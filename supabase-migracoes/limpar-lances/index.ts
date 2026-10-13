// ============================================================================
// JPFFS — Edge Function "limpar-lances"
// ----------------------------------------------------------------------------
// Apaga clipes de lance:
//   1) mais velhos que 3 dias (retenção combinada na doc);
//   2) os mais antigos, se o armazenamento passar do limite de espaço.
//
// Desde out/2026 os vídeos novos vão pro Cloudflare R2 (free: 10 GB, download
// sem custo) — coluna "armazenamento" = 'r2'. Os antigos ('supabase') ficam no
// bucket "lances" do Supabase (free: 1 GB) até a retenção apagar. Cada um tem
// sua trava de espaço (ver TRAVAS).
//
// A trava de espaço NÃO mexe em clipe recente (< PROTEGE_HORAS) enquanto o uso
// estiver abaixo do teto. Antes ela apagava "os mais antigos" sem olhar a
// idade: no dia 10/10/2026 (Campeonato + Rachão, 4 câmeras, ~100 arquivos) o
// bucket passou de 850 MB no meio do Rachão e a limpeza apagou os lances do
// Campeonato gravados horas antes. A cota dos dois planos é medida como média
// no mês, então passar um pouco do limite num dia de jogo é bem menos grave do
// que perder os lances do dia.
//
// Roda a cada 30 min via Cron Job (ver 006-lances-prod.sql).
// Responde na hora (200) e faz a limpeza em segundo plano com
// EdgeRuntime.waitUntil — assim o timeout curto do Cron (máx. 5s) não é
// problema.
//
// Apaga o ARQUIVO primeiro e só depois a linha da tabela — se apagar o
// arquivo falhar, a linha fica e a próxima execução tenta de novo.
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Supabase.
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET são os
// mesmos secrets da função "lances-r2".
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const RETENCAO_DIAS = 3;
const PROTEGE_HORAS = 24; // clipe mais novo que isso só sai se o uso passar do teto
const LOTE = 100;
const MB = 1024 * 1024;

// limite: começa a expurgar | alvo: expurga até baixar disso | teto: só aqui encosta nos recentes
const TRAVAS = {
  supabase: { rpc: "uso_bucket_lances", limite: 850 * MB, alvo: 650 * MB, teto: 1536 * MB },
  r2: { rpc: "uso_r2_lances", limite: 8 * 1024 * MB, alvo: 6.5 * 1024 * MB, teto: 9.5 * 1024 * MB },
} as const;
type Armazenamento = keyof typeof TRAVAS;
type Linha = { id: string; caminho_storage: string; armazenamento: Armazenamento };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) ?? "";
const R2_ENDPOINT = `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${env("R2_BUCKET") || "jpffs-lances"}`;
const r2 = env("R2_ACCESS_KEY_ID")
  ? new AwsClient({ accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" })
  : null;

async function apagarNoR2(key: string) {
  if (!r2) throw new Error("R2 não configurado (faltam secrets)");
  const url = `${R2_ENDPOINT}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const resp = await r2.fetch(url, { method: "DELETE" });
  if (!resp.ok && resp.status !== 404) throw new Error(`R2 DELETE ${resp.status}`);
}

async function limpar() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) { console.error("faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); return; }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let removidos = 0;

  async function expurgar(linhas: Linha[]) {
    if (!linhas.length) return;
    const doSupabase = linhas.filter((l) => l.armazenamento !== "r2");
    const doR2 = linhas.filter((l) => l.armazenamento === "r2");
    const apagados: string[] = [];

    if (doSupabase.length) {
      const { error } = await sb.storage.from("lances").remove(doSupabase.map((l) => l.caminho_storage));
      if (error) console.error("storage.remove:", error.message); // tenta de novo no próximo run
      else apagados.push(...doSupabase.map((l) => l.id));
    }
    for (let i = 0; i < doR2.length; i += 10) {
      const lote = doR2.slice(i, i + 10);
      const res = await Promise.allSettled(lote.map((l) => apagarNoR2(l.caminho_storage)));
      res.forEach((r, k) => {
        if (r.status === "fulfilled") apagados.push(lote[k].id);
        else console.error("r2.delete:", (r.reason as Error)?.message || r.reason);
      });
    }

    if (!apagados.length) return;
    const { error: eLinha } = await sb.from("lances").delete().in("id", apagados);
    if (eLinha) { console.error("lances.delete:", eLinha.message); return; }
    removidos += apagados.length;
  }

  const usoBytes: Record<string, number> = {};
  try {
    // 1) retenção — mais velhos que RETENCAO_DIAS (nos dois armazenamentos)
    const corte = new Date(Date.now() - RETENCAO_DIAS * 86_400_000).toISOString();
    for (let i = 0; i < 20; i++) {
      const { data, error } = await sb
        .from("lances")
        .select("id, caminho_storage, armazenamento")
        .lt("criado_em", corte)
        .limit(LOTE);
      if (error) { console.error(error.message); break; }
      if (!data || data.length === 0) break;
      const antes = removidos;
      await expurgar(data as Linha[]);
      if (removidos === antes || data.length < LOTE) break; // nada saiu: não fica em loop
    }

    // 2) espaço — por armazenamento: se acima do limite, apaga os mais antigos
    //    até baixar do alvo, poupando as últimas PROTEGE_HORAS abaixo do teto
    const corteRecente = new Date(Date.now() - PROTEGE_HORAS * 3_600_000).toISOString();
    for (const [onde, t] of Object.entries(TRAVAS) as [Armazenamento, (typeof TRAVAS)[Armazenamento]][]) {
      const { data: uso } = await sb.rpc(t.rpc);
      let bytes = Number(uso ?? 0);
      let voltas = 0;
      while (bytes > t.limite && voltas < 40) {
        voltas++;
        let q = sb
          .from("lances")
          .select("id, caminho_storage, armazenamento")
          .eq("armazenamento", onde)
          .order("criado_em", { ascending: true })
          .limit(bytes > t.teto ? 10 : 50);
        if (bytes <= t.teto) q = q.lt("criado_em", corteRecente);
        const { data } = await q;
        if (!data || data.length === 0) break;
        await expurgar(data as Linha[]);
        const { data: uso2 } = await sb.rpc(t.rpc);
        const novo = Number(uso2 ?? 0);
        if (novo >= bytes) break; // não baixou nada — evita loop infinito
        bytes = novo;
        if (bytes <= t.alvo) break;
      }
      usoBytes[onde] = bytes;
    }

    console.log(`limpar-lances: removidos=${removidos} bytes_supabase=${usoBytes.supabase} bytes_r2=${usoBytes.r2}`);
  } catch (e) {
    console.error("limpar-lances:", (e as Error)?.message || e);
  }
}

Deno.serve(() => {
  // roda em segundo plano; responde na hora pro Cron não estourar o timeout
  // @ts-ignore EdgeRuntime é fornecido pelo Supabase
  EdgeRuntime.waitUntil(limpar());
  return json({ ok: true, iniciado: true });
});
