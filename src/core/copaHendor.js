/* core/copaHendor — regras da Copa Hendor de Penalidades (Estatuto Arts. 41–56, 85).
 * Só funções puras sobre o objeto `copa` guardado em `base.copas` — sem React, sem
 * Supabase. Nenhum import de propósito: regras.js importa este arquivo, e qualquer
 * dependência de volta viraria import circular.
 *
 * Modelo (resumo):
 *   copa      { id, tipo:"hendor", nome, ano, fases:[{id,nome,data}], partidas:[…], penalidades:[…] }
 *   partida   { id, fase, rotulo,
 *               duplaA/duplaB: { jogadores?:[id,id], subs:[{sai,entra,motivo}] },
 *               origem: { A:{de,tipo}, B:{de,tipo} },   // de onde vem cada lado ("vencedor"|"perdedor")
 *               placarManual?:{A,B},                     // fases já jogadas, sem chute a chute
 *               wo?:"A"|"B",                             // lado que venceu por W.O. (Art. 54)
 *               disputa?:{ moeda, ordem, chutes, lesionados } }
 *   Uma dupla sem `jogadores` é montada a partir do vencedor da partida de origem; `subs`
 *   troca quem saiu por quem entrou (Art. 55 §1), então "dupla" não é um par fixo.
 */

const CHUTES_POR_DUPLA = 4; // Art. 49 — todos têm direito às 4 cobranças (sem parar antes)
const outro = (lado) => (lado === "A" ? "B" : "A");

/* ------------------------------ disputa ------------------------------------*/

/* Quem bate primeiro: quem ganhou o cara ou coroa escolhe bater ou defender (Art. 50). */
function primeiroLado(disputa) {
  const { vencedor, escolha } = disputa.moeda;
  return escolha === "bater" ? vencedor : outro(vencedor);
}

/* Se o jogador escalado estiver lesionado, o parceiro executa no lugar (Art. 55 §3). */
function quemExecuta(disputa, lado, jogadorId) {
  if (!(disputa.lesionados || []).includes(jogadorId)) return jogadorId;
  const par = disputa.ordem[lado].cobradores;
  return par.find((j) => j !== jogadorId) ?? jogadorId;
}

/* Chute de número `idx` (0-based). Art. 51: X1 bate 2 (um contra cada defensor), Y1 bate 2,
 * X2 bate 2, Y2 bate 2. A partir do 9º chute vêm as alternadas (Art. 52): um por dupla,
 * cobradores e defensores em rodízio, começando de novo pelo primeiro do ciclo. */
function chuteEsperado(disputa, idx) {
  const X = primeiroLado(disputa), Y = outro(X);
  const total = CHUTES_POR_DUPLA * 2;
  let lado, kicker, defensor, fase;
  if (idx < total) {
    const bloco = Math.floor(idx / 2);   // 0:X1  1:Y1  2:X2  3:Y2
    lado = bloco % 2 === 0 ? X : Y;
    const cobrador = Math.floor(bloco / 2);
    kicker = disputa.ordem[lado].cobradores[cobrador];
    defensor = disputa.ordem[outro(lado)].defensores[idx % 2];
    fase = "regular";
  } else {
    const alt = idx - total;              // 0,1 = 1ª rodada (X depois Y), 2,3 = 2ª…
    lado = alt % 2 === 0 ? X : Y;
    const rodada = Math.floor(alt / 2);
    kicker = disputa.ordem[lado].cobradores[rodada % 2];
    defensor = disputa.ordem[outro(lado)].defensores[rodada % 2];
    fase = "alternada";
  }
  return {
    idx, lado, fase,
    cobrador: quemExecuta(disputa, lado, kicker),
    defensor: quemExecuta(disputa, outro(lado), defensor),
  };
}

function estadoDisputa(disputa) {
  const chutes = disputa?.chutes || [];
  const gols = { A: 0, B: 0 }, tentativas = { A: 0, B: 0 };
  for (const c of chutes) { tentativas[c.lado]++; if (c.resultado === "gol") gols[c.lado]++; }
  const n = chutes.length;
  const fechouRodada = n >= CHUTES_POR_DUPLA * 2 && n % 2 === 0; // 8 chutes, depois de 2 em 2
  const decidida = fechouRodada && gols.A !== gols.B;
  const vencedor = decidida ? (gols.A > gols.B ? "A" : "B") : null;
  return {
    gols, tentativas, vencedor, decidida,
    emAlternadas: n >= CHUTES_POR_DUPLA * 2 && !decidida,
    proximo: decidida ? null : chuteEsperado(disputa, n),
  };
}

/* moeda: {vencedor:"A"|"B", escolha:"bater"|"defender"}
 * ordem: { A:{cobradores:[id,id], defensores:[id,id]}, B:{…} } */
function iniciarDisputa({ moeda, ordem }) {
  return { moeda, ordem, chutes: [], lesionados: [] };
}

function registrarChute(disputa, resultado) {
  const est = estadoDisputa(disputa);
  if (est.decidida) return disputa;
  const { lado, cobrador, defensor, fase } = est.proximo;
  return { ...disputa, chutes: [...disputa.chutes, { lado, cobrador, defensor, fase, resultado }] };
}

const desfazerChute = (disputa) => ({ ...disputa, chutes: disputa.chutes.slice(0, -1) });

function marcarLesionado(disputa, jogadorId) {
  if ((disputa.lesionados || []).includes(jogadorId)) return disputa;
  return { ...disputa, lesionados: [...(disputa.lesionados || []), jogadorId] };
}

/* ------------------------------ duplas e vencedores ------------------------*/

const partidaPorId = (copa, id) => (copa.partidas || []).find((p) => p.id === id);

