import React, { useState, useEffect } from "react";
import { T } from "../../theme";
import { Painel, Chip, Secao, Segmento } from "../../components/ui";
import { IconeSetaDireita, IconeTrofeu } from "../../components/icones";
import {
  copaDaTemporada, faseAtual, statusDaFase, statusDaPartida, vencedorDaPartida, placarDaPartida, campeoesDaCopa,
} from "../../core/copaHendor";
import { FASE_CURTA, formatarData, nomesDe, nomeDupla, textoDaDupla, notasDeSubstituicao } from "./util";
import { PartidaDetalhe } from "./PartidaDetalhe";
import { ArvoreChaveamento } from "./ArvoreChaveamento";
import { ResultadosCopa } from "./ResultadosCopa";
import { DocumentacaoCopa } from "./DocumentacaoCopa";

/* ======================= TELA: COPA HENDOR ===============================
 * Três abas (a barra de baixo mora no App): chaveamento, resultados, documentação.
 * Visitante só vê; organizador age direto nos cartões das partidas. */

const STATUS = {
  encerrada: { rotulo: "Encerrada", cor: T.verde }, em_andamento: { rotulo: "Ao vivo", cor: T.laranja },
  pronta: { rotulo: "Pronta", cor: T.gk }, aguardando: { rotulo: "Aguardando", cor: T.fraco },
};

function PartidaCard({ copa, partida, nomes, abrir, souOrganizador }) {
  const status = statusDaPartida(copa, partida);
  const venc = vencedorDaPartida(partida);
  const placar = placarDaPartida(partida);
  const mostrar = status === "encerrada" || status === "em_andamento";
  const notas = notasDeSubstituicao(copa, partida, nomes);
  const clicavel = status !== "aguardando";
  const chamada = status === "pronta" ? (souOrganizador ? "Iniciar disputa" : null)
    : status === "em_andamento" ? "Acompanhar" : partida.disputa ? "Ver chutes" : souOrganizador ? "Detalhes" : null;

  const conteudo = (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="font-destaque" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: T.ouro }}>{partida.rotulo}</span>
        <Chip cor={STATUS[status].cor}>{STATUS[status].rotulo}</Chip>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {["A", "B"].map((lado) => {
          const { texto, definida } = textoDaDupla(copa, partida, lado, nomes);
          const ganhou = venc === lado, perdeu = venc && venc !== lado;
          return (
            <div key={lado} className="flex items-center justify-between" style={{
              padding: "10px 12px", borderRadius: 8, gap: 8, opacity: perdeu ? 0.5 : 1,
              background: ganhou ? T.ouroFraco : "rgba(255,255,255,.04)",
              border: `1px solid ${ganhou ? "rgba(245,197,24,.4)" : "transparent"}`,
            }}>
              <span className="min-w-0" style={{ fontSize: 14, fontWeight: ganhou ? 800 : 600, color: ganhou ? T.ouro : definida ? T.texto : T.fraco, fontStyle: definida ? "normal" : "italic" }}>{texto}</span>
              {mostrar && (
                <b className="font-destaque shrink-0" style={{ fontSize: partida.wo ? 12 : 20, color: ganhou ? T.ouro : T.secundario }}>
                  {partida.wo ? (ganhou ? "W.O." : "") : placar[lado]}
                </b>
              )}
            </div>
          );
        })}
      </div>
      {notas.map((n, i) => <p key={i} style={{ fontSize: 10.5, color: T.laranja, marginTop: 6 }}>↻ {n.texto}</p>)}
      {chamada && (
        <p className="flex items-center justify-end" style={{ gap: 4, marginTop: 8, fontSize: 11.5, fontWeight: 800, color: T.ouro }}>
          {chamada} <IconeSetaDireita tam={13} cor={T.ouro} />
        </p>
      )}
    </>
  );
  const estilo = { padding: 12, background: T.tier1, border: `1px solid ${T.borda}`, borderRadius: 12, display: "block", width: "100%", textAlign: "left" };
  return clicavel
    ? <button onClick={() => abrir(partida.id)} style={estilo}>{conteudo}</button>
    : <div style={estilo}>{conteudo}</div>;
}

/* Vista escolhida (árvore ou por fase) fica só neste aparelho — é conveniência, não dado. */
const lerVista = () => { try { return localStorage.getItem("jpffs:copaVista") === "fases" ? "fases" : "arvore"; } catch { return "arvore"; } };

