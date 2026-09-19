import React, { useState, useEffect, useRef } from "react";
import { T, AMARELO, AZUL, corDe } from "../theme";
import { id } from "../core/repositorio";
import { barradoDoRachao } from "../core/regras";
import {
  criarSessao, aguardandoLinha, goleirosLivres, proximosTimes,
  podeIniciarPartida, iniciarPartida, atribuirGoleiro, limparGoleiro, marcarGol,
  encerrarPartida, encerrarManual, reabrirUltimaPartida, resolverParOuImpar, resolverPrimeiroGol, substituirLinha, removerJogador,
  inserirNaFila, ordemGeral, reclassificarJogador, avisosSessao, NOME_LADO,
} from "../core/rachao";
import {
  Botao, Painel, inputStyle, Campo, CabecalhoPagina, Secao, Segmento, IconeGoleiro,
  Contador, FaixaPartida, SecaoRecolhivel, CampoBusca,
} from "../components/ui";
import { LimiteErro } from "../components/LimiteErro";
import { GatilhoLances } from "./lances/GatilhoLances";
import { CronometroPartida } from "../components/CronometroPartida";

/* =========================== TELA: RACHÃO =================================
 * Fila por ordem de chegada, times Amarelo × Azul, vencedor fica em quadra
 * (Art. 25º-30º do Estatuto). Totalmente separada do Campeonato: não mexe em
 * gols/cartões/pontos/tabela de ninguém.
 *
 * A sessão e os convidados do dia vivem no localStorage do aparelho (chave
 * abaixo) — não no Supabase, então não sincroniza entre dispositivos nem
 * aparece no backup da base. Isso é de propósito: sobrevive a trocar de aba,
 * fechar o navegador ou recarregar a página no meio do dia, e só some de
 * verdade quando alguém aperta "Encerrar jogos do Rachão".               */

const CHAVE_RACHAO = "jpffs:rachao";
// rascunho da chamada manual do Rachão (dias SEM rodada do Campeonato): a lista que o
// organizador monta na tela de abertura antes de apertar "Abrir Rachão". Vive só neste
// aparelho, some quando o Rachão abre ou quando o rascunho é de um dia já passado.
const CHAVE_RACHAO_RASCUNHO = "jpffs:rachao:rascunho";

function rotuloRachao(data) {
  try {
    return "Rachão · " + new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  } catch {
    return "Rachão";
  }
}

function carregarRachaoLocal() {
  try {
    const bruto = localStorage.getItem(CHAVE_RACHAO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}
function salvarRachaoLocal(estado) {
  try {
    if (!estado.sessao) { localStorage.removeItem(CHAVE_RACHAO); return; }
    localStorage.setItem(CHAVE_RACHAO, JSON.stringify(estado));
  } catch { /* localStorage indisponível (modo privado, cota etc.) — segue só na memória */ }
}

function carregarRascunhoAbertura(hoje) {
  try {
    const bruto = localStorage.getItem(CHAVE_RACHAO_RASCUNHO);
    if (!bruto) return null;
    const r = JSON.parse(bruto);
    if (!r || typeof r.data !== "string" || r.data < hoje) return null; // rascunho de um dia já passado — ignora
    return r;
  } catch {
    return null;
  }
}
function salvarRascunhoAbertura(rascunho) {
  try {
    if (!rascunho || (!rascunho.chegada?.length && !rascunho.convidados?.length)) {
      localStorage.removeItem(CHAVE_RACHAO_RASCUNHO);
      return;
    }
    localStorage.setItem(CHAVE_RACHAO_RASCUNHO, JSON.stringify(rascunho));
  } catch { /* localStorage indisponível — segue só na memória */ }
}
function limparRascunhoAbertura() {
  try { localStorage.removeItem(CHAVE_RACHAO_RASCUNHO); } catch { /* nada a fazer */ }
}

function TelaRachao({ base, avisar }) {
  const [sessao, setSessao] = useState(() => carregarRachaoLocal()?.sessao ?? null);
  const [convidados, setConvidados] = useState(() => carregarRachaoLocal()?.convidados ?? []); // só desta sessão — não entra no elenco
  // ordem de chegada estável, só pra exibição (Lista de chegada) — cada jogador ganha um
  // índice na hora em que entra no dia e ele nunca muda depois, mesmo que a fila (que gira
  // com vitória/derrota) reordene. Não afeta regra nenhuma do jogo.
  const [ordemIdx, setOrdemIdx] = useState(() => carregarRachaoLocal()?.ordemIdx ?? {});
  const proximoIdx = (atual) => (Object.keys(atual).length ? Math.max(...Object.values(atual)) + 1 : 0);

  useEffect(() => { salvarRachaoLocal({ sessao, convidados, ordemIdx }); }, [sessao, convidados, ordemIdx]);

  const nomes = {
    ...Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome])),
    ...Object.fromEntries(convidados.map((c) => [c.id, c.nome])),
  };

  if (!sessao) return <AberturaRachao {...{ base, avisar, setSessao, setConvidados, setOrdemIdx }} />;

  const presentesTotal = new Set([...sessao.linha, ...sessao.goleiros]).size;
  const avisos = avisosSessao(sessao, presentesTotal);

  return (
    <div className="rachao-layout">
      <div className="space-y-4 rachao-conteudo" style={{ flex: 1, minWidth: 0 }}>
        <CabecalhoPagina titulo="Rachão"
          descricao={new Date(sessao.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          acao={<CronometroPartida />} />

        <Painel className="grid grid-cols-4 gap-1.5 p-2">
          <Contador rotulo="No dia" valor={presentesTotal} cor={T.verde} />
          <Contador rotulo="Aguardando" valor={aguardandoLinha(sessao).length} />
          <Contador rotulo="Goleiros" valor={sessao.goleiros.length} cor={T.gk} />
          <Contador rotulo="Partidas" valor={sessao.historico.length} cor={T.ouro} />
        </Painel>

        {avisos.map((a, i) => (
          <Painel key={i} className="p-3" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.1)", fontSize: 12, color: T.laranja }}>{a}</Painel>
        ))}

        <QuadraAoVivo {...{ sessao, atualizar: setSessao, avisar, nomes }} />
        {sessao.desfazer && (
          <Botao variante="secundario" className="w-full" style={{ minHeight: 40, fontSize: 12 }} onClick={() => {
            const n = sessao.desfazer.quadra?.numero;
            if (!confirm(`Reabrir a partida ${n}? Ela volta a estar em andamento, com o placar que tinha, e a fila volta ao que era antes de encerrar. Quem chegou ou saiu da fila depois é mantido. Se a partida seguinte já começou, ela é desfeita.`)) return;
            const r = reabrirUltimaPartida(sessao);
            setSessao(r.sessao); avisar(r.aviso);
          }}>
            ↩ Reabrir a partida {sessao.desfazer.quadra?.numero} (corrigir placar, quem sai e quem entra)
          </Botao>
        )}
        <LimiteErro>
          <GatilhoLances
            partidaId={`rachao-${sessao.id}`}
            canalId={`dia-${sessao.data}`}
            partidaRotulo={rotuloRachao(sessao.data)}
            modalidade="rachao"
            jogadores={[...new Set([...sessao.linha, ...sessao.goleiros])].map((jid) => ({ id: jid, nome: nomes[jid] }))}
            souOrganizador
            avisar={avisar}
          />
        </LimiteErro>
        <ProximosTimesPainel {...{ sessao, nomes }} />
        <FilaEConvidados {...{ sessao, atualizar: setSessao, avisar, base, convidados, setConvidados, nomes, ordemIdx, setOrdemIdx, proximoIdx }} />
        <HistoricoDoDia sessao={sessao} />

        <Botao variante="secundario" className="w-full" onClick={() => {
          if (confirm("Encerrar os jogos do Rachão? A fila, a quadra e o histórico de hoje são apagados de vez — não tem como desfazer.")) {
            setSessao(null); setConvidados([]); setOrdemIdx({});
            avisar("Rachão encerrado");
          }
        }}>Encerrar jogos do Rachão</Botao>
      </div>
      <ListaChegada {...{ sessao, convidados, nomes, ordemIdx }} />
    </div>
  );
}

