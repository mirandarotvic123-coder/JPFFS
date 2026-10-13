// ============================================================================
// JPFFS — Edge Function "lances-r2"
// ----------------------------------------------------------------------------
// Os vídeos de lance moram no Cloudflare R2 (plano gratuito: 10 GB e download
// SEM custo de egress), não mais no Supabase Storage — o free do Supabase dá só
// 5 GB/mês de download e estourou em out/2026 (12,7 GB num ciclo).
//
// O app nunca vê a chave do R2. Esta função confere o login e devolve links
// ASSINADOS de curta duração:
//   { acao: "upload", partidaId, angulo, ext }  -> { key, url }  (PUT, 15 min)
//   { acao: "ver", caminhos: [..] }              -> { urls: { caminho: url } } (GET, 1 h)
//   { acao: "apagar", id }                       -> { ok }  (só organizador)
//
// Quem pode: "upload"/"ver" = qualquer aprovado (eh_aprovado());
// "apagar" = organizador (eh_organizador_aprovado()). As duas funções e a RLS
// da tabela "lances" são as mesmas do 004 — esta função roda com o login de
// quem chamou (Authorization do app), então a RLS vale aqui também.
//
// Secrets (Painel → Edge Functions → Secrets):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// SUPABASE_URL e SUPABASE_ANON_KEY o Supabase injeta sozinho.
// Deploy com "Verify JWT" LIGADO (padrão).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) ?? "";
const BUCKET = env("R2_BUCKET") || "jpffs-lances";
const ENDPOINT = `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${BUCKET}`;
const r2 = new AwsClient({
  accessKeyId: env("R2_ACCESS_KEY_ID"),
  secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});

const urlObjeto = (key: string) => `${ENDPOINT}/${key.split("/").map(encodeURIComponent).join("/")}`;

async function assinar(metodo: "GET" | "PUT", key: string, segundos: number) {
  const url = new URL(urlObjeto(key));
  url.searchParams.set("X-Amz-Expires", String(segundos));
  const req = await r2.sign(new Request(url, { method: metodo }), { aws: { signQuery: true } });
  return req.url;
}

// partida_id vem do app (ex.: "rachao-tig80s1o", "camp-<rodada>-<jogo>", "teste-camera")
const PARTIDA_OK = /^[A-Za-z0-9_-]{1,100}$/;
const EXT_OK = new Set(["mp4", "webm"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "método não suportado" }, 405);
  if (!env("R2_ACCOUNT_ID") || !env("R2_ACCESS_KEY_ID") || !env("R2_SECRET_ACCESS_KEY")) {
    return json({ erro: "R2 não configurado (faltam secrets)" }, 503);
  }

  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return json({ erro: "corpo inválido" }, 400); }

  try {
    if (corpo.acao === "upload") {
      const { data: aprovado } = await sb.rpc("eh_aprovado");
      if (!aprovado) return json({ erro: "sem permissão" }, 403);
      const partidaId = String(corpo.partidaId ?? "");
      const angulo = Math.max(1, Math.min(20, Number(corpo.angulo) || 1));
      const ext = String(corpo.ext ?? "");
      if (!PARTIDA_OK.test(partidaId) || !EXT_OK.has(ext)) return json({ erro: "parâmetros inválidos" }, 400);
      const key = `${partidaId}/${Date.now()}-a${angulo}.${ext}`;
      return json({ key, url: await assinar("PUT", key, 15 * 60) });
    }

    if (corpo.acao === "ver") {
      const pedidos = Array.isArray(corpo.caminhos) ? corpo.caminhos.map(String).slice(0, 12) : [];
      if (!pedidos.length) return json({ urls: {} });
      // só assina o que existe na tabela — a RLS já barra quem não é aprovado
      const { data, error } = await sb
        .from("lances")
        .select("caminho_storage")
        .eq("armazenamento", "r2")
        .in("caminho_storage", pedidos);
      if (error) return json({ erro: error.message }, 403);
      const urls: Record<string, string> = {};
      for (const l of data ?? []) urls[l.caminho_storage] = await assinar("GET", l.caminho_storage, 60 * 60);
      return json({ urls });
    }

    if (corpo.acao === "apagar") {
      const { data: org } = await sb.rpc("eh_organizador_aprovado");
      if (!org) return json({ erro: "só o organizador apaga" }, 403);
      const { data: l, error } = await sb
        .from("lances")
        .select("id, caminho_storage, armazenamento")
        .eq("id", String(corpo.id ?? ""))
        .maybeSingle();
      if (error || !l) return json({ erro: error?.message || "lance não encontrado" }, 404);
      // clipe antigo do Supabase Storage é apagado pelo próprio app (excluirLance)
      if (l.armazenamento !== "r2") return json({ erro: "clipe não está no R2" }, 400);
      const resp = await r2.fetch(urlObjeto(l.caminho_storage), { method: "DELETE" });
      if (!resp.ok && resp.status !== 404) return json({ erro: `R2 ${resp.status}` }, 502);
      const { error: eDel } = await sb.from("lances").delete().eq("id", l.id);
      if (eDel) return json({ erro: eDel.message }, 403);
      return json({ ok: true });
    }

    return json({ erro: "ação desconhecida" }, 400);
  } catch (e) {
    console.error("lances-r2:", (e as Error)?.message || e);
    return json({ erro: "falha interna" }, 500);
  }
});
