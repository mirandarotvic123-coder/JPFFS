/* Testes da lógica da Copa Hendor (sem framework — o projeto não tem runner).
 * Rodar na raiz do projeto:  npx vite-node testes/copaHendor.teste.mjs
 * Sai com código 1 se algo falhar. */
import * as C from "/src/core/copaHendor.js";
import { copaHendor2026 } from "/src/data/copaHendor2026.js";
import { calcularClassificacao } from "/src/core/regras.js";
import { migrarBase } from "/src/core/repositorio.js";
import { baseOficial } from "/src/data/baseOficial.js";

let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);

const copa = copaHendor2026();
const P = (id) => C.partidaPorId(copa, id);
const D = (id, l) => C.duplaEfetiva(copa, P(id), l).jogadores;

/* chaveamento derivado da arte oficial */
eq(D("q1", "A"), ["teruya", "renato"], "q1 A"); eq(D("q1", "B"), ["pietro", "flavinho"], "q1 B");
eq(D("q2", "A"), ["kaike", "alex"], "q2 A"); eq(D("q3", "A"), ["aranha", "lazaro"], "q3 A");
eq(D("q4", "A"), ["victor", "ricardinho"], "q4 A"); eq(D("q4", "B"), ["andre", "paulo-cesar"], "q4 B");
eq(D("s1", "A"), ["teruya", "renato"], "s1 A"); eq(D("s1", "B"), ["kaike", "alex"], "s1 B");
eq(D("s2", "A"), ["aranha", "lazaro"], "s2 A"); eq(D("s2", "B"), ["victor", "ricardinho"], "s2 B");
eq(D("final", "A"), [], "final ainda vazia");
eq(["o1", "q1", "s1", "final"].map((i) => C.statusDaPartida(copa, P(i))), ["encerrada", "encerrada", "pronta", "aguardando"], "status");
eq(C.faseAtual(copa), "semis", "fase atual");
eq(C.vencedorDaPartida(P("o1")), "B", "o1 venceu B"); eq(C.vencedorDaPartida(P("o2")), "A", "o2 venceu A");
eq(C.campeoesDaCopa(copa), [], "sem campeão ainda");

/* sequência regular (Art. 51) */
const ordem = { A: { cobradores: ["teruya", "renato"], defensores: ["teruya", "renato"] }, B: { cobradores: ["kaike", "alex"], defensores: ["alex", "kaike"] } };
const nova = () => C.iniciarDisputa({ moeda: { vencedor: "A", escolha: "bater" }, ordem });
const jogar = (d, resultados) => resultados.reduce((acc, r) => C.registrarChute(acc, r), d);
let d = nova();
eq(Array.from({ length: 8 }, (_, i) => { const e = C.chuteEsperado(d, i); return `${e.lado}:${e.cobrador}>${e.defensor}`; }),
  ["A:teruya>alex", "A:teruya>kaike", "B:kaike>teruya", "B:kaike>renato", "A:renato>alex", "A:renato>kaike", "B:alex>teruya", "B:alex>renato"], "sequência Art. 51");
eq(C.primeiroLado({ moeda: { vencedor: "A", escolha: "defender" } }), "B", "escolha defender");

/* 3x1 decide nos 8 chutes, e nada é aceito depois */
d = jogar(nova(), ["gol", "gol", "gol", "defendeu", "gol", "defendeu", "defendeu", "defendeu"]);
let e = C.estadoDisputa(d);
eq(e.gols, { A: 3, B: 1 }, "placar 3x1"); eq(e.vencedor, "A", "A vence"); ok(e.proximo === null, "sem próximo chute");
eq(C.registrarChute(d, "gol").chutes.length, 8, "não aceita chute depois de decidida");

