/* core/repositorio — único ponto do sistema que toca em armazenamento
 * (Supabase: base do campeonato, sessão do organizador, foto do jogador).
 * Trocar de backend um dia é mexer só aqui. */
import { supabase } from "../supabase";
import { baseOficial } from "../data/baseOficial";
import { CONFIG_PADRAO } from "./regras";

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

async function salvarBase(b) {
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

/* Apaga só a linha de "perfis" (revoga acesso) — a conta de login em si
 * (auth.users) continua existindo, fora do alcance do app sem a chave
 * secreta do Supabase; pra apagar o login de verdade é pelo painel do
 * Supabase (Authentication → Users → Delete user). Precisa da policy de
 * DELETE em supabase-migracoes/003-*. */
async function excluirPerfil(perfilId) {
  try {
    const { error } = await supabase.from("perfis").delete().eq("id", perfilId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Falha ao excluir perfil:", e);
    return false;
  }
}

/* Foto do jogador — bucket "avatares" no Supabase Storage. Se o bucket ainda
 * não foi criado no projeto (ver instruções passadas à parte), o upload falha
 * de forma controlada e a tela mostra aviso, sem quebrar o cadastro. */
async function enviarFotoJogador(jogadorId, arquivo) {
  const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
  const caminho = `${jogadorId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatares").upload(caminho, arquivo, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("avatares").getPublicUrl(caminho);
  return data.publicUrl;
}

/* Lances (replay de gols) — tabela "lances" + bucket privado "lances".
 * Ver supabase-migracoes/004-*: qualquer aprovado grava e lê, só organizador
 * apaga; o vídeo em si só sai por link assinado (createSignedUrl), nunca
 * público. Clipes de teste usam partidaId = "teste-camera". */
async function enviarLance({ modalidade, partidaId, tipo, jogadorId, jogadorNome, angulo, blob, formato }) {
  const ext = (formato || "").startsWith("video/mp4") ? "mp4" : "webm";
  const caminho = `${partidaId}/${Date.now()}-a${angulo}.${ext}`;
  const { error: erroUpload } = await supabase.storage
    .from("lances")
    .upload(caminho, blob, { contentType: formato || "video/webm", upsert: false });
  if (erroUpload) throw erroUpload;

  const { data: s } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("lances")
    .insert({
      modalidade,
      partida_id: partidaId,
      tipo,
      jogador_id: jogadorId || null,
      jogador_nome: jogadorNome || null,
      angulo,
      caminho_storage: caminho,
      formato: formato || "video/webm",
      criado_por: s?.session?.user?.id || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function listarLances(partidaId) {
  try {
    let q = supabase.from("lances").select("*").order("criado_em", { ascending: false });
    if (partidaId) q = q.eq("partida_id", partidaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Falha ao listar lances:", e);
    return [];
  }
}

async function urlAssinadaLance(caminhoStorage, segundos = 3600) {
  const { data, error } = await supabase.storage.from("lances").createSignedUrl(caminhoStorage, segundos);
  if (error) throw error;
  return data.signedUrl;
}

async function excluirLance(lance) {
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
  carregarBase, salvarBase, enviarFotoJogador, id, migrarBase, buscarPerfil,
  listarPerfis, decidirPerfil, excluirPerfil,
  enviarLance, listarLances, urlAssinadaLance, excluirLance,
};
