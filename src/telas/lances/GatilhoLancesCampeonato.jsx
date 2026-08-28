import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { supabase } from "../../supabase";
import { T } from "../../theme";
import { id as gerarId } from "../../core/repositorio";
import { Botao, Painel } from "../../components/ui";

/* ================== GATILHO DE LANCES — CAMPEONATO =====================
 * Segue a doc, seção 3.
 *
 * GOL: registrar o gol é o botão "+" do jogador na própria súmula (uma via
 * só, sem confusão). Quando as câmeras estão ativas, esse "+" chama
 * `golMarcado(jid, nome)` aqui — que dispara a captura e mostra a pergunta
 * "Quer guardar o vídeo? Sim/Não". Não = o gol continua valendo, só o
 * vídeo é descartado.
 *
 * LANCE: dribles/defesas/falhas — só vídeo, jogador opcional, NÃO mexe em
 * estatística. Botão próprio aqui no painel.
 *
 * ISOLAMENTO: canal e broadcasts são try/catch; este componente não toca em
 * NADA do jogo (quem registra o gol é a súmula). Envolver em <LimiteErro>.
 * O canal só abre quando o organizador ativa as câmeras da partida.
 * ===================================================================== */

const CAMPO = { width: "100%", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: "10px", color: T.texto, fontSize: 14 };

const GatilhoLancesCampeonato = forwardRef(function GatilhoLancesCampeonato(
  { partidaId, partidaRotulo, jogadores = [], ativo, setAtivo, souOrganizador, avisar },
  ref
) {
  const canalRef = useRef(null);
  const [conectado, setConectado] = useState(false);
  const [fluxo, setFluxo] = useState(null); // null | "gol-gravar" | "lance-classificar"
  const [capturaId, setCapturaId] = useState(null);
  const [golDe, setGolDe] = useState(null); // nome do jogador do gol
  const [jogadorId, setJogadorId] = useState("");
  const [copiado, setCopiado] = useState(false);
  const fluxoRef = useRef(null);
  useEffect(() => { fluxoRef.current = fluxo; }, [fluxo]);

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

  /* chamado pela súmula quando alguém marca um gol (botão "+"). */
  useImperativeHandle(ref, () => ({
    golMarcado(jid, nome) {
      if (!canalRef.current || fluxoRef.current) return; // sem canal ou já tem captura em curso
      const cid = gerarId();
      setCapturaId(cid);
      setGolDe(nome || null);
      setFluxo("gol-gravar");
      enviar("disparo", { id: cid, modalidade: "campeonato", partidaRotulo });
      avisar?.(`Gravando o gol${nome ? " de " + nome : ""}…`);
    },
  }));

  const jogadoresOrd = [...jogadores].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  function abrirLance() {
    const cid = gerarId();
    setCapturaId(cid);
    setJogadorId("");
    setFluxo("lance-classificar");
    enviar("disparo", { id: cid, modalidade: "campeonato", partidaRotulo });
    avisar?.("Gravando lance…");
  }

  function decidirGravarGol(sim) {
    if (capturaId) {
      enviar("decisao", sim
        ? { id: capturaId, acao: "salvar", tipo: "gol", jogadorNome: golDe || null }
        : { id: capturaId, acao: "descartar" });
    }
    avisar?.(sim ? "Vídeo do gol guardado" : "Vídeo descartado — o gol continua valendo");
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
          <Botao variante="secundario" className="w-full" onClick={abrirLance} disabled={!conectado} style={{ minHeight: 46 }}>
            Gravar lance (drible, defesa…)
          </Botao>
          {souOrganizador && (
            <Botao variante="secundario" className="w-full" onClick={copiarLink} style={{ minHeight: 36, fontSize: 10.5 }}>
              {copiado ? "Link copiado ✓" : "Copiar link de câmera desta partida"}
            </Botao>
          )}
          <p style={{ fontSize: 10, color: T.fraco, lineHeight: 1.4 }}>
            Câmeras ligadas: ao marcar um gol no <b>+</b> do jogador, as câmeras gravam e aparece aqui a pergunta de guardar o vídeo.
          </p>
        </>
      )}

      {fluxo === "gol-gravar" && (
        <div className="space-y-2">
          <p style={{ fontSize: 11.5, color: T.verde }}>
            Gol{golDe ? <> de <b>{golDe}</b></> : ""} registrado. Câmeras capturando os ~20s.
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
});

export { GatilhoLancesCampeonato };
