/* core/rachao — fila de chegada, times Amarelo × Azul e as regras de rotação
 * do RACHÃO (Art. 25º a 30º do Estatuto). Tudo aqui é puro, como regras.js:
 * recebe uma "sessão" (o rachão de um dia), devolve uma sessão nova — sem
 * React, sem tela, dá pra testar isolado.
 *
 * A sessão NÃO é persistida em lugar nenhum — vive só no estado local da
 * tela enquanto o rachão do dia está rolando. "Encerrar jogos do Rachão"
 * simplesmente descarta o estado; não há histórico entre dias nem gravação
 * no Supabase. Por isso o módulo não tem "status" nem reabertura — só existe
 * enquanto a tela mantém a sessão viva.
 *
 * Diferença de fundo pro Campeonato: lá o sorteio é balanceado e todas as
 * partidas rolam em paralelo. Aqui é UMA quadra, times formados por ORDEM DE
 * CHEGADA (sem balancear estrela nenhuma), "quem vence fica em quadra" e um
 * corte automático de sequência (Art. 29º).
 *
 * Suposições assumidas (ambiente de teste — corrija se não bater com o jogo
 * real da quadra):
 *  - "Time que sai" volta pro FIM da fila de linha (não guarda a posição
 *    antiga) — é a leitura padrão de fila com "vencedor fica" e também é o
 *    que dá sentido à exceção do Art. 25º §2º "b" (ver abaixo).
 *  - Goleiro NÃO segue fila estrita: fica num pool sempre visível (ordenado
 *    por chegada só como referência) e é escolhido na mão pra cada time —
 *    pedido explícito de quem usa o sistema, porque há menos goleiros do que
 *    vagas.
 *  - Art. 25º §2º "b" (substituto que entra depois dos 5min mantém a posição
 *    antiga) é lido como valendo só pro desfecho DESTA partida em que ele
 *    entrou — se o time dele continuar vencendo depois, ele vira um membro
 *    comum do time dali pra frente.
 *  - Art. 29º §4º (25+ presentes → corte em 2) e o "par ou ímpar" do
 *    Art. 30º §2º não são resolvidos sozinhos pelo motor — o organizador
 *    escolhe o limite de partidas na abertura do dia, e decide o par-ou-ímpar
 *    na mão quando a fila não é suficiente pra tirar os dois times.
 */

const RACHAO_PADRAO = { linhaPorTime: 4, limitePartidas: 3 };
const NOME_LADO = { amarelo: "Amarelo", azul: "Azul" };
const outroLado = (lado) => (lado === "amarelo" ? "azul" : "amarelo");

/* --- montagem da sessão do dia -------------------------------------------*/

function criarSessao({ id, data, rodadaOrigemId, ordemChegada = [], porId = {}, linhaPorTime, limitePartidas }) {
  const linha = [], goleiros = [], vistos = new Set();
  for (const jid of ordemChegada) {
    if (vistos.has(jid)) continue;
    const j = porId[jid];
    if (!j) continue;
    vistos.add(jid);
    (j.posicao === "GOLEIRO" ? goleiros : linha).push(jid);
  }
  return {
    id, data, rodadaOrigemId: rodadaOrigemId || null,
    linhaPorTime: linhaPorTime === 5 ? 5 : 4,
    limitePartidas: limitePartidas === 2 ? 2 : 3,
    linha, goleiros, quadra: null, timeEmEspera: null, historico: [],
  };
}

/* --- fila / pools ----------------------------------------------------------
 * "linha" e "goleiros" guardam TODO MUNDO do dia naquela posição — sair da
 * fila (aguardando) pra entrar em quadra não remove ninguém dessas listas
 * mestras, só passam a aparecer como "em quadra" até saírem de novo.        */

