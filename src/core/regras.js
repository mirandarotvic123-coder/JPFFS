/* core/regras — pontuação, disciplina, classificação e o motor de sorteio
 * equilibrado. Tudo aqui é puro: recebe dados, devolve dados, sem React e
 * sem tela nenhuma — dá pra testar isolado.
 */
import { AMARELO, AZUL } from "../theme";
import { criarRng, novaSeed, embaralharRng, distribuirProporcional } from "./rng";

const CONFIG_PADRAO = {
  pontosPresenca: 1, pontosVitoria: 3, pontosEmpate: 1, pontosDerrota: 0,
  tetoPorRodada: 4, baseAproveitamento: "realizadas", rodadasPrevistas: 30,
  amareloNoSegundoAtraso: true, pontoPerdidoTerceiroAtraso: 1,
  atrasosParaSuspensao: 4, perdePontoNoQuartoAtraso: false,
  cartoesPorPonto: 3, pontosPorCicloAmarelo: 1, pontosPorVermelho: 1,
  converterSegundoAmarelo: true,
  jogadoresPorTime: 5, goleirosPorTime: 1,
  zonaSupercopa: 12, goleirosSupercopa: 2, campeoesHendor: [],
  criteriosDesempate: ["pontos", "vitorias", "saldo", "golsPro", "cartoes", "alfabetica"],
  rodadasAntiRepeticao: 3, usarAproveitamento: false,
  pesos: { rigida: 100000, amplitude: 1000, desvio: 300, faixa: 40, faixaPartida: 900, varianciaInterna: 60, repeticao: 8, aproveitamento: 15 },
};

const ROTULO_CRITERIO = {
  pontos: "Pontos", vitorias: "Vitórias", saldo: "Saldo de gols",
  golsPro: "Gols pró", cartoes: "Menos cartões", alfabetica: "Ordem alfabética",
};

function estrelasPorPosicao(p) {
  if (p <= 3) return 5; if (p <= 6) return 4; if (p <= 9) return 3; if (p <= 14) return 2; return 1;
}

const NIVEL_ATRASO = {
  1: { rotulo: "1º atraso — alerta", curto: "1º", cor: "#FFD166" },
  2: { rotulo: "2º atraso — cartão amarelo", curto: "2º", cor: "#FFA53D" },
  3: { rotulo: "3º atraso — perde o ponto de presença", curto: "3º", cor: "#FF8A5B" },
  4: { rotulo: "4º atraso — suspenso da rodada", curto: "4º", cor: "#FF6B6B" },
};
const nivelInfo = (n, cfg = CONFIG_PADRAO) =>
  n <= 0 ? null : { ...NIVEL_ATRASO[Math.min(n, 4)], n, suspende: n >= cfg.atrasosParaSuspensao };
const mesDe = (data) => String(data || "").slice(0, 7);
function disciplinaAtrasos(base) {
  const estado = {}, porRodada = {}, antesDe = {};
  const rodadas = [...base.rodadas].sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.numero - b.numero);
  for (const r of rodadas) {
    const mes = mesDe(r.data);
    porRodada[r.id] = {};
    antesDe[r.id] = JSON.parse(JSON.stringify(estado));
    for (const [jid, status] of Object.entries(r.presencas || {})) {
      if (status !== "presente" && status !== "atrasado") continue;
      const e = (estado[jid] = estado[jid] || { contador: 0, contadorMes: 0, mes: null, emenda: false });
      if (e.mes && mes !== e.mes) {
        e.contadorMes = 0;
        if (!e.emenda) e.contador = 0;
      }
      e.mes = mes;
      if (status === "atrasado") {
        e.contadorMes += 1; e.contador += 1; e.emenda = true;
        porRodada[r.id][jid] = e.contador;
      } else {
        e.contador = e.contadorMes; e.emenda = false;
      }
    }
  }
  return { porRodada, antesDe, estado };
}

