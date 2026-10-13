/* core/repositorio — único ponto do sistema que toca em armazenamento
 * (Supabase: base do campeonato, sessão do organizador, foto do jogador).
 * Trocar de backend um dia é mexer só aqui. */
import { supabase } from "../supabase";
import { baseOficial } from "../data/baseOficial";
import { CONFIG_PADRAO } from "./regras";
import { copaHendor2026 } from "../data/copaHendor2026";

/* --- infra/repositorio (Supabase) ---------------------------------------*/

async function carregarBase() {
  try {
    const { data, error } = await supabase
      .from("base")
      .select("dados")
      .eq("id", 1)
      .single();
    if (error) throw error;
    const b = data?.dados;
    return b && Object.keys(b).length ? migrarBase(b) : null;
  } catch (e) {
    console.error("Falha ao carregar a base:", e);
    return null;
  }
}

/* ?simulacao=1 na URL → ensaio: lê a base normalmente, mas NADA é gravado (nem no banco, nem
 * no backup local) e o tempo real é ignorado. Serve pra testar a Copa/Rachão com jogo de
 * mentira sem sujar os dados de produção — o `npm run dev` fala com o mesmo Supabase. */
const SIMULACAO = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("simulacao") === "1";

async function salvarBase(b) {
  if (SIMULACAO) return true;
  try { localStorage.setItem("jpffs:backup", JSON.stringify({ dados: b, em: Date.now() })); } catch { }

  const gravar = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) return "sem-sessao";
    const { error } = await supabase
      .from("base")
      .update({ dados: b, atualizado_em: new Date().toISOString(), atualizado_por: s.session.user.email || null })
      .eq("id", 1);
    if (error) throw error;
    return true;
  };

  try {
    return (await gravar()) === true;
  } catch (e) {
    console.warn("Falha ao salvar, tentando de novo…", e);
    await new Promise((r) => setTimeout(r, 1200));
    try { return (await gravar()) === true; }
    catch (e2) { console.error("Falha ao salvar a base (persistido só localmente):", e2); return false; }
  }
}
/* Perfil de login (tabela "perfis") — papel (jogador/organizador) e status
 * (pendente/aprovado/recusado) de cada conta. Ver supabase-migracoes/001-*
 * pro desenho completo: quem se cadastra sozinho ("Criar usuário") entra
 * como jogador/pendente e só enxerga a Tabela depois que um organizador
 * aprova; a segurança de verdade é a RLS no banco, isto aqui só busca/decide. */
async function buscarPerfil(userId) {
  try {
    const { data, error } = await supabase.from("perfis").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("Falha ao carregar perfil:", e);
    return null;
  }
}