function idsEmQuadra(sessao) {
  const s = new Set();
  const q = sessao.quadra;
  if (q) for (const lado of ["amarelo", "azul"]) {
    for (const jid of q.lados[lado].linha) s.add(jid);
    if (q.lados[lado].goleiro) s.add(q.lados[lado].goleiro);
  }
  return s;
}
function aguardandoLinha(sessao) {
  const emQuadra = idsEmQuadra(sessao);
  return sessao.linha.filter((jid) => !emQuadra.has(jid));
}
function goleirosLivres(sessao) {
  const emQuadra = idsEmQuadra(sessao);
  return sessao.goleiros.filter((jid) => !emQuadra.has(jid));
}
function proximosTimes(sessao, quantos = 2) {
  const fila = aguardandoLinha(sessao);
  const times = [];
  for (let i = 0; i < quantos; i++) {
    const bloco = fila.slice(i * sessao.linhaPorTime, (i + 1) * sessao.linhaPorTime);
    if (!bloco.length) break;
    times.push(bloco);
  }
  return times;
}

/* --- iniciar / montar a quadra --------------------------------------------*/

function podeIniciarPartida(sessao) {
  if (sessao.quadra) return false;
  const necessario = sessao.timeEmEspera ? sessao.linhaPorTime : sessao.linhaPorTime * 2;
  return aguardandoLinha(sessao).length >= necessario;
}

function iniciarPartida(sessao) {
  const fila = aguardandoLinha(sessao);
  let amarelo, azul, incumbente = null, partidasSeguidas = 0, forcarSaidaAoFim = false;
  let primeiraPartida = sessao.historico.length === 0;

  if (sessao.timeEmEspera) {
    // time que já tinha ficado esperando adversário (Art. 27º/28º) — não perde a vaga.
    amarelo = { linha: sessao.timeEmEspera.linha, goleiro: sessao.timeEmEspera.goleiro };
    azul = { linha: fila.slice(0, sessao.linhaPorTime), goleiro: null };
    incumbente = "amarelo";
    partidasSeguidas = sessao.timeEmEspera.partidasSeguidas;
    forcarSaidaAoFim = sessao.timeEmEspera.forcarSaidaAoFim;
    primeiraPartida = false;
  } else {
    amarelo = { linha: fila.slice(0, sessao.linhaPorTime), goleiro: null };
    azul = { linha: fila.slice(sessao.linhaPorTime, sessao.linhaPorTime * 2), goleiro: null };
  }

  const quadra = {
    numero: sessao.historico.length + 1, primeiraPartida,
    incumbente, partidasSeguidas, forcarSaidaAoFim,
    lados: {
      amarelo: { linha: amarelo.linha, goleiro: amarelo.goleiro, protegidos: [] },
      azul: { linha: azul.linha, goleiro: azul.goleiro, protegidos: [] },
    },
    placar: { amarelo: 0, azul: 0 }, primeiroGol: null, pendente: null,
  };
  return { ...sessao, quadra, timeEmEspera: null };
}

/* --- goleiro (escolha manual, sem fila) ------------------------------------*/

function atribuirGoleiro(sessao, lado, goleiroId) {
  if (!sessao.quadra) return sessao;
  if (sessao.quadra.lados[outroLado(lado)].goleiro === goleiroId) return sessao; // já é do outro time
  const quadra = { ...sessao.quadra, lados: { ...sessao.quadra.lados, [lado]: { ...sessao.quadra.lados[lado], goleiro: goleiroId } } };
  return { ...sessao, quadra };
}
function limparGoleiro(sessao, lado) {
  if (!sessao.quadra) return sessao;
  const quadra = { ...sessao.quadra, lados: { ...sessao.quadra.lados, [lado]: { ...sessao.quadra.lados[lado], goleiro: null } } };
  return { ...sessao, quadra };
}

/* --- placar ao vivo (só o placar do time — nenhuma estatística individual) */

function marcarGol(sessao, lado, delta) {
  if (!sessao.quadra) return sessao;
  const atual = sessao.quadra.placar[lado] || 0;
  const novo = Math.max(0, atual + delta);
  let primeiroGol = sessao.quadra.primeiroGol;
  if (delta > 0 && atual === 0 && !primeiroGol) primeiroGol = lado; // Art. 30º — quem fez o 1º gol da partida
  if (delta < 0 && novo === 0 && primeiroGol === lado && (sessao.quadra.placar[outroLado(lado)] || 0) === 0) {
    primeiroGol = null; // desfez o próprio gol que tinha aberto o placar
  }
  const quadra = { ...sessao.quadra, placar: { ...sessao.quadra.placar, [lado]: novo }, primeiroGol };
  return { ...sessao, quadra };
}