/* ------------------------- Lista de chegada (só visual) --------------------
 * Mistura goleiro e convidado numa lista única, na ordem em que cada um
 * entrou no dia. Não é a fila do jogo (aquela gira com vitória/derrota) —
 * é só uma referência de "quem chegou quando", meio apagada de propósito. */

function ListaChegada({ sessao, convidados, nomes, ordemIdx }) {
  const ordenados = ordemGeral(sessao, ordemIdx);
  const ehGoleiro = (jid) => sessao.goleiros.includes(jid);
  const ehConvidado = (jid) => convidados.some((c) => c.id === jid);

  if (!ordenados.length) return null;
  return (
    <aside className="rachao-lista-chegada" style={{ opacity: 0.62 }}>
      <p style={{ marginBottom: 8, fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: T.fraco }}>ORDEM DE CHEGADA</p>
      <div className="space-y-1">
        {ordenados.map((jid, i) => (
          <div key={jid} className="flex items-center gap-1.5" style={{ padding: "3px 2px", fontSize: 11.5 }}>
            <span style={{ width: 18, textAlign: "right", color: T.fraco, flexShrink: 0 }}>{i + 1}</span>
            {ehGoleiro(jid) && <IconeGoleiro tam={11} />}
            <span className="truncate" style={{ color: T.secundario }}>{nomes[jid] || "?"}</span>
            {ehConvidado(jid) && <span style={{ fontSize: 8, color: T.roxo, flexShrink: 0 }}>CONV</span>}
          </div>
        ))}
      </div>
    </aside>
  );
}

/* --------------------------- Abertura do dia ------------------------------*/