async function listarPerfis() {
  try {
    const { data, error } = await supabase.from("perfis").select("*").order("criado_em", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Falha ao listar perfis:", e);
    return [];
  }
}

async function decidirPerfil(perfilId, status, decididoPorId) {
  try {
    const { error } = await supabase.from("perfis")
      .update({ status, decidido_em: new Date().toISOString(), decidido_por: decididoPorId })
      .eq("id", perfilId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Falha ao decidir perfil:", e);
    return false;
  }
}

/* Revogar acesso = decidirPerfil(id, "recusado"). NÃO existe mais um
 * "excluir de vez" pelo app: apagar só a linha de "perfis" deixava o login
 * (auth.users) órfão — a pessoa continuava conseguindo logar e caía num
 * limbo ("cadastro em análise" pra sempre), sem aparecer na lista do
 * organizador. Pra apagar o login por completo é pelo painel do Supabase
 * (Authentication → Users → Delete user). */

/* Foto do jogador — bucket "avatares" no Supabase Storage. Se o bucket ainda
 * não foi criado no projeto (ver instruções passadas à parte), o upload falha
 * de forma controlada e a tela mostra aviso, sem quebrar o cadastro. */
/* Foto de celular chega com 2–5 MB e aparece em toda lista do app — cada
 * abertura baixava tudo de novo (conta no egress do Supabase). Reduz pra no
 * máximo 512px em JPEG (~40–80 KB) antes de subir. Se o navegador não conseguir
 * ler a imagem (ex.: HEIC em desktop), sobe o original. */
const FOTO_MAX_PX = 512;

async function reduzirFoto(arquivo) {
  try {
    const url = URL.createObjectURL(arquivo);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const escala = Math.min(1, FOTO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < arquivo.size ? { blob, ext: "jpg" } : null;
  } catch {
    return null;
  }
}

async function enviarFotoJogador(jogadorId, arquivo) {
  const reduzida = await reduzirFoto(arquivo);
  const ext = reduzida?.ext || (arquivo.name.split(".").pop() || "jpg").toLowerCase();
  const caminho = `${jogadorId}-${Date.now()}.${ext}`;
  // caminho muda a cada foto nova -> pode ficar em cache no aparelho por 30 dias
  const { error } = await supabase.storage.from("avatares").upload(caminho, reduzida?.blob || arquivo, {
    upsert: true, cacheControl: "2592000", ...(reduzida ? { contentType: "image/jpeg" } : {}),
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatares").getPublicUrl(caminho);
  return data.publicUrl;
}

/* Lances (replay de gols) — metadados na tabela "lances" (Supabase) e o
 * VÍDEO no Cloudflare R2 (desde out/2026; o egress do Supabase free estourou).
 * Ver supabase-migracoes/004-*, 008-* e lances-r2/: qualquer aprovado grava e
 * lê, só organizador apaga. O vídeo só sai por link assinado de curta duração,
 * gerado pela Edge Function "lances-r2" (o app nunca vê a chave do R2).
 * Coluna "armazenamento": 'r2' (novos) ou 'supabase' (antigos, bucket
 * "lances", até a limpeza apagar). Clipes de teste usam partidaId = "teste-camera". */
async function funcaoR2(corpo) {
  const { data, error } = await supabase.functions.invoke("lances-r2", { body: corpo });
  if (error) throw error;
  if (data?.erro) throw new Error(data.erro);
  return data;
}

async function enviarLance({ modalidade, partidaId, partidaRotulo, tipo, jogadorId, jogadorNome, angulo, blob, formato }) {
  const ext = (formato || "").startsWith("video/mp4") ? "mp4" : "webm";
  const contentType = formato || "video/webm";
  let caminho;
  let armazenamento = "r2";
  try {
    const { key, url } = await funcaoR2({ acao: "upload", partidaId, angulo, ext });
    const resp = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
    if (!resp.ok) throw new Error(`R2 respondeu ${resp.status}`);
    caminho = key;
  } catch (e) {
    /* R2 fora do ar ou mal configurado: não perde o lance — guarda no Supabase
     * Storage como antes (conta no egress de lá, mas o clipe fica salvo). */
    console.warn("R2 indisponível, enviando pro Supabase Storage:", e);
    armazenamento = "supabase";
    caminho = `${partidaId}/${Date.now()}-a${angulo}.${ext}`;
    const { error: erroUpload } = await supabase.storage
      .from("lances")
      .upload(caminho, blob, { contentType, upsert: false });
    if (erroUpload) throw erroUpload;
  }

  const { data: s } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("lances")
    .insert({
      modalidade,
      partida_id: partidaId,
      partida_rotulo: partidaRotulo || null,
      tipo,
      jogador_id: jogadorId || null,
      jogador_nome: jogadorNome || null,
      angulo,
      caminho_storage: caminho,
      armazenamento,
      tamanho_bytes: blob.size,
      formato: formato || "video/webm",
      criado_por: s?.session?.user?.id || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Lista clipes. `filtro` pode ser { partidaId }, { partidaPrefixo } (todas as
 * partidas de uma rodada), { desde, ate } (janela de tempo — o link de câmera
 * "do dia" cobre Campeonato + Rachão) ou { modalidade }; sem filtro traz tudo.
 * Nunca lança — devolve [] em erro (a Galeria não pode quebrar). */
async function listarLances(filtro) {
  try {
    let q = supabase.from("lances").select("*").order("criado_em", { ascending: false }).limit(400);
    if (typeof filtro === "string") q = q.eq("partida_id", filtro); // compat: string = partidaId
    else if (filtro?.partidaId) q = q.eq("partida_id", filtro.partidaId);
    else if (filtro?.partidaPrefixo) q = q.like("partida_id", `${filtro.partidaPrefixo}%`);
    else if (filtro?.desde) { q = q.gte("criado_em", filtro.desde); if (filtro.ate) q = q.lt("criado_em", filtro.ate); }
    else if (filtro?.modalidade) q = q.eq("modalidade", filtro.modalidade);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Falha ao listar lances:", e);
    return [];
  }
}

/* Título automático do clipe (formato da doc, seção 5.2):
 *   Tipo — Jogador (ou "sem jogador") — HH:mm — Ângulo N
 * `semAngulo` tira o final — é o título do cartão que junta os ângulos. */
function tituloLance(l, { semAngulo = false } = {}) {
  const tipo = l.tipo === "gol" ? "Gol" : "Lance";
  const jogador = (l.jogador_nome || "").trim() || "sem jogador";
  const hora = new Date(l.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return semAngulo ? `${tipo} — ${jogador} — ${hora}` : `${tipo} — ${jogador} — ${hora} — Ângulo ${l.angulo}`;
}

async function urlAssinadaLance(caminhoStorage, segundos = 3600) {
  const { data, error } = await supabase.storage.from("lances").createSignedUrl(caminhoStorage, segundos);
  if (error) throw error;
  return data.signedUrl;
}

/* Cache dos vídeos NO APARELHO (Cache API). O link assinado muda a cada vez
 * (token novo), então o navegador nunca reaproveitava nada: cada "Ver" e cada
 * "Baixar" baixava o clipe inteiro de novo. Agora cada aparelho baixa cada
 * clipe UMA vez; rever, ver juntos e baixar saem do cache local (mais rápido,
 * poupa o 4G de quem assiste e o egress dos clipes antigos no Supabase).
 * A chave é o caminho no bucket (estável), não a URL assinada. O nome começa
 * com "jpffs-lances" — o sw.js preserva esse cache ao trocar de versão. */
const CACHE_LANCES = "jpffs-lances-v1";
const CACHE_LANCES_DIAS = 7;
const chaveCacheLance = (caminho) => `/__lances__/${caminho}`;

async function abrirCacheLances() {
  try { return typeof caches !== "undefined" ? await caches.open(CACHE_LANCES) : null; }
  catch { return null; } // http sem TLS, aba anônima etc. — segue sem cache
}

/* Link assinado de um clipe, do R2 ou do Supabase conforme "armazenamento". */
async function urlVideoLance(l) {
  if (l.armazenamento === "r2") {
    const { urls } = await funcaoR2({ acao: "ver", caminhos: [l.caminho_storage] });
    const url = urls?.[l.caminho_storage];
    if (!url) throw new Error("vídeo não encontrado");
    return url;
  }
  return urlAssinadaLance(l.caminho_storage, 600);
}

/* `l` = linha da tabela "lances" (precisa de caminho_storage e armazenamento). */
async function blobLance(l) {
  const caminhoStorage = l.caminho_storage;
  const cache = await abrirCacheLances();
  if (cache) {
    try {
      const hit = await cache.match(chaveCacheLance(caminhoStorage));
      if (hit) return await hit.blob();
    } catch { /* cache corrompido — baixa de novo */ }
  }
  const url = await urlVideoLance(l);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("falha ao buscar o vídeo");
  const blob = await resp.blob();
  if (cache) {
    cache.put(chaveCacheLance(caminhoStorage), new Response(blob, {
      headers: { "Content-Type": blob.type || "video/mp4", "X-Salvo-Em": String(Date.now()) },
    })).catch(() => { /* sem espaço — tudo bem, só não fica em cache */ });
  }
  return blob;
}

/* Tira do cache os clipes com mais de CACHE_LANCES_DIAS (o servidor já apagou). */
async function limparCacheLances() {
  const cache = await abrirCacheLances();
  if (!cache) return;
  try {
    const limite = Date.now() - CACHE_LANCES_DIAS * 86_400_000;
    for (const req of await cache.keys()) {
      const r = await cache.match(req);
      if (Number(r?.headers.get("X-Salvo-Em") || 0) < limite) await cache.delete(req);
    }
  } catch { /* nada */ }
}

/* Nome de arquivo amigável pra baixar: "gol-douglas-22-43-angulo-1.mp4" */
function nomeArquivoLance(l) {
  const ext =
    (l?.caminho_storage || "").split(".").pop()?.toLowerCase() ||
    ((l?.formato || "").includes("mp4") ? "mp4" : "webm");
  const slug = tituloLance(l)
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "lance"}.${ext}`;
}

async function excluirLance(lance) {
  abrirCacheLances().then((c) => c?.delete(chaveCacheLance(lance.caminho_storage))).catch(() => {});
  if (lance.armazenamento === "r2") {
    await funcaoR2({ acao: "apagar", id: lance.id }); // apaga o arquivo no R2 e a linha
    return true;
  }
  const { error: erroStorage } = await supabase.storage.from("lances").remove([lance.caminho_storage]);
  if (erroStorage) throw erroStorage;
  const { error } = await supabase.from("lances").delete().eq("id", lance.id);
  if (error) throw error;
  return true;
}

const id = () => Math.random().toString(36).slice(2, 10);

/* corrige texto salvo com "double-encoding" de UTF-8 (ex.: "ClassificaÃ§Ã£o"
 * em vez de "Classificação") — um problema antigo de gravação que ficou preso
 * em alguns registros. Só mexe na string quando reconhece a marca típica da
 * corrupção (Ã/Â seguido de outro byte) e a decodificação bate certinho;
 * caso contrário devolve o texto original intacto. */
function corrigirMojibake(s) {
  if (typeof s !== "string" || !/[ÃÂ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

function migrarBase(base) {
  const b = { ...baseOficial(), ...base, config: { ...CONFIG_PADRAO, ...(base.config || {}), pesos: { ...CONFIG_PADRAO.pesos, ...(base.config?.pesos || {}) } } };
  b.restricoes = b.restricoes || [];
  // Copa Hendor 2026 já cadastrada (oitavas e quartas lançadas): entra uma vez e passa a ser
  // gravada junto com a base no primeiro save de um organizador.
  b.copas = base.copas?.length ? base.copas : [copaHendor2026()];
  b.historicoInicial = base.historicoInicial || { rodadas: 0, jogadores: {} };
  if (b.historicoInicial.descricao) b.historicoInicial = { ...b.historicoInicial, descricao: corrigirMojibake(b.historicoInicial.descricao) };
  b.jogadores = (b.jogadores || []).map((j) => ({ ...j, posicao: /goleiro/i.test(j.posicao || "") ? "GOLEIRO" : "LINHA", convidado: !!j.convidado }));
  b.rodadas = (b.rodadas || []).map((r) => ({
    ...r, ajustes: r.ajustes || [], times: r.times || [], ordemChegada: r.ordemChegada || [],
    jogos: (r.jogos || []).map((g) => ({ ...g, soCartoes: g.soCartoes || [], golsNaoComputadosA: g.golsNaoComputadosA || 0, golsNaoComputadosB: g.golsNaoComputadosB || 0 })),
  }));
  // rachoes NÃO é persistido — o Rachão roda só na memória da tela, dura o dia e "Encerrar
  // jogos do Rachão" descarta tudo. ordemChegada acima é a única ponte com o Campeonato.
  return b;
}
export {
  SIMULACAO, carregarBase, salvarBase, enviarFotoJogador, id, migrarBase, buscarPerfil,
  listarPerfis, decidirPerfil,
  enviarLance, listarLances, urlAssinadaLance, blobLance, limparCacheLances, excluirLance, tituloLance, nomeArquivoLance,
};