/* --- encerrar partida: o coração das regras (Art. 27º-30º) ----------------*/

function encerrarPartida(sessao) {
  const q = sessao.quadra;
  if (!q) return { sessao, aviso: "Nenhuma partida em andamento.", pendente: false };
  const gA = q.placar.amarelo, gB = q.placar.azul;
  const resultado = gA > gB ? "amarelo" : gB > gA ? "azul" : "empate";
  const vencedorNormal = resultado === "empate" ? null : resultado;

  let ladoQueFica = null, partidasSeguidas = 0, motivo = "";

  if (q.forcarSaidaAoFim) {
    // Art. 29º: o incumbente já tinha completado o limite de partidas seguidas antes desta —
    // sai depois dela de qualquer jeito.
    if (resultado === "empate" || vencedorNormal === q.incumbente) {
      ladoQueFica = null;
      motivo = resultado === "empate"
        ? "Empate na partida de corte — os dois times saem (Art. 29º §1º)."
        : `${NOME_LADO[q.incumbente]} venceu de novo, mas já cumpriu o limite de partidas seguidas — os dois times saem (Art. 29º §1º).`;
    } else {
      ladoQueFica = vencedorNormal; partidasSeguidas = 1;
      motivo = `${NOME_LADO[vencedorNormal]} venceu e assume a quadra.`;
    }
  } else if (q.primeiraPartida && resultado === "empate") {
    if (gA === 0 && gB === 0) {
      ladoQueFica = null;
      motivo = "0×0 na 1ª partida do dia — os dois times saem (Art. 30º §1º).";
    } else if (q.primeiroGol) {
      ladoQueFica = q.primeiroGol; partidasSeguidas = 1;
      motivo = `Empate, mas ${NOME_LADO[q.primeiroGol]} fez o 1º gol — permanece em quadra (Art. 30º).`;
    } else {
      ladoQueFica = null;
      motivo = "Empate na 1ª partida sem gol nenhum registrado — os dois times saem.";
    }
  } else if (resultado === "empate") {
    // fora da 1ª partida do dia o Estatuto não prevê empate (jogo tem 2 gols ou tempo esgotado
    // com alguém na frente) — por bom senso, tratamos como o incumbente mantendo a vaga.
    ladoQueFica = q.incumbente;
    partidasSeguidas = q.partidasSeguidas;
    motivo = `Empate — ${q.incumbente ? NOME_LADO[q.incumbente] : "quem já estava"} permanece em quadra.`;
  } else {
    ladoQueFica = vencedorNormal;
    partidasSeguidas = ladoQueFica === q.incumbente ? q.partidasSeguidas + 1 : 1;
    motivo = `${NOME_LADO[ladoQueFica]} venceu e permanece em quadra.`;
  }

  if (ladoQueFica === null) {
    const suficiente = aguardandoLinha(sessao).length >= sessao.linhaPorTime + 2;
    if (!suficiente) {
      return {
        sessao: { ...sessao, quadra: { ...q, pendente: "empateSemFila" } },
        aviso: "Fila insuficiente pra os dois times saírem — decida no par ou ímpar quem fica (Art. 30º §2º).",
        pendente: true,
      };
    }
  }
  return aplicarDesfecho(sessao, { ladoQueFica, partidasSeguidas, motivo });
}

function resolverParOuImpar(sessao, ladoVencedor) {
  // só usado quando encerrarPartida sinalizou "pendente" — decisão manual da quadra.
  return aplicarDesfecho(sessao, {
    ladoQueFica: ladoVencedor, partidasSeguidas: 1,
    motivo: `${NOME_LADO[ladoVencedor]} venceu no par ou ímpar (Art. 30º §2º) e permanece em quadra.`,
  });
}