function AberturaRachao({ base, avisar, setSessao, setConvidados, setOrdemIdx }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [rasc] = useState(() => carregarRascunhoAbertura(hoje));
  const [data, setData] = useState(rasc?.data ?? hoje);
  const [linhaPorTime, setLinhaPorTime] = useState([4, 5, 6].includes(rasc?.linhaPorTime) ? rasc.linhaPorTime : 4);
  const [limitePartidas, setLimitePartidas] = useState(rasc?.limitePartidas === 2 ? 2 : 3);
  // chamada manual (só usada quando NÃO há rodada na data): `chegada` são os ids na ordem em
  // que o pessoal foi chegando — elenco e convidados do dia misturados, igual `ordemChegada`
  // da rodada. `convManual` guarda o {id,nome,posicao} de cada convidado desta lista.
  const [chegada, setChegada] = useState(() => rasc?.chegada ?? []);
  const [convManual, setConvManual] = useState(() => rasc?.convidados ?? []);
  const [busca, setBusca] = useState("");
  const [nomeConv, setNomeConv] = useState("");
  const [posConv, setPosConv] = useState("LINHA");

  const porId = Object.fromEntries(base.jogadores.map((j) => [j.id, j]));
  const rodadaDoDia = base.rodadas.find((r) => r.data === data);

  // porId completo pra chamada manual: elenco + convidados do dia (criarSessao classifica
  // linha/goleiro por `posicao`, então o convidado precisa aparecer aqui).
  const porIdManual = { ...porId, ...Object.fromEntries(convManual.map((c) => [c.id, c])) };
  const nomeDe = (jid) => porIdManual[jid]?.nome ?? "?";
  const ehGoleiro = (jid) => porIdManual[jid]?.posicao === "GOLEIRO";

  useEffect(() => {
    if (rodadaDoDia) return; // com rodada não existe rascunho pra guardar
    salvarRascunhoAbertura({ data, linhaPorTime, limitePartidas, chegada, convidados: convManual });
  }, [rodadaDoDia, data, linhaPorTime, limitePartidas, chegada, convManual]);

  const alternarChamada = (jid) => {
    if (barradoDoRachao(porId[jid])) return avisar(`${porId[jid].nome} está com pendência financeira — bloqueado no Rachão`);
    setChegada((c) => (c.includes(jid) ? c.filter((x) => x !== jid) : [...c, jid]));
  };
  const removerDaChegada = (jid) => {
    setChegada((c) => c.filter((x) => x !== jid));
    setConvManual((cs) => cs.filter((c) => c.id !== jid)); // se for convidado, some de vez
  };
  const adicionarConvidado = () => {
    const nome = nomeConv.trim();
    if (!nome) return;
    const cid = id();
    setConvManual((cs) => [...cs, { id: cid, nome, posicao: posConv }]);
    setChegada((c) => [...c, cid]);
    setNomeConv("");
    setPosConv("LINHA");
  };

  const elencoFiltrado = base.jogadores
    .filter((j) => j.ativo !== false)
    .filter((j) => j.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const nGoleiros = chegada.filter(ehGoleiro).length;
  const nLinha = chegada.length - nGoleiros;

  // pendência financeira "total" barra do Rachão também: quem já estava na chamada do
  // Campeonato e foi marcado devendo depois sai da lista aqui.
  const ordemDoCampeonato = rodadaDoDia?.ordemChegada || [];
  const chegadaDoCampeonato = ordemDoCampeonato.filter((jid) => !barradoDoRachao(porId[jid]));
  const barradosDoCampeonato = ordemDoCampeonato.filter((jid) => barradoDoRachao(porId[jid]));

  function abrir() {
    const listaChegada = rodadaDoDia ? chegadaDoCampeonato : chegada.filter((jid) => !barradoDoRachao(porId[jid]));
    const porIdAbertura = rodadaDoDia ? porId : porIdManual;
    const nova = criarSessao({
      id: id(), data, rodadaOrigemId: rodadaDoDia?.id || null,
      ordemChegada: listaChegada, porId: porIdAbertura, linhaPorTime, limitePartidas,
    });
    const idsNaSessao = new Set([...nova.linha, ...nova.goleiros]);
    setConvidados(rodadaDoDia ? [] : convManual.filter((c) => idsNaSessao.has(c.id)));
    setOrdemIdx(Object.fromEntries([...nova.linha, ...nova.goleiros]
      .map((jid) => [jid, listaChegada.indexOf(jid)])));
    setSessao(nova);
    limparRascunhoAbertura();
    avisar(`Rachão de ${new Date(data + "T12:00:00").toLocaleDateString("pt-BR")} aberto`);
  }

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Rachão" descricao="Fila por ordem de chegada, Amarelo × Azul, vencedor fica em quadra. Fica salvo neste aparelho até você encerrar o dia." />
      <Painel className="p-4 space-y-3">
        <Campo rotulo="Data do rachão">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={inputStyle} />
        </Campo>

        {rodadaDoDia ? (
          <p style={{ fontSize: 12, color: T.secundario }}>
            Lista de presença vindo da ordem de chegada do Campeonato. Total de: {chegadaDoCampeonato.length} jogadores.
            {barradosDoCampeonato.length > 0 && (
              <b style={{ color: T.vermelho }}> Fora por pendência financeira: {barradosDoCampeonato.map((jid) => porId[jid].nome).join(", ")}.</b>
            )}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: T.fraco }}>
            Nenhuma rodada do Campeonato nesta data — monte a lista do dia aqui embaixo, na ordem em que o pessoal for chegando. Fica só neste Rachão.
          </p>
        )}

        <Campo rotulo="Jogadores de linha por time">
          <Segmento valor={linhaPorTime} onChange={setLinhaPorTime}
            opcoes={[{ valor: 4, rotulo: "4 + 1 gol" }, { valor: 5, rotulo: "5 + 1 gol" }, { valor: 6, rotulo: "6 + 1 gol" }]} />
        </Campo>
        <Campo rotulo="Sai depois de quantas partidas seguidas" dica="Art. 29º — com 25+ presentes o Estatuto recomenda 2 (a não ser que a locação seja de 2h ou mais).">
          <Segmento valor={limitePartidas} onChange={setLimitePartidas}
            opcoes={[{ valor: 2, rotulo: "2 partidas" }, { valor: 3, rotulo: "3 partidas" }]} />
        </Campo>

        {!rodadaDoDia && (
          <ChamadaManual {...{
            elencoFiltrado, busca, setBusca, chegada, alternarChamada, removerDaChegada,
            nomeConv, setNomeConv, posConv, setPosConv, adicionarConvidado,
            nomeDe, ehGoleiro, nLinha, nGoleiros,
          }} />
        )}

        <Botao className="w-full" disabled={!rodadaDoDia && chegada.length === 0} onClick={abrir}>
          {rodadaDoDia || chegada.length === 0 ? "Abrir Rachão" : `Abrir Rachão · ${chegada.length} na lista`}
        </Botao>
      </Painel>
    </div>
  );
}

/* --- chamada manual do dia sem rodada -------------------------------------
 * Toca no nome do elenco pra marcar/desmarcar — a ORDEM DOS TOQUES vira a
 * ordem de chegada. Convidado do dia entra pelo campo de nome (fica só neste
 * Rachão, não encosta no elenco). Depois de aberto, atrasado se adiciona
 * normalmente em "Adicionar à fila".                                       */
