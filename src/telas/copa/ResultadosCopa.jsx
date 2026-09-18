import React, { useState } from "react";
import { T } from "../../theme";
import { Botao, Painel, Secao, Campo, inputStyle } from "../../components/ui";
import { id } from "../../core/repositorio";
import { statusDaPartida, vencedorDaPartida, placarDaPartida, estatisticasJogadores } from "../../core/copaHendor";
import { textoDaDupla } from "./util";

/* Resultados: partidas já jogadas (ou em andamento), cobranças por jogador e as
 * penalidades da Copa que descontam pontos do Campeonato. */

function LinhaResultado({ copa, partida, nomes, abrir }) {
  const venc = vencedorDaPartida(partida);
  const placar = placarDaPartida(partida);
  const status = statusDaPartida(copa, partida);
  return (
    <button onClick={() => abrir(partida.id)} className="flex w-full items-center justify-between text-left rounded-lg"
      style={{ gap: 8, padding: "10px 12px", background: T.tier1, border: `1px solid ${T.borda}` }}>
      <span className="min-w-0 flex-1">
        <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.fraco }}>
          {partida.rotulo}{status === "em_andamento" && <span style={{ color: T.laranja }}> · ao vivo</span>}
        </span>
        {["A", "B"].map((l) => (
          <span key={l} style={{ display: "block", fontSize: 13, marginTop: 2, fontWeight: venc === l ? 800 : 500, color: venc === l ? T.ouro : venc ? T.fraco : T.texto }}>
            {textoDaDupla(copa, partida, l, nomes).texto}
          </span>
        ))}
      </span>
      <span className="font-destaque text-right shrink-0" style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 700, color: T.secundario }}>
        {partida.wo ? <span style={{ fontSize: 11, color: T.laranja }}>W.O.</span> : <>{placar.A}<br />{placar.B}</>}
      </span>
    </button>
  );
}

function Penalidades({ copa, base, nomes, mudarCopa, souOrganizador, avisar }) {
  const [jid, setJid] = useState("");
  const [valor, setValor] = useState(5);
  const [motivo, setMotivo] = useState("");
  const lista = copa.penalidades || [];
  const elenco = base.jogadores.filter((j) => !j.convidado).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (!lista.length && !souOrganizador) return null;
  return (
    <section>
      <Secao titulo="Penalidades no Campeonato" detalhe={lista.length ? `${lista.length} lançamento${lista.length > 1 ? "s" : ""}` : null} />
      <Painel className="p-3 space-y-2">
        <p style={{ fontSize: 11, color: T.fraco }}>Ausência ou desistência na Copa custa 5 pontos no Campeonato (Art. 55 §4).</p>
        {lista.length === 0 && <p style={{ fontSize: 12.5, color: T.secundario }}>Nenhuma penalidade lançada.</p>}
        {lista.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.25)", fontSize: 13, gap: 8 }}>
            <span className="truncate" style={{ color: T.secundario }}>{nomes[p.jogadorId] || p.jogadorId} <span style={{ color: T.fraco }}>· {p.motivo || "sem motivo"}</span></span>
            <span className="flex items-center gap-2 shrink-0">
              <b style={{ color: T.vermelho }}>−{Math.abs(p.valor)}</b>
              {souOrganizador && (
                <button onClick={() => {
                  if (confirm(`Remover a penalidade de ${nomes[p.jogadorId]}? Ele recupera os ${Math.abs(p.valor)} pontos.`))
                    mudarCopa((c) => ({ ...c, penalidades: c.penalidades.filter((x) => x.id !== p.id) }));
                }} style={{ color: T.fraco }}>✕</button>
              )}
            </span>
          </div>
        ))}
        {souOrganizador && (
          <div className="space-y-2" style={{ borderTop: `1px solid ${T.borda}`, paddingTop: 10 }}>
            <div className="flex gap-2">
              <select value={jid} onChange={(e) => setJid(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }}>
                <option value="">Jogador…</option>{elenco.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
              </select>
              <input type="number" min="1" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...inputStyle, width: 64, padding: "10px 4px", textAlign: "center", fontSize: 13 }} />
            </div>
            <div className="flex gap-2">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ex.: ausência nas quartas)" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }} />
              <Botao style={{ padding: "0 14px" }} onClick={() => {
                if (!jid || !Number(valor)) return;
                mudarCopa((c) => ({ ...c, penalidades: [...(c.penalidades || []), { id: id(), jogadorId: jid, valor: -Math.abs(Number(valor)), motivo }] }));
                setJid(""); setValor(5); setMotivo("");
                avisar("Penalidade lançada — já vale na classificação");
              }}>Lançar</Botao>
            </div>
          </div>
        )}
      </Painel>
    </section>
  );
}

function ResultadosCopa({ copa, nomes, abrir, base, mudarCopa, souOrganizador, avisar }) {
  const fases = [...copa.fases].reverse()
    .map((f) => ({ f, ps: copa.partidas.filter((p) => p.fase === f.id && ["encerrada", "em_andamento"].includes(statusDaPartida(copa, p))) }))
    .filter((x) => x.ps.length);
  const est = estatisticasJogadores(copa);
  const cobradores = Object.entries(est).sort((a, b) => b[1].gols - a[1].gols || b[1].defesas - a[1].defesas || (nomes[a[0]] || "").localeCompare(nomes[b[0]] || "", "pt-BR"));
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center" style={{ margin: "2px 0 10px", gap: 6 }}>
        <h1 className="font-destaque" style={{ fontSize: 21, fontWeight: 700, color: T.texto }}>Resultados</h1>
        <span style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: T.secundario }}>Copa Hendor {copa.ano}</span>
      </div>

      {fases.map(({ f, ps }) => (
        <section key={f.id}>
          <Secao titulo={f.nome} />
          <div className="space-y-2">{ps.map((p) => <LinhaResultado key={p.id} {...{ copa, partida: p, nomes, abrir }} />)}</div>
        </section>
      ))}

      <section>
        <Secao titulo="Cobranças por jogador" />
        {cobradores.length === 0 ? (
          <Painel className="p-3" style={{ fontSize: 12.5, color: T.secundario }}>
            Os chutes detalhados aparecem a partir das semifinais — as fases anteriores foram lançadas só com o placar final.
          </Painel>
        ) : (
          <Painel className="p-2">
            <div className="grid" style={{ gridTemplateColumns: "1fr 64px 64px", gap: "2px 8px", fontSize: 12.5 }}>
              <span style={{ color: T.fraco, fontSize: 10, letterSpacing: ".1em", padding: "4px 6px" }}>JOGADOR</span>
              <span className="text-center" style={{ color: T.fraco, fontSize: 10, letterSpacing: ".1em" }}>GOLS</span>
              <span className="text-center" style={{ color: T.fraco, fontSize: 10, letterSpacing: ".1em" }}>DEFESAS</span>
              {cobradores.map(([jid, s]) => (
                <React.Fragment key={jid}>
                  <span style={{ padding: "6px 6px", fontWeight: 600 }}>{nomes[jid] || jid}</span>
                  <span className="text-center" style={{ padding: "6px 0", color: T.verde, fontWeight: 700 }}>{s.gols}/{s.chutes}</span>
                  <span className="text-center" style={{ padding: "6px 0", color: T.gk, fontWeight: 700 }}>{s.defesas}/{s.defesasTentadas}</span>
                </React.Fragment>
              ))}
            </div>
          </Painel>
        )}
      </section>

      <Penalidades {...{ copa, base, nomes, mudarCopa, souOrganizador, avisar }} />
    </div>
  );
}

export { ResultadosCopa };
