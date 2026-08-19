import React, { useState, useEffect, useMemo } from "react";
import { T } from "../theme";
import { corDe, AMARELO, AZUL } from "../theme";
import {
  CONFIG_PADRAO, nivelInfo, nivelSeAtrasar, normalizarCartoes, placarDe, timePorId,
  idsDoTime, marcarReaproveitamentos, sortearEquipes, poolsDoDia, partidasPossiveis,
  evVazio, avaliarTimes, buscaLocal, chaveDupla,
} from "../core/regras";
import { imagemEscalacoes, textoWhatsApp } from "../core/exportacao";
import { id } from "../core/repositorio";
import {
  Botao, Painel, inputStyle, Campo, CabecalhoPagina, Secao, Segmento, SeloAtraso,
  CampoBusca, Estrelas, IconeGoleiro, Contador, FaixaPartida, Marcadores,
} from "../components/ui";
import { IconeSetaDireita, IconeTrofeu } from "../components/icones";
import { Historico } from "./TelaConfig";

/* =========================== TELA: RODADA ================================*/

function TelaRodada({ base, setBase, dados, cfg: cfgGlobal, avisar }) {
  const [etapa, setEtapa] = useState("presenca");
  const rodada = base.rodadas.find((r) => r.status === "aberta");
  const cfg = rodada?.configSnapshot ? { ...CONFIG_PADRAO, ...rodada.configSnapshot } : cfgGlobal;
  const porId = Object.fromEntries(dados.todos.map((l) => [l.id, l]));
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const atualizar = (patch) => setBase({ ...base, rodadas: base.rodadas.map((r) => (r.id === rodada.id ? { ...r, ...patch } : r)) });

  if (!rodada) {
    const ultima = [...base.rodadas].sort((a, b) => b.numero - a.numero)[0];
    const proxima = Math.max(dados.rodadasRealizadas, ultima?.numero || 0) + 1;
    return (
      <div className="space-y-4">
        <CabecalhoPagina titulo="Gestão da Rodada" descricao="Presença, sorteio equilibrado e súmula da partida." />
        <Painel className="p-6 text-center">
          <p style={{ fontSize: 14, color: T.secundario, marginBottom: 4 }}>Nenhuma rodada em andamento.</p>
          <p style={{ fontSize: 12, color: T.fraco, marginBottom: 20 }}>
            {ultima ? `Última no app: rodada ${ultima.numero} (${ultima.data})` : `Base oficial carregada até a ${base.historicoInicial?.rodadas || 0}ª rodada.`}
          </p>
          <Botao className="w-full" onClick={() => {
            setBase({ ...base, rodadas: [...base.rodadas, { id: id(), numero: proxima, data: new Date().toISOString().slice(0, 10), status: "aberta", presencas: {}, naLinha: {}, times: [], jogos: [], ajustes: [], configSnapshot: { ...cfg } }] });
            avisar(`Rodada ${proxima} aberta`);
          }}>Abrir rodada {proxima}</Botao>
        </Painel>
        <Historico {...{ base, setBase, avisar, nomes, dados }} />
      </div>
    );
  }

  const etapas = [
    { id: "presenca", r: "Presença" }, { id: "times", r: "Sorteio" },
    { id: "jogos", r: `Partidas${rodada.jogos.length ? ` (${rodada.jogos.length})` : ""}` },
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Gestão da Rodada" descricao={new Date(rodada.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} />
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: T.ouroFraco, border: "1px solid rgba(245,197,24,.34)" }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <button
            onClick={() => {
              const temLancamento = (rodada.jogos || []).length > 0 || Object.keys(rodada.presencas || {}).length > 0;
              const msg = temLancamento
                ? `Fechar a rodada ${rodada.numero} e voltar? As presenças/partidas ainda não fechadas desta rodada serão descartadas.`
                : `Voltar para a tela de abertura? A rodada ${rodada.numero} (ainda vazia) será cancelada.`;
              if (confirm(msg)) {
                setBase({ ...base, rodadas: base.rodadas.filter((r) => r.id !== rodada.id) });
                avisar("Voltou para a abertura de rodada");
              }
            }}
            title="Voltar para abrir rodada"
            style={{ fontSize: 18, fontWeight: 900, color: T.ouro, lineHeight: 1, padding: "2px 6px" }}>‹</button>
          <div>
            <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color: T.ouro }}>Rodada {rodada.numero}</p>
            <p style={{ fontSize: 12, color: T.secundario }}>{rodada.jogos.length} partida(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="number" value={rodada.numero} onChange={(e) => atualizar({ numero: Number(e.target.value) })} style={{ ...inputStyle, width: 58, padding: "8px 4px", textAlign: "center", fontSize: 13 }} />
          <input type="date" value={rodada.data} onChange={(e) => atualizar({ data: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "8px", fontSize: 12 }} />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg p-1" style={{ background: "rgba(0,0,0,.3)" }}>
        {etapas.map((e) => (
          <button key={e.id} onClick={() => setEtapa(e.id)} className="flex-1 rounded"
            style={{
              padding: "11px 4px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              background: etapa === e.id ? T.ouro : "transparent", color: etapa === e.id ? T.sobreOuro : T.secundario
            }}>{e.r}</button>
        ))}
      </div>

      {etapa === "presenca" && <EtapaPresenca {...{ base, setBase, rodada, atualizar, porId, cfg, dados, avisar, ir: () => setEtapa("times") }} />}
      {etapa === "times" && <EtapaSorteio {...{ base, rodada, atualizar, porId, cfg, dados, avisar, nomes, ir: () => setEtapa("jogos") }} />}
      {etapa === "jogos" && <EtapaJogos {...{ base, rodada, atualizar, cfg, dados, avisar, nomes, porId }} />}
    </div>
  );
}

/* --------------------- Etapa 1: presença ---------------------------------*/

