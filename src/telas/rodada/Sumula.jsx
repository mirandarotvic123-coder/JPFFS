import React, { useState } from "react";
import { T, corDe } from "../../theme";
import { normalizarCartoes, placarDe, timePorId, idsDoTime, poolsDoDia, evVazio } from "../../core/regras";
import { Botao, Painel, inputStyle, Segmento, SeloAtraso, Estrelas, IconeGoleiro } from "../../components/ui";
import { IconeSetaDireita } from "../../components/icones";

/* ========================= SÚMULA DA PARTIDA ==============================
 * Cabeçalho "PARTIDA N" (com recolher/abrir) → placar estilo transmissão →
 * um bloco por time com os gols e o elenco → Encerrar/Reabrir embaixo.
 *
 * Uso do dia a dia:
 *  - GOL: "+ Gol" no bloco do time → toca em quem fez (o gol já conta e as
 *    câmeras já disparam nesse toque) → toca em quem deu a assistência, ou
 *    "Sem assistência". Gol contra e gol não computado ficam na mesma lista.
 *    Errou? o × no gol lá na lista tira um.
 *  - CARTÃO e correções de um jogador (gol, assistência, cartão, trocar,
 *    só completando): tocar na linha dele no elenco.
 *  - Placar à mão (raro): tocar no número do placar liga o − / +.
 *
 * Os dados não mudaram: continua tudo em jogo.eventos[jid] (contagens),
 * golsContraA/B, golsNaoComputadosA/B, placarManual, soCartoes/completaTime.
 * ======================================================================== */

const evDe = (jogo, jid) => ({ ...evVazio, ...(jogo.eventos?.[jid] || {}) });
const ordenarElenco = (time) => [...(time.jogadores || [])].sort((a, b) => Number(!!b.atuaComoGoleiro) - Number(!!a.atuaComoGoleiro));

const CARTOES = [
  { campo: "ca", rotulo: "Amarelo", curto: "CA", cor: T.ouro },
  { campo: "cz", rotulo: "Azul", curto: "CZ", cor: T.gk },
  { campo: "cv", rotulo: "Vermelho", curto: "CV", cor: T.vermelho },
];

