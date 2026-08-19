import React, { useState } from "react";
import { T, AMARELO, AZUL, corDe } from "../theme";
import { id } from "../core/repositorio";
import {
  criarSessao, aguardandoLinha, goleirosLivres, proximosTimes,
  podeIniciarPartida, iniciarPartida, atribuirGoleiro, limparGoleiro, marcarGol,
  encerrarPartida, resolverParOuImpar, resolverPrimeiroGol, substituirLinha, removerJogador,
  inserirNaFila, avisosSessao, NOME_LADO,
} from "../core/rachao";
import {
  Botao, Painel, inputStyle, Campo, CabecalhoPagina, Secao, Segmento, IconeGoleiro,
  Contador, FaixaPartida,
} from "../components/ui";

/* =========================== TELA: RACHÃO =================================
 * Fila por ordem de chegada, times Amarelo × Azul, vencedor fica em quadra
 * (Art. 25º-30º do Estatuto). Totalmente separada do Campeonato: não mexe em
 * gols/cartões/pontos/tabela de ninguém.
 *
 * Nada aqui é salvo — a sessão e os convidados do dia vivem só no estado
 * local desta tela. Sair da aba/recarregar a página perde tudo, e é assim
 * mesmo: o Rachão roda dentro do dia e acaba com "Encerrar jogos do Rachão".
 * (Se um dia isso precisar sobreviver a um refresh, dá pra trocar os
 * useState abaixo por localStorage — sem precisar do Supabase pra isso.)  */

