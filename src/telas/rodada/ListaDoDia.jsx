import React, { useState } from "react";
import { T } from "../../theme";
import { IconeGoleiro } from "../../components/ui";
import { ordemRachaoDaRodada } from "../../core/rachao";

/* ======================== LISTA DO DIA (widget) ===========================
 * Botão recolhível no canto inferior direito da etapa Partidas: abre a lista
 * de presença do dia já na ORDEM DO RACHÃO — ordem de chegada, com quem entrou
 * pra completar partida mandado pro fim (Art. 35º §2º). Serve pra ver de
 * relance quem chegou antes (pra escolher quem completa, Art. 35º §1º) e como
 * a fila do Rachão vai ficando. É a mesma ordem que a abertura do Rachão usa
 * (core/rachao.js → ordemRachaoDaRodada). Posição/tamanho em estilo.css
 * (.lista-dia).
 * ======================================================================== */

function ListaDoDia({ rodada, base }) {
  const [aberta, setAberta] = useState(false);
  const jog = Object.fromEntries(base.jogadores.map((j) => [j.id, j]));
  const { itens } = ordemRachaoDaRodada(rodada);
  const iFim = itens.findIndex((i) => i.foiProFim);

  if (!aberta) {
    return (
      <button onClick={() => setAberta(true)} className="lista-dia lista-dia-botao flex items-center"
        aria-label={`Abrir lista do dia (${itens.length} presentes)`}>
        <IconeLista />
        <span>Lista do dia</span>
        <b className="lista-dia-contador">{itens.length}</b>
      </button>
    );
  }

  return (
    <div className="lista-dia lista-dia-painel" role="dialog" aria-label="Lista do dia">
      <div className="flex items-start justify-between gap-2" style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${T.tier4}` }}>
        <div className="min-w-0">
          <p className="font-destaque" style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".08em", color: T.ouro }}>LISTA DO DIA · {itens.length}</p>
          <p style={{ fontSize: 10.5, color: T.secundario, lineHeight: 1.35 }}>Ordem do Rachão. Quem completa partida (<b style={{ color: T.laranja }}>+P</b>) vai pro fim — Art. 35º §2º.</p>
        </div>
        <button onClick={() => setAberta(false)} aria-label="Recolher lista"
          style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, background: "rgba(255,255,255,.06)", color: T.secundario, fontSize: 18 }}>×</button>
      </div>

      <ol className="lista-dia-itens">
        {itens.length === 0 && <li style={{ padding: 12, fontSize: 12, color: T.fraco }}>Ninguém marcado na chamada ainda.</li>}
        {itens.map((it, idx) => (
          <React.Fragment key={it.jid}>
            {idx === iFim && (
              <li style={{ padding: "8px 12px 4px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", color: T.laranja }}>
                ↓ FIM DA FILA · COMPLETARAM
              </li>
            )}
            <LinhaLista it={it} posicao={idx + 1} jogador={jog[it.jid]} />
          </React.Fragment>
        ))}
      </ol>
    </div>
  );
}

function LinhaLista({ it, posicao, jogador }) {
  const valendo = it.partidas.filter((p) => !p.completou);
  const completou = it.partidas.filter((p) => p.completou);
  return (
    <li className="flex items-center gap-1.5" style={{ padding: "6px 10px", minHeight: 38, background: it.foiProFim ? "rgba(255,165,61,.06)" : "transparent" }}>
      <span style={{ width: 18, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: T.fraco, flexShrink: 0 }}>{posicao}</span>
      {jogador?.posicao === "GOLEIRO" && <IconeGoleiro tam={13} />}
      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: T.texto }}>
        {jogador?.nome || "?"}
        {it.status === "atrasado" && <span title="Chegou atrasado" style={{ marginLeft: 5, fontSize: 9.5, fontWeight: 800, color: T.laranja }}>ATRASADO</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {valendo.map((p) => <Etiqueta key={"v" + p.numero} cor={T.verde}>P{p.numero}</Etiqueta>)}
        {completou.map((p) => <Etiqueta key={"c" + p.numero} cor={T.laranja} title={`Completou a partida ${p.numero}`}>+P{p.numero}</Etiqueta>)}
        {it.partidas.length === 0 && <Etiqueta cor={T.fraco}>sem partida</Etiqueta>}
      </span>
    </li>
  );
}

const Etiqueta = ({ cor, title, children }) => (
  <span title={title} style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".03em", color: cor, border: `1px solid ${cor}55`, background: `${cor}14`, borderRadius: 999, padding: "1px 6px", whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const IconeLista = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

export { ListaDoDia };
