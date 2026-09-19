/* Testes da lógica do Rachão: reabrir a última partida e decidir na mão quem fica
 * (sem framework — o projeto não tem runner).
 * Rodar na raiz do projeto:  npx vite-node testes/rachao.teste.mjs
 * Sai com código 1 se algo falhar. */
import * as R from "/src/core/rachao.js";

let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.log("FALHOU:", m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);

const linha = Array.from({ length: 14 }, (_, i) => `l${i + 1}`);
const porId = Object.fromEntries([
  ...linha.map((id) => [id, { id, posicao: "LINHA" }]),
  ["g1", { id: "g1", posicao: "GOLEIRO" }], ["g2", { id: "g2", posicao: "GOLEIRO" }], ["g3", { id: "g3", posicao: "GOLEIRO" }],
]);
const novaSessao = () => R.criarSessao({ id: "s", data: "2026-09-19", ordemChegada: [...linha, "g1", "g2", "g3"], porId, linhaPorTime: 4, limitePartidas: 3 });
const jogar = (s, a, b) => { let x = R.marcarGol(s, "amarelo", a); return R.marcarGol(x, "azul", b); };

/* --- sem encerramento nada a reabrir ------------------------------------------------ */
let s = R.iniciarPartida(novaSessao());
eq(R.reabrirUltimaPartida(s).ok, false, "sem partida encerrada não reabre");

/* --- encerra 1×0 (amarelo vence) e reabre ------------------------------------------- */
const s0 = jogar(s, 1, 0);
const r1 = R.encerrarPartida(s0);
eq(r1.sessao.historico.length, 1, "histórico ganhou a partida 1");
eq(r1.sessao.quadra.incumbente, "amarelo", "amarelo ficou em quadra");
ok(r1.sessao.desfazer && r1.sessao.desfazer.quadra.numero === 1, "guardou a foto da partida 1");

const re = R.reabrirUltimaPartida(r1.sessao);
ok(re.ok, "reabriu");
eq(re.sessao.quadra.numero, 1, "voltou pra partida 1");
eq(re.sessao.quadra.placar, { amarelo: 1, azul: 0 }, "placar preservado");
eq(re.sessao.historico.length, 0, "registro saiu do histórico");
eq(re.sessao.linha, s0.linha, "fila voltou ao que era");
eq(re.sessao.quadra.lados.amarelo.linha, s0.quadra.lados.amarelo.linha, "time amarelo igual");
eq(re.sessao.desfazer, null, "não reabre duas vezes");
eq(re.sessao.quadra.pendente, null, "sem decisão pendente");

/* --- corrige o placar e encerra de novo: agora o azul vence ------------------------- */
let corrigida = R.marcarGol(R.marcarGol(re.sessao, "amarelo", -1), "azul", 2); // 0×2
const r2 = R.encerrarPartida(corrigida);
eq(r2.sessao.quadra.incumbente, "azul", "depois de corrigir, azul fica");
eq(r2.sessao.historico[0].placarAzul, 2, "histórico com o placar corrigido");

/* --- quem chegou depois é mantido; quem foi removido continua fora ------------------ */
const r3 = R.encerrarPartida(jogar(s, 2, 0));
let depois = R.inserirNaFila(r3.sessao, "novo1", null, false);      // chegou depois do encerramento
depois = R.removerJogador(depois, "l12");                           // saiu depois do encerramento
const re2 = R.reabrirUltimaPartida(depois);
ok(re2.sessao.linha.includes("novo1"), "chegada posterior preservada");
eq(re2.sessao.linha[re2.sessao.linha.length - 1], "novo1", "chegada posterior vai pro fim");
ok(!re2.sessao.linha.includes("l12"), "removido posterior continua fora");
ok(!re2.sessao.quadra.lados.amarelo.linha.includes("l12") && !re2.sessao.quadra.lados.azul.linha.includes("l12"), "removido não volta pra quadra");

/* --- partida seguinte já começou: reabrir desfaz ela ------------------------------- */
const r4 = R.encerrarPartida(jogar(s, 3, 1));
ok(r4.sessao.quadra && r4.sessao.quadra.numero === 2, "partida 2 já montada");
const re3 = R.reabrirUltimaPartida(r4.sessao);
eq(re3.sessao.quadra.numero, 1, "reabrir volta pra partida 1 mesmo com a 2 montada");

/* --- só a ÚLTIMA partida: depois da 2ª encerrada, reabre a 2ª ---------------------- */
const r5 = R.encerrarPartida(jogar(r4.sessao, 0, 2));
eq(R.reabrirUltimaPartida(r5.sessao).sessao.quadra.numero, 2, "reabre a última (2ª), não a 1ª");

/* --- decidir na mão ------------------------------------------------------------------ */
const m1 = R.encerrarManual(jogar(s, 5, 0), "azul");            // regra diria amarelo; organizador manda o azul ficar
eq(m1.sessao.quadra.incumbente, "azul", "manual: azul fica");
eq(m1.sessao.quadra.partidasSeguidas, 1, "manual: 1ª seguida do azul");
ok(/na mão/.test(m1.sessao.historico[0].motivo), "manual: motivo registrado");
ok(m1.sessao.desfazer, "manual também pode ser reaberto");

const m2 = R.encerrarManual(jogar(s, 1, 1), null);               // os dois saem (fila tem 2 times de fora: 14 - 8 = 6? só 6 → sem 2 times completos)
ok(m2.sessao.historico.length === 1, "manual: os dois saem registra a partida");
ok(!m2.sessao.quadra || m2.sessao.quadra.incumbente === null, "manual: sem incumbente quando os dois saem");
ok(m2.sessao.linha.slice(-8).every((jid) => ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"].includes(jid)), "manual: quem saiu foi pro fim da fila");

const m3 = R.encerrarManual(R.encerrarPartida(jogar(s, 1, 0)).sessao, "amarelo"); // amarelo já era incumbente na partida 2
eq(m3.sessao.quadra.partidasSeguidas ?? m3.sessao.timeEmEspera?.partidasSeguidas, 2, "manual: amarelo fica de novo = 2ª seguida");

/* --- encerrarManual não trava sem quadra --------------------------------------------- */
eq(R.encerrarManual(novaSessao(), "amarelo").pendente, false, "sem quadra não quebra");

if (falhas) { console.log(`${falhas} teste(s) falharam`); process.exit(1); }
console.log("rachao: tudo certo");