function nivelSeAtrasar(disciplina, rodada, jid) {
  const e = disciplina.antesDe[rodada.id]?.[jid] || { contador: 0, mes: null, emenda: false };
  const mes = mesDe(rodada.data);
  let c = e.contador;
  if (e.mes && mes !== e.mes && !e.emenda) c = 0;
  return c + 1;
}
const evVazio = { gols: 0, assistencias: 0, ca: 0, cv: 0, cz: 0 };
const eventoDe = (jogo, jid) => ({ ...evVazio, ...((jogo.eventos || {})[jid] || {}) });
const timePorId = (r, tid) => (r.times || []).find((t) => t.id === tid);
const idsDoTime = (t) => (t?.jogadores || []).map((j) => j.jogadorId);
const HIST_ZERO = { P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, CA: 0, CV: 0, CZ: 0, Pmais: 0, Pmenos: 0, gols: 0, assistencias: 0 };
function normalizarCartoes(ev, cfg) {
  if (!cfg.converterSegundoAmarelo) return ev;
  if ((ev.ca || 0) >= 2) return { ...ev, ca: ev.ca - 1, cv: (ev.cv || 0) + 1 };
  if ((ev.ca || 0) >= 1 && (ev.cz || 0) >= 1) return { ...ev, ca: ev.ca - 1, cz: ev.cz - 1, cv: (ev.cv || 0) + 1 };
  return ev;
}

function placarDe(jogo, rodada) {
  const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
  const soma = (t) => idsDoTime(t).reduce((s, jid) => s + eventoDe(jogo, jid).gols, 0);
  const calcA = soma(tA) + (jogo.golsContraB || 0) + (jogo.golsNaoComputadosA || 0);
  const calcB = soma(tB) + (jogo.golsContraA || 0) + (jogo.golsNaoComputadosB || 0);
  const m = jogo.placarManual;
  return { A: m ? m.A : calcA, B: m ? m.B : calcB, calcA, calcB, manual: !!m, divergente: !!m && (m.A !== calcA || m.B !== calcB) };
}
function marcarReaproveitamentos(rodada) {
  const jaContou = new Set(); // já tem uma aparição que pontua de verdade
  return [...(rodada.jogos || [])].sort((a, b) => a.numero - b.numero).map((jogo) => {
    const soCartoes = [...(jogo.soCartoes || [])];
    for (const tid of [jogo.timeA, jogo.timeB]) {
      const time = timePorId(rodada, tid);
      for (const j of time?.jogadores || []) {
        // se essa vaga já foi marcada como "só completando" (manual, na tela do sorteio,
        // ou pelo próprio sorteio automático), respeita a escolha e não mexe nela —
        // só decide sozinho quando ninguém decidiu ainda, pra não roubar a vaga que
        // realmente vale só porque ela está numa partida de número maior.
        if (soCartoes.includes(j.jogadorId)) continue;
        if (jaContou.has(j.jogadorId)) { soCartoes.push(j.jogadorId); }
        else { jaContou.add(j.jogadorId); }
      }
    }
    return { ...jogo, completaTime: [], soCartoes };
  });
}

