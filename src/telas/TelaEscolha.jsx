import React from "react";
import { T, ESCUDO } from "../theme";
import { IconeTabela, IconeTrofeu, IconeSetaDireita } from "../components/icones";
import { copaDaTemporada, faseAtual, statusDaFase, campeoesDaCopa } from "../core/copaHendor";
import { formatarData, nomesDe, nomeDupla } from "./copa/util";

/* Primeira tela: escolher o que acompanhar. Aparece sempre que o app abre. */

function CartaoEscolha({ Icone, titulo, linha, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center text-left rounded-xl"
      style={{ gap: 14, padding: "20px 18px", background: T.tier1, border: `1px solid ${T.borda}`, minHeight: 96 }}>
      <span className="flex items-center justify-center shrink-0"
        style={{ width: 52, height: 52, borderRadius: 14, background: T.ouroFraco, border: "1px solid rgba(245,197,24,.3)" }}>
        <Icone tam={26} cor={T.ouro} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-destaque" style={{ display: "block", fontSize: 17, fontWeight: 700, letterSpacing: ".02em", color: T.texto }}>{titulo}</span>
        <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: T.secundario, lineHeight: 1.4 }}>{linha}</span>
      </span>
      <IconeSetaDireita tam={18} cor={T.ouro} />
    </button>
  );
}

function TelaEscolha({ base, dados, onEscolher }) {
  const copa = copaDaTemporada(base);
  let linhaCopa = "Chaveamento, resultados e regras";
  if (copa) {
    const campeoes = campeoesDaCopa(copa);
    if (campeoes.length) linhaCopa = `Campeões: ${nomeDupla(campeoes, nomesDe(base))}`;
    else {
      const f = copa.fases.find((x) => x.id === faseAtual(copa));
      const andamento = statusDaFase(copa, f.id) === "em_andamento";
      linhaCopa = `${f.nome} · ${andamento ? "em andamento" : formatarData(f.data)}`;
    }
  }
  return (
    <div className="mx-auto space-y-4" style={{ maxWidth: 460, paddingTop: 8 }}>
      <div className="flex flex-col items-center text-center" style={{ gap: 10, margin: "8px 0 14px" }}>
        <img src={ESCUDO} alt="JPFFS" style={{ height: 78, width: "auto", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.55))" }} />
        <h1 className="font-destaque" style={{ fontSize: 22, fontWeight: 700, color: T.texto }}>O que você quer ver?</h1>
      </div>
      <CartaoEscolha Icone={IconeTabela} titulo="Campeonato JPFFS" onClick={() => onEscolher("jpffs")}
        linha={`${dados.rodadasRealizadas}ª rodada · pontos corridos`} />
      <CartaoEscolha Icone={IconeTrofeu} titulo="Copa Hendor de Penalidades" onClick={() => onEscolher("hendor")} linha={linhaCopa} />
    </div>
  );
}

export { TelaEscolha };
