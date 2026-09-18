import React, { useState } from "react";
import { T } from "../../theme";
import { Botao, Painel, Secao, Segmento, Chip, inputStyle } from "../../components/ui";
import { IconeSetaEsquerda } from "../../components/icones";
import { id } from "../../core/repositorio";
import {
  CHUTES_POR_DUPLA, outro, estadoDisputa, iniciarDisputa, registrarChute, desfazerChute, marcarLesionado,
  placarDaPartida, vencedorDaPartida, duplaEfetiva, statusDaPartida, substitutosPossiveis,
} from "../../core/copaHendor";
import { formatarData, nomeDupla, textoDaDupla, notasDeSubstituicao } from "./util";

const STATUS = {
  encerrada: { rotulo: "Encerrada", cor: T.verde }, em_andamento: { rotulo: "Ao vivo", cor: T.laranja },
  pronta: { rotulo: "Pronta", cor: T.gk }, aguardando: { rotulo: "Aguardando", cor: T.fraco },
};

/* ----------------------------- placar ------------------------------------- */

function Placar({ copa, partida, nomes }) {
  const status = statusDaPartida(copa, partida);
  const venc = vencedorDaPartida(partida);
  const placar = placarDaPartida(partida);
  const fase = copa.fases.find((f) => f.id === partida.fase);
  const mostrar = status === "encerrada" || status === "em_andamento";
  const notas = notasDeSubstituicao(copa, partida, nomes);
  return (
    <Painel className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-destaque" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: T.ouro }}>
          {partida.rotulo} <span style={{ color: T.fraco, fontWeight: 600 }}>· {formatarData(fase.data)}</span>
        </span>
        <Chip cor={STATUS[status].cor}>{STATUS[status].rotulo}</Chip>
      </div>
      {["A", "B"].map((lado) => {
        const { texto, definida } = textoDaDupla(copa, partida, lado, nomes);
        const ganhou = venc === lado, perdeu = venc && venc !== lado;
        return (
          <div key={lado} className="flex items-center justify-between" style={{
            padding: "12px 14px", borderRadius: 10, gap: 10, opacity: perdeu ? 0.55 : 1,
            background: ganhou ? T.ouroFraco : "rgba(255,255,255,.04)",
            border: `1px solid ${ganhou ? "rgba(245,197,24,.45)" : "transparent"}`,
          }}>
            <span style={{ fontSize: 15, fontWeight: ganhou ? 800 : 600, color: ganhou ? T.ouro : definida ? T.texto : T.fraco, fontStyle: definida ? "normal" : "italic" }}>{texto}</span>
            {mostrar && (
              <b className="font-destaque" style={{ fontSize: partida.wo ? 14 : 30, lineHeight: 1, color: ganhou ? T.ouro : T.secundario }}>
                {partida.wo ? (ganhou ? "W.O." : "") : placar[lado]}
              </b>
            )}
          </div>
        );
      })}
      {notas.map((n, i) => <p key={i} style={{ fontSize: 11, color: T.laranja }}>↻ {n.texto}</p>)}
    </Painel>
  );
}

/* ----------------------------- lista de chutes ---------------------------- */

function ListaChutes({ partida, nomes }) {
  const chutes = partida.disputa?.chutes || [];
  if (!chutes.length) return null;
  return (
    <section>
      <Secao titulo="Chutes" detalhe={`${chutes.length} cobrança${chutes.length > 1 ? "s" : ""}`} />
      <Painel className="p-2 space-y-1">
        {chutes.map((c, i) => ({ c, n: i + 1 })).reverse().map(({ c, n }) => (
          <div key={n} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.2)", fontSize: 12.5, gap: 8 }}>
            <span className="min-w-0" style={{ color: T.secundario }}>
              <b style={{ color: T.fraco, marginRight: 6 }}>{n}</b>
              {nomes[c.cobrador]} <span style={{ color: T.fraco }}>cobra ·</span> {nomes[c.defensor]} <span style={{ color: T.fraco }}>defende</span>
              {c.fase === "alternada" && <span style={{ color: T.fraco }}> · alternada</span>}
            </span>
            <b style={{ color: c.resultado === "gol" ? T.verde : T.gk, flexShrink: 0 }}>{c.resultado === "gol" ? "GOL" : "DEFENDEU"}</b>
          </div>
        ))}
      </Painel>
    </section>
  );
}

