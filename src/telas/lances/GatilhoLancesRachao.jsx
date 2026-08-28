import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import { T } from "../../theme";
import { id as gerarId } from "../../core/repositorio";
import { Botao, Painel, Segmento } from "../../components/ui";

/* ===================== GATILHO DE LANCES — RACHÃO =======================
 * Botão "Gravar lance" na tela do Rachão. Dispara a gravação nas câmeras
 * (canal Realtime da partida do dia) e classifica o lance.
 *
 * ISOLAMENTO: tudo aqui é try/catch e não toca em NADA do jogo. Se o
 * Realtime cair, o botão simplesmente não faz efeito — a fila, o placar e o
 * resultado do Rachão seguem 100% normais. Este componente pode ser
 * removido inteiro sem afetar o resto da tela.
 * ====================================================================== */

function rotuloDoDia(data) {
  try {
    return "Rachão · " + new Date(data + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long",
    });
  } catch {
    return "Rachão";
  }
}

function GatilhoLancesRachao({ sessao, nomes, souOrganizador, avisar }) {
  const partidaId = `rachao-${sessao?.id || "sem-id"}`;
  const rotulo = rotuloDoDia(sessao?.data);
  const canalRef = useRef(null);
  const [conectado, setConectado] = useState(false);
  const [aberto, setAberto] = useState(false); // painel de classificação
  const [capturaId, setCapturaId] = useState(null);
  const [tipo, setTipo] = useState("gol");
  const [jogadorId, setJogadorId] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!sessao?.id) return;
    let vivo = true;
    try {
      const canal = supabase.channel(`lances:${partidaId}`, { config: { broadcast: { self: false } } });
      canal.subscribe((status) => { if (vivo && status === "SUBSCRIBED") setConectado(true); });
      canalRef.current = canal;
    } catch (e) {
      console.warn("Lances: canal do Rachão não abriu (sem efeito no jogo):", e);
    }
    return () => {
      vivo = false;
      try { if (canalRef.current) supabase.removeChannel(canalRef.current); } catch {}
      canalRef.current = null;
    };
  }, [sessao?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function enviar(evento, payload) {
    try { canalRef.current?.send({ type: "broadcast", event: evento, payload }); }
    catch (e) { console.warn("Lances: falha ao enviar sinal (sem efeito no jogo):", e); }
  }

  function gravarLance() {
    const cid = gerarId();
    setCapturaId(cid);
    setTipo("gol");
    setJogadorId("");
    setAberto(true);
    enviar("disparo", { id: cid, modalidade: "rachao", partidaRotulo: rotulo });
    avisar?.("Gravando lance…");
  }

  function confirmar() {
    if (!capturaId) return;
    enviar("decisao", {
      id: capturaId,
      acao: "salvar",
      tipo,
      jogadorNome: jogadorId ? nomes?.[jogadorId] || null : null,
    });
    avisar?.("Lance salvo — as câmeras estão enviando");
    fechar();
  }

  function descartar() {
    if (capturaId) enviar("decisao", { id: capturaId, acao: "descartar" });
    fechar();
  }

  function fechar() {
    setAberto(false);
    setCapturaId(null);
  }

  function copiarLink() {
    const url = `${window.location.origin}${window.location.pathname}?camera=1&p=${encodeURIComponent(partidaId)}&r=${encodeURIComponent(rotulo)}`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); },
      () => avisar?.("Não copiou. Link: " + url)
    );
  }

  const presentes = [...(sessao?.linha || []), ...(sessao?.goleiros || [])]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => (nomes?.[a] || "").localeCompare(nomes?.[b] || "", "pt-BR"));

  return (
    <Painel className="space-y-2 p-3" style={{ borderColor: T.tier4 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span className="font-destaque" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.ouro }}>
          Câmeras
        </span>
        <span style={{ fontSize: 10, color: conectado ? T.verde : T.fraco }}>
          {conectado ? "conectado" : "conectando…"}
        </span>
      </div>

      {!aberto ? (
        <>
          <Botao className="w-full" onClick={gravarLance} disabled={!conectado} style={{ minHeight: 52 }}>
            Gravar lance
          </Botao>
          {souOrganizador && (
            <Botao variante="secundario" className="w-full" onClick={copiarLink} style={{ minHeight: 38, fontSize: 10.5 }}>
              {copiado ? "Link copiado ✓" : "Copiar link de câmera desta partida"}
            </Botao>
          )}
          <p style={{ fontSize: 10, color: T.fraco, lineHeight: 1.4 }}>
            Ao tocar, as câmeras já gravam os ~20s do lance. Depois você classifica — o vídeo espera a decisão.
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <p style={{ fontSize: 11, color: T.verde }}>Capturando nas câmeras… classifique:</p>
          <Segmento valor={tipo} onChange={setTipo} opcoes={[{ valor: "gol", rotulo: "Gol" }, { valor: "lance", rotulo: "Lance" }]} />
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)}
            style={{ width: "100%", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: "10px", color: T.texto, fontSize: 14 }}>
            <option value="">— sem jogador —</option>
            {presentes.map((jid) => <option key={jid} value={jid}>{nomes?.[jid] || "?"}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={confirmar} style={{ minHeight: 44 }}>Salvar</Botao>
            <Botao variante="secundario" onClick={descartar} style={{ minHeight: 44 }}>Descartar</Botao>
          </div>
        </div>
      )}
    </Painel>
  );
}

export { GatilhoLancesRachao };