function ChamadaManual({
  elencoFiltrado, busca, setBusca, chegada, alternarChamada, removerDaChegada,
  nomeConv, setNomeConv, posConv, setPosConv, adicionarConvidado,
  nomeDe, ehGoleiro, nLinha, nGoleiros,
}) {
  return (
    <div className="space-y-3" style={{ borderTop: `1px solid ${T.borda}`, paddingTop: 12 }}>
      <Secao titulo="Lista do dia" detalhe="toque na ordem de chegada" />

      <div className="grid grid-cols-3 gap-1.5">
        <Contador rotulo="Na lista" valor={chegada.length} cor={T.verde} />
        <Contador rotulo="Linha" valor={nLinha} />
        <Contador rotulo="Goleiros" valor={nGoleiros} cor={T.gk} />
      </div>

      {chegada.length > 0 && (
        <div className="space-y-1 rounded-lg p-2" style={{ background: "rgba(0,0,0,.22)", maxHeight: 230, overflowY: "auto" }}>
          {chegada.map((jid, i) => (
            <div key={jid} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.18)" }}>
              <span className="flex items-center gap-1.5" style={{ minWidth: 0, fontSize: 12.5 }}>
                <b style={{ color: T.fraco, flexShrink: 0 }}>{i + 1}º</b>
                {ehGoleiro(jid) && <IconeGoleiro tam={11} />}
                <span className="truncate">{nomeDe(jid)}</span>
              </span>
              <button onClick={() => removerDaChegada(jid)} title="Tirar da lista"
                style={{ padding: "4px 7px", fontSize: 13, color: T.laranja, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <CampoBusca value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no elenco…" />
      <div className="flex flex-wrap gap-1.5">
        {elencoFiltrado.length === 0 && (
          <p style={{ padding: 6, fontSize: 12, color: T.fraco }}>Ninguém no elenco com esse nome.</p>
        )}
        {elencoFiltrado.map((j) => {
          const pos = chegada.indexOf(j.id);
          const on = pos !== -1;
          const travado = barradoDoRachao(j);
          return (
            <button key={j.id} onClick={() => alternarChamada(j.id)}
              title={travado ? "Pendência financeira — bloqueado" : undefined}
              className="flex items-center gap-1.5 rounded-full"
              style={{
                padding: "9px 13px", minHeight: 42, fontSize: 13.5, fontWeight: 600,
                border: `1px solid ${travado ? T.vermelho : on ? T.verde : T.borda}`,
                background: travado ? "rgba(255,107,107,.08)" : on ? "rgba(61,214,140,.16)" : "rgba(255,255,255,.04)",
                color: travado ? T.vermelho : on ? T.verde : T.secundario,
                opacity: travado ? 0.6 : 1,
              }}>
              {travado && "🚫"}
              {on && <b style={{ fontSize: 11, opacity: 0.85 }}>{pos + 1}</b>}
              {j.posicao === "GOLEIRO" && <IconeGoleiro tam={13} />}
              {j.nome}
              {travado && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em" }}>BLOQUEADO</span>}
            </button>
          );
        })}
      </div>

      <div>
        <p style={{ marginBottom: 6, fontSize: 11, color: T.fraco, fontStyle: "italic" }}>
          Convidado que só vai jogar hoje — fica só neste Rachão, não entra pro elenco.
        </p>
        <div className="flex gap-1.5">
          <input value={nomeConv} onChange={(e) => setNomeConv(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarConvidado()}
            placeholder="Nome do convidado" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 14 }} />
          <select value={posConv} onChange={(e) => setPosConv(e.target.value)}
            style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
            <option value="LINHA">Linha</option><option value="GOLEIRO">Gol</option>
          </select>
          <Botao style={{ padding: "0 16px" }} onClick={adicionarConvidado}>+</Botao>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Quadra ao vivo -----------------------------*/

function QuadraAoVivo({ sessao, atualizar, avisar, nomes }) {
  const q = sessao.quadra;
  const [naMao, setNaMao] = useState(false);

  if (!q) {
    if (sessao.timeEmEspera) {
      return (
        <Painel className="space-y-2 p-4 text-center">
          <p style={{ fontSize: 13, color: T.secundario }}>
            <b style={{ color: T.verde }}>Um time já está pronto</b> esperando adversário — falta gente na fila pra montar o outro lado.
          </p>
          <p style={{ fontSize: 12, color: T.secundario }}>{sessao.timeEmEspera.linha.map((jid) => nomes[jid]).join(" · ")}</p>
          {podeIniciarPartida(sessao) && (
            <Botao onClick={() => { atualizar(iniciarPartida(sessao)); avisar("Adversário montado — partida pronta"); }}>
              Montar adversário e iniciar
            </Botao>
          )}
        </Painel>
      );
    }
    return (
      <Painel className="p-6 text-center" style={{ borderStyle: "dashed" }}>
        <p style={{ marginBottom: 12, fontSize: 13, color: T.secundario }}>
          {podeIniciarPartida(sessao) ? "Fila pronta pra montar os dois primeiros times." : "Aguardando gente suficiente na fila pra montar dois times."}
        </p>
        {podeIniciarPartida(sessao) && (
          <Botao onClick={() => { atualizar(iniciarPartida(sessao)); avisar(`Partida ${sessao.historico.length + 1} montada`); }}>
            {sessao.historico.length === 0 ? "Iniciar 1ª partida" : "Iniciar próxima partida"}
          </Botao>
        )}
      </Painel>
    );
  }

  if (q.pendente === "empateSemFila") {
    return (
      <Painel className="space-y-3 p-4" style={{ borderColor: T.laranja }}>
        <p style={{ fontSize: 12.5, color: T.laranja }}>
          Empate sem fila suficiente pra tirar os dois times — decida na quadra no par ou ímpar (Art. 30º §2º) quem fica.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {["amarelo", "azul"].map((lado) => (
            <Botao key={lado} style={{ background: corDe(lado).hex, color: "#fff" }} onClick={() => {
              const r = resolverParOuImpar(sessao, lado);
              atualizar(r.sessao); avisar(r.aviso);
            }}>{corDe(lado).cor} venceu</Botao>
          ))}
        </div>
        <Botao variante="secundario" className="w-full" onClick={() => atualizar({ ...sessao, quadra: { ...q, pendente: null } })}>
          Voltar (cliquei sem querer)
        </Botao>
      </Painel>
    );
  }

  if (q.pendente === "primeiroGol") {
    return (
      <Painel className="space-y-3 p-4" style={{ borderColor: T.laranja }}>
        <p style={{ fontSize: 12.5, color: T.laranja }}>
          Empate {q.placar.amarelo}×{q.placar.azul} — quem fez o 1º gol permanece em quadra (Art. 30º). Quem foi?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {["amarelo", "azul"].map((lado) => (
            <Botao key={lado} style={{ background: corDe(lado).hex, color: "#fff" }} onClick={() => {
              const r = resolverPrimeiroGol(sessao, lado);
              atualizar(r.sessao); avisar(r.aviso);
            }}>{corDe(lado).cor} fez o 1º gol</Botao>
          ))}
        </div>
        <Botao variante="secundario" className="w-full" onClick={() => atualizar({ ...sessao, quadra: { ...q, pendente: null } })}>
          Voltar (cliquei sem querer)
        </Botao>
      </Painel>
    );
  }

  return (
    <Painel className="space-y-3 p-3">
      <FaixaPartida n={q.numero} />
      <div className="grid grid-cols-2 gap-2">
        {["amarelo", "azul"].map((lado) => (
          <TimeQuadra key={lado} {...{ lado, sessao, q, atualizar, avisar, nomes }} />
        ))}
      </div>
      <Botao className="w-full" onClick={() => {
        const r = encerrarPartida(sessao);
        atualizar(r.sessao);
        if (r.aviso) avisar(r.aviso);
      }}>Encerrar partida</Botao>
      <button onClick={() => setNaMao((v) => !v)} className="w-full text-center"
        style={{ fontSize: 11, fontWeight: 700, color: T.fraco, textDecoration: "underline" }}>
        {naMao ? "Fechar" : "O resultado das regras não bate? Decidir na mão quem fica"}
      </button>
      {naMao && (
        <div className="space-y-2 rounded-lg p-2" style={{ background: "rgba(0,0,0,.22)" }}>
          <p style={{ fontSize: 11, color: T.secundario }}>
            Encerra a partida escolhendo quem fica. A fila, o goleiro e o corte do Art. 29º seguem normalmente a partir daí.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {["amarelo", "azul"].map((lado) => (
              <Botao key={lado} style={{ background: corDe(lado).hex, color: "#fff", minHeight: 40, fontSize: 11 }} onClick={() => {
                const r = encerrarManual(sessao, lado);
                atualizar(r.sessao); setNaMao(false); avisar(r.aviso);
              }}>{corDe(lado).cor} fica</Botao>
            ))}
            <Botao variante="secundario" style={{ minHeight: 40, fontSize: 11 }} onClick={() => {
              const r = encerrarManual(sessao, null);
              atualizar(r.sessao); setNaMao(false); avisar(r.aviso);
            }}>Os dois saem</Botao>
          </div>
        </div>
      )}
    </Painel>
  );
}

function TimeQuadra({ lado, sessao, q, atualizar, avisar, nomes }) {
  const cor = corDe(lado);
  const time = q.lados[lado];
  const goleirosDisp = goleirosLivres(sessao);
  const livres = aguardandoLinha(sessao);

  return (
    <div className="overflow-hidden rounded-lg" style={{ background: T.tier1, border: `1px solid ${T.borda}` }}>
      <div className="flex items-center justify-between" style={{ padding: "7px 10px", background: `${cor.hex}22`, borderBottom: `2px solid ${cor.hex}` }}>
        <span style={{ fontSize: 11.5, fontWeight: 900, color: cor.hex }}>{cor.emoji} {cor.cor}</span>
        {q.incumbente === lado && (
          <span title={q.forcarSaidaAoFim ? "Sai depois desta partida, seja qual for o resultado (Art. 29º)." : undefined}
            style={{ fontSize: 8.5, fontWeight: 800, color: q.forcarSaidaAoFim ? T.laranja : T.verde }}>
            EM QUADRA{q.partidasSeguidas > 0 ? ` · ${q.partidasSeguidas}ª` : ""}{q.forcarSaidaAoFim ? " · ÚLTIMA" : ""}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 p-2">
        <button onClick={() => atualizar(marcarGol(sessao, lado, -1))} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,.08)", color: T.secundario, fontSize: 18 }}>−</button>
        <span className="font-destaque" style={{ width: 34, textAlign: "center", fontSize: 32, fontWeight: 700 }}>{q.placar[lado]}</span>
        <button onClick={() => atualizar(marcarGol(sessao, lado, 1))} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,.08)", color: T.ouro, fontSize: 18 }}>+</button>
      </div>
      <div className="space-y-1 px-2 pb-2">
        {time.goleiro ? (
          <div className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: T.gkFraco }}>
            <span className="flex items-center gap-1" style={{ fontSize: 12 }}>
              <IconeGoleiro tam={12} />{nomes[time.goleiro] || "?"}
              {!sessao.goleiros.includes(time.goleiro) && (
                <span title="Jogador de linha completando o gol por falta de goleiro — não conta a partida pra ele (Art. 34º §10º, mesma lógica do Campeonato)"
                  style={{ fontSize: 8, fontWeight: 800, color: T.laranja }}>LINHA NO GOL</span>
              )}
            </span>
            <button onClick={() => atualizar(limparGoleiro(sessao, lado))} title="Trocar goleiro" style={{ color: "rgba(255,255,255,.35)", fontSize: 12 }}>✕</button>
          </div>
        ) : (
          <select value="" onChange={(e) => e.target.value && atualizar(atribuirGoleiro(sessao, lado, e.target.value))}
            style={{ ...inputStyle, padding: "7px 4px", fontSize: 11.5 }}>
            <option value="">— escolher goleiro —</option>
            {goleirosDisp.map((gid, i) => <option key={gid} value={gid}>{nomes[gid] || "?"}{i === 0 ? " · próximo da fila" : ""}</option>)}
            {livres.map((jid) => <option key={jid} value={jid}>{nomes[jid] || "?"} · linha completando o gol</option>)}
          </select>
        )}
        {time.linha.map((jid) => (
          <LinhaJogador key={jid} {...{ jid, lado, sessao, atualizar, avisar, nomes, livres }} />
        ))}
      </div>
    </div>
  );
}

function LinhaJogador({ jid, lado, sessao, atualizar, avisar, nomes, livres }) {
  const [abrir, setAbrir] = useState(false);
  const [substitutoId, setSubstitutoId] = useState("");
  const [passou5, setPassou5] = useState(true);

  return (
    <div className="rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.22)" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12.5 }}>{nomes[jid] || "?"}</span>
        <button onClick={() => setAbrir((v) => !v)} style={{ fontSize: 10, fontWeight: 800, color: T.laranja, flexShrink: 0 }}>SAIU</button>
      </div>
      {abrir && (
        <div className="mt-1.5 space-y-1.5">
          <select value={substitutoId} onChange={(e) => setSubstitutoId(e.target.value)} style={{ ...inputStyle, padding: "6px 4px", fontSize: 11 }}>
            <option value="">— foi embora de vez (vaga fica aberta) —</option>
            {livres.map((oid) => <option key={oid} value={oid}>{nomes[oid] || "?"} entra no lugar</option>)}
          </select>
          {substitutoId && (
            <Segmento valor={passou5} onChange={setPassou5} opcoes={[
              { valor: false, rotulo: "Não passou de 5 min" },
              { valor: true, rotulo: "Já passou de 5 min" },
            ]} />
          )}
          <div className="flex gap-1.5">
            <Botao variante="secundario" className="flex-1" style={{ minHeight: 38, fontSize: 11 }} onClick={() => { setAbrir(false); setSubstitutoId(""); }}>Cancelar</Botao>
            <Botao className="flex-1" style={{ minHeight: 38, fontSize: 11 }} onClick={() => {
              const nomeSaiu = nomes[jid] || "?";
              if (substitutoId) {
                const nomeEntrou = nomes[substitutoId] || "?";
                atualizar(substituirLinha(sessao, lado, jid, substitutoId, { passouDe5Min: passou5 }));
                avisar(`${nomeSaiu} saiu, ${nomeEntrou} entrou`);
              } else {
                atualizar(removerJogador(sessao, jid));
                avisar(`${nomeSaiu} saiu — vaga em aberto`);
              }
              setAbrir(false); setSubstitutoId(""); setPassou5(true);
            }}>Confirmar</Botao>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Próximos times --------------------------------*/

function ProximosTimesPainel({ sessao, nomes }) {
  const proximos = proximosTimes(sessao, 2);
  if (!proximos.length) return null;
  return (
    <section>
      <Secao titulo="Próximos times" detalhe="prévia — muda conforme a fila muda" />
      <div className="grid grid-cols-2 gap-2">
        {proximos.map(({ jogadores, faltam, goleiro }, i) => (
          <Painel key={i} className="p-2.5">
            <p style={{ marginBottom: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", color: T.fraco }}>
              {i === 0 ? "PRÓXIMO A ENTRAR" : "DEPOIS DESSE"}
            </p>
            {goleiro ? (
              <p className="flex items-center gap-1" style={{ fontSize: 12, color: T.gk }}><IconeGoleiro tam={11} />{nomes[goleiro] || "?"}</p>
            ) : (
              <p style={{ fontSize: 11, fontStyle: "italic", color: T.fraco }}>sem goleiro livre pra sugerir</p>
            )}
            {jogadores.map((jid) => <p key={jid} style={{ fontSize: 12, color: T.secundario }}>{nomes[jid] || "?"}</p>)}
            {faltam > 0 && (
              <p style={{ marginTop: 2, fontSize: 11, fontStyle: "italic", color: T.fraco }}>
                +{faltam} jogador{faltam > 1 ? "es" : ""} do time que sair
              </p>
            )}
          </Painel>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- Fila / convidado --------------------------*/

const IconeArrastar = ({ cor }) => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill={cor} aria-hidden="true">
    {[2, 8].map((cx) => [3, 8, 13].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" />))}
  </svg>
);

/* Fila de linha com reordenação por arrastar (pointer events — funciona no
 * toque e no mouse). Pegar pelo "⠿" e soltar na posição.
 *
 * Desenhado pra NÃO travar em celular: a lista fica parada durante o gesto (a
 * linha arrastada só acompanha o dedo por transform e uma barra mostra onde vai
 * cair) — nenhum nó do DOM muda de lugar no meio do arraste, então o navegador
 * não solta o "pointer capture" do botão (o que deixava o soltar se perder e a
 * fila presa). Os listeners de mover/soltar ficam na `window`, então soltar em
 * qualquer lugar da tela (ou o navegador cancelar o toque) sempre encerra o
 * gesto. Ao soltar, commita um único `inserirNaFila` (move só o jogador
 * arrastado, na frente do vizinho de baixo — os outros mantêm a ordem relativa). */
function FilaLinhaArrastavel({ filaLinha, nomes, sessao, atualizar, avisar, ordemIdx }) {
  const [dragId, setDragId] = useState(null);
  const [alvo, setAlvo] = useState(null); // { indice, barraY, dy }
  const linhasRef = useRef(new Map());   // jid -> elemento da linha
  const caixaRef = useRef(null);
  const gestoRef = useRef(null);         // { jid, pointerId, retas, yInicio, yAtual, novoIdx }
  const rolagemRef = useRef(0);
  const propsRef = useRef(null);
  propsRef.current = { filaLinha, nomes, sessao, atualizar, avisar };
  // as funções abaixo são recriadas a cada render; a window recebe estes invólucros
  // estáveis (sempre chamam a versão mais nova) pra add/removeEventListener baterem.
  const fnsRef = useRef({});
  const estaveis = useRef({
    mover: (e) => fnsRef.current.aoMoverJanela(e),
    soltar: (e) => fnsRef.current.aoSoltarJanela(e),
    foco: () => fnsRef.current.aoPerderFoco(),
  }).current;

  /* onde a linha cairia, com o dedo na altura `yAtual` (coordenadas da página —
   * assim continua certo mesmo se a página rolar durante o arraste). */
  function recalcular() {
    const g = gestoRef.current;
    if (!g) return;
    const outros = g.retas.filter((r) => r.jid !== g.jid);
    const yPag = g.yAtual + window.scrollY;
    const novoIdx = outros.filter((r) => yPag > r.meio).length;
    g.novoIdx = novoIdx;
    const caixaTopo = caixaRef.current ? caixaRef.current.getBoundingClientRect().top + window.scrollY : 0;
    const barraPag = novoIdx < outros.length ? outros[novoIdx].topo - 1 : outros.length ? outros[outros.length - 1].base + 1 : 0;
    setAlvo({ indice: novoIdx, barraY: barraPag - caixaTopo, dy: yPag - g.yInicio });
  }

  function encerrarGesto(commitar) {
    const g = gestoRef.current;
    gestoRef.current = null;
    window.removeEventListener("pointermove", estaveis.mover);
    window.removeEventListener("pointerup", estaveis.soltar);
    window.removeEventListener("pointercancel", estaveis.soltar);
    window.removeEventListener("blur", estaveis.foco);
    cancelAnimationFrame(rolagemRef.current);
    setDragId(null);
    setAlvo(null);
    if (!g || !commitar) return;
    const { filaLinha: fila, nomes: nm, sessao: ses, atualizar: atu, avisar: avi } = propsRef.current;
    if (fila.indexOf(g.jid) === g.novoIdx) return; // caiu onde já estava
    const outros = fila.filter((jid) => jid !== g.jid);
    const antesDeId = g.novoIdx < outros.length ? outros[g.novoIdx] : null;
    atu(inserirNaFila(ses, g.jid, antesDeId, false));
    avi(`${nm[g.jid] || "Jogador"} agora é ${g.novoIdx + 1}º na fila`);
  }
  function aoMoverJanela(e) {
    const g = gestoRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    g.yAtual = e.clientY;
    recalcular();
  }
  function aoSoltarJanela(e) {
    const g = gestoRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    encerrarGesto(e.type === "pointerup"); // toque cancelado pelo navegador = desiste, não move
  }
  function aoPerderFoco() { encerrarGesto(false); }
  fnsRef.current = { aoMoverJanela, aoSoltarJanela, aoPerderFoco };

  /* perto da borda da tela, rola a página sozinha enquanto o dedo segura */
  function loopRolagem() {
    const g = gestoRef.current;
    if (!g) return;
    const borda = 90;
    if (g.yAtual < borda) { window.scrollBy(0, -Math.ceil((borda - g.yAtual) / 6)); recalcular(); }
    else if (g.yAtual > window.innerHeight - borda) { window.scrollBy(0, Math.ceil((g.yAtual - (window.innerHeight - borda)) / 6)); recalcular(); }
    rolagemRef.current = requestAnimationFrame(loopRolagem);
  }

  function aoDescer(e, jid) {
    if (gestoRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const retas = filaLinha.map((id) => {
      const r = linhasRef.current.get(id)?.getBoundingClientRect();
      const topo = (r?.top ?? 0) + window.scrollY, base = (r?.bottom ?? 0) + window.scrollY;
      return { jid: id, topo, base, meio: (topo + base) / 2 };
    });
    gestoRef.current = { jid, pointerId: e.pointerId, retas, yInicio: e.clientY + window.scrollY, yAtual: e.clientY, novoIdx: filaLinha.indexOf(jid) };
    window.addEventListener("pointermove", estaveis.mover);
    window.addEventListener("pointerup", estaveis.soltar);
    window.addEventListener("pointercancel", estaveis.soltar);
    window.addEventListener("blur", estaveis.foco);
    setDragId(jid);
    recalcular();
    rolagemRef.current = requestAnimationFrame(loopRolagem);
  }

  // saiu da tela no meio do gesto: solta os listeners
  useEffect(() => () => { if (gestoRef.current) encerrarGesto(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Painel className="space-y-1 p-2" style={{ position: "relative", userSelect: dragId ? "none" : "auto", WebkitUserSelect: dragId ? "none" : "auto" }}>
      {filaLinha.length === 0 && <p style={{ padding: 8, textAlign: "center", fontSize: 12, color: T.fraco }}>Ninguém aguardando.</p>}
      <div ref={caixaRef} className="space-y-1" style={{ position: "relative" }}>
        {filaLinha.map((jid, i) => (
          <div key={jid} ref={(el) => { if (el) linhasRef.current.set(jid, el); else linhasRef.current.delete(jid); }}
            className="flex items-center justify-between rounded px-2 py-1.5"
            style={{
              background: dragId === jid ? T.tier3 : "rgba(0,0,0,.18)",
              boxShadow: dragId === jid ? "0 6px 18px rgba(0,0,0,.45)" : "none",
              opacity: dragId && dragId !== jid ? 0.65 : 1,
              transform: dragId === jid && alvo ? `translateY(${alvo.dy}px)` : "none",
              position: "relative", zIndex: dragId === jid ? 2 : 0,
              transition: dragId ? "none" : "background .12s, opacity .12s",
            }}>
            <span className="flex items-center" style={{ minWidth: 0, gap: 6, fontSize: 12.5 }}>
              <button onPointerDown={(e) => aoDescer(e, jid)} onContextMenu={(e) => e.preventDefault()}
                title="Arraste para reordenar"
                style={{
                  touchAction: "none", cursor: dragId === jid ? "grabbing" : "grab", padding: "6px 5px", display: "flex", flexShrink: 0,
                  WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none",
                }}>
                <IconeArrastar cor={dragId === jid ? T.secundario : T.fraco} />
              </button>
              <b style={{ color: T.fraco, flexShrink: 0 }}>{i + 1}º</b>
              <span className="truncate">{nomes[jid] || "?"}</span>
            </span>
            <div className="flex items-center" style={{ gap: 2, flexShrink: 0 }}>
              <button onClick={() => { atualizar(reclassificarJogador(sessao, jid, true, ordemIdx)); avisar(`${nomes[jid]} virou goleiro pro resto do dia`); }}
                title="Reclassificar como goleiro pro resto do dia" style={{ padding: "4px 6px", fontSize: 9, fontWeight: 800, color: T.gk }}>GOL</button>
              <button onClick={() => { atualizar(removerJogador(sessao, jid)); avisar(`${nomes[jid]} saiu da fila`); }}
                style={{ padding: "4px 7px", fontSize: 13, color: T.laranja }}>✕</button>
            </div>
          </div>
        ))}
        {dragId && alvo && (
          <div aria-hidden="true" style={{
            position: "absolute", left: 0, right: 0, top: alvo.barraY - 1, height: 3, borderRadius: 2,
            background: T.ouro, boxShadow: `0 0 6px ${T.ouro}`, pointerEvents: "none", zIndex: 3,
          }} />
        )}
      </div>
      {filaLinha.length > 1 && (
        <p style={{ padding: "2px 6px 0", fontSize: 9.5, color: T.fraco }}>Arraste pela alça à esquerda para mudar a ordem da fila.</p>
      )}
    </Painel>
  );
}

function FilaEConvidados({ sessao, atualizar, avisar, base, convidados, setConvidados, nomes, ordemIdx, setOrdemIdx, proximoIdx }) {
  const filaLinha = aguardandoLinha(sessao);
  const [filaAberta, setFilaAberta] = useState(false);
  const [goleirosAberto, setGoleirosAberto] = useState(false);

  return (
    <div className="space-y-3">
      <SecaoRecolhivel titulo="Fila (linha)" detalhe={`${filaLinha.length} aguardando`} aberto={filaAberta} onToggle={() => setFilaAberta((v) => !v)}>
        <FilaLinhaArrastavel {...{ filaLinha, nomes, sessao, atualizar, avisar, ordemIdx }} />
      </SecaoRecolhivel>

      <SecaoRecolhivel titulo="Goleiros presentes" detalhe={`${goleirosLivres(sessao).length} aguardando · ${sessao.goleiros.length} no dia`}
        aberto={goleirosAberto} onToggle={() => setGoleirosAberto((v) => !v)}>
        <Painel className="space-y-1 p-2">
          {sessao.goleiros.length === 0 && <p style={{ padding: 8, textAlign: "center", fontSize: 12, color: T.fraco }}>Nenhum goleiro no dia ainda.</p>}
          {sessao.goleiros.map((jid) => {
            const ladoOcupado = sessao.quadra && ["amarelo", "azul"].find((l) => sessao.quadra.lados[l].goleiro === jid);
            const rank = goleirosLivres(sessao).indexOf(jid); // ordem de chegada entre os que aguardam
            return (
              <div key={jid} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: ladoOcupado ? T.gkFraco : "rgba(0,0,0,.18)" }}>
                <span className="flex items-center gap-1" style={{ fontSize: 12.5 }}>
                  <IconeGoleiro tam={12} />
                  {!ladoOcupado && rank >= 0 && <b style={{ color: T.fraco, marginRight: 1 }}>{rank + 1}º</b>}
                  {nomes[jid] || "?"}
                  {ladoOcupado && <span style={{ fontSize: 8.5, fontWeight: 800, color: T.gk }}>EM QUADRA · {NOME_LADO[ladoOcupado]}</span>}
                </span>
                {!ladoOcupado && (
                  <div className="flex items-center" style={{ gap: 2 }}>
                    <button onClick={() => { atualizar(reclassificarJogador(sessao, jid, false, ordemIdx)); avisar(`${nomes[jid]} virou linha pro resto do dia`); }}
                      title="Reclassificar como linha pro resto do dia" style={{ padding: "4px 6px", fontSize: 9, fontWeight: 800, color: T.secundario }}>LINHA</button>
                    <button onClick={() => { atualizar(removerJogador(sessao, jid)); avisar(`${nomes[jid]} saiu`); }} style={{ padding: "4px 7px", fontSize: 13, color: T.laranja }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </Painel>
      </SecaoRecolhivel>

      <AdicionarNaFila {...{ sessao, atualizar, avisar, base, convidados, setConvidados, ordemIdx, setOrdemIdx, proximoIdx }} />
    </div>
  );
}

function AdicionarNaFila({ sessao, atualizar, avisar, base, convidados, setConvidados, ordemIdx, setOrdemIdx, proximoIdx }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState("elenco");
  const [jogadorId, setJogadorId] = useState("");
  const [nome, setNome] = useState("");
  const [posicao, setPosicao] = useState("LINHA");
  const [posicaoFila, setPosicaoFila] = useState("");

  const jaNaSessao = new Set([...sessao.linha, ...sessao.goleiros]);
  const disponiveisElenco = base.jogadores.filter((j) => j.ativo !== false && !jaNaSessao.has(j.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // A posição digitada é sobre a ORDEM DE CHEGADA combinada (a mesma lista da barra lateral,
  // misturando linha e goleiro) — não sobre a fila de um tipo só, senão "posição 7" muda de
  // sentido dependendo de quantos goleiros tem na frente. Pra encaixar de fato na fila
  // funcional do tipo certo (linha OU goleiro), escaneia a partir dali até achar o primeiro
  // do mesmo tipo do novo jogador — é ele quem entra como referência pro inserirNaFila.
  const posicaoEscolhida = (ehGoleiro) => {
    const geral = ordemGeral(sessao, ordemIdx);
    const idx = posicaoFila === "" ? geral.length : Math.max(0, Math.min(Number(posicaoFila) - 1, geral.length));
    const mesmoTipo = (jid) => sessao.goleiros.includes(jid) === ehGoleiro;
    let antesDeIdTipo = null;
    for (let i = idx; i < geral.length; i++) if (mesmoTipo(geral[i])) { antesDeIdTipo = geral[i]; break; }
    return { antesDeIdTipo, anteriorIdGeral: geral[idx - 1] ?? null, antesDeIdGeral: geral[idx] ?? null };
  };
  const novoOrdemIdx = (s, anteriorId, antesDeId) => {
    const antes = anteriorId != null ? s[anteriorId] : undefined;
    const depois = antesDeId != null ? s[antesDeId] : undefined;
    if (antes === undefined && depois === undefined) return proximoIdx(s);
    if (antes === undefined) return depois - 1;
    if (depois === undefined) return antes + 1;
    return (antes + depois) / 2;
  };

  return (
    <SecaoRecolhivel titulo="Adicionar à fila" detalhe="do elenco ou convidado" aberto={aberto} onToggle={() => setAberto((v) => !v)}>
      <Painel className="space-y-2 p-3">
        <Segmento valor={modo} onChange={setModo} opcoes={[{ valor: "elenco", rotulo: "Do elenco" }, { valor: "convidado", rotulo: "Convidado do dia" }]} />
        {modo === "elenco" ? (
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)} style={inputStyle}>
            <option value="">— escolher jogador —</option>
            {disponiveisElenco.map((j) => (
              <option key={j.id} value={j.id} disabled={barradoDoRachao(j)}>
                {j.nome}{j.posicao === "GOLEIRO" ? " (Gol)" : ""}{barradoDoRachao(j) ? " — pendência financeira" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex gap-1.5">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 14 }} />
            <select value={posicao} onChange={(e) => setPosicao(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
              <option value="LINHA">Linha</option><option value="GOLEIRO">Gol</option>
            </select>
          </div>
        )}
        <Campo rotulo="Posição na ordem de chegada (vazio = no fim)" dica="conta linha e goleiro juntos, igual a lista da direita">
          <input type="number" min="1" value={posicaoFila} onChange={(e) => setPosicaoFila(e.target.value)} placeholder="ex.: 3" style={inputStyle} />
        </Campo>
        <Botao className="w-full" onClick={() => {
          if (modo === "elenco") {
            if (!jogadorId) return;
            const j = base.jogadores.find((x) => x.id === jogadorId);
            const { antesDeIdTipo, anteriorIdGeral, antesDeIdGeral } = posicaoEscolhida(j.posicao === "GOLEIRO");
            atualizar(inserirNaFila(sessao, jogadorId, antesDeIdTipo, j.posicao === "GOLEIRO"));
            setOrdemIdx((s) => (jogadorId in s ? s : { ...s, [jogadorId]: novoOrdemIdx(s, anteriorIdGeral, antesDeIdGeral) }));
            avisar(`${j.nome} entrou na fila`);
            setJogadorId("");
          } else {
            if (!nome.trim()) return;
            const jid = id();
            const ehGoleiro = posicao === "GOLEIRO";
            const { antesDeIdTipo, anteriorIdGeral, antesDeIdGeral } = posicaoEscolhida(ehGoleiro);
            setConvidados([...convidados, { id: jid, nome: nome.trim(), posicao }]);
            atualizar(inserirNaFila(sessao, jid, antesDeIdTipo, ehGoleiro));
            setOrdemIdx((s) => ({ ...s, [jid]: novoOrdemIdx(s, anteriorIdGeral, antesDeIdGeral) }));
            avisar(`${nome.trim()} entrou como convidado do dia`);
            setNome("");
          }
          setPosicaoFila("");
        }}>Adicionar</Botao>
      </Painel>
    </SecaoRecolhivel>
  );
}

/* --------------------------- Histórico do dia -------------------------------*/

function HistoricoDoDia({ sessao }) {
  const [aberto, setAberto] = useState(false);
  if (!sessao.historico.length) return null;
  return (
    <SecaoRecolhivel titulo="Partidas de hoje" detalhe={`${sessao.historico.length}`} aberto={aberto} onToggle={() => setAberto((v) => !v)}>
      <div className="space-y-1.5">
        {[...sessao.historico].reverse().map((h) => (
          <Painel key={h.numero} className="p-2.5">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 10.5, color: T.fraco }}>PARTIDA {h.numero}</span>
              <span className="font-destaque" style={{ fontSize: 15, fontWeight: 700 }}>
                <span style={{ color: AMARELO.hex }}>{h.placarAmarelo}</span> × <span style={{ color: AZUL.hex }}>{h.placarAzul}</span>
              </span>
            </div>
            <p style={{ marginTop: 3, fontSize: 11.5, color: T.secundario }}>{h.motivo}</p>
          </Painel>
        ))}
      </div>
    </SecaoRecolhivel>
  );
}

export { TelaRachao };
