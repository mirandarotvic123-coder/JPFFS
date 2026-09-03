import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import { T } from "../../theme";
import { id as gerarId } from "../../core/repositorio";
import { lerCamerasAtivas, salvarCamerasAtivas } from "../../core/lances";
import { Botao, Painel, Segmento } from "../../components/ui";

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

  if (!ativo) {
    return (
      <Botao variante="secundario" className="w-full" onClick={() => setAtivo(true)} style={{ minHeight: 40, fontSize: 10.5 }}>
        Ativar câmeras
      </Botao>
    );
  }

  const jogadoresOrd = [...jogadores].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  return (
    <Painel className="space-y-2 p-3" style={{ borderColor: T.tier4 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span className="font-destaque" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.ouro }}>
          Câmeras
        </span>
        <button onClick={() => setAtivo(false)} style={{ fontSize: 10, color: conectado ? T.verde : T.fraco }}>
          {conectado ? "conectado ✕" : "conectando…"}
        </button>
      </div>

      {!aberto ? (
        <>
          <Botao className="w-full" onClick={gravarLance} disabled={!conectado} style={{ minHeight: 50 }}>
            Gravar lance
          </Botao>
          {souOrganizador && (
            <Botao variante="secundario" className="w-full" onClick={copiarLink} style={{ minHeight: 36, fontSize: 10.5 }}>
              {copiado ? "Link copiado ✓" : "Copiar link de câmera do dia"}
            </Botao>
          )}
          <p style={{ fontSize: 10, color: T.fraco, lineHeight: 1.4 }}>
            Ao tocar, as câmeras já gravam os ~20s do lance. Depois você classifica — o vídeo espera a decisão.
            {souOrganizador ? " O link vale o dia inteiro e serve também pro Campeonato — não precisa trocar." : ""}
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <p style={{ fontSize: 11, color: T.verde }}>Capturando nas câmeras… classifique:</p>
          <Segmento valor={tipo} onChange={setTipo} opcoes={[{ valor: "gol", rotulo: "Gol" }, { valor: "lance", rotulo: "Lance" }]} />
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)}
            style={{ width: "100%", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: "10px", color: T.texto, fontSize: 14 }}>
            <option value="">— sem jogador —</option>
            {jogadoresOrd.map((j) => <option key={j.id} value={j.id}>{j.nome || "?"}</option>)}
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

export { GatilhoLances };