function TelaRachao({ base, avisar }) {
  const [sessao, setSessao] = useState(null);
  const [convidados, setConvidados] = useState([]); // só desta sessão — não entra no elenco
  // ordem de chegada estável, só pra exibição (Lista de chegada) — cada jogador ganha um
  // índice na hora em que entra no dia e ele nunca muda depois, mesmo que a fila (que gira
  // com vitória/derrota) reordene. Não afeta regra nenhuma do jogo.
  const [ordemIdx, setOrdemIdx] = useState({});
  const proximoIdx = (atual) => (Object.keys(atual).length ? Math.max(...Object.values(atual)) + 1 : 0);

  const nomes = {
    ...Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome])),
    ...Object.fromEntries(convidados.map((c) => [c.id, c.nome])),
  };

  if (!sessao) return <AberturaRachao {...{ base, avisar, setSessao, setConvidados, setOrdemIdx }} />;

  const presentesTotal = new Set([...sessao.linha, ...sessao.goleiros]).size;
  const avisos = avisosSessao(sessao, presentesTotal);

  return (
    <div className="rachao-layout">
      <div className="space-y-4" style={{ flex: 1, minWidth: 0 }}>
        <CabecalhoPagina titulo="Rachão"
          descricao={new Date(sessao.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} />

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
        <ProximosTimesPainel {...{ sessao, nomes }} />
        <FilaEConvidados {...{ sessao, atualizar: setSessao, avisar, base, convidados, setConvidados, nomes, ordemIdx, setOrdemIdx, proximoIdx }} />
        <HistoricoDoDia sessao={sessao} />

        <Botao variante="secundario" className="w-full" onClick={() => {
          if (confirm("Encerrar os jogos do Rachão? Nada foi salvo — a fila, a quadra e o histórico de hoje somem.")) {
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
  const idsHoje = [...new Set([...sessao.linha, ...sessao.goleiros])];
  const ordenados = idsHoje.sort((a, b) => (ordemIdx[a] ?? Infinity) - (ordemIdx[b] ?? Infinity));
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
  const [data, setData] = useState(hoje);
  const [linhaPorTime, setLinhaPorTime] = useState(4);
  const [limitePartidas, setLimitePartidas] = useState(3);
  const porId = Object.fromEntries(base.jogadores.map((j) => [j.id, j]));
  const rodadaDoDia = base.rodadas.find((r) => r.data === data);

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Rachão" descricao="Fila por ordem de chegada, Amarelo × Azul, vencedor fica em quadra. Nada fica salvo — roda só no dia." />
      <Painel className="p-4 space-y-3">
        <Campo rotulo="Data do rachão">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={inputStyle} />
        </Campo>

        {rodadaDoDia ? (
          <p style={{ fontSize: 12, color: T.secundario }}>
            Vou puxar a ordem de chegada da <b style={{ color: T.ouro }}>rodada {rodadaDoDia.numero}</b> do Campeonato
            deste dia ({(rodadaDoDia.ordemChegada || []).length} jogador(es) já chamados) — dá pra ajustar a fila depois de abrir.
          </p>
        ) : (
          <p style={{ fontSize: 12, color: T.fraco }}>Nenhuma rodada do Campeonato encontrada nesta data — a fila abre vazia, dá pra adicionar todo mundo na mão.</p>
        )}
        <Campo rotulo="Jogadores de linha por time">
          <Segmento valor={linhaPorTime} onChange={setLinhaPorTime}
            opcoes={[{ valor: 4, rotulo: "4 + 1 gol" }, { valor: 5, rotulo: "5 + 1 gol" }]} />
        </Campo>
        <Campo rotulo="Sai depois de quantas partidas seguidas" dica="Art. 29º — com 25+ presentes o Estatuto recomenda 2 (a não ser que a locação seja de 2h ou mais).">
          <Segmento valor={limitePartidas} onChange={setLimitePartidas}
            opcoes={[{ valor: 2, rotulo: "2 partidas" }, { valor: 3, rotulo: "3 partidas" }]} />
        </Campo>
        <Botao className="w-full" onClick={() => {
          const chegada = rodadaDoDia?.ordemChegada || [];
          const nova = criarSessao({
            id: id(), data, rodadaOrigemId: rodadaDoDia?.id || null,
            ordemChegada: chegada, porId, linhaPorTime, limitePartidas,
          });
          setConvidados([]);
          setOrdemIdx(Object.fromEntries([...nova.linha, ...nova.goleiros]
            .map((jid) => [jid, chegada.indexOf(jid)])));
          setSessao(nova);
          avisar(`Rachão de ${new Date(data + "T12:00:00").toLocaleDateString("pt-BR")} aberto`);
        }}>Abrir Rachão</Botao>
      </Painel>
    </div>
  );
}

/* ------------------------------ Quadra ao vivo -----------------------------*/

function QuadraAoVivo({ sessao, atualizar, avisar, nomes }) {
  const q = sessao.quadra;

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
            <span className="flex items-center gap-1" style={{ fontSize: 12 }}><IconeGoleiro tam={12} />{nomes[time.goleiro] || "?"}</span>
            <button onClick={() => atualizar(limparGoleiro(sessao, lado))} title="Trocar goleiro" style={{ color: "rgba(255,255,255,.35)", fontSize: 12 }}>✕</button>
          </div>
        ) : (
          <select value="" onChange={(e) => e.target.value && atualizar(atribuirGoleiro(sessao, lado, e.target.value))}
            style={{ ...inputStyle, padding: "7px 4px", fontSize: 11.5 }}>
            <option value="">— escolher goleiro —</option>
            {goleirosDisp.map((gid, i) => <option key={gid} value={gid}>{nomes[gid] || "?"}{i === 0 ? " · próximo da fila" : ""}</option>)}
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
        {proximos.map(({ jogadores, faltam }, i) => (
          <Painel key={i} className="p-2.5">
            <p style={{ marginBottom: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", color: T.fraco }}>
              {i === 0 ? "PRÓXIMO A ENTRAR" : "DEPOIS DESSE"}
            </p>
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

function FilaEConvidados({ sessao, atualizar, avisar, base, convidados, setConvidados, nomes, ordemIdx, setOrdemIdx, proximoIdx }) {
  const filaLinha = aguardandoLinha(sessao);

  return (
    <section className="space-y-3">
      <div>
        <Secao titulo="Fila (linha)" detalhe={`${filaLinha.length} aguardando`} />
        <Painel className="space-y-1 p-2">
          {filaLinha.length === 0 && <p style={{ padding: 8, textAlign: "center", fontSize: 12, color: T.fraco }}>Ninguém aguardando.</p>}
          {filaLinha.map((jid, i) => (
            <div key={jid} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.18)" }}>
              <span style={{ fontSize: 12.5 }}><b style={{ marginRight: 6, color: T.fraco }}>{i + 1}º</b>{nomes[jid] || "?"}</span>
              <div className="flex items-center" style={{ gap: 2 }}>
                <button disabled={i === 0} onClick={() => atualizar(inserirNaFila(sessao, jid, filaLinha[i - 1], false))}
                  style={{ padding: "4px 7px", fontSize: 12, color: i === 0 ? "rgba(255,255,255,.15)" : T.secundario }}>▲</button>
                <button disabled={i === filaLinha.length - 1} onClick={() => atualizar(inserirNaFila(sessao, jid, filaLinha[i + 2], false))}
                  style={{ padding: "4px 7px", fontSize: 12, color: i === filaLinha.length - 1 ? "rgba(255,255,255,.15)" : T.secundario }}>▼</button>
                <button onClick={() => { atualizar(removerJogador(sessao, jid)); avisar(`${nomes[jid]} saiu da fila`); }}
                  style={{ padding: "4px 7px", fontSize: 13, color: T.laranja }}>✕</button>
              </div>
            </div>
          ))}
        </Painel>
      </div>

      <div>
        <Secao titulo="Goleiros presentes" detalhe={`${goleirosLivres(sessao).length} aguardando · ${sessao.goleiros.length} no dia`} />
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
                  <button onClick={() => { atualizar(removerJogador(sessao, jid)); avisar(`${nomes[jid]} saiu`); }} style={{ padding: "4px 7px", fontSize: 13, color: T.laranja }}>✕</button>
                )}
              </div>
            );
          })}
        </Painel>
      </div>

      <AdicionarNaFila {...{ sessao, atualizar, avisar, base, convidados, setConvidados, ordemIdx, setOrdemIdx, proximoIdx }} />
    </section>
  );
}

function AdicionarNaFila({ sessao, atualizar, avisar, base, convidados, setConvidados, ordemIdx, setOrdemIdx, proximoIdx }) {
  const [modo, setModo] = useState("elenco");
  const [jogadorId, setJogadorId] = useState("");
  const [nome, setNome] = useState("");
  const [posicao, setPosicao] = useState("LINHA");
  const [estrelas, setEstrelas] = useState(1);
  const [posicaoFila, setPosicaoFila] = useState("");

  const jaNaSessao = new Set([...sessao.linha, ...sessao.goleiros]);
  const disponiveisElenco = base.jogadores.filter((j) => j.ativo !== false && !jaNaSessao.has(j.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Acha onde encaixar na fila (aguardando) e devolve tanto o vizinho de referência pro
  // inserirNaFila quanto os vizinhos pra calcular a posição na Lista de chegada — assim quem
  // escolhe "posição 10" cai na 10ª posição das duas listas, não só na fila do jogo.
  const posicaoNaFila = (ehGoleiro) => {
    const fila = ehGoleiro ? goleirosLivres(sessao) : aguardandoLinha(sessao);
    const idx = posicaoFila === "" ? fila.length : Math.max(0, Math.min(Number(posicaoFila) - 1, fila.length));
    return { antesDeId: fila[idx] ?? null, anteriorId: fila[idx - 1] ?? null };
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
    <div>
      <Secao titulo="Adicionar à fila" detalhe="do elenco ou convidado só do Rachão" />
      <Painel className="space-y-2 p-3">
        <Segmento valor={modo} onChange={setModo} opcoes={[{ valor: "elenco", rotulo: "Do elenco" }, { valor: "convidado", rotulo: "Convidado do dia" }]} />
        {modo === "elenco" ? (
          <select value={jogadorId} onChange={(e) => setJogadorId(e.target.value)} style={inputStyle}>
            <option value="">— escolher jogador —</option>
            {disponiveisElenco.map((j) => <option key={j.id} value={j.id}>{j.nome}{j.posicao === "GOLEIRO" ? " (Gol)" : ""}</option>)}
          </select>
        ) : (
          <div className="flex gap-1.5">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 14 }} />
            <select value={posicao} onChange={(e) => setPosicao(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
              <option value="LINHA">Linha</option><option value="GOLEIRO">Gol</option>
            </select>
            <select value={estrelas} onChange={(e) => setEstrelas(Number(e.target.value))} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
            </select>
          </div>
        )}
        <Campo rotulo="Posição na fila (vazio = no fim)">
          <input type="number" min="1" value={posicaoFila} onChange={(e) => setPosicaoFila(e.target.value)} placeholder="ex.: 3" style={inputStyle} />
        </Campo>
        <Botao className="w-full" onClick={() => {
          if (modo === "elenco") {
            if (!jogadorId) return;
            const j = base.jogadores.find((x) => x.id === jogadorId);
            const { antesDeId, anteriorId } = posicaoNaFila(j.posicao === "GOLEIRO");
            atualizar(inserirNaFila(sessao, jogadorId, antesDeId, j.posicao === "GOLEIRO"));
            setOrdemIdx((s) => (jogadorId in s ? s : { ...s, [jogadorId]: novoOrdemIdx(s, anteriorId, antesDeId) }));
            avisar(`${j.nome} entrou na fila`);
            setJogadorId("");
          } else {
            if (!nome.trim()) return;
            const jid = id();
            const ehGoleiro = posicao === "GOLEIRO";
            const { antesDeId, anteriorId } = posicaoNaFila(ehGoleiro);
            setConvidados([...convidados, { id: jid, nome: nome.trim(), posicao, estrelas }]);
            atualizar(inserirNaFila(sessao, jid, antesDeId, ehGoleiro));
            setOrdemIdx((s) => ({ ...s, [jid]: novoOrdemIdx(s, anteriorId, antesDeId) }));
            avisar(`${nome.trim()} entrou como convidado do dia`);
            setNome(""); setEstrelas(1);
          }
          setPosicaoFila("");
        }}>Adicionar</Botao>
      </Painel>
    </div>
  );
}

/* --------------------------- Histórico do dia -------------------------------*/

function HistoricoDoDia({ sessao }) {
  if (!sessao.historico.length) return null;
  return (
    <section>
      <Secao titulo="Partidas de hoje" detalhe={`${sessao.historico.length}`} />
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
    </section>
  );
}

export { TelaRachao };
