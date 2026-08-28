import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import { T } from "../../theme";
import { id as gerarId } from "../../core/repositorio";
import { Botao, Painel } from "../../components/ui";

/* ================== GATILHO DE LANCES — CAMPEONATO =====================
 * Segue a doc, seção 3:
 *   - "Gol": o organizador indica quem marcou → isso registra o gol de
 *     verdade (mesma via da súmula, via onRegistrarGol) → câmeras gravam →
 *     pergunta "Quer gravar esse gol? Sim/Não". Não = gol continua valendo,
 *     só o vídeo é descartado.
 *   - "Lance": dribles/defesas/falhas — só vídeo, NÃO mexe em estatística.
 *     Escolhe jogador (ou "sem jogador") e confirma.
 *
 * ISOLAMENTO: o canal Realtime e os broadcasts são try/catch e o único
 * efeito no jogo é `onRegistrarGol(jid)` — que é exatamente o mesmo
 * `setEvento(jid,"gols",+1)` que o botão +/- da súmula já usa. Envolver em
 * <LimiteErro>. O canal só abre quando o organizador ativa as câmeras.
 * ===================================================================== */

const CAMPO = { width: "100%", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: "10px", color: T.texto, fontSize: 14 };

function GatilhoLancesCampeonato({ partidaId, partidaRotulo, jogadores = [], onRegistrarGol, souOrganizador, avisar }) {
  const canalRef = useRef(null);
  const [ativo, setAtivo] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [fluxo, setFluxo] = useState(null); // null | "gol-quem" | "gol-gravar" | "lance-classificar"
  const [capturaId, setCapturaId] = useState(null);
  const [jogadorId, setJogadorId] = useState("");
  const [golDe, setGolDe] = useState(null); // { jid, nome }
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!ativo || !partidaId) return;
    let vivo = true;
    try {
      const canal = supabase.channel(`lances:${partidaId}`, { config: { broadcast: { self: false } } });
      canal.subscribe((s) => { if (vivo && s === "SUBSCRIBED") setConectado(true); });
      canalRef.current = canal;
    } catch (e) {
      console.warn("Lances: canal não abriu (sem efeito no jogo):", e);
    }
    return () => {
      vivo = false;
      setConectado(false);
      try { if (canalRef.current) supabase.removeChannel(canalRef.current); } catch {}
      canalRef.current = null;
    };
  }, [ativo, partidaId]);

  function enviar(evento, payload) {
    try { canalRef.current?.send({ type: "broadcast", event: evento, payload }); }
    catch (e) { console.warn("Lances: falha ao enviar sinal (sem efeito no jogo):", e); }
  }

  const jogadoresOrd = [...jogadores].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  function abrirGol() { setJogadorId(""); setGolDe(null); setFluxo("gol-quem"); }
  function abrirLance() {
    const cid = gerarId();
    setCapturaId(cid);
    setJogadorId("");
    setFluxo("lance-classificar");
    enviar("disparo", { id: cid, modalidade: "campeonato", partidaRotulo });
    avisar?.("Gravando lance…");
  }

  function confirmarGolQuem() {
    if (!jogadorId) return;
    const nome = jogadoresOrd.find((j) => j.id === jogadorId)?.nome || null;
    // registra o gol de verdade (mesma via da súmula) — vale pra pontuação/artilharia
    try { onRegistrarGol?.(jogadorId); } catch (e) { console.error("Lances: onRegistrarGol falhou:", e); }
    const cid = gerarId();
    setCapturaId(cid);
    setGolDe({ jid: jogadorId, nome });
    setFluxo("gol-gravar");
    enviar("disparo", { id: cid, modalidade: "campeonato", partidaRotulo });
    avisar?.(`Gol de ${nome || "?"} registrado — gravando…`);
  }

  function decidirGravarGol(sim) {
    if (capturaId) {
      enviar("decisao", sim
        ? { id: capturaId, acao: "salvar", tipo: "gol", jogadorNome: golDe?.nome || null }
        : { id: capturaId, acao: "descartar" });
    }
    if (!sim) avisar?.("Vídeo descartado — o gol continua valendo");
    fechar();
  }

  function salvarLance() {
    if (capturaId) {
      const nome = jogadorId ? (jogadoresOrd.find((j) => j.id === jogadorId)?.nome || null) : null;
      enviar("decisao", { id: capturaId, acao: "salvar", tipo: "lance", jogadorNome: nome });
      avisar?.("Lance salvo — as câmeras estão enviando");
    }
    fechar();
  }
  function descartarLance() {
    if (capturaId) enviar("decisao", { id: capturaId, acao: "descartar" });
    fechar();
  }

  function fechar() { setFluxo(null); setCapturaId(null); setGolDe(null); setJogadorId(""); }

  function copiarLink() {
    const url = `${window.location.origin}${window.location.pathname}?camera=1&p=${encodeURIComponent(partidaId)}&r=${encodeURIComponent(partidaRotulo || "")}`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); },
      () => avisar?.("Não copiou. Link: " + url)
    );
  }

  if (!ativo) {
    return (
      <Botao variante="secundario" className="w-full" onClick={() => setAtivo(true)} style={{ minHeight: 40, fontSize: 10.5 }}>
        Ativar câmeras desta partida
      </Botao>
    );
  }

  return (
    <Painel className="space-y-2 p-3" style={{ borderColor: T.tier4 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span className="font-destaque" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.ouro }}>Câmeras</span>
        <button onClick={() => { setAtivo(false); fechar(); }} style={{ fontSize: 10, color: conectado ? T.verde : T.fraco }}>
          {conectado ? "conectado ✕" : "conectando…"}
        </button>
      </div>

      {fluxo === null && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={abrirGol} disabled={!conectado} style={{ minHeight: 50 }}>Gol</Botao>
            <Botao variante="secundario" onClick={abrirLance} disabled={!conectado} style={{ minHeight: 50 }}>Lance</Botao>
          </div>
          {souOrganizador && (
            <Botao variante="secundario" className="w-full" onClick={copiarLink} style={{ minHeight: 36, fontSize: 10.5 }}>
              {copiado ? "Link copiado ✓" : "Copiar link de câmera desta partida"}
            </Botao>
          )}
          <p style={{ fontSize: 10, color: T.fraco, lineHeight: 1.4 }}>
            <b>Gol</b> registra o gol na súmula + grava o vídeo. <b>Lance</b> é só vídeo, não mexe em nada da pontuação.
          </p>
        </>
      )}

      {fluxo === "gol-quem" && (
        <div className="space-y-2">
          <p style={{ fontSize: 11.5, color: T.secundario }}>Quem marcou?</p>
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)} style={CAMPO}>
            <option value="">— escolher jogador —</option>
            {jogadoresOrd.map((j) => <option key={j.id} value={j.id}>{j.nome || "?"}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={confirmarGolQuem} disabled={!jogadorId} style={{ minHeight: 44 }}>Registrar gol</Botao>
            <Botao variante="secundario" onClick={fechar} style={{ minHeight: 44 }}>Cancelar</Botao>
          </div>
        </div>
      )}

      {fluxo === "gol-gravar" && (
        <div className="space-y-2">
          <p style={{ fontSize: 11.5, color: T.verde }}>
            Gol de <b>{golDe?.nome || "?"}</b> registrado. Câmeras capturando os ~20s.
          </p>
          <p style={{ fontSize: 11.5, color: T.secundario }}>Quer guardar o vídeo desse gol?</p>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={() => decidirGravarGol(true)} style={{ minHeight: 44 }}>Sim, guardar</Botao>
            <Botao variante="secundario" onClick={() => decidirGravarGol(false)} style={{ minHeight: 44 }}>Não</Botao>
          </div>
        </div>
      )}

      {fluxo === "lance-classificar" && (
        <div className="space-y-2">
          <p style={{ fontSize: 11, color: T.verde }}>Capturando nas câmeras… atribuir a um jogador?</p>
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)} style={CAMPO}>
            <option value="">— sem jogador —</option>
            {jogadoresOrd.map((j) => <option key={j.id} value={j.id}>{j.nome || "?"}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={salvarLance} style={{ minHeight: 44 }}>Salvar</Botao>
            <Botao variante="secundario" onClick={descartarLance} style={{ minHeight: 44 }}>Descartar</Botao>
          </div>
        </div>
      )}
    </Painel>
  );
}

export { GatilhoLancesCampeonato };