function EtapaPresenca({ base, setBase, rodada, atualizar, porId, cfg, dados, avisar, ir }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [conv, setConv] = useState({ nome: "", posicao: "LINHA", estrelas: 1 });
  const ciclo = { ausente: "presente", presente: "atrasado", atrasado: "ausente" };
  const statusDe = (jid) => rodada.presencas[jid] || "ausente";
  const P = poolsDoDia(base, rodada, porId, dados, cfg);
  const partidas = partidasPossiveis(P.linha.length, P.goleiros.length, cfg);
  const linhaPorTime = cfg.jogadoresPorTime - cfg.goleirosPorTime;
  const vagasLinhaTot = partidas * linhaPorTime * 2;
  const vagasGkTot = partidas * cfg.goleirosPorTime * 2;
  const faltamLinha = Math.max(0, vagasLinhaTot - P.linha.length);
  const vagasGkAbertas = Math.max(0, vagasGkTot - P.goleiros.length);
  const faltamCompletar = faltamLinha + vagasGkAbertas;
  const dist = [5, 4, 3, 2, 1].map((e) => ({ e, n: P.aptos.filter((a) => (a.linha?.estrelas || 1) === e).length })).filter((d) => d.n);
  const visiveisBusca = base.jogadores.filter((j) => j.ativo !== false)
    .filter((j) => j.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const contagemFiltro = {
    todos: visiveisBusca.length,
    presente: visiveisBusca.filter((j) => statusDe(j.id) === "presente").length,
    atrasado: visiveisBusca.filter((j) => statusDe(j.id) === "atrasado").length,
  };
  const visiveis = filtro === "todos" ? visiveisBusca : visiveisBusca.filter((j) => statusDe(j.id) === filtro);
  const primeiraLetra = (nome) => (nome || "").trim().charAt(0).toUpperCase();
  const gruposChamada = [
    { titulo: "A – I", jogadores: visiveis.filter((j) => primeiraLetra(j.nome) >= "A" && primeiraLetra(j.nome) <= "I") },
    { titulo: "J – R", jogadores: visiveis.filter((j) => primeiraLetra(j.nome) >= "J" && primeiraLetra(j.nome) <= "R") },
    { titulo: "S – Z", jogadores: visiveis.filter((j) => primeiraLetra(j.nome) >= "S") },
  ].filter((g) => g.jogadores.length > 0);

  return (
    <div className="space-y-4">
      {/* Ajustes vigentes nesta rodada (congelados na abertura). */}
      <Painel className="p-3" style={{ background: "rgba(240,192,64,.06)", borderColor: "rgba(240,192,64,.25)" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: T.ouro, marginBottom: 6 }}>AJUSTES DESTA RODADA</div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {[
            `Teto ${cfg.tetoPorRodada} pts/rodada`,
            `${cfg.jogadoresPorTime - cfg.goleirosPorTime} de linha + ${cfg.goleirosPorTime} gk por time`,
            `Supercopa: ${cfg.zonaSupercopa} linha + ${cfg.goleirosSupercopa || 2} gk`,
            `Cartões: ${cfg.cartoesPorPonto} = 1 ponto`,
          ].map((t, i) => (
            <span key={i} style={{ fontSize: 10.5, fontWeight: 700, color: T.secundario, background: "rgba(255,255,255,.05)", padding: "4px 9px", borderRadius: 20 }}>{t}</span>
          ))}
        </div>
      </Painel>

      <Painel className="grid grid-cols-5 gap-1.5 p-2">
        <Contador rotulo="Aptos" valor={P.aptos.length} cor={T.verde} />
        <Contador rotulo="Goleiros" valor={P.goleiros.length} cor={T.gk} />
        <Contador rotulo="Linha" valor={P.linha.length} />
        <Contador rotulo="Partidas" valor={partidas} cor={partidas >= 1 ? T.ouro : T.laranja} />
        <Contador rotulo="Completar" valor={faltamCompletar} cor={faltamCompletar > 0 ? T.laranja : T.fraco} />
      </Painel>

      {partidas >= 1 && vagasGkAbertas > 0 && (
        <Painel className="p-3" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.12)", fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.laranja }}>{P.goleiros.length} goleiro(s) para {partidas * 2} equipes.</b> {vagasGkAbertas} equipe(s)
          sairão com a <b style={{ color: T.gk }}>vaga de meta em aberto</b> — você escolhe na hora quem completa no gol.
          O sorteio não promove jogador de linha a goleiro nem coloca dois goleiros na mesma equipe.
        </Painel>
      )}

      {dist.length > 0 && (
        <p className="rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,.22)", fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.ouro }}>Distribuição:</b> {dist.map((d) => `${d.n} de ${d.e}★`).join(" · ")}
        </p>
      )}

      {P.suspensos.length > 0 && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)", fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.vermelho }}>Suspensos (§8º d):</b>{" "}
          {P.suspensos.map((e) => `${e.jogador.nome} (${e.nivel}º atraso)`).join(", ")}. Perdem a presença e ficam fora do sorteio.
        </Painel>
      )}

      <CampoBusca value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jogador…" />

      <div className="flex gap-1.5">
        {[["todos", "Todos"], ["presente", "Presentes"], ["atrasado", "Atrasados"]].map(([f, r]) => (
          <button key={f} onClick={() => setFiltro(f)} className="flex-1 rounded-full"
            style={{
              padding: "9px 6px", minHeight: 40, fontSize: 12, fontWeight: 800,
              background: filtro === f ? T.ouro : "rgba(255,255,255,.07)",
              color: filtro === f ? T.sobreOuro : T.secundario,
            }}>
            {r}{f !== "todos" ? ` (${contagemFiltro[f]})` : ""}
          </button>
        ))}
      </div>

      <section>
        <Secao titulo="Chamada" detalhe="ausente → presente → atrasado" />
        {Object.keys(rodada.presencas || {}).length > 0 && (
          <button
            onClick={() => {
              const temLancamento = (rodada.jogos || []).length > 0 || !!rodada.sorteioRascunho;
              if (temLancamento && !confirm("Limpar toda a presença marcada? Vagas das partidas já sorteadas podem ficar em aberto."))
                return;
              atualizar({ presencas: {} });
              avisar("Seleção de presença limpa");
            }}
            style={{ display: "block", marginBottom: 10, fontSize: 11.5, fontWeight: 700, color: T.laranja, textDecoration: "underline" }}>
            Limpar seleção
          </button>
        )}
        {gruposChamada.length === 0 && (
          <p className="rounded-lg p-4 text-center" style={{ background: "rgba(0,0,0,.2)", fontSize: 12.5, color: T.fraco }}>
            {filtro === "todos" ? "Nenhum jogador encontrado." : `Ninguém ${filtro === "presente" ? "presente" : "atrasado"} ainda${busca ? " com esse nome" : ""}.`}
          </p>
        )}
        <div className="space-y-4">
          {gruposChamada.map((grupo) => (
            <div key={grupo.titulo}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", color: T.ouro, marginBottom: 8, opacity: 0.85 }}>{grupo.titulo}</div>
              <div className="flex flex-wrap gap-2">
                {grupo.jogadores.map((j) => {
                  const s = statusDe(j.id), l = porId[j.id];
                  const nivel = s === "atrasado" ? nivelSeAtrasar(dados.disciplina, rodada, j.id) : 0;
                  const proximo = nivelSeAtrasar(dados.disciplina, rodada, j.id);
                  const susp = nivel >= cfg.atrasosParaSuspensao;
                  const est = susp ? { border: T.vermelho, background: "rgba(255,107,107,.18)", color: T.vermelho }
                    : s === "presente" ? { border: T.verde, background: "rgba(61,214,140,.16)", color: T.verde }
                      : s === "atrasado" ? { border: T.laranja, background: "rgba(255,165,61,.16)", color: T.laranja }
                        : { border: T.borda, background: "rgba(255,255,255,.04)", color: T.secundario };
                  return (
                    <button key={j.id} onClick={() => {
                      const novo = ciclo[s];
                      // registra a ordem de chegada de graça, sem mudar nada do fluxo do
                      // Campeonato — usada depois pra pré-preencher a fila do Rachão do mesmo dia.
                      const jaTemOrdem = (rodada.ordemChegada || []).includes(j.id);
                      const ordemChegada = (novo === "presente" || novo === "atrasado") && !jaTemOrdem
                        ? [...(rodada.ordemChegada || []), j.id] : (rodada.ordemChegada || []);
                      atualizar({ presencas: { ...rodada.presencas, [j.id]: novo }, ordemChegada });
                      if (novo === "atrasado") avisar(`${j.nome}: ${nivelInfo(proximo, cfg).rotulo}`);
                    }} className="flex items-center gap-1.5 rounded-full"
                      style={{ padding: "10px 14px", minHeight: 44, fontSize: 14, fontWeight: 600, border: `1px solid ${est.border}`, background: est.background, color: est.color }}>
                      {susp && "🚫"}
                      {j.posicao === "GOLEIRO" && <IconeGoleiro tam={14} />}
                      {j.nome}
                      <Estrelas n={l?.estrelas || 1} tam={9} goleiro={j.posicao === "GOLEIRO"} />
                      {nivel > 0 && <SeloAtraso nivel={nivel} cfg={cfg} mini />}
                      <Marcadores jogador={j} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Secao titulo="Convidado / avulso" detalhe="joga, mas fica fora da tabela" />
        <Painel className="flex gap-1.5 p-3">
          <input value={conv.nome} onChange={(e) => setConv({ ...conv, nome: e.target.value })} placeholder="Nome" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 14 }} />
          <select value={conv.posicao} onChange={(e) => setConv({ ...conv, posicao: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
            <option value="LINHA">Linha</option><option value="GOLEIRO">Gol</option>
          </select>
          <select value={conv.estrelas} onChange={(e) => setConv({ ...conv, estrelas: Number(e.target.value) })} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
          </select>
          <Botao style={{ padding: "0 16px" }} onClick={() => {
            if (!conv.nome.trim()) return;
            const jid = id();
            setBase({
              ...base,
              jogadores: [...base.jogadores, { id: jid, nome: conv.nome.trim(), posicao: conv.posicao, ativo: true, convidado: true, estrelasIniciais: conv.estrelas }],
              rodadas: base.rodadas.map((r) => r.id === rodada.id
                ? { ...r, presencas: { ...r.presencas, [jid]: "presente" }, ordemChegada: [...(r.ordemChegada || []), jid] } : r),
            });
            avisar(`${conv.nome.trim()} entrou como convidado`);
            setConv({ nome: "", posicao: "LINHA", estrelas: 1 });
          }}>+</Botao>
        </Painel>
      </section>

      <div className="barra-resumo" style={{
        position: "sticky", zIndex: 10, marginTop: 4, marginLeft: -12, marginRight: -12,
        background: "rgba(0,16,57,.97)", backdropFilter: "blur(8px)", borderTop: `1px solid ${T.borda}`,
        padding: "10px 12px", borderRadius: "12px 12px 0 0",
      }}>
        <div className="flex items-center" style={{ gap: 14 }}>
          <div className="flex shrink-0" style={{ gap: 12 }}>
            <div className="text-center">
              <p className="font-destaque" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, color: T.verde }}>{P.aptos.length}</p>
              <p style={{ fontSize: 8.5, marginTop: 2, letterSpacing: ".08em", textTransform: "uppercase", color: T.fraco }}>Aptos</p>
            </div>
            <div className="text-center">
              <p className="font-destaque" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, color: partidas >= 1 ? T.ouro : T.laranja }}>{partidas}</p>
              <p style={{ fontSize: 8.5, marginTop: 2, letterSpacing: ".08em", textTransform: "uppercase", color: T.fraco }}>Partidas</p>
            </div>
          </div>
          <Botao className="flex-1" disabled={partidas < 1} onClick={ir}>
            {partidas >= 1 ? `Sortear ${partidas} partida(s)` : `Ninguém presente ainda`}
          </Botao>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Etapa 2: sorteio ----------------------------------*/

function EtapaSorteio({ base, rodada, atualizar, porId, cfg, dados, avisar, nomes, ir }) {
  const sorteio = rodada.sorteioRascunho || null;
  const setSorteio = (valor) => atualizar({ sorteioRascunho: valor });
  const [travas, setTravas] = useState({});
  const [sel, setSel] = useState(null);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);
  const [nPartidas, setNPartidas] = useState(0);

  const P = poolsDoDia(base, rodada, porId, dados, cfg);
  const maxPartidas = partidasPossiveis(P.linha.length, P.goleiros.length, cfg);
  const alvo = nPartidas || maxPartidas;
  useEffect(() => {
    if (!sorteio) return;
    const aptosIds = new Set(P.aptos.map((e) => e.jogador.id));
    let mudou = false;
    const partidas = sorteio.partidas.map((p) => {
      const limpar = (lado) => {
        let alterado = false;
        const vagas = lado.vagas.map((v) => {
          if (v.jogador && !aptosIds.has(v.jogador.id)) { alterado = true; return { ...v, jogador: null }; }
          return v;
        });
        if (!alterado) return lado;
        mudou = true;
        return { ...lado, vagas, forca: vagas.reduce((s, v) => s + (v.jogador?.estrelas || 0), 0) };
      };
      return { ...p, amarelo: limpar(p.amarelo), azul: limpar(p.azul) };
    });
    if (mudou) { setSorteio({ ...sorteio, partidas }); avisar("Alguém saiu da chamada — a vaga dela(e) no sorteio ficou em aberto"); }
  }, [rodada.presencas]);

  const aparicoes = {};
  for (const g of rodada.jogos)
    for (const t of [timePorId(rodada, g.timeA), timePorId(rodada, g.timeB)])
      for (const j of t?.jogadores || []) aparicoes[j.jogadorId] = (aparicoes[j.jogadorId] || 0) + 1;

  const entradas = () => P.aptos.map(({ jogador: j, linha: l }) => ({
    id: j.id, nome: j.nome, ehGoleiro: j.posicao === "GOLEIRO", convidado: !!j.convidado,
    estrelas: j.convidado ? j.estrelasIniciais || 1 : l?.estrelas || 1,
    aproveitamento: l?.aproveitamento || 0, posicaoTabela: l?.posicao || 999,
    prioridade: aparicoes[j.id] || 0,
  }));

  const duplasRecentes = () => {
    const m = new Map();
    [...base.rodadas].filter((r) => r.numero < rodada.numero && (r.times || []).length)
      .sort((a, b) => b.numero - a.numero).slice(0, cfg.rodadasAntiRepeticao)
      .forEach((r, idx) => {
        const peso = cfg.rodadasAntiRepeticao - idx;
        for (const t of r.times || []) {
          const e = idsDoTime(t);
          for (let i = 0; i < e.length; i++) for (let k = i + 1; k < e.length; k++)
            m.set(chaveDupla(e[i], e[k]), (m.get(chaveDupla(e[i], e[k])) || 0) + peso);
        }
      });
    return m;
  };

  function executar(seed) {
    const r = sortearEquipes(entradas(), {
      ...cfg, seed, partidas: alvo, travas,
      restricoes: base.restricoes || [], duplasRecentes: duplasRecentes(),
    });
    if (r.erro) return avisar(r.erro);
    setSorteio(r); setSel(null);
    const contaVazias = (p) => [p.amarelo, p.azul].reduce((s, e) => s + e.vagas.filter((v) => !v.jogador).length, 0);
    const incompleta = r.partidas.find((p) => contaVazias(p) > 0);
    const buracos = incompleta ? contaVazias(incompleta) : 0;
    avisar(buracos > 0
      ? `Sorteado · a partida ${incompleta.numero} tem ${buracos} vaga(s) para completar`
      : `${r.partidas.length} partida(s) sorteada(s)`);
  }

  const jogadoresDaPartida = (p) => [p.amarelo, p.azul].flatMap((e) => e.vagas.map((v) => v.jogador).filter(Boolean));
  const contarVazias = (p) => [p.amarelo, p.azul].reduce((s, e) => s + e.vagas.filter((v) => !v.jogador).length, 0);
  const diag = useMemo(() => {
    if (!sorteio) return null;
    const times = sorteio.partidas.flatMap((p) => [p.amarelo, p.azul]).map((e) => e.vagas.map((v) => v.jogador).filter(Boolean).filter((j) => !j.naoPontua));
    const todos = times.flat();
    if (!todos.length) return { indiceEquilibrio: 0, amplitude: 0, desvio: 0, violacoes: [] };
    return avaliarTimes(times, {
      pesos: cfg.pesos, goleirosPorTime: cfg.goleirosPorTime, goleirosSuficientes: false,
      totalCinco: todos.filter((j) => j.estrelas === 5).length, duplasRecentes: null,
      restricoes: (base.restricoes || []).filter((r) => todos.some((j) => j.id === r.a) && todos.some((j) => j.id === r.b)),
      usarAproveitamento: cfg.usarAproveitamento, travados: new Set(),
      partidaDoTime: (i) => Math.floor(i / 2),
      nome: (x) => nomes[x] || "?", nomeTime: (i) => `Time ${i + 1}`,
    });
  }, [sorteio, cfg, base.restricoes, nomes]);

  function mexer(fn) {
    const partidas = sorteio.partidas.map((p) => ({
      ...p,
      amarelo: { ...p.amarelo, vagas: p.amarelo.vagas.map((v) => ({ ...v })) },
      azul: { ...p.azul, vagas: p.azul.vagas.map((v) => ({ ...v })) },
    }));
    fn(partidas);
    for (const p of partidas) for (const lado of ["amarelo", "azul"]) {
      const e = p[lado];
      e.forca = e.vagas.reduce((s, v) => s + (v.jogador && !v.jogador.naoPontua ? v.jogador.estrelas : 0), 0);
    }
    setSorteio({ ...sorteio, partidas });
  }
  
  const contarGoleiros = (equipe, exceto) =>
    equipe.vagas.filter((v) => v !== exceto && v.jogador?.ehGoleiro).length;

  function trocar(a, b) {
    setSel(null);
    if (!a || !b || a === b) return;
    const primeira = {};
    for (const q of sorteio.partidas) for (const e of [q.amarelo, q.azul]) for (const v of e.vagas)
      if (v.jogador) { const at = primeira[v.jogador.id]; if (at === undefined || q.numero < at) primeira[v.jogador.id] = q.numero; }
    const posicaoDe = (id) => {
      for (const q of sorteio.partidas) for (const e of [q.amarelo, q.azul]) for (const v of e.vagas)
        if (v.jogador?.id === id) return q.numero;
      return null;
    };
    
    const ehManual = (id) => {
      for (const q of sorteio.partidas) for (const e of [q.amarelo, q.azul]) for (const v of e.vagas)
        if (v.jogador?.id === id) return !!v.jogador.manual;
      return false;
    };
    const travado = (id) => primeira[id] === posicaoDe(id) && !aparicoes[id] && !ehManual(id);
    if (travado(a) || travado(b)) { avisar("Jogador bloqueado 🔒 — está na partida em que pontua"); return; }
    let recusa = null;
    mexer((partidas) => {
      let va = null, vb = null, ea = null, eb = null;
      for (const p of partidas) for (const lado of ["amarelo", "azul"])
        for (const v of p[lado].vagas) {
          if (v.jogador?.id === a) { va = v; ea = p[lado]; }
          if (v.jogador?.id === b) { vb = v; eb = p[lado]; }
        }
      if (!va || !vb) return;
      if (va.papel !== vb.papel) { recusa = "Vaga de goleiro só troca com vaga de goleiro."; return; }
      if (ea !== eb) {
        const aposA = contarGoleiros(ea, va) + (vb.jogador?.ehGoleiro ? 1 : 0);
        const aposB = contarGoleiros(eb, vb) + (va.jogador?.ehGoleiro ? 1 : 0);
        if (aposA > cfg.goleirosPorTime || aposB > cfg.goleirosPorTime) {
          recusa = "Recusado: deixaria dois goleiros na mesma equipe.";
          return;
        }
      }
      const tmp = va.jogador; va.jogador = vb.jogador; vb.jogador = tmp;
    });
    if (recusa) avisar(recusa);
  }

  function definirVaga(pi, lado, vi, jid) {
    let recusa = null;
    mexer((partidas) => {
      const equipe = partidas[pi][lado];
      const vaga = equipe.vagas[vi];
      if (!jid) { vaga.jogador = null; return; }
      const dados = P.aptos.find((e) => e.jogador.id === jid);
      if (!dados) return;
      const { jogador: j, linha: l } = dados;
      const ehGk = j.posicao === "GOLEIRO";
      if (ehGk && contarGoleiros(equipe, vaga) >= cfg.goleirosPorTime) {
        recusa = `${j.nome} é goleiro e esta equipe já tem um.`;
        return;
      }
      vaga.jogador = {
        id: j.id, nome: j.nome, ehGoleiro: ehGk, convidado: !!j.convidado,
        estrelas: j.convidado ? j.estrelasIniciais || 1 : l?.estrelas || 1,
        posicaoTabela: l?.posicao || 999, slotGoleiro: vaga.papel === "GOLEIRO",
        manual: true, naoPontua: true,
      };
    });
    if (recusa) avisar(recusa);
  }

  function completarAutomaticamente(numeroPartida) {
    let preencheu = 0;
    mexer((partidas) => {
      const alvos = numeroPartida ? partidas.filter((p) => p.numero === numeroPartida) : partidas;
      const usoAtual = () => {
        const m = {};
        for (const q of partidas) for (const e of [q.amarelo, q.azul])
          for (const x of e.vagas) if (x.jogador) m[x.jogador.id] = (m[x.jogador.id] || 0) + 1;
        return m;
      };

      for (const p of alvos) for (const lado of ["amarelo", "azul"]) {
        const equipe = p[lado];
        for (const vaga of equipe.vagas) {
          if (vaga.jogador) continue;
          const querGk = vaga.papel === "GOLEIRO";
          const jaTemGk = contarGoleiros(equipe, vaga) >= cfg.goleirosPorTime;
          const nestaPartida = new Set([p.amarelo, p.azul]
            .flatMap((e) => e.vagas.map((x) => x.jogador?.id).filter(Boolean)));
          const uso = usoAtual();
          const candidatos = P.aptos
            .filter((e) => !nestaPartida.has(e.jogador.id))
            .filter((e) => {
              const ehGk = e.jogador.posicao === "GOLEIRO";
              if (jaTemGk && ehGk) return false;
              return true;
            })
            .sort((a, b) => {
              const ua = (uso[a.jogador.id] || 0) + (aparicoes[a.jogador.id] || 0);
              const ub = (uso[b.jogador.id] || 0) + (aparicoes[b.jogador.id] || 0);
              if (ua !== ub) return ua - ub;
              if (querGk) {
                const ga = a.jogador.posicao === "GOLEIRO" ? 0 : 1;
                const gb = b.jogador.posicao === "GOLEIRO" ? 0 : 1;
                if (ga !== gb) return ga - gb;
              }
              return 0;
            });
          const e = candidatos[0];
          if (!e) continue;
          const l = e.linha;
          vaga.jogador = {
            id: e.jogador.id, nome: e.jogador.nome, ehGoleiro: e.jogador.posicao === "GOLEIRO",
            convidado: !!e.jogador.convidado,
            estrelas: e.jogador.convidado ? e.jogador.estrelasIniciais || 1 : l?.estrelas || 1,
            posicaoTabela: l?.posicao || 999, slotGoleiro: vaga.papel === "GOLEIRO",
            manual: true, naoPontua: true,
          };
          preencheu++;
        }
      }
    });
    avisar(preencheu > 0
      ? `${preencheu} vaga(s) completada(s) com quem jogou menos`
      : "Não há quem completar — todos já estão nesta partida");
  }
  const vaziasTotal = sorteio ? sorteio.partidas.reduce((s, p) => s + contarVazias(p), 0) : 0;
  function gravar() {
    const times = [], jogos = [];
    sorteio.partidas.forEach((p, i) => {
      const criar = (lado) => {
        const t = {
          id: id(), partida: p.numero, cor: lado.cor, chave: lado.chave, seed: sorteio.seed,
          extra: !!p.extra,
          jogadores: lado.vagas.filter((v) => v.jogador).map((v) => ({
            jogadorId: v.jogador.id, estrelaNoSorteio: v.jogador.estrelas,
            atuaComoGoleiro: v.papel === "GOLEIRO",
          })),
          vagasAbertas: lado.vagas.filter((v) => !v.jogador).map((v) => v.papel),
        };
        times.push(t); return t.id;
      };
      const a = criar(p.amarelo), b = criar(p.azul);
      const soCartoesManual = [p.amarelo, p.azul].flatMap((e) => e.vagas.filter((v) => v.jogador?.naoPontua).map((v) => v.jogador.id));
      jogos.push({
        id: id(), numero: i + 1, timeA: a, timeB: b,
        golsContraA: 0, golsContraB: 0, golsNaoComputadosA: 0, golsNaoComputadosB: 0, placarManual: null, encerrado: false, completaTime: [], soCartoes: soCartoesManual, eventos: {}
      });
    });
    const nova = { ...rodada, times, jogos };
    atualizar({ times: nova.times, jogos: marcarReaproveitamentos(nova), sorteioRascunho: null });
    setTravas({});
    avisar(`${sorteio.partidas.length} partida(s) gravada(s)`);
    ir();
  }

  const CardTime = ({ p, pi, lado }) => {
    const time = p[lado];
    const idsNaPartida = new Set(jogadoresDaPartida(p).map((j) => j.id));
    const primeiraAparicao = {};
    for (const q of sorteio.partidas)
      for (const e of [q.amarelo, q.azul])
        for (const v of e.vagas)
          if (v.jogador) {
            const at = primeiraAparicao[v.jogador.id];
            if (at === undefined || q.numero < at) primeiraAparicao[v.jogador.id] = q.numero;
          }

    return (
      <div className="overflow-hidden rounded-lg" style={{ background: T.tier1, border: `1px solid ${T.borda}` }} onDragOver={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between" style={{ padding: "7px 10px", background: `${time.hex}22`, borderBottom: `2px solid ${time.hex}` }}>
          <span className="flex items-center" style={{ gap: 5, fontSize: 11.5, fontWeight: 900, letterSpacing: ".08em", color: time.hex }}>
            <span style={{ fontSize: 13 }}>{time.emoji}</span>{time.cor}
          </span>
          <span className="font-destaque" style={{ fontSize: 14, fontWeight: 700, color: T.texto }}>{time.forca}★</span>
        </div>
        <ul className="space-y-1" style={{ padding: 6 }}>
          {time.vagas.map((v, vi) => {
            const j = v.jogador;
            if (!j) {
              const jaTemGk = contarGoleiros(time, v) >= cfg.goleirosPorTime;
              const opcoes = P.aptos
                .filter((e) => !idsNaPartida.has(e.jogador.id))
                .filter((e) => !(jaTemGk && e.jogador.posicao === "GOLEIRO"))
                .sort((a, b) => (aparicoes[a.jogador.id] || 0) - (aparicoes[b.jogador.id] || 0)
                  || a.jogador.nome.localeCompare(b.jogador.nome, "pt-BR"));
              return (
                <li key={`v${vi}`} className="rounded" style={{ background: "rgba(255,165,61,.1)", border: `1px dashed ${T.laranja}`, padding: 5 }}>
                  <div className="mb-1 flex items-center gap-1">
                    {v.papel === "GOLEIRO" ? <IconeGoleiro tam={12} /> : <span style={{ fontSize: 10, color: T.laranja }}>▢</span>}
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", color: T.laranja }}>
                      VAGA DE {v.papel}
                    </span>
                  </div>
                  <select value="" onChange={(e) => definirVaga(pi, lado, vi, e.target.value)}
                    style={{ ...inputStyle, padding: "7px 4px", fontSize: 11.5 }}>
                    <option value="">— escolher —</option>
                    {opcoes.map(({ jogador: o, linha: l }) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}{o.posicao === "GOLEIRO" ? " (GK)" : ""} · {l?.estrelas || 1}★
                        {aparicoes[o.id] ? " · já jogou" : ""}
                      </option>
                    ))}
                  </select>
                </li>
              );
            }
            const noGol = v.papel === "GOLEIRO";
            const repetido = !!aparicoes[j.id];
            const naoPontua = !!j.naoPontua;
            const travado = primeiraAparicao[j.id] === p.numero && !repetido && !j.manual;
            const semPontuar = repetido || naoPontua;
            return (
              <li key={j.id} draggable={!travado}
                onDragStart={(e) => { if (travado) { e.preventDefault(); return; } e.dataTransfer.setData("text/plain", j.id); }}
                onDrop={(e) => { e.preventDefault(); if (!travado) trocar(e.dataTransfer.getData("text/plain"), j.id); }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => { if (travado) return; sel === null ? setSel(j.id) : sel === j.id ? setSel(null) : trocar(sel, j.id); }}
                className={`flex items-center justify-between gap-1 rounded ${travado ? "" : "cursor-pointer"}`}
                style={{
                  padding: "7px 6px", fontSize: 12.5, minHeight: 36,
                  background: sel === j.id ? T.ouroFraco : noGol ? T.gkFraco : "transparent",
                  outline: sel === j.id ? `1px solid ${T.ouro}` : noGol ? `1px solid ${T.gk}` : "none",
                  opacity: travado ? 0.92 : 1
                }}>
                <span className="flex min-w-0 items-center gap-1" style={{ color: semPontuar ? T.fraco : T.texto, fontStyle: semPontuar ? "italic" : "normal" }}>
                  {noGol && <IconeGoleiro tam={13} />}
                  <span className="truncate">{j.nome}</span>
                  {travado && <span title="Está na partida em que pontua — bloqueado para não desfazer a escalação que vale" style={{ fontSize: 11 }}>🔒</span>}
                  {repetido && <span title="Já jogou nesta rodada — aqui só preenche a vaga, não pontua nada" style={{ fontSize: 8, fontWeight: 800, color: T.laranja }}>REPETE</span>}
                  {!repetido && naoPontua && <span title="Completou uma vaga que estava em aberto (§10º) — não pontua nada" style={{ fontSize: 8, fontWeight: 800, color: T.laranja }}>COMPLETA</span>}
                  {j.convidado && <span style={{ fontSize: 8, color: T.roxo }}>CONV</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Estrelas n={j.estrelas} tam={9} goleiro={j.ehGoleiro} />
                  {!travado && (
                    <button onClick={(e) => { e.stopPropagation(); definirVaga(pi, lado, vi, null); }}
                      title="Esvaziar a vaga" style={{ color: "rgba(255,255,255,.25)", fontSize: 12 }}>✕</button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {rodada.jogos.length > 0 && (
        <Painel className="p-3" style={{ fontSize: 11.5, color: T.secundario }}>
          <b style={{ color: T.ouro }}>{rodada.jogos.length} partida(s) já gravada(s).</b>
          <span style={{ display: "block", marginTop: 4, color: T.fraco }}>
            Sortear e gravar de novo substitui estas partidas — a rodada recomeça do zero.
          </span>
          <button
            onClick={() => {
              if (confirm("Apagar todas as partidas desta rodada? Placares e cartões lançados serão perdidos.")) {
                atualizar({ times: [], jogos: [], sorteioRascunho: null });
                setTravas({});
                avisar("Partidas da rodada apagadas");
              }
            }}
            style={{ marginTop: 8, color: T.laranja, fontSize: 12, fontWeight: 700, textDecoration: "underline" }}>
            Apagar partidas desta rodada
          </button>
        </Painel>
      )}

      <div className="flex gap-2">
        <Campo rotulo="Partidas">
          <select value={alvo} onChange={(e) => setNPartidas(Number(e.target.value))} style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
            {Array.from({ length: Math.max(1, maxPartidas) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} partida{n > 1 ? "s" : ""} · {n * cfg.jogadoresPorTime * 2} jogadores</option>
            ))}
          </select>
        </Campo>
        <Botao className="flex-1" style={{ alignSelf: "flex-end" }} onClick={() => executar()}>Sortear</Botao>
      </div>

      {sorteio && diag && (
        <Painel className="space-y-3 p-3">
          <div className="text-center">
            <p style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>Equilíbrio</p>
            <p className="font-destaque" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: diag.indiceEquilibrio >= 90 ? T.verde : diag.indiceEquilibrio >= 75 ? T.ouro : T.laranja }}>{diag.indiceEquilibrio}%</p>
            <p style={{ marginTop: 4, fontSize: 10, color: T.fraco }}>
              Δ {diag.amplitude.toFixed(2)}★ · desvio {diag.desvio.toFixed(2)} · {sorteio.diagnostico.alternativas} divisão(ões) equivalente(s) · seed {sorteio.seed}
            </p>
          </div>

          <button onClick={() => setMostrarAjuda((v) => !v)} className="flex w-full items-center justify-between rounded-lg"
            style={{ padding: "8px 10px", background: "rgba(255,255,255,.04)", fontSize: 11, fontWeight: 700, color: T.secundario }}>
            Como funciona o sorteio
            <IconeSetaDireita tam={13} style={{ transform: mostrarAjuda ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          </button>
          {mostrarAjuda && (
            <p style={{ fontSize: 10.5, lineHeight: 1.6, color: T.fraco, padding: "0 2px" }}>
              O equilíbrio é medido em cima de todo mundo já escalado, inclusive nas vagas ainda em aberto — cada
              equipe fecha com 1 goleiro + {cfg.jogadoresPorTime - cfg.goleirosPorTime} de linha.<br /><br />
              Toque num jogador e depois em outro para trocar (funciona entre partidas diferentes) · ✕ esvazia a
              vaga · vaga de goleiro só troca com goleiro.
            </p>
          )}

          {sel && <p className="rounded px-2 py-2 text-center" style={{ background: T.ouroFraco, fontSize: 12, color: T.ouroClaro }}>{nomes[sel]} selecionado — toque em outro para trocar.</p>}

          {sorteio.partidas.map((p, pi) => {
            const vazias = contarVazias(p);
            return (
              <div key={p.numero}>
                <FaixaPartida n={p.numero} extra={vazias > 0} />
                {vazias > 0 && (
                  <p className="mb-1.5 rounded px-2 py-1.5" style={{ background: "rgba(255,165,61,.12)", border: `1px solid rgba(255,165,61,.4)`, fontSize: 10.5, lineHeight: 1.45, color: T.laranja }}>
                    Esta partida tem {vazias} vaga(s) em aberto. Complete com quem está presente —
                    quem já jogou entra só para preencher a vaga, sem pontuar nada (nem cartão).
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <CardTime p={p} pi={pi} lado="amarelo" />
                  <CardTime p={p} pi={pi} lado="azul" />
                </div>
                {vazias > 0 && (
                  <div className="mt-2 flex gap-2">
                    <Botao variante="secundario" className="flex-1" style={{ minHeight: 42, fontSize: 11.5 }} onClick={() => completarAutomaticamente(p.numero)}>
                      Completar automaticamente
                    </Botao>
                  </div>
                )}
              </div>
            );
          })}

          {[...new Set([...(sorteio.diagnostico.avisos || []), ...(diag.violacoes || []).map((v) => v.texto)])].length > 0 && (
            <ul className="space-y-1 rounded-lg p-2" style={{ border: "1px solid rgba(255,165,61,.4)", background: "rgba(255,165,61,.12)", fontSize: 11.5, color: T.laranja }}>
              {[...new Set([...(sorteio.diagnostico.avisos || []), ...(diag.violacoes || []).map((v) => v.texto)])].map((a, i) => <li key={i}>⚠ {a}</li>)}
            </ul>
          )}

          {sorteio.sobressalentes.length > 0 && (
            <div className="rounded-lg p-2" style={{ background: "rgba(0,0,0,.25)", fontSize: 11.5, color: T.secundario }}>
              <b style={{ color: T.ouro }}>Fora do sorteio ({sorteio.sobressalentes.length}):</b>{" "}
              {sorteio.sobressalentes.map((j) => j.nome).join(", ")}
              <span style={{ display: "block", marginTop: 3, color: T.fraco }}>
                Estão presentes e aparecem na lista de qualquer vaga em aberto acima.
              </span>
            </div>
          )}

          <div className="flex justify-center">
            <Botao onClick={gravar}>
              {vaziasTotal > 0 ? `Gravar · ${vaziasTotal} vaga(s) ficam em aberto` : "Gravar partidas"}
            </Botao>
          </div>
          {vaziasTotal > 0 && (
            <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.4, color: T.fraco }}>
              As partidas completas já podem ser jogadas. As vagas em aberto se completam depois,
              na etapa Partidas, conforme mais gente for chegando.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Botao variante="secundario" style={{ padding: "0 6px", fontSize: 11 }} onClick={async () => {
              const txt = textoWhatsApp(sorteio.partidas, rodada, diag, sorteio.seed);
              try {
                if (navigator.share) { await navigator.share({ text: txt }); return; }
                await navigator.clipboard.writeText(txt); avisar("Copiado — cole no grupo");
              } catch {
                try { await navigator.clipboard.writeText(txt); avisar("Copiado"); } catch { avisar("Não foi possível copiar"); }
              }
            }}>Compartilhar</Botao>
            <Botao variante="secundario" style={{ padding: "0 6px", fontSize: 11 }} onClick={() => executar()}>Sortear de novo</Botao>
            <Botao variante="secundario" style={{ padding: "0 6px", fontSize: 11 }} onClick={() => executar(sorteio.seed)}>Repetir seed</Botao>
          </div>
          <button onClick={() => setSorteio(null)} style={{ width: "100%", padding: 6, fontSize: 12, color: T.fraco }}>descartar sorteio</button>
        </Painel>
      )}
    </div>
  );
}


/* --------------------- Etapa 3: partidas e súmulas -----------------------*/

// Resorteia só UMA partida específica: mantém quem já está escalado nela (nunca remove
// ninguém), e preenche só as vagas de fato abertas (linha e/ou goleiro) com quem está
// aguardando encaixe. Depois roda o mesmo ajuste fino de equilíbrio (buscaLocal), que pode
// trocar quem já estava de time (Amarelo↔Azul) mas nunca tira alguém já confirmado da partida.
function sortearParcial(tA, tB, sobra, cfg, nomes, restricoes) {
  const gkPorTime = cfg.goleirosPorTime, linhaPorTime = cfg.jogadoresPorTime - gkPorTime;
  const existentes = [
    ...(tA.jogadores || []).map((j) => ({ id: j.jogadorId, estrelas: j.estrelaNoSorteio || 1, ehGoleiro: j.atuaComoGoleiro })),
    ...(tB.jogadores || []).map((j) => ({ id: j.jogadorId, estrelas: j.estrelaNoSorteio || 1, ehGoleiro: j.atuaComoGoleiro })),
  ];
  const idsExistentes = new Set(existentes.map((e) => e.id));
  const gkExistentes = existentes.filter((e) => e.ehGoleiro);
  const lnExistentes = existentes.filter((e) => !e.ehGoleiro);

  const vagasGk = Math.max(0, gkPorTime * 2 - gkExistentes.length);
  const vagasLn = Math.max(0, linhaPorTime * 2 - lnExistentes.length);
  const sobraGk = sobra.filter((s) => s.ehGoleiro && !idsExistentes.has(s.id)).sort((a, b) => b.estrelas - a.estrelas).slice(0, vagasGk);
  const sobraLn = sobra.filter((s) => !s.ehGoleiro && !idsExistentes.has(s.id)).sort((a, b) => b.estrelas - a.estrelas).slice(0, vagasLn);

  const gkPool = [...gkExistentes, ...sobraGk];
  const lnPool = [...lnExistentes, ...sobraLn].sort((a, b) => b.estrelas - a.estrelas);

  const A = [], B = [];
  gkPool.forEach((j, i) => (i % 2 === 0 ? A : B).push({ ...j, slotGoleiro: true }));
  lnPool.forEach((j, i) => (i % 4 === 0 || i % 4 === 3 ? A : B).push({ ...j, slotGoleiro: false }));
  const times2 = [A, B];
  const todos2 = [...A, ...B];

  buscaLocal(times2, {
    pesos: cfg.pesos, goleirosPorTime: gkPorTime, goleirosSuficientes: false,
    totalCinco: todos2.filter((j) => j.estrelas === 5).length, duplasRecentes: null,
    restricoes: (restricoes || []).filter((r) => todos2.some((j) => j.id === r.a) && todos2.some((j) => j.id === r.b)),
    usarAproveitamento: cfg.usarAproveitamento, travados: new Set(),
    nome: (x) => nomes[x] || "?", nomeTime: (i) => (i === 0 ? "Amarelo" : "Azul"),
  });

  const vagasDe = (jogadores) => {
    const gk = jogadores.filter((j) => j.slotGoleiro), ln = jogadores.filter((j) => !j.slotGoleiro);
    return {
      jogadores: [
        ...gk.map((j) => ({ jogadorId: j.id, estrelaNoSorteio: j.estrelas, atuaComoGoleiro: true })),
        ...ln.map((j) => ({ jogadorId: j.id, estrelaNoSorteio: j.estrelas, atuaComoGoleiro: false })),
      ],
      vagasAbertas: [
        ...Array(Math.max(0, gkPorTime - gk.length)).fill("GOLEIRO"),
        ...Array(Math.max(0, linhaPorTime - ln.length)).fill("LINHA"),
      ],
    };
  };
  return { A: vagasDe(A), B: vagasDe(B) };
}

// Cria uma partida nova só com quem está "aguardando encaixe" — ação manual do organizador,
// nunca automática. Reaproveita o mesmo encaixe por força de sortearParcial, só que partindo
// de dois times vazios. Se não sobrar gente pra fechar os dois lados por completo, a partida
// nasce com vagas em aberto, que entram no fluxo normal de "Sortear esta partida" quando mais
// gente chegar depois.
function criarPartidaExtra(sobra, cfg, nomes, restricoes, numero) {
  const resultado = sortearParcial({ jogadores: [] }, { jogadores: [] }, sobra, cfg, nomes, restricoes);
  const criarTime = (cor, dados) => ({
    id: id(), partida: numero, cor: cor.cor, chave: cor.chave, seed: null, extra: true,
    jogadores: dados.jogadores, vagasAbertas: dados.vagasAbertas,
  });
  const timeA = criarTime(AMARELO, resultado.A);
  const timeB = criarTime(AZUL, resultado.B);
  const jogo = {
    id: id(), numero, timeA: timeA.id, timeB: timeB.id, extra: true,
    golsContraA: 0, golsContraB: 0, golsNaoComputadosA: 0, golsNaoComputadosB: 0,
    placarManual: null, encerrado: false, completaTime: [], soCartoes: [], eventos: {},
  };
  return { times: [timeA, timeB], jogo };
}

function EtapaJogos({ base, rodada, atualizar, cfg, dados, avisar, nomes, porId }) {
  const niveis = dados.disciplina.porRodada[rodada.id] || {};
  const [jogoAlvo, setJogoAlvo] = useState("");

  const P = poolsDoDia(base, rodada, porId, dados, cfg);
  // Só sai do "aguardando encaixe" quem já tem uma colocação que vale (pontua) em algum jogo —
  // quem só entrou pra completar (§10º) continua aparecendo, porque ainda não teve seu encaixe de verdade.
  const idsComVagaReal = new Set();
  for (const t of rodada.times || []) {
    const jogoDoTime = (rodada.jogos || []).find((j) => j.timeA === t.id || j.timeB === t.id);
    const soCartoesDoJogo = jogoDoTime ? new Set([...(jogoDoTime.completaTime || []), ...(jogoDoTime.soCartoes || [])]) : new Set();
    for (const jj of t.jogadores || []) if (!soCartoesDoJogo.has(jj.jogadorId)) idsComVagaReal.add(jj.jogadorId);
  }
  const sobra = P.aptos.filter((e) => !idsComVagaReal.has(e.jogador.id)).map((e) => ({
    id: e.jogador.id, nome: e.jogador.nome, ehGoleiro: e.jogador.posicao === "GOLEIRO",
    estrelas: e.jogador.convidado ? (e.jogador.estrelasIniciais || 1) : (e.linha?.estrelas || 1),
    nivel: e.nivel,
  }));
  const intocada = (jogo) => Object.keys(jogo.eventos || {}).length === 0 && !jogo.placarManual &&
    !(jogo.golsContraA || jogo.golsContraB || jogo.golsNaoComputadosA || jogo.golsNaoComputadosB);
  const jogosComVaga = (rodada.jogos || []).filter((j) => {
    if (j.encerrado || !intocada(j)) return false;
    const tA = timePorId(rodada, j.timeA), tB = timePorId(rodada, j.timeB);
    return ((tA?.vagasAbertas || []).length + (tB?.vagasAbertas || []).length) > 0;
  });

  function sortearPartida() {
    const jogo = rodada.jogos.find((j) => j.id === jogoAlvo);
    if (!jogo) return;
    const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
    if (!tA || !tB) return;
    const resultado = sortearParcial(tA, tB, sobra, cfg, nomes, base.restricoes);
    const novoTimes = rodada.times.map((t) => {
      if (t.id === tA.id) return { ...t, ...resultado.A };
      if (t.id === tB.id) return { ...t, ...resultado.B };
      return t;
    });
    atualizar({ times: novoTimes });
    setJogoAlvo("");
    avisar(`Partida ${jogo.numero} resorteada com quem chegou`);
  }

  function criarExtra() {
    const numero = Math.max(0, ...rodada.jogos.map((j) => j.numero)) + 1;
    const { times: novosTimes, jogo: novoJogo } = criarPartidaExtra(sobra, cfg, nomes, base.restricoes, numero);
    atualizar({ times: [...rodada.times, ...novosTimes], jogos: [...rodada.jogos, novoJogo] });
    avisar(`Partida extra ${numero} criada com quem estava aguardando encaixe`);
  }

  if (!rodada.jogos.length)
    return <Painel className="p-6 text-center" style={{ borderStyle: "dashed", fontSize: 14, color: T.secundario }}>Nenhuma partida sorteada ainda. Volte para a etapa Sorteio.</Painel>;

  return (
    <div className="space-y-4">
      <Botao variante="secundario" className="w-full" onClick={() => {
        imagemEscalacoes(rodada, nomes, niveis, cfg);
        avisar("Gerando imagem das escalações…");
      }}>Enviar escalação</Botao>

      {sobra.length > 0 && (
        <Painel className="p-3 space-y-3" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.08)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: T.laranja, marginBottom: 6 }}>AGUARDANDO ENCAIXE</div>
            <div className="flex flex-wrap gap-1.5">
              {sobra.map((s) => (
                <span key={s.id} className="flex items-center gap-1 rounded-full"
                  style={{ padding: "6px 10px", fontSize: 12.5, fontWeight: 600, background: "rgba(255,255,255,.06)", border: `1px solid ${T.borda}` }}>
                  {s.ehGoleiro && <IconeGoleiro tam={12} />}
                  {s.nome}
                  <Estrelas n={s.estrelas} tam={9} goleiro={s.ehGoleiro} />
                  {s.nivel > 0 && <SeloAtraso nivel={s.nivel} cfg={cfg} mini />}
                </span>
              ))}
            </div>
          </div>
          {jogosComVaga.length > 0 ? (
            <>
              <Campo rotulo="Escolher partida">
                <select value={jogoAlvo} onChange={(e) => setJogoAlvo(e.target.value)} style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
                  <option value="">— selecionar —</option>
                  {jogosComVaga.map((j) => {
                    const tA = timePorId(rodada, j.timeA), tB = timePorId(rodada, j.timeB);
                    const vagas = (tA?.vagasAbertas?.length || 0) + (tB?.vagasAbertas?.length || 0);
                    return <option key={j.id} value={j.id}>Partida {j.numero} · {vagas} vaga(s) em aberto</option>;
                  })}
                </select>
              </Campo>
              <Botao className="w-full" disabled={!jogoAlvo} onClick={sortearPartida}>Sortear esta partida</Botao>
            </>
          ) : (
            <>
              <p style={{ fontSize: 11.5, color: T.fraco }}>
                Nenhuma partida com vaga aberta agora — as vagas já foram preenchidas, ou as partidas
                com vaga já começaram a ser pontuadas. Dá pra criar uma partida extra só com quem
                está aguardando encaixe{sobra.length === 1 ? " — o resto dos times fica em aberto pra você completar na mão" : ""}.
              </p>
              <Botao className="w-full" onClick={criarExtra}>
                Criar partida extra com quem sobrou ({sobra.length})
              </Botao>
            </>
          )}
        </Painel>
      )}

      {Object.keys(niveis).length > 0 && (
        <Painel className="p-3" style={{ fontSize: 11.5, color: T.secundario }}>
          <b style={{ color: T.laranja }}>Atrasos sinalizados na súmula (§8º):</b>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(niveis).map(([jid, n]) => <span key={jid} className="flex items-center gap-1">{nomes[jid]} <SeloAtraso nivel={n} cfg={cfg} /></span>)}
          </div>
        </Painel>
      )}

      {[...rodada.jogos].sort((a, b) => a.numero - b.numero).map((jogo) => (
        <div key={jogo.id}>
          <FaixaPartida n={jogo.numero} extra={!!jogo.extra} />
          <Sumula {...{ jogo, rodada, base, cfg, dados, atualizar, avisar, niveis, porId }} />
        </div>
      ))}

      <Ajustes rodada={rodada} base={base} dados={dados} onMudar={atualizar} />

      {rodada.jogos.some((g) => g.encerrado) && (
        <div className="space-y-1.5">
          <Botao className="flex w-full items-center justify-center" style={{ gap: 8 }}
            onClick={() => { atualizar({ status: "fechada" }); avisar(`Rodada ${rodada.numero} fechada · estrelas recalculadas`); }}>
            <IconeTrofeu tam={16} /> Fechar rodada {rodada.numero}
          </Botao>
          <p className="text-center" style={{ fontSize: 10.5, color: T.fraco }}>
            Recalcula a classificação com as partidas já encerradas. Dá pra reabrir depois, se precisar.
          </p>
        </div>
      )}

      <button
        onClick={() => {
          if (confirm(`Apagar as ${rodada.jogos.length} partida(s) desta rodada? Placares e cartões lançados serão perdidos, e você poderá sortear de novo do zero.`)) {
            atualizar({ times: [], jogos: [] });
            avisar("Partidas apagadas · sorteie novamente");
          }
        }}
        style={{ width: "100%", padding: 10, marginTop: 4, fontSize: 12, fontWeight: 700, color: T.fraco, border: `1px solid ${T.borda}`, borderRadius: 8 }}>
        Apagar partidas desta rodada
      </button>
    </div>
  );
}

/* --------------------------- Súmula da partida ---------------------------*/

function Sumula({ jogo, rodada, base, cfg, dados, atualizar, avisar, niveis, porId }) {
  const jog = Object.fromEntries(base.jogadores.map((j) => [j.id, j]));
  const [pendenteVaga, setPendenteVaga] = useState({});
  const [cartoesAbertos, setCartoesAbertos] = useState({});
  const [aberta, setAberta] = useState(!jogo.encerrado); // partidas já encerradas começam recolhidas
  const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
  const p = placarDe(jogo, rodada);
  const soCartoes = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
  const mudar = (patch) => atualizar({ jogos: rodada.jogos.map((g) => (g.id === jogo.id ? { ...g, ...patch } : g)) });
  if (!tA || !tB) return null;
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
    avisar(repete ? `${jog[jogadorId]?.nome} completou a equipe — não pontua` : `${jog[jogadorId]?.nome} entrou na vaga e vai pontuar`);
  };

  const setEvento = (jid, campo, d) => {
    const at = { ...evVazio, ...(jogo.eventos[jid] || {}) };
    const novo = { ...at, [campo]: Math.max(0, at[campo] + d) };
    if (d > 0 && cfg.converterSegundoAmarelo && (campo === "ca" || campo === "cz")) {
      if (novo.ca >= 2) avisar(`${jog[jid]?.nome}: 2º amarelo vira vermelho (Art. 81º §Único)`);
      else if (novo.ca >= 1 && novo.cz >= 1) avisar(`${jog[jid]?.nome}: amarelo + azul vira vermelho (Art. 81º §Único)`);
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

  const Coluna = ({ time, lado }) => (
    <div className="min-w-0">
      {/* nome do time já aparece grande no placar, no topo do cartão — sem repetir aqui embaixo */}
      <div className="space-y-1">
        {[...(time.jogadores || [])].sort((a, b) => Number(!!b.atuaComoGoleiro) - Number(!!a.atuaComoGoleiro)).map(({ jogadorId: jid, atuaComoGoleiro, estrelaNoSorteio }) => {
          const bruto = { ...evVazio, ...(jogo.eventos[jid] || {}) };
          const ev = normalizarCartoes(bruto, cfg);
          const virouVermelho = ev.cv !== bruto.cv;
          const soCartao = soCartoes.has(jid);
          const expulso = bruto.cv > 0 || bruto.ca >= 2 || (bruto.ca >= 1 && bruto.cz >= 1);
          return (
            <div key={jid} className="rounded-lg p-1.5" style={{
              background: atuaComoGoleiro ? "rgba(79,163,255,.09)" : "rgba(0,0,0,.26)",
              border: soCartao ? `1px dashed ${T.laranja}` : "1px solid transparent"
            }}>
              <div className="mb-1 flex items-start justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1" style={{ fontSize: 12.5, color: soCartao ? T.fraco : T.texto, fontStyle: soCartao ? "italic" : "normal" }}>
                  {atuaComoGoleiro && <IconeGoleiro tam={12} />}<span className="truncate">{jog[jid]?.nome || "?"}</span>
                  <Estrelas n={estrelaNoSorteio || 1} tam={9} goleiro={atuaComoGoleiro} />
                  {niveis?.[jid] && <SeloAtraso nivel={niveis[jid]} cfg={cfg} mini />}
                </span>
                <button onClick={() => mudar({
                  completaTime: (jogo.completaTime || []).filter((x) => x !== jid),
                  soCartoes: soCartao ? (jogo.soCartoes || []).filter((x) => x !== jid) : [...new Set([...(jogo.soCartoes || []), jid])],
                })} title="Art. 34º §10º — entrou só para completar equipe: não pontua nada, nem cartão"
                  style={{
                    flexShrink: 0, borderRadius: 3, padding: "1px 4px", fontSize: 9, fontWeight: 800,
                    background: soCartao ? "rgba(255,165,61,.22)" : "rgba(255,255,255,.07)",
                    color: soCartao ? T.laranja : T.fraco
                  }}>
                  §10
                </button>
              </div>
              {soCartao && <p style={{ fontSize: 9.5, color: T.laranja, marginBottom: 4 }}>completou equipe — não pontua nada, nem cartão</p>}
              {!soCartao && virouVermelho && bruto.ca >= 2 && <p style={{ fontSize: 9.5, color: T.vermelho, marginBottom: 4 }}>2º amarelo → vermelho (Art. 81º) · cartões bloqueados nesta partida</p>}
              {!soCartao && virouVermelho && bruto.ca < 2 && <p style={{ fontSize: 9.5, color: T.vermelho, marginBottom: 4 }}>Amarelo + azul → vermelho (Art. 81º) · cartões bloqueados nesta partida</p>}
              {!soCartao && !virouVermelho && bruto.cv > 0 && <p style={{ fontSize: 9.5, color: T.vermelho, marginBottom: 4 }}>Vermelho direto · cartões bloqueados nesta partida</p>}
              <div className="grid grid-cols-2 gap-1">
                {[["gols", "GOL"], ["assistencias", "ASS"]].map(([campo, rot]) => (
                  <div key={campo} className="flex items-center justify-between rounded" style={{ background: "rgba(255,255,255,.06)", padding: 2, opacity: soCartao ? 0.3 : 1 }}>
                    <button onClick={() => !soCartao && setEvento(jid, campo, -1)} style={{ padding: "4px 6px", color: T.fraco, fontSize: 15 }}>−</button>
                    <span style={{ fontSize: 9, color: T.fraco }}>{rot}</span>
                    <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.texto }}>{bruto[campo]}</span>
                    <button onClick={() => !soCartao && setEvento(jid, campo, 1)} style={{ padding: "4px 6px", color: T.ouro, fontSize: 15 }}>+</button>
                  </div>
                ))}
              </div>
              {(() => {
                const temCartaoReal = bruto.ca > 0 || bruto.cv > 0 || bruto.cz > 0;
                if (!cartoesAbertos[jid] && !temCartaoReal) {
                  return !soCartao && (
                    <button onClick={() => setCartoesAbertos((s) => ({ ...s, [jid]: true }))}
                      className="mt-1 w-full text-center" style={{ padding: "3px 0", fontSize: 9.5, fontWeight: 700, color: T.fraco, letterSpacing: ".04em" }}>
                      + cartão
                    </button>
                  );
                }
                return (
                  <>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {[["ca", "CA", T.laranja], ["cv", "CV", T.vermelho], ["cz", "CA", T.gk]].map(([campo, rot, cor]) => {
                        const desativado = soCartao;
                        const travaSoma = !soCartao && expulso;
                        return (
                          <div key={campo} className="flex items-center justify-between rounded" style={{ background: `${cor}1F`, padding: 2, opacity: desativado ? 0.3 : 1 }}>
                            <button onClick={() => !desativado && setEvento(jid, campo, -1)} style={{ padding: "4px 6px", color: T.fraco, fontSize: 15 }}>−</button>
                            <span style={{ fontSize: 9, color: cor, fontWeight: 800 }}>{rot}</span>
                            <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.texto }}>{bruto[campo]}</span>
                            <button onClick={() => !desativado && !travaSoma && setEvento(jid, campo, 1)} title={travaSoma ? "Já foi expulso nesta partida — não dá pra somar mais cartão" : undefined}
                              style={{ padding: "4px 6px", color: cor, fontSize: 15, opacity: travaSoma ? 0.35 : 1 }}>+</button>
                          </div>
                        );
                      })}
                    </div>
                    {!temCartaoReal && !soCartao && (
                      <button onClick={() => setCartoesAbertos((s) => { const c = { ...s }; delete c[jid]; return c; })}
                        className="mt-1 w-full text-center" style={{ padding: "3px 0", fontSize: 9.5, fontWeight: 700, color: T.fraco, letterSpacing: ".04em" }}>
                        − recolher
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          );
        })}
        {(time.vagasAbertas || []).map((papel, vi) => {
          const jaEscolhidos = new Set([...idsDoTime(tA), ...idsDoTime(tB)]);
          const opcoes = candidatos.filter((e) => !jaEscolhidos.has(e.jogador.id));
          const chave = `${time.id}-${vi}`;
          const pend = pendenteVaga[chave];
          return (
            <div key={chave} className="rounded" style={{ background: "rgba(255,165,61,.1)", border: `1px dashed ${T.laranja}`, padding: 5 }}>
              <div className="mb-1 flex items-center gap-1">
                {papel === "GOLEIRO" ? <IconeGoleiro tam={12} /> : <span style={{ fontSize: 10, color: T.laranja }}>▢</span>}
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", color: T.laranja }}>VAGA DE {papel} · quem chegou</span>
              </div>
              <select value={pend?.jogadorId || ""} onChange={(e) => {
                const jid = e.target.value;
                if (!jid) { setPendenteVaga((s) => { const c = { ...s }; delete c[chave]; return c; }); return; }
                setPendenteVaga((s) => ({ ...s, [chave]: { jogadorId: jid, pontua: !apareceuEmOutroJogo(jid) } }));
              }}
                style={{ ...inputStyle, padding: "7px 4px", fontSize: 11.5 }}>
                <option value="">— escolher quem completa —</option>
                {opcoes.map(({ jogador: o, linha: l }) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}{o.posicao === "GOLEIRO" ? " (GK)" : ""} · {l?.estrelas || 1}★
                    {apareceuEmOutroJogo(o.id) ? " · já jogou noutro jogo" : ""}
                  </option>
                ))}
              </select>
              {pend && (
                <div className="mt-1.5 space-y-1.5">
                  <Segmento valor={pend.pontua} onChange={(v) => setPendenteVaga((s) => ({ ...s, [chave]: { ...s[chave], pontua: v } }))}
                    opcoes={[
                      { valor: true, rotulo: "Vai pontuar" },
                      { valor: false, rotulo: "Só completando (§10º)", cor: T.laranja },
                    ]} />
                  <Botao className="w-full" style={{ minHeight: 38, fontSize: 11 }}
                    onClick={() => { preencherVaga(time.id, papel, pend.jogadorId, pend.pontua); setPendenteVaga((s) => { const c = { ...s }; delete c[chave]; return c; }); }}>
                    Encaixar {jog[pend.jogadorId]?.nome}
                  </Botao>
                </div>
              )}
              {opcoes.length === 0 && <p style={{ fontSize: 9.5, color: T.fraco, marginTop: 3 }}>Ninguém presente disponível ainda — marque a chegada na etapa Presença.</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between rounded px-2" style={{ background: "rgba(255,165,61,.08)" }}
        title="Gol de quem não pontua (§10º) ou que ninguém viu quem fez — soma no placar da própria equipe sem ir pra estatística de ninguém">
        <span style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.laranja }}>Gol não computado</span>
        <div className="flex items-center">
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, -1)} style={{ padding: "6px 8px", color: T.fraco }}>−</button>
          <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800 }}>{jogo[`golsNaoComputados${lado}`] || 0}</span>
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, 1)} style={{ padding: "6px 8px", color: T.laranja }}>+</button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between rounded px-2" style={{ background: "rgba(255,255,255,.06)" }}>
        <span style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.fraco }}>Gol contra</span>
        <div className="flex items-center">
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsContra${lado}`, lado === "A" ? "B" : "A", -1)} style={{ padding: "6px 8px", color: T.fraco }}>−</button>
          <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800 }}>{jogo[`golsContra${lado}`] || 0}</span>
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsContra${lado}`, lado === "A" ? "B" : "A", 1)} style={{ padding: "6px 8px", color: T.ouro }}>+</button>
        </div>
      </div>
    </div>
  );

  return (
    <Painel style={{ borderColor: jogo.encerrado ? "rgba(61,214,140,.45)" : T.borda, position: "relative" }}>
      <button onClick={() => setAberta((v) => !v)} title={aberta ? "Recolher esta partida" : "Expandir esta partida"}
        style={{ position: "absolute", top: 8, right: 8, zIndex: 1, padding: 8, color: T.fraco }}>
        <IconeSetaDireita tam={15} style={{ transform: aberta ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        {["A", "B"].map((lado, i) => (
          <React.Fragment key={lado}>
            {i === 1 && <span style={{ fontSize: 24, fontWeight: 200, color: "rgba(255,255,255,.2)" }}>×</span>}
            <div className="text-center">
              <p style={{ marginBottom: 4, fontSize: 10.5, fontWeight: 900, letterSpacing: ".12em", color: corDe((lado === "A" ? tA : tB).chave).hex }}>{(lado === "A" ? tA : tB).cor}</p>
              <p style={{ marginBottom: 4, fontSize: 12, fontWeight: 800, color: T.ouro }}>{lado === "A" ? forcaA : forcaB}★</p>
              <div className="flex items-center justify-center gap-1.5">
                <button onClick={() => setPlacar(lado, -1)} style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(255,255,255,.08)", color: T.secundario, fontSize: 20 }}>−</button>
                <span className="font-destaque" style={{ width: 42, fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{p[lado]}</span>
                <button onClick={() => setPlacar(lado, 1)} style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(255,255,255,.08)", color: T.ouro, fontSize: 20 }}>+</button>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {aberta && (
        <>
          <div className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,.22)" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.fraco }}>Equilíbrio</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: indiceEquilibrio >= 90 ? T.verde : indiceEquilibrio >= 75 ? T.ouro : T.laranja }}>{indiceEquilibrio}%</span>
            <span style={{ fontSize: 10.5, color: T.secundario }}>· Δ {diffForca}★</span>
            {temVagaAberta && <span style={{ fontSize: 10, color: T.laranja }}>· parcial (tem vaga aberta)</span>}
          </div>

          <p className="px-3 pb-2 text-center" style={{ fontSize: 10.5, lineHeight: 1.5, color: p.divergente ? T.laranja : T.fraco }}>
            {p.manual ? <>Placar lançado à mão{p.divergente && ` · a soma dos gols dá ${p.calcA}×${p.calcB}`} · <button onClick={() => mudar({ placarManual: null })} style={{ textDecoration: "underline" }}>voltar ao automático</button></>
              : "Placar somado dos gols individuais + gols contra + gols não computados. Toque em +/− para sobrescrever."}
          </p>

          <div className="grid grid-cols-2 gap-2 px-2 py-2" style={{ borderTop: `1px solid ${T.borda}` }}>
            <Coluna time={tA} lado="A" /><Coluna time={tB} lado="B" />
          </div>

          <div className="p-3" style={{ borderTop: `1px solid ${T.borda}` }}>
            <Botao variante={jogo.encerrado ? "secundario" : "primario"} className="w-full"
              onClick={() => {
                mudar({ encerrado: !jogo.encerrado, placarManual: jogo.placarManual || { A: p.A, B: p.B } });
                avisar(jogo.encerrado ? `Partida ${jogo.numero} reaberta` : `Partida ${jogo.numero} encerrada · ${p.A}×${p.B}`);
              }}>{jogo.encerrado ? "Reabrir partida" : "Encerrar partida"}</Botao>
            {!jogo.encerrado && <p className="mt-1.5 text-center" style={{ fontSize: 10.5, color: T.fraco }}>Só entra na classificação depois de encerrada.</p>}
          </div>
        </>
      )}
    </Painel>
  );
}

/* --------------------------- Ajustes P+ / P− -----------------------------*/

function Ajustes({ rodada, base, dados, onMudar }) {
  const [aberto, setAberto] = useState(false);
  const [jid, setJid] = useState(""); const [valor, setValor] = useState(1); const [motivo, setMotivo] = useState("");
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const opcoesJogadores = ((dados?.classificacao || []).length
    ? dados.classificacao.map((l) => ({ id: l.id, nome: l.nome }))
    : base.jogadores.map((j) => ({ id: j.id, nome: j.nome })))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const n = (rodada.ajustes || []).length;
  return (
    <section>
      <button onClick={() => setAberto((v) => !v)} className="mb-2 flex w-full items-baseline justify-between gap-2"
        style={{ borderBottom: `1px solid ${T.borda}`, paddingBottom: 5 }}>
        <span className="font-destaque" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.ouro }}>
          Ajustes P+ / P−
        </span>
        <span className="flex items-center" style={{ gap: 5, fontSize: 11.5, color: T.secundario, flexShrink: 0 }}>
          {n > 0 ? `${n} lançamento${n > 1 ? "s" : ""}` : "lançamentos manuais"}
          <IconeSetaDireita tam={12} style={{ transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        </span>
      </button>
      {aberto && (
      <Painel className="space-y-2 p-3">
        <p style={{ fontSize: 11, color: T.fraco }}>Atrasos e cartões já descontam sozinhos. Use aqui só o que o regulamento não automatiza.</p>
        {(rodada.ajustes || []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.25)", fontSize: 13 }}>
            <span className="truncate" style={{ color: T.secundario }}>{nomes[a.jogadorId]} <span style={{ color: T.fraco }}>· {a.motivo || "sem motivo"}</span></span>
            <span className="flex items-center gap-2">
              <b style={{ color: a.valor >= 0 ? T.verde : T.vermelho }}>{a.valor >= 0 ? "+" : ""}{a.valor}</b>
              <button onClick={() => onMudar({ ajustes: rodada.ajustes.filter((x) => x.id !== a.id) })} style={{ color: T.fraco }}>✕</button>
            </span>
          </div>
        ))}
        <div className="flex gap-2">
          <select value={jid} onChange={(e) => setJid(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }}>
            <option value="">Jogador…</option>{opcoesJogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
          </select>
          <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...inputStyle, width: 64, padding: "10px 4px", textAlign: "center", fontSize: 13 }} />
        </div>
        <div className="flex gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }} />
          <Botao style={{ padding: "0 14px" }} onClick={() => {
            if (!jid || !Number(valor)) return;
            onMudar({ ajustes: [...(rodada.ajustes || []), { id: id(), jogadorId: jid, valor: Number(valor), motivo }] });
            setJid(""); setValor(1); setMotivo("");
          }}>Lançar</Botao>
        </div>
      </Painel>
      )}
    </section>
  );
}

export { TelaRodada };
