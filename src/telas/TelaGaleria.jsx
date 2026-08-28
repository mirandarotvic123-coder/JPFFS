import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { listarLances, excluirLance } from "../core/repositorio";
import { Botao, Painel, CabecalhoPagina } from "../components/ui";
import { ListaClipes } from "./lances/ListaClipes";

/* =============================== TELA: GALERIA ===========================
 * Aba "Lances" pra todo jogador aprovado — só assistir/baixar os clipes.
 * Quem vai DISPONIBILIZAR o celular como câmera abre o link separado
 * (?camera=1), que cai na TelaCamera. Assim a aba não vira bagunça.
 *
 * Ainda em modo de teste: mostra os clipes da partida 'teste-camera'.
 * ======================================================================== */

const PARTIDA_ID = "teste-camera";

const msgErro = (e) => e?.message || e?.error_description || String(e);

function TelaGaleria({ perfil, avisar }) {
  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";
  const [lances, setLances] = useState([]);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const timerRef = useRef(null);

  const carregar = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { listarLances(PARTIDA_ID).then(setLances); }, 250);
  };

  useEffect(() => {
    listarLances(PARTIDA_ID).then(setLances);
    const aoFocar = () => { if (document.visibilityState === "visible") carregar(); };
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener("focus", aoFocar);
    // atualiza sozinho quando uma câmera salva/apaga (mesmo canal da partida)
    const canal = supabase
      .channel(`lances:${PARTIDA_ID}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "salvo" }, () => carregar())
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener("focus", aoFocar);
      supabase.removeChannel(canal);
    };
  }, []);

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
      () => setErro("Não consegui copiar — o link é: " + url)
    );
  }

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Lances"
        descricao="Clipes de gols e lances gravados pelas câmeras. Modo de teste — mostrando a partida “teste-camera”."
      />

      {erro && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)" }}>
          <p style={{ fontSize: 12.5, color: T.vermelho }}>{erro}</p>
        </Painel>
      )}

      {souOrganizador && (
        <Painel className="p-3">
          <p style={{ fontSize: 11.5, color: T.secundario, lineHeight: 1.4 }}>
            Pra usar um celular como câmera, mande este link pra quem vai disponibilizar o aparelho
            (a pessoa precisa ter login aprovado no app):
          </p>
          <Botao variante="secundario" className="mt-2 w-full" onClick={copiarLinkCamera} style={{ minHeight: 42, fontSize: 11 }}>
            {copiado ? "Link copiado ✓" : "Copiar link de câmera"}
          </Botao>
        </Painel>
      )}

      <ListaClipes
        lances={lances}
        titulo="Clipes de teste"
        vazio="Nenhum clipe salvo ainda."
        souOrganizador={souOrganizador}
        onApagar={apagar}
      />
    </div>
  );
}

export { TelaGaleria };
