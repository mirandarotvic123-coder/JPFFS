import React from "react";
import { T } from "../../theme";
import { Botao } from "../../components/ui";
import { IconeCamera, IconeLink, IconeCheck } from "../../components/icones";

/* ======================= BARRA DE CÂMERAS (visual) =======================
 * Peças visuais compactas dos gatilhos de lances (Rachão e Campeonato), que
 * moram no cabeçalho congelado ao lado do cronômetro. Só aparência — quem
 * abre canal / manda sinal continua sendo o GatilhoLances* de cada tela.
 * ====================================================================== */

const CAMPO_COMPACTO = {
  background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8,
  padding: "0 8px", height: 40, color: T.texto, fontSize: 13, minWidth: 0,
};

const botaoIcone = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
  border: `1px solid ${T.tier4}`, background: "transparent", color: T.secundario,
};

function BotaoAtivarCameras({ onClick, rotulo = "Ativar câmeras" }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center"
      style={{ gap: 8, height: 40, borderRadius: 8, border: `1px dashed ${T.tier4}`, color: T.secundario, fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>
      <IconeCamera tam={15} cor={T.secundario} /> {rotulo}
    </button>
  );
}

/* Linha com as câmeras ligadas: status (toque = desligar) · [extra] · Gravar lance · copiar link. */
function LinhaCameras({ conectado, onDesligar, onGravar, podeGravar = true, dicaGravar, extra, onCopiar, copiado }) {
  return (
    <div className="flex items-center" style={{ gap: 6 }}>
      <button onClick={onDesligar} className="flex items-center"
        title={conectado ? "Câmeras conectadas — toque para desligar neste aparelho" : "Conectando às câmeras… toque para desligar"}
        style={{ gap: 6, height: 40, padding: "0 10px", borderRadius: 8, flexShrink: 0, border: `1px solid ${conectado ? "rgba(61,214,140,.4)" : T.tier4}`, background: conectado ? "rgba(61,214,140,.08)" : "transparent", fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: conectado ? T.verde : T.fraco }}>
        <span className={conectado ? "" : "crono-pulsa"} style={{ width: 7, height: 7, borderRadius: 999, background: conectado ? T.verde : T.fraco }} />
        {conectado ? "Ao vivo" : "…"}
        <span style={{ fontSize: 12, opacity: 0.7 }}>✕</span>
      </button>
      {extra}
      <Botao onClick={onGravar} disabled={!conectado || !podeGravar} className="flex items-center justify-center"
        style={{ flex: 1, minWidth: 0, minHeight: 40, height: 40, gap: 7, fontSize: 11.5, padding: "0 10px", whiteSpace: "nowrap" }}>
        <span title={dicaGravar} className="flex items-center" style={{ gap: 7 }}>
          <IconeCamera tam={16} cor={T.sobreOuro} /> Gravar lance
        </span>
      </Botao>
      {onCopiar && (
        <button onClick={onCopiar} style={{ ...botaoIcone, color: copiado ? T.verde : T.secundario, borderColor: copiado ? "rgba(61,214,140,.4)" : T.tier4 }}
          title="Copiar link de câmera do dia — vale o dia inteiro, serve pro Campeonato e pro Rachão (não precisa trocar).">
          {copiado ? <IconeCheck tam={16} /> : <IconeLink tam={16} />}
        </button>
      )}
    </div>
  );
}

/* Caixa da decisão (classificar / guardar o vídeo) — destacada em dourado. */
function CaixaDecisao({ children }) {
  return (
    <div className="space-y-2" style={{ marginTop: 8, padding: 8, borderRadius: 10, border: `1px solid ${T.ouro}`, background: T.ouroFraco }}>
      {children}
    </div>
  );
}

/* Par de botões pequenos Gol / Lance. */
function AlternarTipo({ valor, onChange }) {
  return (
    <div className="flex rounded-lg" style={{ gap: 3, padding: 3, background: "rgba(0,0,0,.3)", flexShrink: 0 }}>
      {[{ v: "gol", r: "Gol" }, { v: "lance", r: "Lance" }].map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className="rounded"
          style={{ height: 34, padding: "0 12px", fontSize: 12, fontWeight: 800, background: valor === o.v ? T.ouro : "transparent", color: valor === o.v ? T.sobreOuro : T.secundario }}>
          {o.r}
        </button>
      ))}
    </div>
  );
}

function BotoesDecisao({ onSim, onNao, rotuloSim = "Salvar", rotuloNao = "Descartar" }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Botao onClick={onSim} style={{ minHeight: 40, fontSize: 12 }}>{rotuloSim}</Botao>
      <Botao variante="secundario" onClick={onNao} style={{ minHeight: 40, fontSize: 12 }}>{rotuloNao}</Botao>
    </div>
  );
}

export { BotaoAtivarCameras, LinhaCameras, CaixaDecisao, AlternarTipo, BotoesDecisao, CAMPO_COMPACTO };