function calcularEstatisticas(base) {
  const cfg = { ...CONFIG_PADRAO, ...(base.config || {}) };
  const hist = base.historicoInicial || { rodadas: 0, jogadores: {} };
  const disc = disciplinaAtrasos(base);
  const novo = {};
  for (const j of base.jogadores)
    novo[j.id] = { J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, CA: 0, CV: 0, CZ: 0, gols: 0, assistencias: 0, bonus: 0, penalidadeManual: 0, pontosAtraso: 0, atrasos: 0, sequencia: [] };

  const rodadas = [...base.rodadas].sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.numero - b.numero);
  const encerrados = (r) => (r.jogos || []).filter((g) => g.encerrado);
  const rodadasNovas = rodadas.filter((r) => encerrados(r).length > 0).length;
  const rodadasRealizadas = (hist.rodadas || 0) + rodadasNovas;

  for (const rodada of rodadas) {
    const naRodada = {};
    for (const [jid, nivel] of Object.entries(disc.porRodada[rodada.id] || {})) {
      const st = novo[jid]; if (!st) continue;
      st.atrasos += 1;
      if (nivel === 2 && cfg.amareloNoSegundoAtraso) st.CA += 1;
      if (nivel === 3) st.pontosAtraso += cfg.pontoPerdidoTerceiroAtraso;
      if (nivel >= cfg.atrasosParaSuspensao && cfg.perdePontoNoQuartoAtraso) st.pontosAtraso += cfg.pontosPresenca;
    }

    for (const jogo of encerrados(rodada)) {
      const soCartoes = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
      const p = placarDe(jogo, rodada);
      for (const lado of [
        { ids: idsDoTime(timePorId(rodada, jogo.timeA)), pro: p.A, contra: p.B },
        { ids: idsDoTime(timePorId(rodada, jogo.timeB)), pro: p.B, contra: p.A },
      ]) {
        const res = lado.pro > lado.contra ? "V" : lado.pro === lado.contra ? "E" : "D";
        for (const jid of lado.ids) {
          const st = novo[jid]; if (!st) continue;
          const ev = normalizarCartoes(eventoDe(jogo, jid), cfg);
          if (soCartoes.has(jid)) continue;
          st.J += 1; st[res] += 1; st.GP += lado.pro; st.GC += lado.contra;
          st.gols += ev.gols; st.assistencias += ev.assistencias; st.CA += ev.ca; st.CV += ev.cv; st.CZ += ev.cz;
          if (!naRodada[jid]) naRodada[jid] = res;
        }
      }
    }

    for (const aj of rodada.ajustes || []) {
      const st = novo[aj.jogadorId]; if (!st) continue;
      if (aj.valor >= 0) st.bonus += aj.valor; else st.penalidadeManual += Math.abs(aj.valor);
    }
    if (encerrados(rodada).length > 0)
      for (const j of base.jogadores) novo[j.id].sequencia.push(naRodada[j.id] || "–");
  }

  const denom = cfg.baseAproveitamento === "previstas" ? cfg.rodadasPrevistas : rodadasRealizadas;
  const teto = denom * cfg.tetoPorRodada;

  const lista = base.jogadores.map((j) => {
    const st = novo[j.id];
    const h = { ...HIST_ZERO, ...(hist.jogadores?.[j.id] || {}) };
    const CA = h.CA + st.CA, CV = h.CV + st.CV, CZ = h.CZ + st.CZ;
    const cautelas = CA + CZ, cautelasHist = h.CA + h.CZ;
    const penalAmarelo = (Math.floor(cautelas / cfg.cartoesPorPonto) - Math.floor(cautelasHist / cfg.cartoesPorPonto)) * cfg.pontosPorCicloAmarelo;
    const penalVermelho = st.CV * cfg.pontosPorVermelho;
    const PmenosNovo = st.penalidadeManual + st.pontosAtraso + penalAmarelo + penalVermelho;
    const pontosNovos = st.J * cfg.pontosPresenca + st.V * cfg.pontosVitoria + st.E * cfg.pontosEmpate +
      st.D * cfg.pontosDerrota + st.bonus - PmenosNovo;
    const GP = h.GP + st.GP, GC = h.GC + st.GC;
    const estadoAtraso = disc.estado[j.id] || { contador: 0 };
    return {
      id: j.id, nome: j.nome, jogador: j,
      J: h.J + st.J, V: h.V + st.V, E: h.E + st.E, D: h.D + st.D,
      GP, GC, SG: GP - GC, CA, CV, CZ, cartoes: CA + CV,
      gols: h.gols + st.gols, assistencias: h.assistencias + st.assistencias,
      Pmais: h.Pmais + st.bonus, Pmenos: h.Pmenos + PmenosNovo, histPmenos: h.Pmenos,
      penalidadeManual: st.penalidadeManual, pontosAtraso: st.pontosAtraso, penalAmarelo, penalVermelho,
      cartoesNoCiclo: cautelas % cfg.cartoesPorPonto,
      pontos: h.P + pontosNovos, atrasos: st.atrasos, atrasosNoMes: estadoAtraso.contador,
      nivelAtraso: nivelInfo(estadoAtraso.contador, cfg),
      aproveitamento: teto > 0 ? Math.round(((h.P + pontosNovos) / teto) * 100) : 0,
      ultimos5: st.sequencia.slice(-5),
      temHistorico: !!hist.jogadores?.[j.id],
    };
  });

  return { lista, rodadasRealizadas, rodadasNovas, teto, disciplina: disc };
}

const COMPARADORES = {
  pontos: (a, b) => b.pontos - a.pontos, vitorias: (a, b) => b.V - a.V,
  saldo: (a, b) => b.SG - a.SG, golsPro: (a, b) => b.GP - a.GP,
  cartoes: (a, b) => a.cartoes - b.cartoes,
  alfabetica: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
};