function Chaveamento({ copa, nomes, abrir, souOrganizador }) {
  const [vista, setVista] = useState(lerVista);
  const mudarVista = (v) => { setVista(v); try { localStorage.setItem("jpffs:copaVista", v); } catch { /* modo privado */ } };
  const [faseId, setFaseId] = useState(() => faseAtual(copa));
  const fase = copa.fases.find((f) => f.id === faseId);
  const campeoes = campeoesDaCopa(copa);
  const partidas = copa.partidas.filter((p) => p.fase === faseId);
  const rotuloFase = { encerrada: "Encerrada", em_andamento: "Ao vivo", pronta: "Em breve", aguardando: "Em breve" };
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center text-center" style={{ margin: "2px 0 14px", gap: 6 }}>
        <IconeTrofeu tam={38} cor={T.ouro} />
        <h1 className="font-destaque" style={{ fontSize: 21, fontWeight: 700, color: T.texto }}>Copa Hendor de Penalidades</h1>
        <span style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: T.secundario }}>Chaveamento {copa.ano}</span>
      </div>

      {campeoes.length > 0 && (
        <Painel className="p-3 text-center" style={{ background: T.ouroFraco, borderColor: "rgba(245,197,24,.4)" }}>
          <p style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: T.secundario }}>Dupla campeã</p>
          <p className="font-destaque" style={{ fontSize: 19, fontWeight: 800, color: T.ouro, marginTop: 2 }}>{nomeDupla(campeoes, nomes)}</p>
        </Painel>
      )}

      <Segmento valor={vista} onChange={mudarVista}
        opcoes={[{ valor: "arvore", rotulo: "Chaveamento" }, { valor: "fases", rotulo: "Por fase" }]} />

      {vista === "arvore" && <ArvoreChaveamento {...{ copa, nomes, abrir }} />}

      {vista === "fases" && <>
      <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${T.borda}` }}>
        {copa.fases.map((f) => {
          const ativo = f.id === faseId;
          const st = statusDaFase(copa, f.id);
          return (
            <button key={f.id} onClick={() => setFaseId(f.id)} className="flex-1 rounded-lg"
              style={{ padding: "8px 0", background: ativo ? T.ouro : "transparent", color: ativo ? T.sobreOuro : T.secundario }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, letterSpacing: ".03em" }}>{FASE_CURTA[f.id]}</span>
              <span style={{ display: "block", fontSize: 9.5, fontWeight: 700, opacity: 0.8, color: !ativo && st === "em_andamento" ? T.laranja : undefined }}>{rotuloFase[st]}</span>
            </button>
          );
        })}
      </div>

      <Secao titulo={fase.nome} detalhe={formatarData(fase.data)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {partidas.map((p) => <PartidaCard key={p.id} {...{ copa, partida: p, nomes, abrir, souOrganizador }} />)}
      </div>
      </>}
    </div>
  );
}

function TelaCopaHendor({ aba, base, setBase, dados, avisar, souOrganizador }) {
  const copa = copaDaTemporada(base);
  const [aberta, setAberta] = useState(null); // id da partida com o detalhe aberto
  useEffect(() => { setAberta(null); }, [aba]);
  if (!copa) return <Painel className="p-4 text-center" style={{ fontSize: 13, color: T.secundario }}>Nenhuma Copa cadastrada para esta temporada.</Painel>;

  const nomes = nomesDe(base);
  const mudarCopa = (fn) => setBase((b) => ({ ...b, copas: b.copas.map((c) => (c.id === copa.id ? fn(c) : c)) }));
  const mudarPartida = (pid, fn) => mudarCopa((c) => ({ ...c, partidas: c.partidas.map((p) => (p.id === pid ? fn(p) : p)) }));
  const ctx = { base, setBase, dados, copa, nomes, avisar, souOrganizador, mudarCopa, mudarPartida };

  const partida = aberta && copa.partidas.find((p) => p.id === aberta);
  if (partida) return <PartidaDetalhe {...ctx} partida={partida} voltar={() => setAberta(null)} />;
  if (aba === "resultados") return <ResultadosCopa {...ctx} abrir={setAberta} />;
  if (aba === "documentacao") return <DocumentacaoCopa copa={copa} />;
  return <Chaveamento {...ctx} abrir={setAberta} />;
}

export { TelaCopaHendor };