/* ----------------------------- ao vivo ------------------------------------ */

function AoVivo({ copa, partida, nomes, souOrganizador, mudarPartida, duplas }) {
  const [lesao, setLesao] = useState(false);
  const d = partida.disputa;
  const est = estadoDisputa(d);
  const n = d.chutes.length;
  const registrar = (r) => mudarPartida(partida.id, (p) => ({ ...p, disputa: registrarChute(p.disputa, r) }));
  const desfazer = () => mudarPartida(partida.id, (p) => ({ ...p, disputa: desfazerChute(p.disputa) }));
  const prox = est.proximo;
  const total = CHUTES_POR_DUPLA * 2;
  const titulo = est.decidida ? "Disputa encerrada"
    : prox.fase === "regular" ? `Chute ${n + 1} de ${total}` : `Alternadas · rodada ${Math.floor((n - total) / 2) + 1}`;
  const todos = [...duplas.A, ...duplas.B];

  return (
    <section className="space-y-3">
      <Secao titulo={titulo} detalhe={est.decidida ? null : `Bola com ${nomeDupla(duplas[prox.lado], nomes)}`} />
      {est.decidida ? (
        <Painel className="p-3 text-center" style={{ background: T.ouroFraco, borderColor: "rgba(245,197,24,.4)" }}>
          <p style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: T.secundario }}>Dupla vencedora</p>
          <p className="font-destaque" style={{ fontSize: 20, fontWeight: 800, color: T.ouro, marginTop: 2 }}>{nomeDupla(duplas[est.vencedor], nomes)}</p>
        </Painel>
      ) : (
        <Painel className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div style={{ background: "rgba(0,0,0,.25)", borderRadius: 10, padding: "12px 6px" }}>
              <p style={{ fontSize: 10, letterSpacing: ".14em", color: T.fraco }}>COBRA</p>
              <p className="font-destaque" style={{ fontSize: 19, fontWeight: 800, color: T.texto, marginTop: 3 }}>{nomes[prox.cobrador]}</p>
            </div>
            <div style={{ background: "rgba(0,0,0,.25)", borderRadius: 10, padding: "12px 6px" }}>
              <p style={{ fontSize: 10, letterSpacing: ".14em", color: T.fraco }}>DEFENDE</p>
              <p className="font-destaque" style={{ fontSize: 19, fontWeight: 800, color: T.texto, marginTop: 3 }}>{nomes[prox.defensor]}</p>
            </div>
          </div>
          {souOrganizador ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => registrar("gol")} className="rounded-xl"
                style={{ minHeight: 76, fontSize: 20, fontWeight: 900, letterSpacing: ".06em", background: T.verde, color: "#002B18" }}>GOL</button>
              <button onClick={() => registrar("defendeu")} className="rounded-xl"
                style={{ minHeight: 76, fontSize: 20, fontWeight: 900, letterSpacing: ".06em", background: T.gk, color: T.sobreAzul }}>DEFENDEU</button>
            </div>
          ) : <p className="text-center" style={{ fontSize: 12, color: T.fraco }}>Acompanhando ao vivo — o placar atualiza sozinho.</p>}
          {est.emAlternadas && <p className="text-center" style={{ fontSize: 11.5, color: T.laranja }}>Empatou nas 4 cobranças — alternadas até desempatar (Art. 52).</p>}
        </Painel>
      )}

      {(d.lesionados || []).length > 0 && (
        <p style={{ fontSize: 11.5, color: T.laranja }}>
          Lesionado: {d.lesionados.map((j) => nomes[j]).join(", ")} — o parceiro executa os chutes e defesas que faltam (Art. 55 §3).
        </p>
      )}

      {souOrganizador && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {n === 0
              ? <Botao variante="secundario" className="flex-1" onClick={() => mudarPartida(partida.id, (p) => { const { disputa, ...resto } = p; return resto; })}>Voltar ao sorteio</Botao>
              : <Botao variante="secundario" className="flex-1" onClick={desfazer}>Desfazer último</Botao>}
            {!est.decidida && <Botao variante="secundario" className="flex-1" onClick={() => setLesao((v) => !v)}>Lesão</Botao>}
          </div>
          {lesao && !est.decidida && (
            <Painel className="p-3 space-y-2">
              <p style={{ fontSize: 12, color: T.secundario }}>Quem se lesionou? O parceiro da dupla assume o que falta.</p>
              <div className="grid grid-cols-2 gap-2">
                {todos.filter((j) => !(d.lesionados || []).includes(j)).map((j) => (
                  <Botao key={j} variante="secundario" style={{ minHeight: 44, fontSize: 12 }} onClick={() => {
                    mudarPartida(partida.id, (p) => ({ ...p, disputa: marcarLesionado(p.disputa, j) }));
                    setLesao(false);
                  }}>{nomes[j]}</Botao>
                ))}
              </div>
            </Painel>
          )}
        </div>
      )}
    </section>
  );
}

