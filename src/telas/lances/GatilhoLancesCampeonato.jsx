import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { supabase } from "../../supabase";
import { T } from "../../theme";
import { id as gerarId } from "../../core/repositorio";
import { BotaoAtivarCameras, LinhaCameras, CaixaDecisao, BotoesDecisao, CAMPO_COMPACTO } from "./BarraCameras";

/* ================== GATILHO DE LANCES — CAMPEONATO =====================
 * Segue a doc, seção 3.
 *
 * ESCOPO: o canal é DO DIA (`dia-<AAAA-MM-DD>`) — o mesmo link de câmera cobre
 * a rodada inteira do Campeonato E o Rachão do dia (as partidas rolam uma de
 * cada vez, mesmo campo). Qual partida/modalidade é o clipe vem no sinal
 * `disparo` (a súmula sabe), então a Galeria separa tudo sozinha.
 *
 * GOL: registrar o gol é o botão "+" do jogador na própria súmula (uma via
 * só, sem confusão). Quando as câmeras estão ativas, esse "+" chama
 * `golMarcado(jid, nome, partidaId, partidaRotulo)` aqui — que dispara a
 * captura e mostra a pergunta "Quer guardar o vídeo? Sim/Não". Não = o gol
 * continua valendo, só o vídeo é descartado.
 *
 * LANCE: dribles/defesas/falhas — só vídeo, jogador opcional, NÃO mexe em
 * estatística. Botão próprio aqui no painel; se houver mais de uma partida
 * aberta, escolhe-se a partida antes.
 *
 * ISOLAMENTO: canal e broadcasts são try/catch; este componente não toca em
 * NADA do jogo (quem registra o gol é a súmula). Envolver em <LimiteErro>.
 * O canal só abre quando o organizador ativa as câmeras da rodada.
 * ===================================================================== */

const GatilhoLancesCampeonato = forwardRef(function GatilhoLancesCampeonato(
  { canalId, rodadaRotulo, partidas = [], ativo, setAtivo, souOrganizador, avisar },
  ref
) {
  const canalRef = useRef(null);
  const [conectado, setConectado] = useState(false);
  const [fluxo, setFluxo] = useState(null); // null | "gol-gravar" | "lance-classificar"
  const [capturaId, setCapturaId] = useState(null);
  const [golDe, setGolDe] = useState(null); // nome do jogador do gol
  const [jogadorId, setJogadorId] = useState("");
  const [partidaSelId, setPartidaSelId] = useState(partidas[0]?.id || "");
  const [copiado, setCopiado] = useState(false);
  const fluxoRef = useRef(null);
  useEffect(() => { fluxoRef.current = fluxo; }, [fluxo]);

  /* se a partida selecionada encerrar (sai da lista), cai pra primeira aberta */
  useEffect(() => {
    if (partidas.length && !partidas.some((p) => p.id === partidaSelId)) setPartidaSelId(partidas[0].id);
  }, [partidas, partidaSelId]);

  useEffect(() => {
    if (!ativo || !canalId) return;
    let vivo = true;
    try {
      const canal = supabase.channel(`lances:${canalId}`, { config: { broadcast: { self: false } } });
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
  }, [ativo, canalId]);

  function enviar(evento, payload) {
    try { canalRef.current?.send({ type: "broadcast", event: evento, payload }); }
    catch (e) { console.warn("Lances: falha ao enviar sinal (sem efeito no jogo):", e); }
  }

  /* chamado pela súmula quando alguém marca um gol (botão "+"). A partida vem
   * da própria súmula — o clipe é etiquetado com ela, não com a rodada. */
  useImperativeHandle(ref, () => ({
    golMarcado(jid, nome, partidaId, partidaRotulo) {
      if (!canalRef.current || fluxoRef.current) return; // sem canal ou já tem captura em curso
      const cid = gerarId();
      setCapturaId(cid);
      setGolDe(nome || null);
      setFluxo("gol-gravar");
      enviar("disparo", { id: cid, modalidade: "campeonato", partidaId, partidaRotulo });
      avisar?.(`Gravando o gol${nome ? " de " + nome : ""}…`);
    },
  }));

  const partidaSel = partidas.find((p) => p.id === partidaSelId) || partidas[0] || null;
  const jogadoresLance = [...(partidaSel?.jogadores || [])].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  function abrirLance() {
    if (!partidaSel) { avisar?.("Nenhuma partida aberta pra gravar."); return; }
    const cid = gerarId();
    setCapturaId(cid);
    setJogadorId("");
    setFluxo("lance-classificar");
    enviar("disparo", { id: cid, modalidade: "campeonato", partidaId: partidaSel.id, partidaRotulo: partidaSel.rotulo });
    avisar?.(`Gravando lance — ${partidaSel.rotulo}…`);
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
      const nome = jogadorId ? (jogadoresLance.find((j) => j.id === jogadorId)?.nome || null) : null;
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
    const url = `${window.location.origin}${window.location.pathname}?camera=1&p=${encodeURIComponent(canalId)}&r=${encodeURIComponent(rodadaRotulo || "")}`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); },
      () => avisar?.("Não copiou. Link: " + url)
    );
  }

  if (!ativo) return <BotaoAtivarCameras onClick={() => setAtivo(true)} />;

  return (
    <div>
      <LinhaCameras
        conectado={conectado}
        onDesligar={() => { setAtivo(false); fechar(); }}
        onGravar={abrirLance}
        podeGravar={!!partidaSel && fluxo === null}
        dicaGravar="Drible, defesa, falha… (só vídeo). Gol é no + do jogador na súmula — com as câmeras ligadas ele já grava."
        extra={partidas.length > 1 && (
          <select value={partidaSelId} onChange={(e) => setPartidaSelId(e.target.value)} disabled={fluxo !== null}
            title="Partida em jogo (para “Gravar lance”)" style={{ ...CAMPO_COMPACTO, flexShrink: 0, maxWidth: 118 }}>
            {partidas.map((p) => <option key={p.id} value={p.id}>{p.curto || p.rotulo}</option>)}
          </select>
        )}
        onCopiar={souOrganizador ? copiarLink : null}
        copiado={copiado}
      />

      {fluxo === "gol-gravar" && (
        <CaixaDecisao>
          <p style={{ fontSize: 12, color: T.texto }}>
            <b style={{ color: T.ouroClaro }}>Gol{golDe ? ` de ${golDe}` : ""}</b> registrado — guardar o vídeo?
          </p>
          <BotoesDecisao onSim={() => decidirGravarGol(true)} onNao={() => decidirGravarGol(false)} rotuloSim="Sim, guardar" rotuloNao="Não" />
        </CaixaDecisao>
      )}

      {fluxo === "lance-classificar" && (
        <CaixaDecisao>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: T.ouroClaro }}>
            Capturando{partidaSel ? ` — ${partidaSel.curto || partidaSel.rotulo}` : ""}… atribuir a um jogador?
          </p>
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)} style={{ ...CAMPO_COMPACTO, width: "100%" }}>
            <option value="">— sem jogador —</option>
            {jogadoresLance.map((j) => <option key={j.id} value={j.id}>{j.nome || "?"}</option>)}
          </select>
          <BotoesDecisao onSim={salvarLance} onNao={descartarLance} />
        </CaixaDecisao>
      )}
    </div>
  );
});

export { GatilhoLancesCampeonato };