function Sumula({ jogo, rodada, base, cfg, dados, atualizar, avisar, niveis, porId, camerasAtivas, gatilhoLancesRef }) {
  const jog = Object.fromEntries(base.jogadores.map((j) => [j.id, j]));
  const [pendenteVaga, setPendenteVaga] = useState({});
  const [trocando, setTrocando] = useState(null); // { jid, timeId, goleiro, novoId, pontua } — trocar um jogador da partida por outro
  const [aberta, setAberta] = useState(!jogo.encerrado); // partidas já encerradas começam recolhidas
  const [expandido, setExpandido] = useState(null); // jid com o editor aberto no elenco
  const [editandoPlacar, setEditandoPlacar] = useState(false);
  const [folha, setFolha] = useState(null); // { tipo: "gol", lado, autor? }
  const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
  const p = placarDe(jogo, rodada);
  const soCartoes = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
  const mudar = (patch) => atualizar({ jogos: rodada.jogos.map((g) => (g.id === jogo.id ? { ...g, ...patch } : g)) });
  if (!tA || !tB) return null;
  const timeDe = (lado) => (lado === "A" ? tA : tB);
  const outro = (lado) => (lado === "A" ? "B" : "A");
  const nome = (jid) => jog[jid]?.nome || "?";
  const jaNestaPartida = new Set([...idsDoTime(tA), ...idsDoTime(tB)]);
  const candidatos = dados
    ? poolsDoDia(base, rodada, porId, dados, cfg).aptos.filter((e) => !jaNestaPartida.has(e.jogador.id))
    : [];
  const apareceuEmOutroJogo = (jid) => (rodada.jogos || []).some((g) => g.id !== jogo.id &&
    [g.timeA, g.timeB].some((tid) => idsDoTime(timePorId(rodada, tid)).includes(jid)));
  const forcaDe = (t) => (t.jogadores || []).filter((j) => !soCartoes.has(j.jogadorId)).reduce((s, j) => s + (j.estrelaNoSorteio || 0), 0);
  const forcaA = forcaDe(tA), forcaB = forcaDe(tB);
  const temVagaAberta = (tA.vagasAbertas || []).length > 0 || (tB.vagasAbertas || []).length > 0;
  const mediaForca = (forcaA + forcaB) / 2;
  const diffForca = Math.abs(forcaA - forcaB);
  const indiceEquilibrio = mediaForca > 0 ? Math.max(0, Math.min(100, Math.round(100 - (diffForca / mediaForca) * 70))) : 100;

  const preencherVaga = (timeId, papel, jogadorId, pontua) => {
    if (!jogadorId) return;
    const repete = !pontua; // decisão explícita de quem preencheu a vaga, não mais um palpite automático
    const l = porId[jogadorId];
    const cand = candidatos.find((e) => e.jogador.id === jogadorId);
    const novoTimes = (rodada.times || []).map((t) => {
      if (t.id !== timeId) return t;
      const idxVaga = (t.vagasAbertas || []).indexOf(papel);
      const vagasAbertas = idxVaga === -1 ? (t.vagasAbertas || [])
        : [...t.vagasAbertas.slice(0, idxVaga), ...t.vagasAbertas.slice(idxVaga + 1)];
      return {
        ...t, vagasAbertas,
        jogadores: [...(t.jogadores || []), {
          jogadorId, estrelaNoSorteio: cand?.jogador?.convidado ? (cand.jogador.estrelasIniciais || 1) : (l?.estrelas || 1),
          atuaComoGoleiro: papel === "GOLEIRO",
        }],
      };
    });
    const novoJogos = repete
      ? (rodada.jogos || []).map((g) => (g.id === jogo.id ? { ...g, soCartoes: [...new Set([...(g.soCartoes || []), jogadorId])] } : g))
      : rodada.jogos;
    atualizar({ times: novoTimes, jogos: novoJogos });
    avisar(repete ? `${nome(jogadorId)} completou a equipe — não pontua` : `${nome(jogadorId)} entrou na vaga e vai pontuar`);
  };

  /* Troca quem está numa vaga da partida por outro jogador (escolheu o errado, ou quem
   * veio não era o combinado). Mantém a vaga (time, goleiro/linha) e leva junto o "só
   * completando" conforme a escolha; os lançamentos (gol, assistência, cartão) do jogador que
   * sai NESTA partida são descartados — quem chama já confirmou. */
  const trocarJogador = (timeId, jidAntigo, jidNovo, pontua) => {
    if (!jidNovo || jidNovo === jidAntigo) return;
    const l = porId[jidNovo];
    const cand = candidatos.find((e) => e.jogador.id === jidNovo);
    const novoTimes = (rodada.times || []).map((t) => t.id !== timeId ? t : {
      ...t,
      jogadores: (t.jogadores || []).map((j) => j.jogadorId !== jidAntigo ? j : {
        ...j, jogadorId: jidNovo,
        estrelaNoSorteio: cand?.jogador?.convidado ? (cand.jogador.estrelasIniciais || 1) : (l?.estrelas || 1),
      }),
    });
    const { [jidAntigo]: _descartado, ...eventos } = jogo.eventos || {};
    const soCartoesNovo = [...(jogo.soCartoes || []).filter((x) => x !== jidAntigo), ...(pontua ? [] : [jidNovo])];
    atualizar({
      times: novoTimes,
      jogos: rodada.jogos.map((g) => g.id !== jogo.id ? g : {
        ...g, eventos, soCartoes: [...new Set(soCartoesNovo)], completaTime: (g.completaTime || []).filter((x) => x !== jidAntigo),
      }),
    });
    setTrocando(null);
    setExpandido(null);
    avisar(`${nome(jidNovo)} entrou no lugar de ${nome(jidAntigo)}${pontua ? "" : " (só completando)"}`);
  };

  const setEvento = (jid, campo, d) => {
    const at = evDe(jogo, jid);
    const novo = { ...at, [campo]: Math.max(0, at[campo] + d) };
    if (d > 0 && cfg.converterSegundoAmarelo && (campo === "ca" || campo === "cz")) {
      if (novo.ca >= 2) avisar(`${nome(jid)}: 2º amarelo vira vermelho (Art. 81º §Único)`);
      else if (novo.ca >= 1 && novo.cz >= 1) avisar(`${nome(jid)}: amarelo + azul vira vermelho (Art. 81º §Único)`);
    }
    mudar({ eventos: { ...jogo.eventos, [jid]: novo } });
  };
  const setPlacar = (lado, d) => {
    const atual = jogo.placarManual || { A: p.calcA, B: p.calcB };
    mudar({ placarManual: { ...atual, [lado]: Math.max(0, atual[lado] + d) } });
  };
  const ajustarGolQueSomaNoPlacar = (campo, ladoNoPlacar, d) => {
    const atualCampo = jogo[campo] || 0;
    const novoCampo = Math.max(0, atualCampo + d);
    const diff = novoCampo - atualCampo;
    const atualizacoes = { [campo]: novoCampo };
    if (jogo.placarManual && diff !== 0) {
      const pm = jogo.placarManual;
      atualizacoes.placarManual = { ...pm, [ladoNoPlacar]: Math.max(0, pm[ladoNoPlacar] + diff) };
    }
    mudar(atualizacoes);
  };

  /* com as câmeras ligadas, todo gol marcado aqui grava o lance */
  const gravarLanceDoGol = (jid, nomeAutor) => {
    if (!camerasAtivas) return;
    gatilhoLancesRef?.current?.golMarcado(jid, nomeAutor, `camp-${rodada.id}-${jogo.id}`, `Rodada ${rodada.numero} · Partida ${jogo.numero}`);
  };
  const somarGol = (jid) => { setEvento(jid, "gols", 1); gravarLanceDoGol(jid, nome(jid)); };

  /* fluxo do "+ Gol": autor → assistência */
  function golDe(lado, jid) {
    if (soCartoes.has(jid)) {
      // só completando (Art. 35º §1º) não pontua: o gol vale pro placar do time, mas não vai pra estatística dele
      ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, 1);
      gravarLanceDoGol(jid, nome(jid));
      avisar(`${nome(jid)} só completa a equipe (Art. 35º §1º) — entrou como gol não computado`);
      setFolha(null);
      return;
    }
    somarGol(jid);
    const companheiros = idsDoTime(timeDe(lado)).filter((x) => x !== jid && !soCartoes.has(x));
    if (companheiros.length) setFolha({ tipo: "gol", lado, autor: jid });
    else { setFolha(null); avisar(`Gol de ${nome(jid)}`); }
  }
  function golSemAutor(lado, campo) {
    if (campo === "contra") ajustarGolQueSomaNoPlacar(`golsContra${outro(lado)}`, lado, 1);
    else ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, 1);
    gravarLanceDoGol(null, null);
    avisar(campo === "contra" ? `Gol contra do ${timeDe(outro(lado)).cor} — ponto pro ${timeDe(lado).cor}` : "Gol não computado lançado");
    setFolha(null);
  }
  function assistencia(jid) {
    const autor = folha?.autor;
    if (jid) setEvento(jid, "assistencias", 1);
    avisar(`Gol de ${nome(autor)}${jid ? ` · assistência de ${nome(jid)}` : ""}`);
    setFolha(null);
  }
  /* gols já lançados de um lado, pra lista do bloco do time (cada um com × pra tirar) */
  const golsDoLado = (lado) => {
    const itens = [];
    for (const { jogadorId: jid } of ordenarElenco(timeDe(lado))) {
      const g = evDe(jogo, jid).gols;
      if (g > 0) itens.push({ chave: jid, rotulo: nome(jid), n: g, tirar: () => setEvento(jid, "gols", -1) });
    }
    const contra = jogo[`golsContra${outro(lado)}`] || 0;
    if (contra) itens.push({ chave: "contra", rotulo: "Gol contra", n: contra, fraco: true, tirar: () => ajustarGolQueSomaNoPlacar(`golsContra${outro(lado)}`, lado, -1) });
    const naoComp = jogo[`golsNaoComputados${lado}`] || 0;
    if (naoComp) itens.push({ chave: "naoComp", rotulo: "Não computado", n: naoComp, fraco: true, tirar: () => ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, -1) });
    return itens;
  };

  const encerrarOuReabrir = () => {
    mudar({ encerrado: !jogo.encerrado, placarManual: jogo.placarManual || { A: p.A, B: p.B } });
    avisar(jogo.encerrado ? `Partida ${jogo.numero} reaberta` : `Partida ${jogo.numero} encerrada · ${p.A}×${p.B}`);
    if (!jogo.encerrado) { setEditandoPlacar(false); setExpandido(null); }
  };

  const propsLinha = (time) => ({
    jogo, cfg, niveis, soCartoes, nome, candidatos, apareceuEmOutroJogo, time,
    trocando, setTrocando, setEvento, somarGol, trocarJogador, mudar,
  });

  return (
    <Painel style={{ border: `1.5px solid ${jogo.encerrado ? "rgba(61,214,140,.5)" : T.tier4}`, overflow: "hidden" }}>
      <CabecalhoPartida jogo={jogo} aberta={aberta} onAlternar={() => setAberta((v) => !v)} />
      <PlacarPartida {...{ jogo, tA, tB, p, editandoPlacar, setPlacar }}
        onEditar={jogo.encerrado ? null : () => setEditandoPlacar((v) => !v)} />

      {aberta && (
        <>
          <div className="flex flex-wrap items-center justify-center px-3 py-2" style={{ gap: "4px 8px", fontSize: 11, color: T.secundario, background: "rgba(0,0,0,.18)" }}>
            <span style={{ color: corDe(tA.chave).hex, fontWeight: 800 }}>{forcaA}★</span>
            <span style={{ fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.fraco }}>Equilíbrio</span>
            <span style={{ fontWeight: 900, color: indiceEquilibrio >= 90 ? T.verde : indiceEquilibrio >= 75 ? T.ouro : T.laranja }}>{indiceEquilibrio}%</span>
            <span style={{ color: corDe(tB.chave).hex, fontWeight: 800 }}>{forcaB}★</span>
            {temVagaAberta && <span style={{ color: T.laranja }}>· parcial (tem vaga aberta)</span>}
          </div>

          {(p.manual || editandoPlacar) && (
            <p className="px-3 text-center" style={{ paddingTop: 8, fontSize: 11, lineHeight: 1.5, color: p.divergente ? T.laranja : T.fraco }}>
              {p.manual
                ? <>Placar lançado à mão{p.divergente && ` · a soma dos gols dá ${p.calcA}×${p.calcB}`} · <button onClick={() => mudar({ placarManual: null })} style={{ textDecoration: "underline" }}>voltar ao automático</button></>
                : <>Use − / + no placar só pra corrigir o resultado. Gol de jogador é no “+ Gol” do time. · <button onClick={() => setEditandoPlacar(false)} style={{ textDecoration: "underline" }}>pronto</button></>}
            </p>
          )}

          <div className="sumula-times">
            {["A", "B"].map((lado) => {
              const time = timeDe(lado);
              return (
                <BlocoTime key={lado} time={time} gols={golsDoLado(lado)} bloqueado={jogo.encerrado}
                  onGol={() => setFolha({ tipo: "gol", lado })}>
                  {ordenarElenco(time).map((vaga) => (
                    <LinhaJogador key={vaga.jogadorId} vaga={vaga} {...propsLinha(time)}
                      aberto={expandido === vaga.jogadorId}
                      onAlternar={() => { setExpandido((x) => (x === vaga.jogadorId ? null : vaga.jogadorId)); setTrocando(null); }} />
                  ))}
                  {(time.vagasAbertas || []).map((papel, vi) => (
                    <VagaAberta key={`${time.id}-${vi}`} chave={`${time.id}-${vi}`} {...{ time, papel, tA, tB, candidatos, apareceuEmOutroJogo, pendenteVaga, setPendenteVaga, preencherVaga, nome }} />
                  ))}
                </BlocoTime>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-1 px-3 pb-4">
            <Botao variante={jogo.encerrado ? "secundario" : "primario"} onClick={encerrarOuReabrir} style={{ minHeight: 42, padding: "0 28px", fontSize: 12 }}>
              {jogo.encerrado ? "Reabrir partida" : "Encerrar partida"}
            </Botao>
            {!jogo.encerrado && <p style={{ fontSize: 10.5, color: T.fraco }}>Só entra na classificação depois de encerrada.</p>}
          </div>
        </>
      )}

      {folha?.tipo === "gol" && !folha.autor && (
        <Folha titulo={`Gol do ${timeDe(folha.lado).cor}`} subtitulo="Quem fez?" cor={corDe(timeDe(folha.lado).chave).hex} onFechar={() => setFolha(null)}>
          <GradeJogadores ids={idsDoTime(timeDe(folha.lado))} nome={nome} goleiros={goleirosDe(timeDe(folha.lado))}
            marca={(jid) => (soCartoes.has(jid) ? "só completa · não computado" : null)}
            onEscolher={(jid) => golDe(folha.lado, jid)} />
          <div className="grid grid-cols-2 gap-2" style={{ marginTop: 12 }}>
            <BotaoFolha secundario onClick={() => golSemAutor(folha.lado, "contra")}>Gol contra do {timeDe(outro(folha.lado)).cor.toLowerCase()}</BotaoFolha>
            <BotaoFolha secundario onClick={() => golSemAutor(folha.lado, "naoComp")}>Não computado</BotaoFolha>
          </div>
          <p className="mt-2 text-center" style={{ fontSize: 10.5, color: T.fraco }}>
            Não computado: gol que ninguém viu quem fez — soma no placar sem ir pra estatística de ninguém.
          </p>
        </Folha>
      )}

      {folha?.tipo === "gol" && folha.autor && (
        <Folha titulo={`Gol de ${nome(folha.autor)} ✓`} subtitulo="Assistência de quem?" cor={corDe(timeDe(folha.lado).chave).hex} onFechar={() => assistencia(null)}>
          <GradeJogadores ids={idsDoTime(timeDe(folha.lado)).filter((x) => x !== folha.autor && !soCartoes.has(x))} nome={nome}
            goleiros={goleirosDe(timeDe(folha.lado))} onEscolher={assistencia} />
          <div style={{ marginTop: 12 }}><BotaoFolha secundario onClick={() => assistencia(null)}>Sem assistência</BotaoFolha></div>
        </Folha>
      )}

    </Painel>
  );
}

const goleirosDe = (time) => new Set((time.jogadores || []).filter((j) => j.atuaComoGoleiro).map((j) => j.jogadorId));

/* --------------------------- Placar (topo) -------------------------------*/

function Escudo({ cor, tam = 40 }) {
  return (
    <svg width={tam} height={tam * 1.15} viewBox="0 0 40 46" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M20 2 37 8v14c0 11-7.5 18.5-17 22C10.5 40.5 3 33 3 22V8L20 2Z" fill={`${cor}2E`} stroke={cor} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M13 17h14l-2 9H15l-2-9Zm0 0 3.5 3.5L20 15l3.5 5.5L27 17" fill="none" stroke={cor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CabecalhoPartida({ jogo, aberta, onAlternar }) {
  return (
    <div className="flex items-center justify-between gap-2" style={{ padding: "8px 8px 8px 14px", background: T.tier2, borderBottom: `1px solid ${T.tier4}` }}>
      <span className="font-destaque flex min-w-0 items-center gap-2" style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".14em", color: jogo.extra ? T.laranja : T.ouro }}>
        PARTIDA {jogo.numero}{jogo.extra ? " · SOBRESSALENTES" : ""}
      </span>
      <button onClick={onAlternar} aria-expanded={aberta} className="flex items-center rounded-lg"
        style={{ gap: 6, height: 36, padding: "0 12px", flexShrink: 0, border: `1px solid ${T.tier4}`, background: "rgba(255,255,255,.05)", color: T.texto, fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>
        {aberta ? "Recolher" : "Abrir"}
        <IconeSetaDireita tam={14} style={{ transform: aberta ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .15s" }} />
      </button>
    </div>
  );
}

function PlacarPartida({ jogo, tA, tB, p, editandoPlacar, setPlacar, onEditar }) {
  const cA = corDe(tA.chave).hex, cB = corDe(tB.chave).hex;
  const status = jogo.encerrado ? { t: "Encerrada", c: T.verde } : p.manual ? { t: "Placar à mão", c: T.laranja } : { t: "Em andamento", c: T.secundario };
  const Lado = ({ time, cor, alinhar }) => (
    <div className={`flex min-w-0 flex-col items-center gap-1.5 ${alinhar}`}>
      <Escudo cor={cor} />
      <span className="font-destaque truncate" style={{ maxWidth: "100%", fontSize: 15, fontWeight: 700, letterSpacing: ".08em", color: T.texto }}>{time.cor}</span>
    </div>
  );
  const Numero = ({ lado }) => (
    <div className="flex flex-col items-center gap-1.5">
      {/* tocar no número liga/desliga a correção do placar à mão */}
      <button onClick={onEditar || undefined} disabled={!onEditar} title={onEditar ? "Corrigir o placar à mão" : undefined}
        className="font-destaque flex items-center justify-center" style={{ width: 58, height: 64, borderRadius: 10, background: "rgba(0,8,30,.55)", border: `1px solid ${editandoPlacar ? T.ouro : T.borda}`, fontSize: 42, fontWeight: 700, lineHeight: 1, color: T.texto }}>
        {p[lado]}
      </button>
      {editandoPlacar && (
        <div className="flex gap-1">
          <button onClick={() => setPlacar(lado, -1)} aria-label="Tirar 1 do placar" style={{ width: 27, height: 30, borderRadius: 7, background: "rgba(255,255,255,.08)", color: T.secundario, fontSize: 17 }}>−</button>
          <button onClick={() => setPlacar(lado, 1)} aria-label="Somar 1 no placar" style={{ width: 27, height: 30, borderRadius: 7, background: "rgba(255,255,255,.08)", color: T.ouro, fontSize: 17 }}>+</button>
        </div>
      )}
    </div>
  );
  return (
    <div style={{ position: "relative", background: `linear-gradient(90deg, ${cA}24 0%, rgba(0,0,0,.12) 38%, rgba(0,0,0,.12) 62%, ${cB}24 100%)`, borderBottom: `1px solid ${T.borda}` }}>
      <div className="grid items-center gap-2" style={{ padding: "16px 12px 12px", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)" }}>
        <Lado time={tA} cor={cA} alinhar="" />
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-start gap-2">
            <Numero lado="A" />
            <span className="font-destaque" style={{ fontSize: 28, lineHeight: "64px", fontWeight: 700, color: "rgba(219,225,255,.35)" }}>:</span>
            <Numero lado="B" />
          </div>
          <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: status.c, background: "rgba(0,8,30,.55)", border: `1px solid ${status.c}55` }}>
            {status.t}
          </span>
        </div>
        <Lado time={tB} cor={cB} alinhar="" />
      </div>
    </div>
  );
}

/* --------------------------- Bloco de um time ----------------------------*/

function BlocoTime({ time, gols, bloqueado, onGol, children }) {
  const cor = corDe(time.chave).hex;
  const n = (time.jogadores || []).length;
  return (
    <div className="min-w-0 rounded-lg" style={{ border: `1px solid ${cor}55`, background: "rgba(0,0,0,.16)" }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${T.borda}` }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: cor, flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <p className="font-destaque truncate" style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".06em", color: T.texto, lineHeight: 1.1 }}>{time.cor}</p>
          <p style={{ fontSize: 10.5, color: T.fraco }}>{n} jogador{n === 1 ? "" : "es"}</p>
        </div>
        {!bloqueado && (
          <button onClick={onGol} className="flex items-center rounded-lg"
            style={{ gap: 6, height: 40, padding: "0 14px", background: T.ouro, color: T.sobreOuro, fontSize: 12, fontWeight: 900, letterSpacing: ".06em", textTransform: "uppercase", flexShrink: 0 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Gol
          </button>
        )}
      </div>

      <div className="px-3 py-2" style={{ borderBottom: `1px solid ${T.borda}` }}>
        {gols.length === 0
          ? <p style={{ fontSize: 11.5, color: T.fraco }}>Nenhum gol ainda</p>
          : (
            <div className="flex flex-wrap gap-1.5">
              {gols.map((g) => (
                <span key={g.chave} className="flex items-center rounded-full"
                  style={{ gap: 6, padding: "3px 4px 3px 10px", fontSize: 12, fontWeight: 700, background: g.fraco ? "rgba(255,255,255,.05)" : `${cor}1F`, border: `1px solid ${g.fraco ? T.borda : cor + "55"}`, color: g.fraco ? T.secundario : T.texto }}>
                  ⚽ {g.rotulo}{g.n > 1 && <b style={{ color: cor }}>×{g.n}</b>}
                  {!bloqueado && (
                    <button onClick={g.tirar} title="Tirar 1 gol" aria-label={`Tirar 1 gol de ${g.rotulo}`}
                      style={{ width: 24, height: 24, borderRadius: 999, color: T.fraco, fontSize: 14, lineHeight: 1 }}>×</button>
                  )}
                </span>
              ))}
            </div>
          )}
      </div>

      <div className="grid items-center px-3" style={{ padding: "8px 12px 4px", gridTemplateColumns: "minmax(0,1fr) 30px 30px 46px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.fraco }}>
        <span>Jogador</span><span className="text-center">G</span><span className="text-center">A</span><span className="text-center">Cart.</span>
      </div>
      <div style={{ padding: "0 6px 6px" }}>{children}</div>
    </div>
  );
}

/* Uma linha do elenco: nome + G / A / cartões. Toque abre o editor do jogador. */
function LinhaJogador({ vaga, jogo, cfg, niveis, soCartoes, nome, candidatos, apareceuEmOutroJogo, time,
  trocando, setTrocando, setEvento, somarGol, trocarJogador, mudar, aberto, onAlternar }) {
  const { jogadorId: jid, atuaComoGoleiro, estrelaNoSorteio } = vaga;
  const bruto = evDe(jogo, jid);
  const ev = normalizarCartoes(bruto, cfg);
  const virouVermelho = ev.cv !== bruto.cv;
  const soCartao = soCartoes.has(jid);
  const expulso = bruto.cv > 0 || bruto.ca >= 2 || (bruto.ca >= 1 && bruto.cz >= 1);
  const valor = (v) => (v > 0 ? <b style={{ color: T.texto }}>{v}</b> : <span style={{ color: "rgba(219,225,255,.22)" }}>–</span>);
  const temCartao = bruto.ca + bruto.cz + bruto.cv > 0;

  return (
    <div className="rounded-lg" style={{ marginTop: 2, background: aberto ? "rgba(245,197,24,.07)" : "transparent", border: `1px solid ${aberto ? "rgba(245,197,24,.35)" : "transparent"}` }}>
      <button onClick={onAlternar} className="grid w-full items-center rounded-lg text-left"
        style={{ padding: "0 6px", gridTemplateColumns: "minmax(0,1fr) 30px 30px 46px", minHeight: 44, background: aberto ? "transparent" : atuaComoGoleiro ? "rgba(59,147,238,.08)" : "rgba(255,255,255,.03)" }}>
        <span className="flex min-w-0 items-center gap-1.5">
          {atuaComoGoleiro && <IconeGoleiro tam={14} />}
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: soCartao ? T.fraco : expulso ? T.vermelho : T.texto, fontStyle: soCartao ? "italic" : "normal" }}>{nome(jid)}</span>
              {niveis?.[jid] && <SeloAtraso nivel={niveis[jid]} cfg={cfg} mini />}
              {soCartao && <span style={{ fontSize: 9, fontWeight: 800, color: T.laranja, background: "rgba(255,165,61,.16)", borderRadius: 3, padding: "0 4px", flexShrink: 0 }}>COMPLETA</span>}
            </span>
            <Estrelas n={estrelaNoSorteio || 1} tam={8.5} goleiro={atuaComoGoleiro} />
          </span>
        </span>
        <span className="text-center" style={{ fontSize: 13.5 }}>{valor(bruto.gols)}</span>
        <span className="text-center" style={{ fontSize: 13.5 }}>{valor(bruto.assistencias)}</span>
        <span className="flex items-center justify-center gap-0.5">
          {temCartao ? CARTOES.flatMap((c) => Array.from({ length: Math.min(bruto[c.campo], 2) }, (_, i) => (
            <span key={c.campo + i} style={{ width: 8, height: 12, borderRadius: 1.5, background: c.cor }} />
          ))) : valor(0)}
        </span>
      </button>

      {aberto && (
        <div className="space-y-2" style={{ padding: "4px 8px 8px" }}>
          {soCartao && <p style={{ fontSize: 10.5, color: T.laranja }}>Completou a equipe (Art. 35º §1º) — não pontua nada, nem cartão. Gol dele entra como não computado.</p>}
          {!soCartao && virouVermelho && bruto.ca >= 2 && <p style={{ fontSize: 10.5, color: T.vermelho }}>2º amarelo → vermelho (Art. 81º) · cartões bloqueados nesta partida</p>}
          {!soCartao && virouVermelho && bruto.ca < 2 && <p style={{ fontSize: 10.5, color: T.vermelho }}>Amarelo + azul → vermelho (Art. 81º) · cartões bloqueados nesta partida</p>}
          {!soCartao && !virouVermelho && bruto.cv > 0 && <p style={{ fontSize: 10.5, color: T.vermelho }}>Vermelho direto · cartões bloqueados nesta partida</p>}

          {!soCartao && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Passo rotulo="Gols" valor={bruto.gols} onMenos={() => setEvento(jid, "gols", -1)} onMais={() => somarGol(jid)} />
                <Passo rotulo="Assist." valor={bruto.assistencias} onMenos={() => setEvento(jid, "assistencias", -1)} onMais={() => setEvento(jid, "assistencias", 1)} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CARTOES.map((c) => (
                  <Passo key={c.campo} rotulo={c.curto} cor={c.cor} valor={bruto[c.campo]}
                    onMenos={() => setEvento(jid, c.campo, -1)}
                    onMais={() => !expulso && setEvento(jid, c.campo, 1)} travaMais={expulso}
                    dicaMais={expulso ? "Já foi expulso nesta partida — não dá pra somar mais cartão" : undefined} />
                ))}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => setTrocando((t) => (t?.jid === jid ? null : { jid, timeId: time.id, goleiro: !!atuaComoGoleiro, novoId: "", pontua: !soCartao }))}
              className="rounded-lg" style={{ minHeight: 38, fontSize: 11.5, fontWeight: 800, border: `1px solid ${trocando?.jid === jid ? T.ouro : T.tier4}`, color: trocando?.jid === jid ? T.ouro : T.secundario }}>
              ⇄ Trocar jogador
            </button>
            <button onClick={() => mudar({
              completaTime: (jogo.completaTime || []).filter((x) => x !== jid),
              soCartoes: soCartao ? (jogo.soCartoes || []).filter((x) => x !== jid) : [...new Set([...(jogo.soCartoes || []), jid])],
            })} title="Art. 35º §1º — entrou só para completar equipe: não pontua nada, nem cartão"
              className="rounded-lg" style={{ minHeight: 38, fontSize: 11.5, fontWeight: 800, border: `1px solid ${soCartao ? T.laranja : T.tier4}`, background: soCartao ? "rgba(255,165,61,.14)" : "transparent", color: soCartao ? T.laranja : T.secundario }}>
              {soCartao ? "Só completando ✓" : "Só completando"}
            </button>
          </div>

          {trocando?.jid === jid && (
            <PainelTroca {...{ jid, atuaComoGoleiro, bruto, candidatos, apareceuEmOutroJogo, trocando, setTrocando, trocarJogador, nome }} />
          )}
        </div>
      )}
    </div>
  );
}

function Passo({ rotulo, valor, cor = T.secundario, onMenos, onMais, travaMais, dicaMais }) {
  return (
    <div className="flex items-center justify-between rounded-lg" style={{ background: cor === T.secundario ? "rgba(255,255,255,.06)" : `${cor}1A`, padding: 2 }}>
      <button onClick={onMenos} aria-label={`Tirar 1 (${rotulo})`} style={{ width: 34, height: 36, color: T.fraco, fontSize: 17 }}>−</button>
      <span className="flex flex-col items-center" style={{ lineHeight: 1.1 }}>
        <b style={{ fontSize: 14, color: T.texto }}>{valor}</b>
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: cor }}>{rotulo}</span>
      </span>
      <button onClick={onMais} title={dicaMais} aria-label={`Somar 1 (${rotulo})`} style={{ width: 34, height: 36, color: cor === T.secundario ? T.ouro : cor, fontSize: 17, opacity: travaMais ? 0.3 : 1 }}>+</button>
    </div>
  );
}

function PainelTroca({ jid, atuaComoGoleiro, bruto, candidatos, apareceuEmOutroJogo, trocando, setTrocando, trocarJogador, nome }) {
  const opcoes = [...candidatos].sort((a, b) => {
    if (atuaComoGoleiro) {
      const ga = a.jogador.posicao === "GOLEIRO" ? 0 : 1, gb = b.jogador.posicao === "GOLEIRO" ? 0 : 1;
      if (ga !== gb) return ga - gb;
    }
    return a.jogador.nome.localeCompare(b.jogador.nome, "pt-BR");
  });
  const lancou = bruto.gols + bruto.assistencias + bruto.ca + bruto.cv + bruto.cz;
  return (
    <div className="space-y-2 rounded-lg" style={{ background: "rgba(255,200,61,.08)", border: `1px dashed ${T.ouro}`, padding: 6 }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", color: T.ouro }}>
        TROCAR {nome(jid).toUpperCase()} POR…
      </span>
      <select value={trocando.novoId} onChange={(e) => {
        const novoId = e.target.value;
        setTrocando((t) => ({ ...t, novoId, pontua: novoId ? !apareceuEmOutroJogo(novoId) : t.pontua }));
      }} style={{ ...inputStyle, padding: "8px 6px", fontSize: 12.5 }}>
        <option value="">— escolher jogador —</option>
        {opcoes.map(({ jogador: o, linha: lin }) => (
          <option key={o.id} value={o.id}>
            {o.nome}{o.posicao === "GOLEIRO" ? " (GK)" : ""} · {lin?.estrelas || 1}★
            {apareceuEmOutroJogo(o.id) ? " · já jogou noutro jogo" : ""}
          </option>
        ))}
      </select>
      {trocando.novoId && (
        <Segmento valor={trocando.pontua} onChange={(v) => setTrocando((t) => ({ ...t, pontua: v }))}
          opcoes={[
            { valor: true, rotulo: "Vai pontuar" },
            { valor: false, rotulo: "Só completando", cor: T.laranja },
          ]} />
      )}
      {opcoes.length === 0 && <p style={{ fontSize: 10, color: T.fraco }}>Ninguém presente disponível — marque a chegada na etapa Presença.</p>}
      <div className="flex gap-1.5">
        <Botao variante="secundario" className="flex-1" style={{ minHeight: 38, fontSize: 11 }} onClick={() => setTrocando(null)}>Cancelar</Botao>
        <Botao className="flex-1" style={{ minHeight: 38, fontSize: 11 }} disabled={!trocando.novoId}
          onClick={() => {
            if (lancou > 0 && !confirm(`${nome(jid)} tem lançamentos nesta partida (gols, assistências ou cartões). Trocar apaga esses lançamentos — o placar não muda sozinho, ajuste-o se precisar. Continuar?`)) return;
            trocarJogador(trocando.timeId, jid, trocando.novoId, trocando.pontua);
          }}>
          Trocar
        </Botao>
      </div>
    </div>
  );
}

function VagaAberta({ chave, time, papel, tA, tB, candidatos, apareceuEmOutroJogo, pendenteVaga, setPendenteVaga, preencherVaga, nome }) {
  const jaEscolhidos = new Set([...idsDoTime(tA), ...idsDoTime(tB)]);
  const opcoes = candidatos.filter((e) => !jaEscolhidos.has(e.jogador.id));
  const pend = pendenteVaga[chave];
  const limpar = () => setPendenteVaga((s) => { const c = { ...s }; delete c[chave]; return c; });
  return (
    <div className="rounded-lg" style={{ marginTop: 4, background: "rgba(255,165,61,.1)", border: `1px dashed ${T.laranja}`, padding: 6 }}>
      <div className="mb-1 flex items-center gap-1">
        {papel === "GOLEIRO" ? <IconeGoleiro tam={12} /> : <span style={{ fontSize: 10, color: T.laranja }}>▢</span>}
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", color: T.laranja }}>VAGA DE {papel} · quem chegou</span>
      </div>
      <select value={pend?.jogadorId || ""} onChange={(e) => {
        const jid = e.target.value;
        if (!jid) { limpar(); return; }
        setPendenteVaga((s) => ({ ...s, [chave]: { jogadorId: jid, pontua: !apareceuEmOutroJogo(jid) } }));
      }}
        style={{ ...inputStyle, padding: "8px 6px", fontSize: 12.5 }}>
        <option value="">— escolher quem completa —</option>
        {opcoes.map(({ jogador: o, linha: l }) => (
          <option key={o.id} value={o.id}>
            {o.nome}{o.posicao === "GOLEIRO" ? " (GK)" : ""} · {l?.estrelas || 1}★
            {apareceuEmOutroJogo(o.id) ? " · já jogou noutro jogo" : ""}
          </option>
        ))}
      </select>
      {pend && (
        <div className="mt-1.5 space-y-2">
          <Segmento valor={pend.pontua} onChange={(v) => setPendenteVaga((s) => ({ ...s, [chave]: { ...s[chave], pontua: v } }))}
            opcoes={[
              { valor: true, rotulo: "Vai pontuar" },
              { valor: false, rotulo: "Só completando", cor: T.laranja },
            ]} />
          <Botao className="w-full" style={{ minHeight: 40, fontSize: 11 }}
            onClick={() => { preencherVaga(time.id, papel, pend.jogadorId, pend.pontua); limpar(); }}>
            Encaixar {nome(pend.jogadorId)}
          </Botao>
        </div>
      )}
      {opcoes.length === 0 && <p style={{ fontSize: 10, color: T.fraco, marginTop: 3 }}>Ninguém presente disponível ainda — marque a chegada na etapa Presença.</p>}
    </div>
  );
}

/* --------------------------- Ações e folhas ------------------------------*/

/* Folha que sobe de baixo (celular) — escolhas grandes, um toque cada. */
function Folha({ titulo, subtitulo, cor, onFechar, children }) {
  return (
    <div onClick={onFechar} className="flex justify-center"
      style={{ alignItems: "flex-end", position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,8,30,.72)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "86vh", overflowY: "auto", background: T.tier1,
          borderTop: `3px solid ${cor}`, borderRadius: "16px 16px 0 0", padding: "14px 14px calc(16px + env(safe-area-inset-bottom))",
        }}>
        <div className="flex items-start justify-between gap-2" style={{ marginBottom: 12 }}>
          <div className="min-w-0">
            <p className="font-destaque truncate" style={{ fontSize: 19, fontWeight: 700, color: T.texto }}>{titulo}</p>
            {subtitulo && <p style={{ fontSize: 12.5, color: T.secundario }}>{subtitulo}</p>}
          </div>
          <button onClick={onFechar} aria-label="Fechar" style={{ width: 36, height: 36, borderRadius: 999, color: T.secundario, fontSize: 20, background: "rgba(255,255,255,.06)", flexShrink: 0 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GradeJogadores({ ids, nome, goleiros, onEscolher, desativado, marca }) {
  if (!ids.length) return <p style={{ fontSize: 12, color: T.fraco }}>Ninguém pra escolher.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {ids.map((jid) => {
        const off = desativado?.(jid);
        const m = marca?.(jid);
        return (
          <button key={jid} onClick={() => !off && onEscolher(jid)} disabled={off} className="flex items-center gap-2 rounded-lg text-left"
            style={{ minHeight: 52, padding: "6px 10px", background: "rgba(255,255,255,.05)", border: `1px solid ${T.tier4}`, opacity: off ? 0.35 : 1 }}>
            {goleiros?.has(jid) && <IconeGoleiro tam={14} />}
            <span className="min-w-0">
              <span className="block truncate" style={{ fontSize: 14, fontWeight: 700, color: T.texto }}>{nome(jid)}</span>
              {m && <span className="block" style={{ fontSize: 9.5, fontWeight: 800, color: T.laranja }}>{m}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BotaoFolha({ children, onClick, secundario }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg"
      style={{ minHeight: 46, padding: "8px 10px", fontSize: 12.5, fontWeight: 800, letterSpacing: ".03em", background: secundario ? "transparent" : T.ouro, color: secundario ? T.secundario : T.sobreOuro, border: `1px solid ${secundario ? T.tier4 : T.ouro}` }}>
      {children}
    </button>
  );
}

export { Sumula };
