import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { listarLances, excluirLance } from "../core/repositorio";
import { Botao, Painel, CabecalhoPagina, Segmento } from "../components/ui";
import { ListaClipes } from "./lances/ListaClipes";

/* =============================== TELA: GALERIA ===========================
 * Aba "Lances" — todo jogador aprovado assiste/baixa os clipes (doc 5.4).
 * Quem vai disponibilizar o celular como câmera abre o link ?camera=1
 * (TelaCamera), fora da navegação. A gravação em si nunca some daqui: se o
 * Supabase falhar, a lista só vem vazia.
 * ======================================================================== */

const msgErro = (e) => e?.message || e?.error_description || String(e);

const FILTROS = [
  { valor: "rachao", rotulo: "Rachão" },
  { valor: "campeonato", rotulo: "Campeonato" },
  { valor: "teste", rotulo: "Testes" },
];

function TelaGaleria({ perfil, avisar }) {
  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";
  const [filtro, setFiltro] = useState("rachao");
  const [lances, setLances] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const timerRef = useRef(null);

  const carregar = (f = filtro) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const consulta = f === "teste" ? { partidaId: "teste-camera" } : { modalidade: f };
      setLances(await listarLances(consulta));
      setCarregando(false);
    }, 200);
  };

  useEffect(() => { setCarregando(true); carregar(filtro); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* agrupa por partida (partida_rotulo), na ordem do mais recente. */
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const l of lances) {
      const chave = l.partida_id;
      if (!mapa.has(chave)) {
        mapa.set(chave, { chave, rotulo: l.partida_rotulo || l.partida_id, itens: [], quando: l.criado_em });
      }
      mapa.get(chave).itens.push(l);
    }
    return [...mapa.values()].sort((a, b) => (a.quando < b.quando ? 1 : -1));
  }, [lances]);

  async function apagar(l) {
    if (!confirm("Apagar este clipe de vez (vídeo + registro)?")) return;
    try {
      await excluirLance(l);
      carregar();
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

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Lances" descricao="Clipes de gols e lances gravados pelas câmeras. Ficam disponíveis por 5 dias." />

      {erro && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)" }}>
          <p style={{ fontSize: 12.5, color: T.vermelho }}>{erro}</p>
        </Painel>
      )}

      <Segmento valor={filtro} onChange={setFiltro} opcoes={FILTROS} />

      {souOrganizador && (
        <Painel className="p-3">
          <p style={{ fontSize: 11.5, color: T.secundario, lineHeight: 1.4 }}>
            Pra usar um celular como câmera de teste, mande este link pra quem vai disponibilizar o aparelho
            (precisa ter login aprovado). No Rachão, o link certo da partida do dia sai na própria tela do Rachão.
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
          vazio={filtro === "teste" ? "Nenhum clipe de teste." : "Nenhum lance gravado ainda nesta modalidade."}
          souOrganizador={souOrganizador}
          onApagar={apagar}
        />
      )}
    </div>
  );
}

export { TelaGaleria };