/* 2x2 vai pras alternadas; só decide quando a rodada fecha */
d = jogar(nova(), ["gol", "gol", "gol", "gol", "defendeu", "defendeu", "defendeu", "defendeu"]);
e = C.estadoDisputa(d);
eq(e.gols, { A: 2, B: 2 }, "2x2"); ok(e.emAlternadas && !e.decidida, "vai pras alternadas");
eq([e.proximo.lado, e.proximo.fase, e.proximo.cobrador, e.proximo.defensor], ["A", "alternada", "teruya", "alex"], "1ª alternada");
d = C.registrarChute(d, "gol");
e = C.estadoDisputa(d); ok(!e.decidida, "não decide no meio da rodada"); eq([e.proximo.lado, e.proximo.cobrador], ["B", "kaike"], "B na sequência");
d = C.registrarChute(d, "defendeu");
e = C.estadoDisputa(d); ok(e.decidida && e.vencedor === "A", "decide ao fechar a rodada"); eq(e.gols, { A: 3, B: 2 }, "3x2");
d = jogar(nova(), ["gol", "gol", "gol", "gol", "defendeu", "defendeu", "defendeu", "defendeu", "gol", "gol"]);
e = C.estadoDisputa(d); ok(!e.decidida, "alternada empatada segue"); eq([e.proximo.lado, e.proximo.cobrador], ["A", "renato"], "2ª rodada: 2º do ciclo");
eq(C.estadoDisputa(C.desfazerChute(d)).gols, { A: 3, B: 2 }, "desfazer volta um chute");

/* lesão (Art. 55 §3): o parceiro executa */
d = C.marcarLesionado(nova(), "renato");
eq(C.chuteEsperado(d, 4).cobrador, "teruya", "parceiro bate no lugar do lesionado");
eq(C.chuteEsperado(d, 2).defensor, "teruya", "parceiro defende no lugar do lesionado");

/* vencedor via disputa, W.O. e avanço automático */
const s1 = P("s1");
s1.disputa = nova();
eq(C.statusDaPartida(copa, s1), "em_andamento", "disputa iniciada, sem chutes = em andamento");
s1.disputa = jogar(s1.disputa, ["gol", "gol", "gol", "gol", "defendeu", "defendeu", "defendeu", "defendeu"]);
eq(C.statusDaPartida(copa, s1), "em_andamento", "empatada = em andamento");
s1.disputa = jogar(s1.disputa, ["gol", "defendeu"]);
eq(C.vencedorDaPartida(s1), "A", "s1 A vence"); eq(D("final", "A"), ["teruya", "renato"], "final A = vencedor s1");
eq(D("t3", "A"), ["kaike", "alex"], "3º lugar A = perdedor s1");
P("s2").wo = "B";
eq(D("final", "B"), ["victor", "ricardinho"], "final B via W.O."); eq(D("t3", "B"), ["aranha", "lazaro"], "3º B = perdedor do W.O.");
P("final").placarManual = { A: 2, B: 1 };
eq(C.campeoesDaCopa(copa), ["teruya", "renato"], "campeões = dupla da final");

/* substituto (Art. 55 §1) */
const c2 = copaHendor2026();
const posicao = { jean: 3, samuel: 20, daniel: 7, gueno: 30 };
const cand = C.candidatosSubstituto(c2, C.partidaPorId(c2, "q1"), (id) => posicao[id]);
eq(cand.slice(0, 4), ["jean", "daniel", "samuel", "gueno"], "candidatos ordenados por classificação");
ok(!cand.includes("teruya") && !cand.includes("alexandre"), "quem já joga / já saiu não é candidato");

const st = C.estatisticasJogadores(copa);
ok(st.teruya.chutes > 0 && st.kaike.defesasTentadas > 0, "estatísticas por jogador");

/* integração com o Campeonato */
const base = migrarBase(baseOficial());
ok(base.copas.length === 1 && base.copas[0].id === "hendor-2026", "migrarBase injeta a copa");
eq(migrarBase({ ...base }).copas[0], base.copas[0], "migrarBase não duplica");
const antes = calcularClassificacao(base).classificacao.find((l) => l.id === "teruya");
base.copas[0].penalidades = [{ id: "x", jogadorId: "teruya", valor: -5, motivo: "Ausência" }];
const depois = calcularClassificacao(base).classificacao.find((l) => l.id === "teruya");
eq(antes.pontos - depois.pontos, 5, "−5 pontos na classificação"); eq(depois.Pmenos - antes.Pmenos, 5, "−5 em P−");
ok(!antes.campeaoHendor, "sem final = ninguém campeão");
const b2 = migrarBase(baseOficial());
for (const id of ["s1", "s2", "final"]) b2.copas[0].partidas.find((p) => p.id === id).placarManual = { A: 1, B: 0 };
eq(calcularClassificacao(b2).classificacao.filter((l) => l.campeaoHendor).map((l) => l.id).sort(), ["renato", "teruya"], "campeões marcados na classificação");

console.log(falhas ? `${falhas} FALHA(S)` : "TUDO OK");
process.exit(falhas ? 1 : 0);
