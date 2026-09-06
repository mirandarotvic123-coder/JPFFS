import { useState, useEffect, useRef } from "react";
import { T } from "../theme";
import { Svg } from "./icones";

/* components/CronometroPartida — contagem regressiva manual pro tempo de jogo.
 * Mora no cabeçalho das telas de partida (Rachão e Gestão da Rodada). Botões
 * de pausar / continuar e zerar; o alvo se ajusta em passos de 1 min só com o
 * cronômetro parado. Ao chegar em 00:00 o mostrador fica vermelho e pisca.
 *
 * Sobrevive a recarregar a página / trocar de aba (igual o resto do Rachão):
 * guarda no localStorage deste aparelho o alvo, se está correndo e — correndo
 * — o instante (timestamp) em que zera, ou — parado — os segundos restantes.
 * A chave é a mesma pro Campeonato e pro Rachão de propósito: as partidas
 * rolam uma de cada vez no mesmo campo, então é um relógio só pro dia. */

const CHAVE_CRONO = "jpffs:cronometro-partida";
const ALVO_PADRAO = 10 * 60; // 10 min
const MIN_SEG = 60, MAX_SEG = 60 * 60, PASSO_SEG = 60;

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE_CRONO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}
function formatarMMSS(seg) {
  const s = Math.max(0, Math.ceil(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const IconePlay = (p) => <Svg {...p}><polygon points="6 3 20 12 6 21 6 3" /></Svg>;
const IconePausa = (p) => <Svg {...p}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Svg>;
const IconeZerar = (p) => <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Svg>;

const botaoStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
  background: "rgba(255,255,255,.06)", color: T.secundario,
  fontSize: 16, fontWeight: 700, lineHeight: 1,
};

function CronometroPartida() {
  const [inicial] = useState(carregar); // lê o localStorage uma vez, na montagem
  const alvoInicial = inicial?.alvoSeg ?? ALVO_PADRAO;
  const restInicial = inicial
    ? (inicial.rodando && inicial.fimEm
        ? Math.max(0, (inicial.fimEm - Date.now()) / 1000)
        : (inicial.restanteSeg ?? alvoInicial))
    : alvoInicial;

  const [alvoSeg, setAlvoSeg] = useState(alvoInicial);
  const [restanteSeg, setRestanteSeg] = useState(restInicial);
  const [rodando, setRodando] = useState(Boolean(inicial?.rodando) && restInicial > 0);
  const fimRef = useRef(inicial?.rodando ? (inicial.fimEm ?? null) : null);

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => {
      const rest = Math.max(0, (fimRef.current - Date.now()) / 1000);
      setRestanteSeg(rest);
      if (rest <= 0) setRodando(false);
    }, 250);
    return () => clearInterval(id);
  }, [rodando]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_CRONO, JSON.stringify(
        rodando
          ? { alvoSeg, rodando: true, fimEm: fimRef.current }
          : { alvoSeg, rodando: false, restanteSeg }
      ));
    } catch { /* localStorage indisponível — segue só na memória */ }
  }, [alvoSeg, rodando, restanteSeg]);

  const acabou = restanteSeg <= 0;

  function alternar() {
    if (rodando) { setRodando(false); return; }
    if (restanteSeg <= 0) return;
    fimRef.current = Date.now() + restanteSeg * 1000;
    setRodando(true);
  }
  function zerar() {
    setRodando(false);
    fimRef.current = null;
    setRestanteSeg(alvoSeg);
  }
  function ajustar(delta) {
    if (rodando) return;
    const novo = Math.min(MAX_SEG, Math.max(MIN_SEG, alvoSeg + delta));
    setAlvoSeg(novo);
    setRestanteSeg(novo);
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
      padding: "6px 10px", borderRadius: 10,
      background: acabou ? "rgba(255,107,107,.12)" : "rgba(0,0,0,.25)",
      border: `1px solid ${acabou ? T.vermelho : T.borda}`,
    }}>
      <div className="flex items-center" style={{ gap: 6 }}>
        <button onClick={() => ajustar(-PASSO_SEG)} disabled={rodando || acabou} title="−1 min"
          style={{ ...botaoStyle, opacity: rodando || acabou ? 0.3 : 1 }}>−</button>
        <span className={"font-destaque" + (acabou ? " crono-pulsa" : "")}
          style={{
            fontVariantNumeric: "tabular-nums", fontSize: 26, fontWeight: 700, lineHeight: 1,
            minWidth: 62, textAlign: "center",
            color: acabou ? T.vermelho : rodando ? T.texto : T.secundario,
          }}>
          {formatarMMSS(restanteSeg)}
        </span>
        <button onClick={() => ajustar(PASSO_SEG)} disabled={rodando || acabou} title="+1 min"
          style={{ ...botaoStyle, opacity: rodando || acabou ? 0.3 : 1 }}>+</button>
      </div>
      <div className="flex items-center" style={{ gap: 4 }}>
        <button onClick={alternar} disabled={acabou} title={rodando ? "Pausar" : "Continuar"}
          style={{ ...botaoStyle, width: 32, opacity: acabou ? 0.3 : 1, color: rodando ? T.laranja : T.verde }}>
          {rodando ? <IconePausa tam={13} /> : <IconePlay tam={13} />}
        </button>
        <button onClick={zerar} title="Zerar" style={{ ...botaoStyle, width: 32 }}>
          <IconeZerar tam={13} />
        </button>
      </div>
    </div>
  );
}

export { CronometroPartida };