function aplicarDesfecho(sessao, { ladoQueFica, partidasSeguidas, motivo }) {
  const q = sessao.quadra;
  const forcarSaidaAoFim = ladoQueFica !== null && partidasSeguidas >= sessao.limitePartidas - 1;

  const registro = {
    numero: q.numero,
    amarelo: { linha: q.lados.amarelo.linha, goleiro: q.lados.amarelo.goleiro },
    azul: { linha: q.lados.azul.linha, goleiro: q.lados.azul.goleiro },
    placarAmarelo: q.placar.amarelo, placarAzul: q.placar.azul,
    ladoQueFicou: ladoQueFica, motivo,
  };

  // quem sai volta pro FIM da fila de linha — exceto os "protegidos" do Art. 25º §2º "b"
  // (substituto que entrou depois dos 5min desta mesma partida mantém a posição antiga).
  let linha = [...sessao.linha];
  const mandarProTras = (lado) => {
    const protegidos = new Set(q.lados[lado].protegidos || []);
    const saem = q.lados[lado].linha.filter((jid) => !protegidos.has(jid));
    linha = linha.filter((jid) => !saem.includes(jid));
    linha.push(...saem);
  };
  if (ladoQueFica !== "amarelo") mandarProTras("amarelo");
  if (ladoQueFica !== "azul") mandarProTras("azul");

  const idsQueFicam = new Set(ladoQueFica ? q.lados[ladoQueFica].linha : []);
  const disponiveis = linha.filter((jid) => !idsQueFicam.has(jid));

  let novaQuadra = null, timeEmEspera = null;
  if (ladoQueFica) {
    const outro = outroLado(ladoQueFica);
    if (disponiveis.length >= sessao.linhaPorTime) {
      novaQuadra = {
        numero: q.numero + 1, primeiraPartida: false,
        incumbente: ladoQueFica, partidasSeguidas, forcarSaidaAoFim,
        lados: {
          [ladoQueFica]: { linha: q.lados[ladoQueFica].linha, goleiro: q.lados[ladoQueFica].goleiro, protegidos: [] },
          [outro]: { linha: disponiveis.slice(0, sessao.linhaPorTime), goleiro: null, protegidos: [] },
        },
        placar: { amarelo: 0, azul: 0 }, primeiroGol: null, pendente: null,
      };
    } else {
      // ninguém suficiente pro desafio — o time que fica espera de pé, pronto pra próxima
      timeEmEspera = { linha: q.lados[ladoQueFica].linha, goleiro: q.lados[ladoQueFica].goleiro, partidasSeguidas, forcarSaidaAoFim };
    }
  } else if (disponiveis.length >= sessao.linhaPorTime * 2) {
    novaQuadra = {
      numero: q.numero + 1, primeiraPartida: false,
      incumbente: null, partidasSeguidas: 0, forcarSaidaAoFim: false,
      lados: {
        amarelo: { linha: disponiveis.slice(0, sessao.linhaPorTime), goleiro: null, protegidos: [] },
        azul: { linha: disponiveis.slice(sessao.linhaPorTime, sessao.linhaPorTime * 2), goleiro: null, protegidos: [] },
      },
      placar: { amarelo: 0, azul: 0 }, primeiroGol: null, pendente: null,
    };
  }

  return {
    sessao: { ...sessao, linha, quadra: novaQuadra, timeEmEspera, historico: [...sessao.historico, registro] },
    aviso: motivo + (novaQuadra ? "" : " Aguardando mais gente pra formar a próxima partida."),
    pendente: false,
  };
}

/* --- substituição no meio da partida (Art. 25º §2º) ------------------------
 * quem sai da quadra no meio do jogo volta pro fim da fila (perdeu a vaga
 * ativa); quem entra:
 *  a) ainda não passou de 5min → também assume posição nova (fim da fila);
 *  b) já passou de 5min → mantém a posição que já tinha (fica "protegido" só
 *     pro desfecho desta partida).                                          */
function substituirLinha(sessao, lado, jogadorSaiId, jogadorEntraId, { passouDe5Min = true } = {}) {
  if (!sessao.quadra) return sessao;
  const ladoAtual = sessao.quadra.lados[lado];
  const linhaTime = ladoAtual.linha.map((jid) => (jid === jogadorSaiId ? jogadorEntraId : jid));
  let protegidos = ladoAtual.protegidos.filter((jid) => jid !== jogadorSaiId);

  let linha = sessao.linha.filter((jid) => jid !== jogadorSaiId);
  linha.push(jogadorSaiId); // quem saiu no meio do jogo perde a vaga ativa, volta pro fim

  if (passouDe5Min) {
    protegidos = [...protegidos, jogadorEntraId]; // Art. 25º §2º "b"
  } else {
    linha = linha.filter((jid) => jid !== jogadorEntraId);
    linha.push(jogadorEntraId); // Art. 25º §2º "a"
  }

  const quadra = { ...sessao.quadra, lados: { ...sessao.quadra.lados, [lado]: { ...ladoAtual, linha: linhaTime, protegidos } } };
  return { ...sessao, linha, quadra };
}