function calcularClassificacao(base) {
  const cfg = { ...CONFIG_PADRAO, ...(base.config || {}) };
  const { lista, rodadasRealizadas, rodadasNovas, teto, disciplina } = calcularEstatisticas(base);
  const criterios = cfg.criteriosDesempate;
  const oficiais = lista.filter((l) => !l.jogador.convidado);
  const convidados = lista.filter((l) => l.jogador.convidado);
  const ordenada = [...oficiais].sort((a, b) => {
    for (const c of criterios) { const d = COMPARADORES[c](a, b); if (d !== 0) return d; }
    return 0;
  });
  const soLinha = ordenada.filter((l) => l.jogador.posicao !== "GOLEIRO");
  const soGoleiros = ordenada.filter((l) => l.jogador.posicao === "GOLEIRO");
  const rankLinha = new Map(soLinha.map((l, i) => [l.id, i + 1]));
  const rankGoleiro = new Map(soGoleiros.map((l, i) => [l.id, i + 1]));
  const nLinhaSuper = cfg.zonaSupercopa ?? 12;
  const nGkSuper = cfg.goleirosSupercopa ?? 2;
  const hendor = new Set((cfg.campeoesHendor || []).filter(Boolean));

  const linhaClassificada = new Set(soLinha.slice(0, nLinhaSuper).map((l) => l.id));
  const hendorLinha = soLinha.filter((l) => hendor.has(l.id));
  for (const campeao of hendorLinha) {
    if (!linhaClassificada.has(campeao.id)) {
      linhaClassificada.add(campeao.id);
      const removivel = [...linhaClassificada].map((id) => soLinha.find((l) => l.id === id))
        .filter((l) => l && !hendor.has(l.id))
        .sort((a, b) => rankLinha.get(b.id) - rankLinha.get(a.id))[0];
      if (removivel) linhaClassificada.delete(removivel.id);
    }
  }
  const gkClassificado = new Set(soGoleiros.slice(0, nGkSuper).map((l) => l.id));
  const hendorGk = soGoleiros.filter((l) => hendor.has(l.id));
  for (const campeao of hendorGk) {
    if (!gkClassificado.has(campeao.id)) {
      gkClassificado.add(campeao.id);
      const removivel = [...gkClassificado].map((id) => soGoleiros.find((l) => l.id === id))
        .filter((l) => l && !hendor.has(l.id))
        .sort((a, b) => rankGoleiro.get(b.id) - rankGoleiro.get(a.id))[0];
      if (removivel) gkClassificado.delete(removivel.id);
    }
  }

  const classificacao = ordenada.map((l, i) => {
    const posicao = i + 1;
    let criterioAplicado = null;
    if (i > 0) for (const c of criterios)
      if (COMPARADORES[c](ordenada[i - 1], l) !== 0) { criterioAplicado = c; break; }
    const ehGk = l.jogador.posicao === "GOLEIRO";
    const rankCategoria = (ehGk ? rankGoleiro : rankLinha).get(l.id);
    return {
      ...l, posicao, criterioAplicado, ehGoleiro: ehGk, rankCategoria,
      totalCategoria: ehGk ? soGoleiros.length : soLinha.length,
      estrelas: rodadasRealizadas > 0 ? estrelasPorPosicao(posicao) : 1,
      supercopa: ehGk ? gkClassificado.has(l.id) : linhaClassificada.has(l.id),
      campeaoHendor: hendor.has(l.id),
    };
  });
  if (rodadasRealizadas > 0) {
    const gkSupercopaPior = classificacao
      .filter((l) => l.ehGoleiro && l.supercopa)
      .sort((a, b) => b.posicao - a.posicao)[0];
    if (gkSupercopaPior && gkSupercopaPior.estrelas === 1) {
      const ultimoDoisEstrelas = classificacao
        .filter((l) => l.estrelas === 2 && l.id !== gkSupercopaPior.id)
        .sort((a, b) => b.posicao - a.posicao)[0];
      gkSupercopaPior.estrelas = 2;
      if (ultimoDoisEstrelas) ultimoDoisEstrelas.estrelas = 1;
    }
  }

  const convFinal = convidados.map((l) => ({
    ...l, posicao: null, criterioAplicado: null, ehGoleiro: l.jogador.posicao === "GOLEIRO",
    rankCategoria: null, totalCategoria: 0,
    estrelas: l.jogador.estrelasIniciais || 1, supercopa: false,
  }));

  return { classificacao, convidados: convFinal, todos: [...classificacao, ...convFinal], rodadasRealizadas, rodadasNovas, teto, disciplina };
}
function chaveDupla(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function variancia(v) {
  if (!v.length) return 0;
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length;
}

function avaliarTimes(times, ctx) {
  const P = ctx.pesos;
  const somas = times.map((t) => t.reduce((s, j) => s + j.estrelas, 0));
  // Equilibrio comparado por MEDIA de estrelas por jogador (densidade), nao soma bruta.
  // Assim a partida que sobra (com menos gente) nao e comparada em desvantagem so por ter
  // menos jogadores -- e o otimizador para de "compensar" isso empurrando craques pra la.
  const medias = times.map((t, i) => (t.length ? somas[i] / t.length : 0));
  const amplitude = Math.max(...medias) - Math.min(...medias);
  const mediaSomas = medias.reduce((s, v) => s + v, 0) / medias.length;
  const desvio = Math.sqrt(variancia(medias));

  let faixa = 0;
  for (let e = 1; e <= 5; e++) {
    const c = times.map((t) => t.filter((j) => j.estrelas === e).length);
    faixa += Math.max(...c) - Math.min(...c);
  }
  const vars = times.map((t) => variancia(t.map((j) => j.estrelas)));
  const ampVar = Math.max(...vars) - Math.min(...vars);

  let repeticao = 0;
  if (ctx.duplasRecentes)
    for (const t of times)
      for (let i = 0; i < t.length; i++)
        for (let k = i + 1; k < t.length; k++) {
          const d1 = ctx.duplasRecentes.get(chaveDupla(t[i].id, t[k].id)) || 0;
          repeticao += d1;
          for (let m = k + 1; m < t.length; m++) {
            const d2 = ctx.duplasRecentes.get(chaveDupla(t[i].id, t[m].id)) || 0;
            const d3 = ctx.duplasRecentes.get(chaveDupla(t[k].id, t[m].id)) || 0;
            if (d1 && d2 && d3) repeticao += 2;
          }
        }

  let ampAprov = 0;
  if (ctx.usarAproveitamento) {
    const md = times.map((t) => t.reduce((s, j) => s + (j.aproveitamento || 0), 0) / (t.length || 1));
    ampAprov = Math.max(...md) - Math.min(...md);
  }
  let faixaPartida = 0;
  if (ctx.partidaDoTime) {
    // tambem por densidade (5 estrelas / jogadores da partida), nao contagem bruta --
    // senao a partida pequena "conta como cheia de craque" com so 1 jogador 5 estrelas
    const cincoPorPartida = new Map(); const totalPorPartida = new Map();
    times.forEach((t, i) => {
      const p = ctx.partidaDoTime(i);
      const c5 = t.filter((j) => j.estrelas === 5).length;
      cincoPorPartida.set(p, (cincoPorPartida.get(p) || 0) + c5);
      totalPorPartida.set(p, (totalPorPartida.get(p) || 0) + t.length);
    });
    const densidades = [...cincoPorPartida.keys()].map((p) => cincoPorPartida.get(p) / (totalPorPartida.get(p) || 1));
    if (densidades.length > 1) faixaPartida = Math.max(...densidades) - Math.min(...densidades);
  }

  const violacoes = [];
  let rigidas = 0;
  let excessoGk = 0;
  const max5 = Math.max(1, Math.ceil(ctx.totalCinco / times.length));
  times.forEach((t, i) => {
    const c5 = t.filter((j) => j.estrelas === 5).length;
    if (c5 > max5) { rigidas += 1; violacoes.push({ texto: `${ctx.nomeTime(i)} com ${c5} jogadores 5★` }); }
    const gks = t.filter((j) => j.ehGoleiro);
    const excesso = Math.max(0, gks.length - ctx.goleirosPorTime);
    if (excesso > 0) {
      excessoGk += excesso * excesso;
      violacoes.push({ texto: `${ctx.nomeTime(i)} com ${gks.length} goleiros — ${gks.map((j) => j.nome).join(", ")}` });
    }

    if (ctx.goleirosSuficientes) {
      const naMeta = t.filter((j) => j.slotGoleiro).length;
      if (naMeta !== ctx.goleirosPorTime) {
        rigidas += 1;
        violacoes.push({ texto: `${ctx.nomeTime(i)} com ${naMeta} goleiro(s) na meta` });
      }
    }
  });
  for (const r of ctx.restricoes || []) {
    const ta = times.findIndex((t) => t.some((j) => j.id === r.a));
    const tb = times.findIndex((t) => t.some((j) => j.id === r.b));
    if (ta < 0 || tb < 0) continue;
    if (r.tipo === "juntos" && ta !== tb) { rigidas += 1; violacoes.push({ texto: `${ctx.nome(r.a)} e ${ctx.nome(r.b)} deveriam jogar juntos` }); }
    if (r.tipo === "separados" && ta === tb) { rigidas += 1; violacoes.push({ texto: `${ctx.nome(r.a)} e ${ctx.nome(r.b)} não deveriam jogar juntos` }); }
  }

  const custo = P.rigida * (rigidas + excessoGk) + P.amplitude * amplitude + P.desvio * desvio +
    P.faixa * faixa + (P.faixaPartida || 0) * faixaPartida + P.varianciaInterna * ampVar + P.repeticao * repeticao +
    (ctx.usarAproveitamento ? P.aproveitamento * ampAprov : 0);

  return {
    custo, somas, amplitude, desvio, faixa, faixaPartida, ampVar, repeticao, violacoes, mediaSomas,
    indiceEquilibrio: Math.max(0, Math.min(100, Math.round(100 - (mediaSomas > 0 ? (amplitude / mediaSomas) * 70 : 0)))),
  };
}

function buscaLocal(times, ctx) {
  let melhor = avaliarTimes(times, ctx);
  for (let passe = 0; passe < 40; passe++) {
    let melhorou = false;
    for (let a = 0; a < times.length; a++)
      for (let b = a + 1; b < times.length; b++)
        for (let i = 0; i < times[a].length; i++)
          for (let k = 0; k < times[b].length; k++) {
            const ja = times[a][i], jb = times[b][k];
            if (!!ja.slotGoleiro !== !!jb.slotGoleiro) continue;
            if (ja.slotGoleiro && ctx.partidaDoTime && ctx.partidaDoTime(a) !== ctx.partidaDoTime(b)) continue;
            if (ctx.travados.has(ja.id) || ctx.travados.has(jb.id)) continue;
            times[a][i] = jb; times[b][k] = ja;
            const nova = avaliarTimes(times, ctx);
            if (nova.custo < melhor.custo - 1e-9) { melhor = nova; melhorou = true; }
            else { times[a][i] = ja; times[b][k] = jb; }
          }
    if (!melhorou) break;
  }
  return melhor;
}

function sortearEquipes(entradas, opcoes = {}) {
  const cfg = { ...CONFIG_PADRAO, ...opcoes, pesos: { ...CONFIG_PADRAO.pesos, ...(opcoes.pesos || {}) } };
  const seed = opcoes.seed || novaSeed();
  const rng = criarRng(seed);
  const gkPorTime = cfg.goleirosPorTime;
  const linhaPorTime = cfg.jogadoresPorTime - gkPorTime;

  const goleiros = entradas.filter((j) => j.ehGoleiro);
  const linha = entradas.filter((j) => !j.ehGoleiro);
  const nLinhaPresente = entradas.filter((j) => !j.ehGoleiro).length;
  const nGkPresente = entradas.filter((j) => j.ehGoleiro).length;
  const maxPartidas = partidasPossiveis(nLinhaPresente, nGkPresente, cfg);
  const partidas = Math.max(0, Math.min(opcoes.partidas || maxPartidas, maxPartidas));
  const nTimes = partidas * 2;

  if (partidas < 1) return {
    erro: `Nenhum jogador presente para sortear.`,
    partidas: [], sobressalentes: entradas, seed, diagnostico: null,
  };

  const vagasGk = nTimes * gkPorTime;
  const vagasLinha = nTimes * linhaPorTime;
  const travas = opcoes.travas || {};
  const travados = new Set(Object.keys(travas).filter((k) => travas[k] < nTimes));

  const selecionar = (grupo, quantos) => {
    const fixos = grupo.filter((j) => travados.has(j.id));
    const resto = embaralharRng(grupo.filter((j) => !travados.has(j.id)), rng)
      .sort((a, b) => (a.prioridade || 0) - (b.prioridade || 0));
    const esc = [...fixos, ...resto].slice(0, quantos);
    const ids = new Set(esc.map((j) => j.id));
    return [esc, grupo.filter((j) => !ids.has(j.id))];
  };
  const [gkFinal0, gkSobrando] = selecionar(goleiros, vagasGk);
  const [linhaFinal, linhaSobrando] = selecionar(linha, vagasLinha);
  const gkFinal = gkFinal0.map((j) => ({ ...j, slotGoleiro: true }));
  const faltamGk = vagasGk - gkFinal.length;
  const faltamLinha = vagasLinha - linhaFinal.length;
  const nomes = Object.fromEntries(entradas.map((j) => [j.id, j.nome]));
  const vagasDe = (jogadores) => {
    const gk = jogadores.filter((j) => j.slotGoleiro);
    const ln = jogadores.filter((j) => !j.slotGoleiro);
    const vagas = [];
    for (let i = 0; i < gkPorTime; i++) vagas.push({ papel: "GOLEIRO", jogador: gk[i] || null });
    for (let i = 0; i < linhaPorTime; i++) vagas.push({ papel: "LINHA", jogador: ln[i] || null });
    return vagas;
  };
  const equipe = (cor, jogadores) => {
    const vagas = vagasDe(jogadores);
    return { ...cor, vagas, forca: jogadores.reduce((s, j) => s + j.estrelas, 0) };
  };
  const poteGk = embaralharRng(
    [...gkFinal, ...gkSobrando.map((j) => ({ ...j, slotGoleiro: true }))], rng
  );
  const poteLinha = [...linhaFinal, ...linhaSobrando].sort((a, b) => b.estrelas - a.estrelas);

  const capLn = linhaPorTime * 2;
  // cada posição guarda até gkPorTime×2 goleiros — pode ficar com buracos
  const gksPorPartida = Array.from({ length: partidas }, () => Array(gkPorTime * 2).fill(null));
  const lnsPorPartida = Array.from({ length: partidas }, () => []);

  const filaG = [...poteGk];
  const filaL = [...poteLinha];
  const vagasGoleiro = [];
  for (let p = 0; p < partidas; p++) for (let s = 0; s < gkPorTime * 2; s++) vagasGoleiro.push([p, s]);
  for (const [p, s] of embaralharRng(vagasGoleiro, rng)) {
    if (!filaG.length) break;
    gksPorPartida[p][s] = { ...filaG.shift(), slotGoleiro: true };
  }
  const alvoLn = Array(partidas).fill(capLn);
  let faltamLn = partidas * capLn - filaL.length;
  for (let p = partidas - 1; p >= 0 && faltamLn > 0; p--) {
    const tira = Math.min(faltamLn, capLn);
    alvoLn[p] -= tira; faltamLn -= tira;
  }
  {
    const gruposLn = distribuirProporcional(filaL, alvoLn, rng);
    gruposLn.forEach((grupo, p) => { lnsPorPartida[p] = grupo.map((j) => ({ ...j, slotGoleiro: false })); });
  }

  const repartir = (gks, lns) => {
    const A = [], B = [];
    if (gks[0]) A.push(gks[0]);
    if (gks[1]) B.push(gks[1]);
    [...lns].sort((a, b) => b.estrelas - a.estrelas)
      .forEach((j, i) => (i % 4 === 0 || i % 4 === 3 ? A : B).push(j));
    return [A, B];
  };

  const times = [];
  for (let p = 0; p < partidas; p++) {
    const gks = [...(gksPorPartida[p] || [])];
    for (let v = 0; v < gkPorTime; v++) {
      if (rng() < 0.5) { const t = gks[v * 2]; gks[v * 2] = gks[v * 2 + 1]; gks[v * 2 + 1] = t; }
    }
    const [A, B] = repartir(gks, lnsPorPartida[p] || []);
    times.push(A, B);
  }
  const assentados = times.flat();
  const ctx = {
    pesos: cfg.pesos, goleirosPorTime: gkPorTime,
    goleirosSuficientes: false,
    totalCinco: assentados.filter((j) => j.estrelas === 5).length,
    duplasRecentes: opcoes.duplasRecentes,
    restricoes: (opcoes.restricoes || []).filter((r) => assentados.some((j) => j.id === r.a) && assentados.some((j) => j.id === r.b)),
    usarAproveitamento: cfg.usarAproveitamento, travados,
    partidaDoTime: (i) => Math.floor(i / 2),
    nome: (x) => nomes[x] || "?", nomeTime: (i) => `Time ${i + 1}`,
  };
  const avaliacaoFinal = buscaLocal(times, ctx);

  const blocos = [];
  for (let p = 0; p < partidas; p++) {
    const A = times[p * 2], B = times[p * 2 + 1];
    blocos.push({
      numero: p + 1, extra: false,
      preenchimento: A.length + B.length,
      amarelo: equipe(AMARELO, A), azul: equipe(AZUL, B),
    });
  }
  blocos.sort((a, b) => b.preenchimento - a.preenchimento);
  blocos.forEach((b, i) => { b.numero = i + 1; delete b.preenchimento; });

  const idsEscalados = new Set();
  for (const b of blocos)
    for (const e of [b.amarelo, b.azul])
      for (const v of e.vagas)
        if (v.jogador) idsEscalados.add(v.jogador.id);
  const naoAlocados = entradas.filter((j) => !idsEscalados.has(j.id));

  const avisos = [];
  if (ctx.totalCinco > nTimes) avisos.push(`${ctx.totalCinco} jogadores 5★ para ${nTimes} equipes — o excedente foi espalhado, mas uma equipe fica com 2.`);
  const gkDeFora = naoAlocados.filter((j) => j.ehGoleiro);
  if (gkDeFora.length) avisos.push(`${gkDeFora.map((g) => g.nome).join(", ")} — sem vaga nesta rodada (mais presentes que vagas).`);
  for (const v of avaliacaoFinal.violacoes) avisos.push(v.texto);

  return {
    erro: null, seed,
    partidas: blocos,
    sobressalentes: naoAlocados,
    diagnostico: { ...avaliacaoFinal, alternativas: 1, avisos },
  };
}

function poolsDoDia(base, rodada, porId, dados, cfg) {
  const statusDe = (jid) => rodada.presencas[jid] || "ausente";
  const presentes = base.jogadores.filter((j) => j.ativo !== false && ["presente", "atrasado"].includes(statusDe(j.id)));
  const info = presentes.map((j) => {
    const nivel = statusDe(j.id) === "atrasado" ? nivelSeAtrasar(dados.disciplina, rodada, j.id) : 0;
    return { jogador: j, nivel, suspenso: nivel >= cfg.atrasosParaSuspensao, linha: porId[j.id] };
  });
  const aptos = info.filter((e) => !e.suspenso);
  return {
    info, aptos,
    suspensos: info.filter((e) => e.suspenso),
    goleiros: aptos.filter((e) => e.jogador.posicao === "GOLEIRO"),
    linha: aptos.filter((e) => e.jogador.posicao !== "GOLEIRO"),
  };
}
function partidasPossiveis(nLinha, nGoleiros, cfg) {
  const linhaPorTime = cfg.jogadoresPorTime - cfg.goleirosPorTime;
  const porLinha = linhaPorTime * 2;
  return Math.ceil(nLinha / porLinha);
}


export {
  CONFIG_PADRAO, ROTULO_CRITERIO, estrelasPorPosicao, NIVEL_ATRASO, nivelInfo, mesDe,
  disciplinaAtrasos, nivelSeAtrasar, evVazio, eventoDe, timePorId, idsDoTime, HIST_ZERO,
  normalizarCartoes, placarDe, marcarReaproveitamentos, calcularEstatisticas,
  calcularClassificacao, variancia, avaliarTimes, buscaLocal, sortearEquipes,
  poolsDoDia, partidasPossiveis, chaveDupla,
};
