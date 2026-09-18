import React, { useEffect, useRef, useState } from "react";
import { T } from "../../theme";
import { statusDaPartida, vencedorDaPartida, placarDaPartida, duplaEfetiva, faseAtual, partidaPorId } from "../../core/copaHendor";
import { FASE_CURTA, formatarData } from "./util";

/* Chaveamento em árvore (Oitavas → Quartas → Semis → Final), igual à arte oficial.
 * Cada coluna divide a mesma altura entre as suas partidas; por isso o cartão de uma fase cai
 * exatamente no meio das duas partidas que o alimentam, e as linhas fecham sem cálculo.
 * No celular a árvore rola pro lado e já abre na fase atual; no desktop cabe inteira. */

const SLOT = 104;      // altura reservada a cada partida da 1ª coluna (px)
const GAP = 28;        // espaço entre colunas — é onde ficam as linhas
const LARGURA_MIN = 168;
const NEUTRA = "rgba(159,179,232,.38)";

const COR_BORDA = { encerrada: T.borda, em_andamento: T.laranja, pronta: T.gk, aguardando: T.borda };

function placeholder(copa, partida, lado) {
  const o = partida.origem?.[lado];
  const de = o && partidaPorId(copa, o.de);
  return de ? `${o.tipo === "perdedor" ? "Perd." : "Venc."} ${de.rotulo}` : "A definir";
}

function Dupla({ copa, partida, lado, nomes, status, venc }) {
  const { jogadores, subs } = duplaEfetiva(copa, partida, lado);
  const entraram = new Set(subs.map((s) => s.entra));
  const definida = jogadores.length === 2;
  const ganhou = venc === lado, perdeu = venc && venc !== lado;
  const mostrar = status === "encerrada" || status === "em_andamento";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "3px 7px", borderRadius: 6, opacity: perdeu ? 0.5 : 1,
      background: ganhou ? T.ouroFraco : "rgba(255,255,255,.05)",
      border: `1px solid ${ganhou ? "rgba(245,197,24,.5)" : "transparent"}`,
    }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 11, lineHeight: "14px", fontWeight: ganhou ? 800 : 600, color: ganhou ? T.ouro : T.texto }}>
        {definida
          ? jogadores.map((j) => (
            <div key={j} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: entraram.has(j) ? T.gk : undefined }}>{nomes[j] || j}</div>
          ))
          : <div style={{ fontStyle: "italic", fontWeight: 500, fontSize: 10, color: T.fraco, lineHeight: "13px" }}>{placeholder(copa, partida, lado)}</div>}
      </div>
      {mostrar && (
        <b className="font-destaque" style={{ fontSize: partida.wo ? 10 : 17, lineHeight: 1, color: ganhou ? T.ouro : T.secundario, flexShrink: 0 }}>
          {partida.wo ? (ganhou ? "W.O." : "") : placarDaPartida(partida)[lado]}
        </b>
      )}
    </div>
  );
}

function Cartao({ copa, partida, nomes, abrir }) {
  const status = statusDaPartida(copa, partida);
  const venc = vencedorDaPartida(partida);
  const clicavel = status !== "aguardando";
  const estilo = {
    width: "100%", display: "flex", flexDirection: "column", gap: 3, padding: 4, borderRadius: 9, textAlign: "left",
    background: T.tier1, border: `1px ${status === "aguardando" ? "dashed" : "solid"} ${COR_BORDA[status]}`,
    boxShadow: status === "em_andamento" ? "0 0 0 2px rgba(255,165,61,.22)" : undefined,
  };
  const conteudo = (
    <>
      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco, padding: "0 3px", lineHeight: "11px" }}>
        {partida.rotulo}{status === "em_andamento" && <span style={{ color: T.laranja }}> · ao vivo</span>}
      </span>
      {["A", "B"].map((l) => <Dupla key={l} {...{ copa, partida, lado: l, nomes, status, venc }} />)}
    </>
  );
  return clicavel ? <button onClick={() => abrir(partida.id)} style={estilo}>{conteudo}</button> : <div style={estilo}>{conteudo}</div>;
}

function ArvoreChaveamento({ copa, nomes, abrir }) {
  const rolagem = useRef(null);
  const [temRolagem, setTemRolagem] = useState(false);
  // colunas: só as partidas "do caminho" (o 3º lugar fica embaixo da final)
  const colunas = copa.fases.map((f) => ({ fase: f, partidas: copa.partidas.filter((p) => p.fase === f.id && p.id !== "t3") }));
  const terceiro = copa.partidas.find((p) => p.id === "t3");
  const corpo = SLOT * colunas[0].partidas.length;
  const atual = faseAtual(copa);

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const alvo = el.querySelector(`[data-fase="${atual}"]`);
    if (alvo) el.scrollLeft = Math.max(0, alvo.offsetLeft - 10); // abre na fase atual
    const medir = () => setTemRolagem(el.scrollWidth > el.clientWidth + 4);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [atual]);

  return (
    <div>
      {temRolagem && (
        <p className="text-center" style={{ fontSize: 11, color: T.secundario, margin: "0 0 8px" }}>← arraste para o lado para ver as outras fases →</p>
      )}
      <div ref={rolagem} style={{ position: "relative", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity", paddingBottom: 10 }}>
        <div style={{ display: "flex", gap: GAP, width: "100%", minWidth: colunas.length * LARGURA_MIN + (colunas.length - 1) * GAP }}>
          {colunas.map(({ fase, partidas }, ci) => {
            const ultima = ci === colunas.length - 1;
            return (
              <div key={fase.id} data-fase={fase.id} style={{ flex: "1 1 0", minWidth: LARGURA_MIN, scrollSnapAlign: "start", display: "flex", flexDirection: "column" }}>
                <div className="text-center" style={{ height: 38, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span className="font-destaque" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: fase.id === atual ? T.ouro : T.secundario }}>{FASE_CURTA[fase.id]}</span>
                  <span style={{ fontSize: 10, color: T.fraco }}>{formatarData(fase.data)}</span>
                </div>
                <div style={{ position: "relative", height: corpo, display: "flex", flexDirection: "column" }}>
                  {partidas.map((p, k) => {
                    const decidida = !!vencedorDaPartida(p);
                    const cor = decidida ? T.ouro : NEUTRA;
                    return (
                      <div key={p.id} style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                        <Cartao {...{ copa, partida: p, nomes, abrir }} />
                        {ci > 0 && <span style={{ position: "absolute", left: -GAP / 2, top: "50%", width: GAP / 2, borderTop: `2px solid ${NEUTRA}` }} />}
                        {!ultima && (
                          <>
                            <span style={{ position: "absolute", right: -GAP / 2, top: "50%", width: GAP / 2, borderTop: `2px solid ${cor}` }} />
                            <span style={{ position: "absolute", right: -GAP / 2, width: 0, height: "50%", borderRight: `2px solid ${cor}`, ...(k % 2 === 0 ? { top: "50%" } : { top: 0 }) }} />
                          </>
                        )}
                      </div>
                    );
                  })}
                  {ultima && terceiro && (
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
                      <Cartao {...{ copa, partida: terceiro, nomes, abrir }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-center" style={{ fontSize: 10.5, color: T.fraco, marginTop: 4 }}>
        <b style={{ color: T.ouro }}>Dourado</b> = venceu · <b style={{ color: T.gk }}>azul</b> = entrou como substituto · toque numa partida para abrir
      </p>
    </div>
  );
}

export { ArvoreChaveamento };