/* --- remoção definitiva (foi embora / não volta mais hoje) ----------------*/

function removerJogador(sessao, jogadorId, { substitutoId, passouDe5Min } = {}) {
  let linha = sessao.linha.filter((jid) => jid !== jogadorId);
  let goleiros = sessao.goleiros.filter((jid) => jid !== jogadorId);
  let quadra = sessao.quadra;
  let timeEmEspera = sessao.timeEmEspera;

  if (quadra) {
    for (const lado of ["amarelo", "azul"]) {
      const ladoAtual = quadra.lados[lado];
      if (ladoAtual.linha.includes(jogadorId)) {
        if (substitutoId) {
          const linhaTime = ladoAtual.linha.map((jid) => (jid === jogadorId ? substitutoId : jid));
          let protegidos = ladoAtual.protegidos.filter((jid) => jid !== jogadorId);
          if (passouDe5Min) protegidos = [...protegidos, substitutoId];
          else { linha = linha.filter((jid) => jid !== substitutoId); linha.push(substitutoId); }
          quadra = { ...quadra, lados: { ...quadra.lados, [lado]: { ...ladoAtual, linha: linhaTime, protegidos } } };
        } else {
          const linhaTime = ladoAtual.linha.filter((jid) => jid !== jogadorId);
          quadra = { ...quadra, lados: { ...quadra.lados, [lado]: { ...ladoAtual, linha: linhaTime, protegidos: ladoAtual.protegidos.filter((jid) => jid !== jogadorId) } } };
        }
      }
      if (quadra.lados[lado].goleiro === jogadorId) {
        const novoGoleiro = substitutoId && goleiros.includes(substitutoId) ? substitutoId : null;
        quadra = { ...quadra, lados: { ...quadra.lados, [lado]: { ...quadra.lados[lado], goleiro: novoGoleiro } } };
      }
    }
  }
  if (timeEmEspera?.linha.includes(jogadorId)) {
    timeEmEspera = { ...timeEmEspera, linha: timeEmEspera.linha.filter((jid) => jid !== jogadorId) };
  }
  return { ...sessao, linha, goleiros, quadra, timeEmEspera };
}

/* --- convidado / reordenar manualmente na fila -----------------------------*/

function inserirNaFila(sessao, jogadorId, posicao, ehGoleiro) {
  const campo = ehGoleiro ? "goleiros" : "linha";
  const atual = sessao[campo].filter((jid) => jid !== jogadorId);
  const idx = Math.max(0, Math.min(posicao ?? atual.length, atual.length));
  atual.splice(idx, 0, jogadorId);
  return { ...sessao, [campo]: atual };
}

/* --- avisos e fechamento do dia --------------------------------------------*/

function avisosSessao(sessao, presentesTotal) {
  const avisos = [];
  if (presentesTotal >= 25 && sessao.limitePartidas === 3) {
    avisos.push("Art. 29º §4º: com 25 ou mais presentes, o corte deveria ser de 2 partidas seguidas — a não ser que a locação seja de 2h ou mais.");
  }
  if (sessao.quadra && (!sessao.quadra.lados.amarelo.goleiro || !sessao.quadra.lados.azul.goleiro)) {
    avisos.push("Falta escolher o goleiro de algum dos times em quadra.");
  }
  return avisos;
}

export {
  RACHAO_PADRAO, NOME_LADO,
  criarSessao, aguardandoLinha, goleirosLivres, proximosTimes,
  podeIniciarPartida, iniciarPartida,
  atribuirGoleiro, limparGoleiro, marcarGol,
  encerrarPartida, resolverParOuImpar,
  substituirLinha, removerJogador, inserirNaFila,
  avisosSessao,
};
