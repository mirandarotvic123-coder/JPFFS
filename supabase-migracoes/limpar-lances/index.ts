// ============================================================================
// JPFFS — Edge Function "limpar-lances"
// ----------------------------------------------------------------------------
// Apaga clipes de lance:
//   1) mais velhos que 3 dias (retenção — era 5; o grosso das visualizações
//      acontece nos 2 primeiros dias, e menos dias = menos espaço ocupado);
//   2) os mais antigos, se o bucket "lances" passar do limite de espaço
//      (o plano free do Supabase dá 1 GB).
//
// A trava de espaço NÃO mexe em clipe recente (< PROTEGE_HORAS) enquanto o
// bucket estiver abaixo do TETO_BYTES. Antes ela apagava "os mais antigos" sem
// olhar a idade: no dia 10/10/2026 (Campeonato + Rachão, 4 câmeras, ~100
// arquivos) o bucket passou de 850 MB no meio do Rachão e a limpeza apagou os
// lances do Campeonato gravados horas antes. A cota de 1 GB do free é medida
// como média no mês, então passar um pouco do limite num dia de jogo é bem
// menos grave do que perder os lances do dia.
//
// Roda a cada 30 min via Cron Job (ver 006-lances-prod.sql).
// Responde na hora (200) e faz a limpeza em segundo plano com
// EdgeRuntime.waitUntil — assim o timeout curto do Cron (máx. 5s) não é
// problema.
//
// Apaga o ARQUIVO pelo Storage API e só depois a linha da tabela — se o
// storage falhar, a linha fica e a próxima execução tenta de novo.
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Supabase.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RETENCAO_DIAS = 3;
const LIMITE_BYTES = 850 * 1024 * 1024;  // acima disso, começa a expurgar por espaço
const ALVO_BYTES = 650 * 1024 * 1024;    // expurga até baixar disso
const PROTEGE_HORAS = 24;                // clipe mais novo que isso só sai acima do TETO
const TETO_BYTES = 1536 * 1024 * 1024;   // só aqui a trava encosta nos clipes recentes
const LOTE = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function limpar() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) { console.error("faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); return; }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let removidos = 0;

  async function expurgar(linhas: { id: string; caminho_storage: string }[]) {
    if (!linhas.length) return;
    const caminhos = linhas.map((l) => l.caminho_storage);
    const { error: eStorage } = await sb.storage.from("lances").remove(caminhos);
    if (eStorage) { console.error("storage.remove:", eStorage.message); return; } // tenta de novo no próximo run
    const { error: eLinha } = await sb.from("lances").delete().in("id", linhas.map((l) => l.id));
    if (eLinha) { console.error("lances.delete:", eLinha.message); return; }
    removidos += linhas.length;
  }

  try {
    // 1) retenção — mais velhos que RETENCAO_DIAS
    const corte = new Date(Date.now() - RETENCAO_DIAS * 86_400_000).toISOString();
    for (let i = 0; i < 20; i++) {
      const { data, error } = await sb
        .from("lances")
        .select("id, caminho_storage")
        .lt("criado_em", corte)
        .limit(LOTE);
      if (error) { console.error(error.message); break; }
      if (!data || data.length === 0) break;
      await expurgar(data);
      if (data.length < LOTE) break;
    }

    // 2) espaço — se acima do limite, apaga os mais antigos até baixar do alvo,
    //    poupando os das últimas PROTEGE_HORAS enquanto não passar do TETO
    let { data: uso } = await sb.rpc("uso_bucket_lances");
    let bytes = Number(uso ?? 0);
    const corteRecente = new Date(Date.now() - PROTEGE_HORAS * 3_600_000).toISOString();
    let voltas = 0;
    while (bytes > LIMITE_BYTES && voltas < 40) {
      voltas++;
      let q = sb
        .from("lances")
        .select("id, caminho_storage")
        .order("criado_em", { ascending: true })
        .limit(bytes > TETO_BYTES ? 10 : 50);
      if (bytes <= TETO_BYTES) q = q.lt("criado_em", corteRecente);
      const { data } = await q;
      if (!data || data.length === 0) break;
      await expurgar(data);
      const { data: uso2 } = await sb.rpc("uso_bucket_lances");
      const novo = Number(uso2 ?? 0);
      if (novo >= bytes) break; // não baixou nada — evita loop infinito
      bytes = novo;
      if (bytes <= ALVO_BYTES) break;
    }

    console.log(`limpar-lances: removidos=${removidos} bytes_bucket=${bytes}`);
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
