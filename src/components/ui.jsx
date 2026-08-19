/* components/ui — peças reutilizáveis compartilhadas pelas 4 telas: cartão,
 * botão, badges, campos de formulário, avatar. Nada aqui sabe de rota nem
 * de tela específica. */
import { T } from "../theme";
import { hashSeed } from "../core/rng";
import { nivelInfo } from "../core/regras";
import { IconeBusca } from "./icones";

const Estrelas = ({ n, tam = 12, goleiro }) => (
  <span title={goleiro ? "Classe (goleiro) — escala geral" : "Classe (linha) — escala geral"}
    style={{ fontSize: tam, letterSpacing: -1, color: goleiro ? T.gk : T.ouro, whiteSpace: "nowrap" }}>
    {"★".repeat(Math.max(0, n))}<span style={{ color: "rgba(255,255,255,.16)" }}>{"★".repeat(Math.max(0, 5 - n))}</span>
  </span>
);

const IconeGoleiro = ({ tam = 15 }) => (
  <span title="Goleiro" style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: tam, height: tam,
    borderRadius: 4, background: T.gk, color: T.sobreAzul, fontSize: tam * 0.66, fontWeight: 900, flexShrink: 0
  }}>G</span>
);

const IconeLinha = ({ tam = 15 }) => (
  <span title="Linha" style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: tam, height: tam,
    borderRadius: 4, background: T.tier3, border: `1px solid ${T.tier4}`, color: T.secundario, fontSize: tam * 0.66, fontWeight: 900, flexShrink: 0
  }}>L</span>
);

const CampoBusca = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative" }}>
    <IconeBusca tam={16} cor={T.fraco} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    <input value={value} onChange={onChange} placeholder={placeholder} style={{ ...inputStyle, paddingLeft: 36 }} />
  </div>
);

const SeloAtraso = ({ nivel, cfg, mini }) => {
  const i = nivelInfo(nivel, cfg); if (!i) return null;
  return <span title={i.rotulo} style={{
    background: `${i.cor}28`, color: i.cor, border: `1px solid ${i.cor}66`, borderRadius: 4,
    padding: mini ? "0 3px" : "1px 5px", fontSize: mini ? 9 : 10, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0
  }}>
    {mini ? i.curto : i.rotulo}</span>;
};

function Botao({ children, onClick, variante = "primario", className = "", disabled, style }) {
  const v = {
    primario: { background: T.ouro, color: T.sobreOuro, border: "none" },
    secundario: { background: "transparent", color: T.texto, border: `1px solid ${T.tier4}` },
    perigo: { background: T.vermelho, color: "#fff", border: "none" },
  }[variante];
  return <button onClick={onClick} disabled={disabled} className={`rounded-lg px-4 ${className}`}
    style={{ ...v, minHeight: 48, fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", opacity: disabled ? 0.4 : 1, ...style }}>{children}</button>;
}

const inputStyle = { width: "100%", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: "12px", color: T.texto, fontSize: 15, outline: "none" };

function Campo({ rotulo, children, dica }) {
  return <label className="block">
    <span style={{ display: "block", marginBottom: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>{rotulo}</span>
    {children}
    {dica && <span style={{ display: "block", marginTop: 4, fontSize: 10.5, lineHeight: 1.35, color: T.fraco }}>{dica}</span>}
  </label>;
}

/* cabeçalho de tela interna (Rodada/Elenco/Ajustes) — título grande + linha de
   apoio, no espírito do modelo do Stitch, mas sem inventar dado que não existe */
function CabecalhoPagina({ titulo, descricao, acao }) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ margin: "2px 0 18px" }}>
      <div className="min-w-0">
        <h1 className="font-destaque" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, color: T.texto }}>{titulo}</h1>
        {descricao && <p style={{ marginTop: 4, fontSize: 13, color: T.secundario, lineHeight: 1.4 }}>{descricao}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

function Secao({ titulo, detalhe, Icone }) {
  return <div className="mb-2 flex items-baseline justify-between gap-2" style={{ borderBottom: `1px solid ${T.borda}`, paddingBottom: 5 }}>
    <h2 className="font-destaque flex items-center" style={{ gap: 6, fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.ouro }}>
      {Icone && <Icone tam={14} cor={T.ouro} />}{titulo}
    </h2>
    {detalhe && <span className="flex items-center" style={{ gap: 4, fontSize: 11.5, color: T.secundario, flexShrink: 0 }}>{detalhe}</span>}
  </div>;
}

const Painel = ({ children, className = "", style }) => (
  <div className={`rounded-lg ${className}`} style={{ background: T.tier1, border: `1px solid ${T.borda}`, ...style }}>{children}</div>
);

/* selo de status em formato de pílula — usado nos cartões do elenco */
const Chip = ({ cor = T.secundario, contorno, children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap",
    background: contorno ? "transparent" : `${cor}22`,
    border: `1px solid ${contorno ? T.borda : cor + "66"}`,
    color: contorno ? T.secundario : cor,
    borderRadius: 999, padding: "2px 8px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".03em",
  }}>{children}</span>
);