/* ----------------------------- troca de jogador --------------------------- */

function TrocaJogador({ copa, partida, base, dados, nomes, lado, sai, fechar, mudarPartida, setBase, avisar }) {
  const [aplicar, setAplicar] = useState("sim");
  const [marcarDevendo, setMarcarDevendo] = useState(false);
  const [outro_, setOutro] = useState("");
  const posicaoDe = (jid) => dados.classificacao.find((l) => l.id === jid)?.posicao;
  const { daFaseAnterior, outros, bloqueados } = substitutosPossiveis(copa, partida, base.jogadores, posicaoDe);
  const candidatos = daFaseAnterior.slice(0, 8);
  const demais = [...daFaseAnterior.slice(8), ...outros];
  const rotuloPos = (j) => (posicaoDe(j) ? `${posicaoDe(j)}º geral` : "—");
  const penaliza = aplicar === "sim";

  const confirmar = (entra) => {
    const quem = nomes[sai];
    const msg = entra
      ? `${nomes[entra]} entra no lugar de ${quem}${penaliza ? ` e ${quem} perde 5 pontos no Campeonato` : ""}?`
      : `Sem substituto: a dupla ${nomeDupla(duplaEfetiva(copa, partida, lado).jogadores, nomes)} é eliminada e o adversário vence por W.O.${penaliza ? ` ${quem} perde 5 pontos.` : ""} Confirmar?`;
    if (!confirm(msg)) return;
    setBase((b) => ({
      ...b,
      jogadores: penaliza && marcarDevendo ? b.jogadores.map((j) => (j.id === sai ? { ...j, pendenciaFinanceira: true } : j)) : b.jogadores,
      copas: b.copas.map((c) => c.id !== copa.id ? c : {
        ...c,
        penalidades: penaliza
          ? [...(c.penalidades || []), { id: id(), jogadorId: sai, valor: -5, motivo: `Ausência — ${partida.rotulo}`, partidaId: partida.id }]
          : c.penalidades || [],
        partidas: c.partidas.map((p) => {
          if (p.id !== partida.id) return p;
          if (!entra) return { ...p, wo: outro(lado) };
          const d = p[`dupla${lado}`] || {};
          return { ...p, [`dupla${lado}`]: { ...d, subs: [...(d.subs || []), { sai, entra, motivo: "Ausente (Art. 55 §1)" }] } };
        }),
      }),
    }));
    avisar(entra ? `${nomes[entra]} entrou no lugar de ${quem}` : "Dupla eliminada — vitória por W.O.");
    fechar();
  };

  return (
    <div className="space-y-3 rounded-lg p-3" style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${T.borda}` }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: T.ouro }}>Trocar {nomes[sai]}</p>
      <Segmento titulo="Penalidade (Art. 55 §4)" valor={aplicar} onChange={setAplicar}
        opcoes={[{ valor: "sim", rotulo: "Perde 5 pontos", cor: T.vermelho }, { valor: "nao", rotulo: "Justificado" }]} />
      <p style={{ fontSize: 10.5, color: T.fraco }}>
        Justificado = motivo familiar, atestado médico ou urgência profissional comprovados: sem perda de pontos.
      </p>
      {penaliza && (
        <label className="flex items-start" style={{ gap: 8, fontSize: 12, color: T.secundario }}>
          <input type="checkbox" checked={marcarDevendo} onChange={(e) => setMarcarDevendo(e.target.checked)} style={{ marginTop: 3 }} />
          Marcar pendência financeira ($) em {nomes[sai]} — multa de 50% do plano Amador
        </label>
      )}
      <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>
        Quem entra — eliminados da fase anterior (Art. 55 §1), por classificação
      </p>
      <div className="space-y-1.5">
        {candidatos.length === 0 && <p style={{ fontSize: 12, color: T.fraco }}>Nenhum eliminado disponível.</p>}
        {candidatos.map((j) => (
          <button key={j} onClick={() => confirmar(j)} className="flex w-full items-center justify-between rounded-lg"
            style={{ padding: "10px 12px", minHeight: 44, background: "rgba(255,255,255,.05)", border: `1px solid ${T.borda}`, fontSize: 13.5, fontWeight: 700, color: T.texto }}>
            <span>{nomes[j]}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: T.secundario }}>{rotuloPos(j)}</span>
          </button>
        ))}
      </div>
      {demais.length > 0 && (
        <div className="space-y-1.5">
          <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>
            Outros jogadores fora da Copa — escolha do organizador
          </p>
          <div className="flex gap-2">
            <select value={outro_} onChange={(e) => setOutro(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }}>
              <option value="">Escolher jogador…</option>
              {demais.map((j) => <option key={j} value={j}>{nomes[j]} — {rotuloPos(j)}</option>)}
            </select>
            <Botao style={{ padding: "0 14px" }} disabled={!outro_} onClick={() => confirmar(outro_)}>Trocar</Botao>
          </div>
        </div>
      )}
      {bloqueados.length > 0 && (
        <p style={{ fontSize: 11, color: T.vermelho }}>
          Fora por pendência financeira ($ "Sem sorteio" ou "Bloqueado"): {bloqueados.map((j) => nomes[j]).join(", ")} (Arts. 42 e 85).
        </p>
      )}
      <div className="flex gap-2">
        <Botao variante="secundario" className="flex-1" style={{ fontSize: 11.5 }} onClick={() => confirmar(null)}>Sem substituto</Botao>
        <Botao variante="secundario" className="flex-1" style={{ fontSize: 11.5 }} onClick={fechar}>Cancelar</Botao>
      </div>
    </div>
  );
}

/* ----------------------------- sorteio e ordem ---------------------------- */

function FormSorteio({ partida, nomes, duplas, mudarPartida, avisar }) {
  const [moeda, setMoeda] = useState("A");
  const [escolha, setEscolha] = useState("bater");
  const [cobA, setCobA] = useState(duplas.A[0]);
  const [defA, setDefA] = useState(duplas.A[0]);
  const [cobB, setCobB] = useState(duplas.B[0]);
  const [defB, setDefB] = useState(duplas.B[0]);
  const par = (lado, primeiro) => [primeiro, duplas[lado].find((j) => j !== primeiro)];
  const opcoes = (lado) => duplas[lado].map((j) => ({ valor: j, rotulo: nomes[j] }));
  const comeca = escolha === "bater" ? moeda : outro(moeda);

  const iniciar = () => {
    const disputa = iniciarDisputa({
      moeda: { vencedor: moeda, escolha },
      ordem: { A: { cobradores: par("A", cobA), defensores: par("A", defA) }, B: { cobradores: par("B", cobB), defensores: par("B", defB) } },
    });
    mudarPartida(partida.id, (p) => ({ ...p, disputa }));
    avisar("Disputa iniciada");
  };

  return (
    <Painel className="p-3 space-y-3">
      <Segmento titulo="Cara ou coroa — quem ganhou?" valor={moeda} onChange={setMoeda}
        opcoes={[{ valor: "A", rotulo: nomeDupla(duplas.A, nomes) }, { valor: "B", rotulo: nomeDupla(duplas.B, nomes) }]} />
      <Segmento titulo="Escolheu" valor={escolha} onChange={setEscolha}
        opcoes={[{ valor: "bater", rotulo: "Bater primeiro" }, { valor: "defender", rotulo: "Defender primeiro" }]} />
      {[["A", cobA, setCobA, defA, setDefA], ["B", cobB, setCobB, defB, setDefB]].map(([lado, cob, setCob, def, setDef]) => (
        <div key={lado} className="space-y-2 rounded-lg p-2" style={{ background: "rgba(0,0,0,.2)" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: T.ouro }}>{nomeDupla(duplas[lado], nomes)}</p>
          <Segmento titulo="Bate primeiro" valor={cob} onChange={setCob} opcoes={opcoes(lado)} />
          <Segmento titulo="Defende primeiro" valor={def} onChange={setDef} opcoes={opcoes(lado)} />
        </div>
      ))}
      <p style={{ fontSize: 12, color: T.secundario }}>
        Começa cobrando: <b style={{ color: T.texto }}>{nomeDupla(duplas[comeca], nomes)}</b> — {nomes[comeca === "A" ? cobA : cobB]} bate o 1º chute.
      </p>
      <Botao className="w-full" onClick={iniciar}>Iniciar disputa</Botao>
    </Painel>
  );
}

/* ----------------------------- antes do jogo ------------------------------ */

function PreJogo(props) {
  const { copa, partida, nomes, duplas, mudarPartida, avisar } = props;
  const [trocando, setTrocando] = useState(null); // { lado, sai }
  const woContra = (lado) => {
    const nome = nomeDupla(duplas[lado], nomes);
    if (confirm(`${nome} não compareceu? O adversário vence por W.O. (Art. 54).`)) {
      mudarPartida(partida.id, (p) => ({ ...p, wo: outro(lado) }));
      avisar("Vitória por W.O. registrada");
    }
  };
  return (
    <section className="space-y-3">
      <Secao titulo="Antes de começar" />
      <Painel className="p-3 space-y-3">
        <p style={{ fontSize: 12, color: T.secundario }}>Alguém faltou? Troque o jogador (Art. 55) ou dê W.O. se a dupla toda faltou (Art. 54).</p>
        {["A", "B"].map((lado) => (
          <div key={lado} className="flex flex-wrap items-center" style={{ gap: 6 }}>
            {duplas[lado].map((j) => (
              <button key={j} onClick={() => setTrocando({ lado, sai: j })} className="rounded-full"
                style={{ padding: "8px 12px", minHeight: 38, fontSize: 12.5, fontWeight: 700, border: `1px solid ${T.tier4}`, color: T.texto, background: "transparent" }}>
                Trocar {props.nomes[j]}
              </button>
            ))}
            <button onClick={() => woContra(lado)} className="rounded-full"
              style={{ padding: "8px 12px", minHeight: 38, fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,107,107,.5)", color: T.vermelho, background: "transparent" }}>
              W.O. da dupla
            </button>
          </div>
        ))}
        {trocando && <TrocaJogador {...props} {...trocando} fechar={() => setTrocando(null)} />}
      </Painel>
      <Secao titulo="Sorteio e ordem" />
      {/* key: se uma troca mudar a dupla, o formulário recomeça com os jogadores certos */}
      <FormSorteio key={[...duplas.A, ...duplas.B].join("|")} partida={partida} nomes={nomes} duplas={duplas} mudarPartida={mudarPartida} avisar={avisar} />
    </section>
  );
}

/* ----------------------------- correções ---------------------------------- */

function CorrigirResultado({ partida, mudarPartida, avisar }) {
  const [a, setA] = useState(partida.placarManual?.A ?? 0);
  const [b, setB] = useState(partida.placarManual?.B ?? 0);
  if (partida.disputa) return null;
  return (
    <Painel className="p-3 space-y-2">
      {partida.wo && (
        <Botao variante="secundario" className="w-full" onClick={() => { mudarPartida(partida.id, (p) => { const { wo, ...resto } = p; return resto; }); avisar("W.O. desfeito"); }}>Desfazer W.O.</Botao>
      )}
      {partida.placarManual && (
        <>
          <p style={{ fontSize: 12, color: T.secundario }}>Placar lançado a partir do chaveamento. Corrija se estiver errado:</p>
          <div className="flex items-center" style={{ gap: 8 }}>
            <input type="number" min="0" value={a} onChange={(e) => setA(e.target.value)} style={{ width: 64, textAlign: "center", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: 10, color: T.texto, fontSize: 15 }} />
            <span style={{ color: T.fraco }}>×</span>
            <input type="number" min="0" value={b} onChange={(e) => setB(e.target.value)} style={{ width: 64, textAlign: "center", background: T.tier2, border: `1px solid ${T.tier4}`, borderRadius: 8, padding: 10, color: T.texto, fontSize: 15 }} />
            <Botao className="flex-1" onClick={() => {
              if (Number(a) === Number(b)) return avisar("Não pode terminar empatado");
              mudarPartida(partida.id, (p) => ({ ...p, placarManual: { A: Number(a), B: Number(b) } }));
              avisar("Placar corrigido");
            }}>Salvar</Botao>
          </div>
        </>
      )}
    </Painel>
  );
}

/* ----------------------------- tela --------------------------------------- */

function PartidaDetalhe(props) {
  const { copa, partida, nomes, souOrganizador, voltar } = props;
  const status = statusDaPartida(copa, partida);
  const duplas = { A: duplaEfetiva(copa, partida, "A").jogadores, B: duplaEfetiva(copa, partida, "B").jogadores };
  return (
    <div className="space-y-4">
      <button onClick={voltar} className="flex items-center" style={{ gap: 6, color: T.ouro, fontSize: 13, fontWeight: 800, minHeight: 40 }}>
        <IconeSetaEsquerda tam={16} cor={T.ouro} /> Voltar ao chaveamento
      </button>
      <Placar copa={copa} partida={partida} nomes={nomes} />
      {status === "aguardando" && (
        <Painel className="p-4 text-center" style={{ fontSize: 12.5, color: T.secundario }}>
          As duplas desta partida saem dos resultados anteriores — assim que a partida de origem terminar, elas aparecem aqui.
        </Painel>
      )}
      {status === "pronta" && !souOrganizador && (
        <Painel className="p-4 text-center" style={{ fontSize: 12.5, color: T.secundario }}>A disputa ainda não começou. Esta tela atualiza sozinha.</Painel>
      )}
      {status === "pronta" && souOrganizador && <PreJogo {...props} duplas={duplas} />}
      {partida.disputa && (status === "em_andamento" || status === "encerrada") && <AoVivo {...props} duplas={duplas} />}
      {status === "encerrada" && souOrganizador && <CorrigirResultado {...props} />}
      <ListaChutes partida={partida} nomes={nomes} />
    </div>
  );
}

export { PartidaDetalhe };
