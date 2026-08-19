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

const id = () => Math.random().toString(36).slice(2, 10);

function migrarBase(base) {
  const b = { ...baseOficial(), ...base, config: { ...CONFIG_PADRAO, ...(base.config || {}), pesos: { ...CONFIG_PADRAO.pesos, ...(base.config?.pesos || {}) } } };
  b.restricoes = b.restricoes || [];
  b.historicoInicial = base.historicoInicial || { rodadas: 0, jogadores: {} };
  b.jogadores = (b.jogadores || []).map((j) => ({ ...j, posicao: /goleiro/i.test(j.posicao || "") ? "GOLEIRO" : "LINHA", convidado: !!j.convidado }));
  b.rodadas = (b.rodadas || []).map((r) => ({
    ...r, ajustes: r.ajustes || [], times: r.times || [],
    jogos: (r.jogos || []).map((g) => ({ ...g, soCartoes: g.soCartoes || [], golsNaoComputadosA: g.golsNaoComputadosA || 0, golsNaoComputadosB: g.golsNaoComputadosB || 0 })),
  }));
  return b;
}
export { carregarBase, salvarBase, enviarFotoJogador, id, migrarBase };