/* avatar do jogador: foto de verdade quando existe, senão iniciais num círculo
   colorido pelo próprio nome (mesma ideia do Gmail/Slack) */
const PALETA_AVATAR = [T.gk, T.ouro, T.verde, T.roxo, T.laranja, "#FF6B9D", "#5FD3C4"];
function AvatarJogador({ jogador, tam = 44 }) {
  if (jogador.fotoUrl) {
    return <img src={jogador.fotoUrl} alt="" style={{ width: tam, height: tam, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${T.borda}` }} />;
  }
  const iniciais = (jogador.nome || "?").trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const cor = PALETA_AVATAR[hashSeed(jogador.nome || "") % PALETA_AVATAR.length];
  return (
    <span style={{
      width: tam, height: tam, borderRadius: "50%", flexShrink: 0,
      background: `${cor}24`, color: cor, border: `1px solid ${cor}55`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: tam * 0.36, fontWeight: 800,
    }}>{iniciais}</span>
  );
}

function Marcadores({ jogador }) {
  return <>
    {jogador?.convidado && <span style={{ background: "rgba(192,140,255,.22)", color: T.roxo, fontSize: 9, fontWeight: 800, padding: "1px 4px", borderRadius: 3 }}>CONV</span>}
    {jogador?.pendenciaFinanceira && <span style={{ color: T.vermelho, fontWeight: 800 }} title="Pendência financeira">$</span>}
    {jogador?.pontuacaoPendente && <span style={{ color: T.secundario }} title="Pontuação pendente">(*)</span>}
  </>;
}

const Contador = ({ rotulo, valor, cor = T.texto }) => (
  <div style={{ background: "rgba(0,0,0,.25)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
    <p className="font-destaque" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: cor }}>{valor}</p>
    <p style={{ fontSize: 9, marginTop: 3, letterSpacing: ".1em", textTransform: "uppercase", color: T.fraco }}>{rotulo}</p>
  </div>
);

const FaixaPartida = ({ n, extra }) => (
  <div className="flex items-center gap-2" style={{ margin: "2px 0 6px" }}>
    <span style={{ height: 1, flex: 1, background: T.borda }} />
    <span className="font-destaque" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", color: extra ? T.laranja : T.ouro }}>
      PARTIDA {n}{extra ? " · SOBRESSALENTES" : ""}
    </span>
    <span style={{ height: 1, flex: 1, background: T.borda }} />
  </div>
);
function Interruptor({ ligado, onChange, titulo, descricao, cor = T.ouro }) {
  return (
    <button onClick={onChange} className="flex w-full items-center gap-3 rounded-lg text-left"
      style={{ padding: "10px 12px", minHeight: 52, background: ligado ? `${cor}1F` : "rgba(0,0,0,.22)", border: `1px solid ${ligado ? cor : T.borda}` }}>
      <span style={{ position: "relative", width: 42, height: 24, borderRadius: 12, flexShrink: 0, background: ligado ? cor : "rgba(255,255,255,.16)", transition: "background .15s" }}>
        <span style={{
          position: "absolute", top: 3, left: ligado ? 21 : 3, width: 18, height: 18, borderRadius: 9,
          background: ligado ? T.fundoBase : "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.4)"
        }} />
      </span>
      <span className="min-w-0 flex-1">
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: ligado ? cor : T.secundario }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 10.5, lineHeight: 1.35, color: T.fraco }}>{descricao}</span>
      </span>
      <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: ".1em", color: ligado ? cor : T.fraco, flexShrink: 0 }}>
        {ligado ? "SIM" : "NÃO"}
      </span>
    </button>
  );
}
function Segmento({ valor, opcoes, onChange, titulo }) {
  return (
    <div>
      {titulo && <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>{titulo}</span>}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: "rgba(0,0,0,.3)" }}>
        {opcoes.map((o) => {
          const ativo = valor === o.valor;
          return (
            <button key={o.valor} onClick={() => onChange(o.valor)} className="flex-1 rounded"
              style={{
                padding: "10px 4px", minHeight: 44, fontSize: 13, fontWeight: 800,
                background: ativo ? (o.cor || T.ouro) : "transparent",
                color: ativo ? T.sobreOuro : T.secundario
              }}>
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}


export {
  Estrelas, IconeGoleiro, IconeLinha, CampoBusca, SeloAtraso, Botao, inputStyle, Campo,
  CabecalhoPagina, Secao, Painel, Chip, AvatarJogador, Marcadores, Contador,
  FaixaPartida, Interruptor, Segmento,
};
