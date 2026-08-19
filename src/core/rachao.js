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
 *  - Goleiro tem presença separada da linha, mas segue a MESMA lógica de fila
 *    por ordem de chegada entre eles: ao montar um time (novo ou substituto),
 *    o motor sugere/atribui sozinho o goleiro livre há mais tempo esperando,
 *    e o goleiro do time que sai vai pro fim dessa fila própria — os
 *    goleiros nunca se misturam com a fila de linha. O organizador ainda
 *    pode trocar na mão a qualquer momento (botão ✕ na tela), porque com
 *    menos goleiros do que vagas às vezes precisa fugir da ordem estrita.
 *  - Art. 25º §2º "b" (substituto que entra depois dos 5min mantém a posição
 *    antiga) é lido como valendo só pro desfecho DESTA partida em que ele
 *    entrou — se o time dele continuar vencendo depois, ele vira um membro
 *    comum do time dali pra frente.
 *  - Art. 29º §4º (25+ presentes → corte em 2) não é aplicado sozinho — vira
 *    só um aviso na tela; o organizador escolhe o limite de partidas na
 *    abertura do dia.
 *  - Empate na 1ª PARTIDA DO DIA pede decisão manual do organizador (Art.
 *    30º, que só fala dessa partida mesmo — nenhum dos dois times tem
 *    vantagem nenhuma ali): 0×0 manda os dois saírem se houver fila
 *    suficiente pros DOIS times completos (senão pede o resultado do par ou
 *    ímpar, Art. 30º §2º); empate COM gols pede quem fez o 1º gol (Art. 30º
 *    caput) — ver "pendente" em encerrarPartida. Empate em qualquer OUTRA
 *    partida do dia não pede nada: o incumbente já tem a vantagem de estar
 *    em quadra e simplesmente permanece, contando pro corte do Art. 29º
 *    igual uma vitória contaria. Exceção: na partida de corte (Art. 29º §1º)
 *    qualquer empate já manda os dois saírem, direto, não importa a partida.
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
  // time em espera (Art. 27º/28º) já está com a vaga comprometida — não é "aguardando".
  if (sessao.timeEmEspera) {
    for (const jid of sessao.timeEmEspera.linha) s.add(jid);
    if (sessao.timeEmEspera.goleiro) s.add(sessao.timeEmEspera.goleiro);
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
  // cada bloco = { jogadores, faltam, goleiro }. "faltam" > 0 quando a fila atual não tem
  // gente suficiente pra fechar esse time — as vagas serão preenchidas por quem for saindo da
  // quadra mais adiante, o que ainda não dá pra saber (depende de quem perder). "goleiro" é só
  // uma sugestão (próximo da fila de goleiros, na mesma ordem que os blocos) — a atribuição de
  // verdade continua manual, pode sair diferente disso.
  const fila = aguardandoLinha(sessao);
  const filaGk = goleirosLivres(sessao);
  const times = [];
  for (let i = 0; i < quantos; i++) {
    const jogadores = fila.slice(i * sessao.linhaPorTime, (i + 1) * sessao.linhaPorTime);
    if (!jogadores.length) break;
    times.push({ jogadores, faltam: sessao.linhaPorTime - jogadores.length, goleiro: filaGk[i] || null });
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
  const filaGk = goleirosLivres(sessao); // por ordem de chegada entre eles
  let amarelo, azul, incumbente = null, partidasSeguidas = 0, forcarSaidaAoFim = false;
  let primeiraPartida = sessao.historico.length === 0;

  if (sessao.timeEmEspera) {
    // time que já tinha ficado esperando adversário (Art. 27º/28º) — não perde a vaga.
    amarelo = { linha: sessao.timeEmEspera.linha, goleiro: sessao.timeEmEspera.goleiro };
    azul = { linha: fila.slice(0, sessao.linhaPorTime), goleiro: filaGk[0] || null };
    incumbente = "amarelo";
    partidasSeguidas = sessao.timeEmEspera.partidasSeguidas;
    forcarSaidaAoFim = sessao.timeEmEspera.forcarSaidaAoFim;
    primeiraPartida = false;
  } else {
    amarelo = { linha: fila.slice(0, sessao.linhaPorTime), goleiro: filaGk[0] || null };
    azul = { linha: fila.slice(sessao.linhaPorTime, sessao.linhaPorTime * 2), goleiro: filaGk[1] || null };
  }

  const quadra = {
    numero: sessao.historico.length + 1, primeiraPartida,
    incumbente, partidasSeguidas, forcarSaidaAoFim,
    lados: {
      amarelo: { linha: amarelo.linha, goleiro: amarelo.goleiro, protegidos: [] },
      azul: { linha: azul.linha, goleiro: azul.goleiro, protegidos: [] },
    },
    placar: { amarelo: 0, azul: 0 }, pendente: null,
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
  const novo = Math.max(0, (sessao.quadra.placar[lado] || 0) + delta);
  const quadra = { ...sessao.quadra, placar: { ...sessao.quadra.placar, [lado]: novo } };
  return { ...sessao, quadra };
}

/* --- encerrar partida: o coração das regras (Art. 27º-30º) ----------------*/

function encerrarPartida(sessao) {
  const q = sessao.quadra;
  if (!q) return { sessao, aviso: "Nenhuma partida em andamento.", pendente: false };
  const gA = q.placar.amarelo, gB = q.placar.azul;
  const resultado = gA > gB ? "amarelo" : gB > gA ? "azul" : "empate";
  const vencedorNormal = resultado === "empate" ? null : resultado;

  // Empate na 1ª partida do dia COM gols: nenhum dos dois times tem vantagem nenhuma (os dois
  // acabaram de se formar) — só quem fez o 1º gol decide (Art. 30º). Nas partidas seguintes
  // isso não se aplica: o incumbente já chega com a vantagem de estar em quadra (ver abaixo).
  if (resultado === "empate" && q.primeiraPartida && !(gA === 0 && gB === 0)) {
    return {
      sessao: { ...sessao, quadra: { ...q, pendente: "primeiroGol" } },
      aviso: "Empate — quem fez o 1º gol permanece em quadra (Art. 30º). Informe abaixo.",
      pendente: true,
    };
  }

  let ladoQueFica = null, partidasSeguidas = 0, motivo = "";

  if (q.forcarSaidaAoFim) {
    // Art. 29º: o incumbente já tinha completado o limite de partidas seguidas antes desta —
    // sai depois dela de qualquer jeito. Empate aqui (0×0 ou com gols, tanto faz) já manda os
    // dois saírem — o corte não depende de quem fez gol primeiro nem de qual partida do dia é.
    if (resultado === "empate" || vencedorNormal === q.incumbente) {
      ladoQueFica = null;
      motivo = resultado === "empate"
        ? "Empate na partida de corte — os dois times saem (Art. 29º §1º)."
        : `${NOME_LADO[q.incumbente]} venceu de novo, mas já cumpriu o limite de partidas seguidas — os dois times saem (Art. 29º §1º).`;
    } else {
      ladoQueFica = vencedorNormal; partidasSeguidas = 1;
      motivo = `${NOME_LADO[vencedorNormal]} venceu e assume a quadra.`;
    }
  } else if (resultado === "empate" && q.primeiraPartida) {
    // só sobra o caso 0×0 na 1ª partida aqui — com gols já foi resolvido (pendente) acima.
    ladoQueFica = null;
    motivo = "0×0 na 1ª partida do dia — os dois times saem (Art. 30º §1º).";
  } else if (resultado === "empate") {
    // fora da 1ª partida do dia: o incumbente já tem a vantagem de estar em quadra — permanece
    // sozinho, sem precisar de decisão nenhuma. Conta pro corte do Art. 29º igual uma vitória.
    ladoQueFica = q.incumbente;
    partidasSeguidas = q.partidasSeguidas + 1;
    motivo = `Empate — ${q.incumbente ? NOME_LADO[q.incumbente] : "quem já estava"} permanece em quadra.`;
  } else {
    ladoQueFica = vencedorNormal;
    partidasSeguidas = ladoQueFica === q.incumbente ? q.partidasSeguidas + 1 : 1;
    motivo = `${NOME_LADO[ladoQueFica]} venceu e permanece em quadra.`;
  }

  if (ladoQueFica === null) {
    // precisa de DOIS times completos de fora — não só "1 time + 2", senão o time que acaba
    // de sair teria que ser misturado com quem já esperava pra fechar o segundo time, o que
    // não é o que se espera aqui: só libera os dois saírem quando dá pra formar as duas
    // equipes inteiramente com quem já estava aguardando.
    const suficiente = aguardandoLinha(sessao).length >= sessao.linhaPorTime * 2;
    if (!suficiente) {
      return {
        sessao: { ...sessao, quadra: { ...q, pendente: "empateSemFila" } },
        aviso: "Fila insuficiente pra formar os dois times completos — decida no par ou ímpar quem fica (Art. 30º §2º).",
        pendente: true,
      };
    }
  }
  return aplicarDesfecho(sessao, { ladoQueFica, partidasSeguidas, motivo });
}

function resolverParOuImpar(sessao, ladoVencedor) {
  // só usado quando encerrarPartida sinalizou pendente:"empateSemFila" — decisão manual,
  // feita fisicamente na quadra (Art. 30º §2º).
  return aplicarDesfecho(sessao, {
    ladoQueFica: ladoVencedor, partidasSeguidas: 1,
    motivo: `${NOME_LADO[ladoVencedor]} venceu no par ou ímpar (Art. 30º §2º) e permanece em quadra.`,
  });
}

function resolverPrimeiroGol(sessao, ladoQueFezPrimeiro) {
  // só usado quando encerrarPartida sinalizou pendente:"primeiroGol" — o organizador informou
  // quem fez o 1º gol da partida empatada (Art. 30º).
  const q = sessao.quadra;
  const partidasSeguidas = ladoQueFezPrimeiro === q.incumbente ? (q.partidasSeguidas || 0) + 1 : 1;
  return aplicarDesfecho(sessao, {
    ladoQueFica: ladoQueFezPrimeiro, partidasSeguidas,
    motivo: `Empate — ${NOME_LADO[ladoQueFezPrimeiro]} fez o 1º gol e permanece em quadra (Art. 30º).`,
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

  // quem sai volta pro FIM da fila — exceto os "protegidos" do Art. 25º §2º "b" (substituto
  // de linha que entrou depois dos 5min desta mesma partida mantém a posição antiga). O
  // goleiro do time que sai não tem essa exceção: sempre volta pro fim da fila de goleiros.
  let linha = [...sessao.linha];
  let goleiros = [...sessao.goleiros];
  const mandarProTras = (lado) => {
    const protegidos = new Set(q.lados[lado].protegidos || []);
    const saem = q.lados[lado].linha.filter((jid) => !protegidos.has(jid));
    linha = linha.filter((jid) => !saem.includes(jid));
    linha.push(...saem);
    const gk = q.lados[lado].goleiro;
    if (gk) { goleiros = goleiros.filter((jid) => jid !== gk); goleiros.push(gk); }
  };
  if (ladoQueFica !== "amarelo") mandarProTras("amarelo");
  if (ladoQueFica !== "azul") mandarProTras("azul");

  const idsQueFicam = new Set(ladoQueFica ? q.lados[ladoQueFica].linha : []);
  const disponiveis = linha.filter((jid) => !idsQueFicam.has(jid));
  const goleiroQueFica = ladoQueFica ? q.lados[ladoQueFica].goleiro : null;
  const golDisponiveis = goleiros.filter((jid) => jid !== goleiroQueFica);

  let novaQuadra = null, timeEmEspera = null;
  if (ladoQueFica) {
    const outro = outroLado(ladoQueFica);
    if (disponiveis.length >= sessao.linhaPorTime) {
      novaQuadra = {
        numero: q.numero + 1, primeiraPartida: false,
        incumbente: ladoQueFica, partidasSeguidas, forcarSaidaAoFim,
        lados: {
          [ladoQueFica]: { linha: q.lados[ladoQueFica].linha, goleiro: goleiroQueFica, protegidos: [] },
          [outro]: { linha: disponiveis.slice(0, sessao.linhaPorTime), goleiro: golDisponiveis[0] || null, protegidos: [] },
        },
        placar: { amarelo: 0, azul: 0 }, pendente: null,
      };
    } else {
      // ninguém suficiente pro desafio — o time que fica espera de pé, pronto pra próxima
      timeEmEspera = { linha: q.lados[ladoQueFica].linha, goleiro: goleiroQueFica, partidasSeguidas, forcarSaidaAoFim };
    }
  } else if (disponiveis.length >= sessao.linhaPorTime * 2) {
    novaQuadra = {
      numero: q.numero + 1, primeiraPartida: false,
      incumbente: null, partidasSeguidas: 0, forcarSaidaAoFim: false,
      lados: {
        amarelo: { linha: disponiveis.slice(0, sessao.linhaPorTime), goleiro: golDisponiveis[0] || null, protegidos: [] },
        azul: { linha: disponiveis.slice(sessao.linhaPorTime, sessao.linhaPorTime * 2), goleiro: golDisponiveis[1] || null, protegidos: [] },
      },
      placar: { amarelo: 0, azul: 0 }, pendente: null,
    };
  }

  return {
    sessao: { ...sessao, linha, goleiros, quadra: novaQuadra, timeEmEspera, historico: [...sessao.historico, registro] },
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

/* --- convidado / reordenar manualmente na fila -----------------------------
 * Insere/move jogadorId na fila mestra (linha ou goleiros) IMEDIATAMENTE
 * ANTES de antesDeId (ou no fim, se antesDeId for null/undefined). Recebe o
 * ID do vizinho, não um índice numérico de propósito: a fila mestra guarda
 * TODO MUNDO do dia (inclusive quem está em quadra agora), então um índice
 * baseado só em quem está "aguardando" apontaria pro lugar errado da fila
 * mestra sempre que alguém já estivesse jogando. Usando o ID do vizinho o
 * ponto de inserção fica sempre certo, não importa quem mais esteja fora
 * da lista de aguardando no momento.                                       */
function inserirNaFila(sessao, jogadorId, antesDeId, ehGoleiro) {
  const campo = ehGoleiro ? "goleiros" : "linha";
  const atual = sessao[campo].filter((jid) => jid !== jogadorId);
  const idx = antesDeId != null ? atual.indexOf(antesDeId) : -1;
  const posicao = idx === -1 ? atual.length : idx;
  atual.splice(posicao, 0, jogadorId);
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
  encerrarPartida, resolverParOuImpar, resolverPrimeiroGol,
  substituirLinha, removerJogador, inserirNaFila,
  avisosSessao,
};
