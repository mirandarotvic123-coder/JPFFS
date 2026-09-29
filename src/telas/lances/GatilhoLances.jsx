import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import { T } from "../../theme";
import { id as gerarId } from "../../core/repositorio";
import { lerCamerasAtivas, salvarCamerasAtivas } from "../../core/lances";
import { BotaoAtivarCameras, LinhaCameras, CaixaDecisao, AlternarTipo, BotoesDecisao, CAMPO_COMPACTO } from "./BarraCameras";

/* ===================== GATILHO DE LANCES (genérico) =====================
 * Botão que dispara a gravação nas câmeras de uma partida e classifica o
 * lance. Serve pro Rachão e pro Campeonato — só muda partidaId / rótulo /
 * modalidade / lista de jogadores.
 *
 * ISOLAMENTO: tudo é try/catch e NÃO toca em nada do jogo (fila, placar,
 * súmula, resultado). Se o Realtime cair, o botão só fica sem efeito. Pode
 * ser removido inteiro sem afetar o resto da tela. Envolver em <LimiteErro>.
 *
 * O canal Realtime só é aberto quando o organizador "ativa" as câmeras
 * desta partida — assim uma rodada com 4 súmulas não abre 4 canais à toa.
 * ====================================================================== */

/* `canalId` é o canal Realtime (ex.: `dia-<AAAA-MM-DD>` — um link de câmera pro
 * dia todo, cobrindo Rachão e Campeonato). `partidaId` continua identificando o
 * clipe/rachão e serve de chave da memória "câmeras ativas" deste aparelho. */
function GatilhoLances({ partidaId, canalId, partidaRotulo, modalidade, jogadores = [], souOrganizador, avisar }) {
  const canalNome = canalId || partidaId;
  const canalRef = useRef(null);
  const [ativo, setAtivo] = useState(() => lerCamerasAtivas(partidaId)); // canal aberto? (lembrado neste aparelho)
  const [conectado, setConectado] = useState(false);

  useEffect(() => { salvarCamerasAtivas(partidaId, ativo); }, [ativo, partidaId]);
  const [aberto, setAberto] = useState(false); // painel de classificação
  const [capturaId, setCapturaId] = useState(null);
  const [tipo, setTipo] = useState("gol");
  const [jogadorId, setJogadorId] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!ativo || !canalNome) return;
    let vivo = true;
    try {
      const canal = supabase.channel(`lances:${canalNome}`, { config: { broadcast: { self: false } } });
      canal.subscribe((status) => { if (vivo && status === "SUBSCRIBED") setConectado(true); });
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
  }, [ativo, canalNome]);

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
    enviar("disparo", { id: cid, modalidade, partidaId, partidaRotulo });
    avisar?.("Gravando lance…");
  }

  function confirmar() {
    if (capturaId) {
      const nome = jogadorId ? (jogadores.find((j) => j.id === jogadorId)?.nome || null) : null;
      enviar("decisao", { id: capturaId, acao: "salvar", tipo, jogadorNome: nome });
      avisar?.("Lance salvo — as câmeras estão enviando");
    }
    fechar();
  }

  function descartar() {
    if (capturaId) enviar("decisao", { id: capturaId, acao: "descartar" });
    fechar();
  }

  function fechar() { setAberto(false); setCapturaId(null); }

  function copiarLink() {
    const url = `${window.location.origin}${window.location.pathname}?camera=1&p=${encodeURIComponent(canalNome)}&r=${encodeURIComponent(partidaRotulo || "")}`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); },
      () => avisar?.("Não copiou. Link: " + url)
    );
  }

  if (!ativo) return <BotaoAtivarCameras onClick={() => setAtivo(true)} />;

  const jogadoresOrd = [...jogadores].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  return (
    <div>
      <LinhaCameras
        conectado={conectado}
        onDesligar={() => { setAtivo(false); fechar(); }}
        onGravar={gravarLance}
        podeGravar={!aberto}
        dicaGravar="As câmeras já gravam os ~20s do lance. Depois você classifica — o vídeo espera a decisão."
        onCopiar={souOrganizador ? copiarLink : null}
        copiado={copiado}
      />
      {aberto && (
        <CaixaDecisao>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: T.ouroClaro }}>Capturando nas câmeras… classifique o lance</p>
          <div className="flex items-center" style={{ gap: 6 }}>
            <AlternarTipo valor={tipo} onChange={setTipo} />
            <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)} style={{ ...CAMPO_COMPACTO, flex: 1 }}>
              <option value="">— sem jogador —</option>
              {jogadoresOrd.map((j) => <option key={j.id} value={j.id}>{j.nome || "?"}</option>)}
            </select>
          </div>
          <BotoesDecisao onSim={confirmar} onNao={descartar} />
        </CaixaDecisao>
      )}
    </div>
  );
}

export { GatilhoLances };
