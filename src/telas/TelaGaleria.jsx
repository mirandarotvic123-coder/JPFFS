import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { listarLances, excluirLance } from "../core/repositorio";
import { Botao, Painel, CabecalhoPagina, Segmento } from "../components/ui";
import { ListaClipes } from "./lances/ListaClipes";

/* =============================== TELA: GALERIA ===========================
 * Aba "Lances" — todo jogador aprovado assiste/baixa os clipes (doc 5.4).
 * Só o organizador apaga; jogador comum vê e baixa, nada mais.
 * Quem vai disponibilizar o celular como câmera abre o link ?camera=1
 * (TelaCamera), fora da navegação. A gravação em si nunca some daqui: se o
 * Supabase falhar, a lista só não atualiza.
 * ======================================================================== */

const msgErro = (e) => e?.message || e?.error_description || String(e);

const MODALIDADES = [
  { valor: "rachao", rotulo: "Rachão" },
  { valor: "campeonato", rotulo: "Campeonato" },
];
const TIPOS = [
  { valor: "todos", rotulo: "Tudo" },
  { valor: "gol", rotulo: "Gols" },
  { valor: "lance", rotulo: "Lances" },
];

const CAMPO = {
  width: "100%", background: T.tier2, border: `1px solid ${T.tier4}`,
  borderRadius: 8, padding: "9px 10px", color: T.texto, fontSize: 13,
};

function TelaGaleria({ perfil, avisar }) {
  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";
  const [modalidade, setModalidade] = useState("rachao");
  const [tipoF, setTipoF] = useState("todos");
  const [jogadorF, setJogadorF] = useState("");
  const [lances, setLances] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const timerRef = useRef(null);
  const modalidadeRef = useRef(modalidade);
  useEffect(() => { modalidadeRef.current = modalidade; }, [modalidade]);

  /* `forcar` = pode zerar a lista (troca de aba, exclusão). Sem ele, uma
   * resposta vazia passageira (token renovando, rede) não apaga o que já
   * está na tela — era o "some e volta com refresh". */
  const carregar = ({ forcar = false } = {}) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const dados = await listarLances({ modalidade: modalidadeRef.current });
      setLances((prev) => (!forcar && dados.length === 0 && prev.length > 0 ? prev : dados));
      setCarregando(false);
    }, 200);
  };

  useEffect(() => {
    setCarregando(true);
    setJogadorF("");
    carregar({ forcar: true });
  }, [modalidade]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const aoFocar = () => { if (document.visibilityState === "visible") carregar(); };
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener("focus", aoFocar);
    // atualiza sozinha quando entra/sai clipe (Realtime na tabela — ver 006)
    const canal = supabase
      .channel("galeria-lances")
      .on("postgres_changes", { event: "*", schema: "public", table: "lances" }, () => carregar())
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener("focus", aoFocar);
      supabase.removeChannel(canal);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* jogadores que têm pelo menos um clipe atribuído (pra popular o filtro) */
  const jogadoresComClipe = useMemo(() => {
    const s = new Set();
    for (const l of lances) {
      const n = (l.jogador_nome || "").trim();
      if (n) s.add(n);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lances]);

  const lancesFiltrados = useMemo(
    () => lances.filter((l) => {
      if (tipoF !== "todos" && l.tipo !== tipoF) return false;
      if (jogadorF && (l.jogador_nome || "").trim() !== jogadorF) return false;
      return true;
    }),
    [lances, tipoF, jogadorF]
  );

  /* agrupa por partida (partida_rotulo), do mais recente pro mais antigo. */
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const l of lancesFiltrados) {
      const chave = l.partida_id;
      if (!mapa.has(chave)) {
        mapa.set(chave, { chave, rotulo: l.partida_rotulo || l.partida_id, itens: [], quando: l.criado_em });
      }
      mapa.get(chave).itens.push(l);
    }
    return [...mapa.values()].sort((a, b) => (a.quando < b.quando ? 1 : -1));
  }, [lancesFiltrados]);

  async function apagar(l) {
    if (!confirm("Apagar este clipe de vez (vídeo + registro)?")) return;
    try {
      await excluirLance(l);
      carregar({ forcar: true });
      avisar?.("Clipe apagado");
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  function copiarLinkCamera() {
    const url = `${window.location.origin}${window.location.pathname}?camera=1`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); },
      () => setErro("Não consegui copiar. O link é: " + url)
    );
  }

  const temFiltro = tipoF !== "todos" || jogadorF;

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Lances" descricao="Clipes de gols e lances gravados pelas câmeras. Ficam disponíveis por 5 dias." />

      {erro && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)" }}>
          <p style={{ fontSize: 12.5, color: T.vermelho }}>{erro}</p>
        </Painel>
      )}

      <Segmento valor={modalidade} onChange={setModalidade} opcoes={MODALIDADES} />

      <div className="space-y-2">
        <Segmento valor={tipoF} onChange={setTipoF} opcoes={TIPOS} />
        <select value={jogadorF} onChange={(e) => setJogadorF(e.target.value)} style={CAMPO}>
          <option value="">Todos os jogadores</option>
          {jogadoresComClipe.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {souOrganizador && (
        <Painel className="p-3">
          <p style={{ fontSize: 11.5, color: T.secundario, lineHeight: 1.4 }}>
            Pra usar um celular como câmera de teste, mande este link pra quem vai disponibilizar o aparelho
            (precisa ter login aprovado). No Rachão/Campeonato, o link certo da partida sai na própria tela dela.
          </p>
          <Botao variante="secundario" className="mt-2 w-full" onClick={copiarLinkCamera} style={{ minHeight: 42, fontSize: 11 }}>
            {copiado ? "Link copiado ✓" : "Copiar link de câmera (teste)"}
          </Botao>
        </Painel>
      )}

      {carregando ? (
        <p style={{ padding: 12, textAlign: "center", fontSize: 12, color: T.fraco }}>Carregando…</p>
      ) : (
        <ListaClipes
          grupos={grupos}
          titulo="Clipes"
          vazio={temFiltro ? "Nenhum clipe com esse filtro." : "Nenhum lance gravado ainda nesta modalidade."}
          souOrganizador={souOrganizador}
          onApagar={apagar}
        />
      )}
    </div>
  );
}

export { TelaGaleria };
