import React, { useState, useRef } from "react";
import { T } from "../theme";
import { idsDoTime } from "../core/regras";
import { id, enviarFotoJogador } from "../core/repositorio";
import {
  Botao, Painel, inputStyle, Campo, CabecalhoPagina, Secao, Segmento, Interruptor,
  CampoBusca, Estrelas, IconeGoleiro, SeloAtraso, Chip, AvatarJogador,
} from "../components/ui";

/* =========================== TELA: ELENCO ================================*/

function TelaElenco({ base, setBase, dados, cfg, avisar }) {
  const [nome, setNome] = useState(""); const [posicao, setPosicao] = useState("LINHA");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("alfabetica");
  const [editando, setEditando] = useState(null);
  const [nomeEditado, setNomeEditado] = useState({});
  const [enviandoFoto, setEnviandoFoto] = useState(null);
  const inputRef = useRef(null);
  const fotoInputsRef = useRef({});
  const porId = Object.fromEntries(dados.todos.map((l) => [l.id, l]));
  const atualizar = (jid, patch) => setBase({ ...base, jogadores: base.jogadores.map((j) => (j.id === jid ? { ...j, ...patch } : j)) });
  const inferidos = base.jogadores.filter((j) => j.posicaoInferida);

  async function handleFoto(jogador, arquivo) {
    if (!arquivo) return;
    setEnviandoFoto(jogador.id);
    try {
      const url = await enviarFotoJogador(jogador.id, arquivo);
      atualizar(jogador.id, { fotoUrl: url });
      avisar("Foto atualizada");
    } catch (e) {
      console.error("Falha ao enviar foto:", e);
      avisar("Não deu pra enviar a foto — confira se o armazenamento (bucket \"avatares\") já foi criado no Supabase.");
    } finally {
      setEnviandoFoto(null);
    }
  }

  function importar(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const txt = String(fr.result);
        let novos = [];
        if (f.name.endsWith(".json")) {
          const d = JSON.parse(txt);
          novos = (Array.isArray(d) ? d : d.jogadores || []).map((j) => ({
            id: id(), nome: j.nome, posicao: /goleiro/i.test(j.posicao || "") ? "GOLEIRO" : "LINHA",
            ativo: j.ativo !== false, convidado: !!j.convidado, estrelasIniciais: 1
          }));
        } else {
          const linhas = txt.split(/\r?\n/).filter(Boolean);
          const sep = linhas[0].includes(";") ? ";" : ",";
          novos = linhas.slice(/nome/i.test(linhas[0]) ? 1 : 0).map((l) => {
            const [n, pos] = l.split(sep);
            return { id: id(), nome: (n || "").trim(), posicao: /goleiro|gk/i.test(pos || "") ? "GOLEIRO" : "LINHA", ativo: true, convidado: false, estrelasIniciais: 1 };
          }).filter((j) => j.nome);
        }
        if (!novos.length) throw new Error();
        setBase({ ...base, jogadores: [...base.jogadores, ...novos] });
        avisar(`${novos.length} jogadores importados`);
      } catch { avisar("Arquivo inválido. CSV: nome;posicao"); }
    };
    fr.readAsText(f); e.target.value = "";
  }

  const ordenacoes = {
    alfabetica: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    classificacao: (a, b) => (porId[a.id]?.posicao || 999) - (porId[b.id]?.posicao || 999),
    posicao: (a, b) => (b.posicao === "GOLEIRO") - (a.posicao === "GOLEIRO") || a.nome.localeCompare(b.nome, "pt-BR"),
  };
  const visiveis = [...base.jogadores]
    .filter((j) => j.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => Number(!!a.convidado) - Number(!!b.convidado) || ordenacoes[ordem](a, b));

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Gestão de Elenco" descricao="Visualize e gerencie os jogadores cadastrados." />
      {inferidos.length > 0 && (
        <Painel className="p-3" style={{ borderColor: T.gk, background: T.gkFraco, fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.gk }}>Confirme os goleiros.</b> A marcação de {inferidos.length} jogadores ({inferidos.map((j) => j.nome).join(", ")}) foi inferida do ícone da tabela oficial.
          <Botao variante="secundario" className="mt-2 w-full" style={{ minHeight: 40 }}
            onClick={() => { setBase({ ...base, jogadores: base.jogadores.map((j) => ({ ...j, posicaoInferida: false })) }); avisar("Posições confirmadas"); }}>Confirmar todas</Botao>
        </Painel>
      )}

      <section>
        <Secao titulo="Novo jogador" detalhe="§11º — entra com 1★" />
        <Painel className="space-y-2 p-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
          <Segmento titulo="Posição" valor={posicao} onChange={setPosicao}
            opcoes={[{ valor: "LINHA", rotulo: "Linha" }, { valor: "GOLEIRO", rotulo: "Goleiro", cor: T.gk }]} />
          <div className="flex gap-2">
            <Botao className="flex-1" onClick={() => {
              if (!nome.trim()) return;
              setBase({ ...base, jogadores: [...base.jogadores, { id: id(), nome: nome.trim(), posicao, ativo: true, convidado: false, estrelasIniciais: 1, pendenciaFinanceira: false, pontuacaoPendente: false }] });
              avisar(`${nome.trim()} cadastrado com 1★`); setNome("");
            }}>Cadastrar</Botao>
            <Botao variante="secundario" onClick={() => inputRef.current?.click()}>Importar</Botao>
            <input ref={inputRef} type="file" accept=".json,.csv" className="hidden" onChange={importar} />
          </div>
          <p style={{ fontSize: 11, color: T.fraco }}>Art. 34º §11º: todo jogador começa com 1 estrela; a classe passa a sair da posição na tabela.</p>
        </Painel>
      </section>

      <CampoBusca value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />

      <div>
        <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>Ordenar por</span>
        <div className="flex gap-1.5">
          {[["alfabetica", "A → Z"], ["classificacao", "Classificação"], ["posicao", "Goleiros primeiro"]].map(([v, r]) => (
            <button key={v} onClick={() => setOrdem(v)} className="flex-1 rounded-full"
              style={{
                padding: "9px 6px", minHeight: 42, fontSize: 11.5, fontWeight: 800,
                background: ordem === v ? T.ouro : "rgba(255,255,255,.07)",
                color: ordem === v ? T.sobreOuro : T.secundario
              }}>{r}</button>
          ))}
        </div>
      </div>

      <section>
        <Secao titulo="Elenco" detalhe={`${base.jogadores.filter((j) => j.ativo !== false && !j.convidado).length} ativos de ${base.jogadores.filter((j) => !j.convidado).length}`} />
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {visiveis.map((j) => {
            const l = porId[j.id];
            const aberto = editando === j.id;
            const inativo = j.ativo === false;
            const badges = [
              { r: inativo ? "INATIVO" : "ATIVO", c: inativo ? T.fraco : T.verde },
              !j.convidado && { r: "OFICIAL", c: T.gk },
              j.convidado && { r: "CONVIDADO", c: T.roxo },
              j.pendenciaFinanceira && { r: "DEVENDO", c: T.vermelho },
              j.pontuacaoPendente && { r: "A CONFIRMAR", c: T.laranja },
            ].filter(Boolean);
            return (
              <Painel key={j.id} className={aberto ? "col-span-full" : ""}
                style={{ borderColor: aberto ? T.ouro : j.convidado ? "rgba(192,140,255,.45)" : T.borda, opacity: inativo && !aberto ? 0.55 : 1 }}>
                <div className="p-3">
                  <div className="flex items-center gap-2.5">
                    <AvatarJogador jogador={j} tam={42} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1" style={{ fontWeight: 700, fontSize: 14.5 }}>
                        {j.posicao === "GOLEIRO" && <IconeGoleiro tam={13} />}
                        <span className="truncate">{j.nome}</span>
                      </p>
                      <Estrelas n={l?.estrelas || 1} tam={10.5} goleiro={j.posicao === "GOLEIRO"} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {badges.map((b) => <Chip key={b.r} cor={b.c}>{b.r}</Chip>)}
                    {l?.nivelAtraso && <SeloAtraso nivel={l.atrasosNoMes} cfg={cfg} mini />}
                  </div>

                  <p style={{ fontSize: 11, color: T.secundario, marginTop: 8 }}>
                    {j.convidado ? "fora da classificação" : `${l?.posicao}º geral`} · {l?.pontos} pts · {l?.J} jogos · {l?.gols} gols · {l?.assistencias} ass
                    {l?.cartoesNoCiclo > 0 && <span style={{ color: T.laranja }}> · {l.cartoesNoCiclo}/{cfg.cartoesPorPonto} amarelos</span>}
                  </p>

                  <button onClick={() => {
                    setEditando(aberto ? null : j.id);
                    setNomeEditado((s) => { const c = { ...s }; delete c[j.id]; return c; });
                  }} className="w-full rounded-lg"
                    style={{
                      marginTop: 10, padding: "9px 12px", minHeight: 38, fontSize: 11, fontWeight: 800, letterSpacing: ".06em",
                      background: aberto ? T.ouro : "rgba(255,255,255,.08)",
                      color: aberto ? T.sobreOuro : T.secundario, border: `1px solid ${aberto ? T.ouro : T.borda}`
                    }}>
                    {aberto ? "FECHAR" : "EDITAR"}
                  </button>
                </div>

                {aberto && (
                  <div className="space-y-2 px-3 pb-3" style={{ borderTop: `1px solid ${T.borda}`, paddingTop: 12 }}>
                    <Campo rotulo="Foto">
                      <div className="flex items-center gap-3">
                        <AvatarJogador jogador={j} tam={56} />
                        <Botao variante="secundario" disabled={enviandoFoto === j.id}
                          onClick={() => fotoInputsRef.current[j.id]?.click()}>
                          {enviandoFoto === j.id ? "Enviando…" : j.fotoUrl ? "Trocar foto" : "Enviar foto"}
                        </Botao>
                        <input ref={(el) => (fotoInputsRef.current[j.id] = el)} type="file" accept="image/*" className="hidden"
                          onChange={(e) => { handleFoto(j, e.target.files?.[0]); e.target.value = ""; }} />
                      </div>
                    </Campo>

                    <Campo rotulo="Nome">
                      <div className="flex gap-2">
                        <input value={nomeEditado[j.id] ?? j.nome}
                          onChange={(e) => setNomeEditado({ ...nomeEditado, [j.id]: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} />
                        <Botao style={{ padding: "0 14px" }}
                          disabled={(nomeEditado[j.id] ?? j.nome).trim() === j.nome}
                          onClick={() => {
                            const novo = (nomeEditado[j.id] ?? j.nome).trim();
                            if (!novo) return avisar("Nome não pode ficar vazio");
                            atualizar(j.id, { nome: novo });
                            setNomeEditado((s) => { const c = { ...s }; delete c[j.id]; return c; });
                            avisar("Nome atualizado");
                          }}>Salvar</Botao>
                      </div>
                    </Campo>

                    <Segmento titulo="Posição" valor={j.posicao}
                      onChange={(v) => atualizar(j.id, { posicao: v, posicaoInferida: false })}
                      opcoes={[{ valor: "LINHA", rotulo: "Jogador de linha" }, { valor: "GOLEIRO", rotulo: "Goleiro", cor: T.gk }]} />
                    {j.posicaoInferida && <p style={{ fontSize: 10.5, color: T.gk }}>Posição inferida da tabela oficial — confirme tocando numa das duas.</p>}

                    <Interruptor ligado={j.ativo !== false} onChange={() => atualizar(j.id, { ativo: j.ativo === false })}
                      titulo="Ativo no campeonato" cor={T.verde}
                      descricao={j.ativo !== false ? "Aparece na chamada de presença da rodada." : "Não aparece na chamada. Continua na tabela com o histórico."} />

                    <Interruptor ligado={!!j.pendenciaFinanceira} onChange={() => atualizar(j.id, { pendenciaFinanceira: !j.pendenciaFinanceira })}
                      titulo="Pendência financeira ($)" cor={T.vermelho}
                      descricao="Só sinaliza na tabela e na chamada. Não desconta pontos nem bloqueia o sorteio." />

                    <Interruptor ligado={!!j.pontuacaoPendente} onChange={() => atualizar(j.id, { pontuacaoPendente: !j.pontuacaoPendente })}
                      titulo="Pontuação a confirmar (*)" cor={T.laranja}
                      descricao="Marca que os pontos dele aguardam confirmação de pagamento. Só sinalização." />

                    <Interruptor ligado={!!j.convidado} onChange={() => atualizar(j.id, { convidado: !j.convidado })}
                      titulo="Convidado / avulso" cor={T.roxo}
                      descricao={j.convidado ? "Joga e entra na súmula, mas fica fora da classificação." : "Conta normalmente na classificação geral."} />

                    <button onClick={() => {
                      if (l?.temHistorico) return avisar("Tem histórico oficial — desative em vez de excluir");
                      if (base.rodadas.some((r) => (r.times || []).some((t) => idsDoTime(t).includes(j.id)))) return avisar("Tem partidas registradas — desative em vez de excluir");
                      if (confirm(`Excluir ${j.nome} do elenco?`)) { setBase({ ...base, jogadores: base.jogadores.filter((x) => x.id !== j.id) }); setEditando(null); }
                    }} className="w-full rounded-lg"
                      style={{
                        padding: "11px", minHeight: 44, fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
                        background: "rgba(176,33,33,.18)", border: "1px solid rgba(255,107,107,.4)", color: T.vermelho
                      }}>
                      Excluir do elenco
                    </button>
                  </div>
                )}
              </Painel>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export { TelaElenco };