function placarDaPartida(partida) {
  if (partida.placarManual) return { A: partida.placarManual.A, B: partida.placarManual.B };
  if (partida.disputa) return estadoDisputa(partida.disputa).gols;
  return { A: 0, B: 0 };
}

function vencedorDaPartida(partida) {
  if (partida.wo) return partida.wo;
  if (partida.placarManual) {
    const { A, B } = partida.placarManual;
    return A > B ? "A" : B > A ? "B" : null;
  }
  return partida.disputa ? estadoDisputa(partida.disputa).vencedor : null;
}

/* Dupla que joga de fato: parte de quem veio da partida de origem (ou de `jogadores`
 * digitado) e aplica as substituições na ordem em que aconteceram. */
function duplaEfetiva(copa, partida, lado) {
  const d = partida[`dupla${lado}`] || {};
  let membros = d.jogadores ? [...d.jogadores] : null;
  if (!membros) {
    const o = partida.origem?.[lado];
    const pai = o && partidaPorId(copa, o.de);
    const v = pai && vencedorDaPartida(pai);
    if (v) membros = duplaEfetiva(copa, pai, o.tipo === "perdedor" ? outro(v) : v).jogadores;
  }
  membros = membros || [];
  for (const s of d.subs || []) membros = membros.map((j) => (j === s.sai ? s.entra : j));
  return { jogadores: membros, subs: d.subs || [] };
}

function statusDaPartida(copa, partida) {
  if (vencedorDaPartida(partida)) return "encerrada";
  if (partida.disputa && partida.disputa.chutes.length > 0) return "em_andamento";
  const prontas = ["A", "B"].every((l) => duplaEfetiva(copa, partida, l).jogadores.length === 2);
  return prontas ? "pronta" : "aguardando";
}

function statusDaFase(copa, faseId) {
  const ps = copa.partidas.filter((p) => p.fase === faseId);
  const st = ps.map((p) => statusDaPartida(copa, p));
  if (st.length && st.every((s) => s === "encerrada")) return "encerrada";
  if (st.some((s) => s === "encerrada" || s === "em_andamento")) return "em_andamento";
  return st.some((s) => s === "pronta") ? "pronta" : "aguardando";
}

/* Fase "atual" = a primeira que ainda não terminou (a última, se tudo terminou). */
function faseAtual(copa) {
  const aberta = copa.fases.find((f) => statusDaFase(copa, f.id) !== "encerrada");
  return (aberta || copa.fases[copa.fases.length - 1]).id;
}

/* Os 2 campeões da Copa: dupla vencedora da final. Alimenta a zona da Supercopa. */
function campeoesDaCopa(copa) {
  const final = copa && (copa.partidas || []).find((p) => p.id === "final");
  const v = final && vencedorDaPartida(final);
  return v ? duplaEfetiva(copa, final, v).jogadores : [];
}

function copaDaTemporada(base) {
  const copas = (base.copas || []).filter((c) => c.tipo === "hendor");
  return copas.find((c) => c.ano === base.temporada) || copas[copas.length - 1] || null;
}
const campeoesHendor = (base) => campeoesDaCopa(copaDaTemporada(base));

/* Penalidades da Copa (−5 do Art. 55 §4) que entram como desconto na classificação. */
const penalidadesDaCopa = (base) =>
  (base.copas || []).flatMap((c) => (c.penalidades || []).map((p) => ({ ...p, copa: c.nome })));

/* Art. 55 §1: substituto = melhor colocado no Campeonato entre os eliminados da fase
 * anterior. `posicaoDe(id)` vem da classificação atual (menor = melhor). Fica de fora quem
 * já joga nesta fase (inclusive quem já entrou de substituto). */
function candidatosSubstituto(copa, partida, posicaoDe) {
  const idx = copa.fases.findIndex((f) => f.id === partida.fase);
  if (idx <= 0) return [];
  const faseAnterior = copa.fases[idx - 1].id;
  const eliminados = [];
  for (const p of copa.partidas.filter((x) => x.fase === faseAnterior)) {
    const v = vencedorDaPartida(p);
    if (!v) continue;
    eliminados.push(...duplaEfetiva(copa, p, outro(v)).jogadores);
  }
  const jogando = new Set();
  for (const p of copa.partidas.filter((x) => x.fase === partida.fase))
    for (const l of ["A", "B"]) duplaEfetiva(copa, p, l).jogadores.forEach((j) => jogando.add(j));
  return eliminados
    .filter((j) => !jogando.has(j))
    .sort((a, b) => (posicaoDe(a) ?? 999) - (posicaoDe(b) ?? 999));
}

/* Gols e defesas por jogador, somando as disputas com chute a chute. */
function estatisticasJogadores(copa) {
  const est = {};
  const get = (id) => (est[id] ||= { chutes: 0, gols: 0, defesasTentadas: 0, defesas: 0 });
  for (const p of copa.partidas || [])
    for (const c of p.disputa?.chutes || []) {
      const k = get(c.cobrador), d = get(c.defensor);
      k.chutes++; d.defesasTentadas++;
      if (c.resultado === "gol") k.gols++; else d.defesas++;
    }
  return est;
}

export {
  CHUTES_POR_DUPLA, outro, primeiroLado, chuteEsperado, estadoDisputa, iniciarDisputa,
  registrarChute, desfazerChute, marcarLesionado,
  partidaPorId, placarDaPartida, vencedorDaPartida, duplaEfetiva, statusDaPartida, statusDaFase,
  faseAtual, campeoesDaCopa, copaDaTemporada, campeoesHendor, penalidadesDaCopa,
  candidatosSubstituto, estatisticasJogadores,
};
