import React, { useState } from "react";
import { T, ESCUDO } from "../theme";
import { eventoDe, placarDe } from "../core/regras";
import { csvClassificacao, imagemTabela, baixarArquivo } from "../core/exportacao";
import {
  Botao, Painel, Secao, SeloAtraso, CampoBusca, Estrelas, IconeGoleiro, IconeLinha, Marcadores, AvatarJogador,
} from "../components/ui";
import { IconeSetaDireita } from "../components/icones";

/* ======================= TELA: CLASSIFICAÇÃO =============================*/

function TelaClassificacao({ base, dados, cfg, avisar }) {
  const [vista, setVista] = useState("classificacao");
  const [detalhe, setDetalhe] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const cols = [["P", "pontos"], ["%", "aproveitamento"], ["J", "J"], ["V", "V"], ["E", "E"], ["D", "D"],
  ["GP", "GP"], ["GC", "GC"], ["SG", "SG"], ["G", "gols"], ["A", "assistencias"], ["CA", "CA"], ["CV", "CV"], ["P+", "Pmais"], ["P−", "Pmenos"]];

  const visiveis = dados.classificacao
    .filter((l) => l.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter((l) => filtro === "todos" ? true
      : filtro === "linha" ? l.jogador.posicao !== "GOLEIRO"
        : filtro === "goleiros" ? l.jogador.posicao === "GOLEIRO"
          : filtro === "supercopa" ? l.supercopa
            : l.atrasosNoMes > 0 || l.jogador.pendenciaFinanceira || l.jogador.pontuacaoPendente || l.cartoes > 0);

  const cor = (k, l) => k === "pontos" ? T.ouro : k === "SG" ? (l.SG > 0 ? T.verde : l.SG < 0 ? T.vermelho : T.fraco)
    : k === "Pmais" ? T.verde : k === "Pmenos" ? T.vermelho : k === "aproveitamento" ? T.texto : T.secundario;

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center text-center" style={{ margin: "2px 0 20px", gap: 6 }}>
        <img src={ESCUDO} alt="Campeonato JPFFS" style={{ height: 60, width: "auto", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.55))" }} />
        <h1 className="font-destaque" style={{ fontSize: 21, fontWeight: 700, color: T.texto }}>Classificação Geral</h1>
        <span style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: T.secundario }}>
          {dados.rodadasRealizadas}ª rodada · teto {dados.teto} pts
        </span>
      </div>

      {/* Alternador Classificação | Resultados | Documentação */}
      <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${T.borda}` }}>
        {[["classificacao", "Classificação"], ["resultados", "Resultados"], ["documentacao", "Documentação"]].map(([v, r]) => (
          <button key={v} onClick={() => setVista(v)} className="flex-1 rounded-lg"
            style={{
              padding: "10px 0", fontSize: 12.5, fontWeight: 800, letterSpacing: ".04em",
              background: vista === v ? T.ouro : "transparent",
              color: vista === v ? T.sobreOuro : T.secundario
            }}>{r}</button>
        ))}
      </div>

      {vista === "resultados" && <Resultados base={base} cfg={cfg} />}
      {vista === "documentacao" && <Documentacao cfg={cfg} />}
      {vista === "classificacao" && (<>
        <Secao titulo="Geral" detalhe={`Supercopa: 1º ao ${cfg.zonaSupercopa}º`} /></>)}

      {vista === "classificacao" && (<>
        <CampoBusca value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jogador…" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[["todos", "Todos"], ["linha", "Linha"], ["goleiros", "Goleiros"], ["supercopa", "Supercopa"], ["alerta", "Alertas"]].map(([f, r]) => (
            <button key={f} onClick={() => setFiltro(f)} className="shrink-0 rounded-full"
              style={{ padding: "9px 15px", fontSize: 12, fontWeight: 800, background: filtro === f ? T.ouro : "rgba(255,255,255,.07)", color: filtro === f ? T.sobreOuro : T.secundario }}>{r}</button>
          ))}
        </div></>)}

      {vista === "classificacao" && (<>
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${T.borda}` }}>
          <table style={{ width: "100%", textAlign: "right", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,.3)", borderBottom: `2px solid ${T.ouro}` }}>
                <th style={{ padding: "8px 5px", textAlign: "center", fontSize: 9.5, color: T.fraco }}>#</th>
                <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9.5, color: T.fraco }}>JOGADOR</th>
                <th style={{ padding: "8px 5px", textAlign: "center", fontSize: 9.5, color: T.fraco }}>CLASSE</th>
                {cols.map(([r]) => <th key={r} style={{ padding: "8px 5px", fontSize: 9.5, color: T.fraco }}>{r}</th>)}
                <th style={{ padding: "8px 5px", textAlign: "center", fontSize: 9.5, color: T.fraco }}>ÚLT. 5</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l, i) => (
                <tr key={l.id} onClick={() => setDetalhe(detalhe === l.id ? null : l.id)}
                  style={{ background: l.supercopa ? T.ouroFraco : i % 2 ? T.linhaPar : "transparent", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer" }}>
                  <td style={{ padding: "8px 5px", textAlign: "center", fontWeight: 900, color: l.supercopa ? T.ouro : T.fraco, borderLeft: l.supercopa ? `4px solid ${T.ouro}` : "4px solid transparent" }}>{l.posicao}</td>
                  <td style={{ padding: "8px 6px", textAlign: "left" }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      {detalhe === l.id && <AvatarJogador jogador={l.jogador} tam={36} />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5" style={{ whiteSpace: "nowrap" }}>
                          {l.jogador.posicao === "GOLEIRO" && <IconeGoleiro />}
                          <span style={{ color: T.texto, fontWeight: 600, fontSize: 12.5 }}>{l.nome}</span>
                          {l.nivelAtraso && <SeloAtraso nivel={l.atrasosNoMes} cfg={cfg} mini />}
                          <Marcadores jogador={l.jogador} />
                        </div>
                        {detalhe === l.id && (
                          <p style={{ marginTop: 3, fontSize: 10.5, lineHeight: 1.5, fontWeight: 400, color: T.secundario, whiteSpace: "normal" }}>
                            <span style={{ display: "block", color: T.secundario }}>
                              Ciclo de amarelos: {l.cartoesNoCiclo}/{cfg.cartoesPorPonto} · atrasos no mês: {l.atrasosNoMes}
                              {l.nivelAtraso && ` — ${l.nivelAtraso.rotulo}`}
                            </span>
                            {l.Pmenos > 0 && <span style={{ display: "block", color: T.vermelho }}>
                              P−: {l.histPmenos} histórico + {l.pontosAtraso} atraso + {l.penalAmarelo} amarelos + {l.penalVermelho} vermelho + {l.penalidadeManual} manual
                            </span>}
                            {l.jogador.posicaoInferida && <span style={{ display: "block", color: T.gk }}>Goleiro inferido da tabela oficial — confirme no Elenco.</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "8px 5px", textAlign: "center" }}><Estrelas n={l.estrelas} tam={10.5} goleiro={l.ehGoleiro} /></td>
                  {cols.map(([r, k]) => (
                    <td key={r} className={k === "pontos" ? "font-destaque" : ""} style={{ padding: "8px 5px", color: cor(k, l), fontWeight: k === "pontos" ? 700 : 400, fontSize: k === "pontos" ? 14 : 12 }}>
                      {k === "aproveitamento" ? `${l[k]}%` : k === "SG" ? `${l.SG > 0 ? "+" : ""}${l.SG}` : (k === "Pmais" || k === "Pmenos") ? (l[k] || "") : l[k]}
                    </td>
                  ))}
                  <td style={{ padding: "8px 5px" }}>
                    <div className="flex justify-center gap-0.5">
                      {l.ultimos5.map((r, k) => (
                        <span key={k} style={{
                          display: "inline-block", width: 16, height: 16, borderRadius: 3, fontSize: 9, fontWeight: 800, lineHeight: "16px", textAlign: "center",
                          background: r === "V" ? T.verde : r === "E" ? "#5A76A8" : r === "D" ? T.vermelho : "rgba(255,255,255,.07)",
                          color: r === "V" || r === "D" ? T.fundoBase : r === "E" ? "#fff" : "rgba(255,255,255,.25)"
                        }}>{r}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visiveis.length === 0 && <Painel className="p-6 text-center" style={{ borderStyle: "dashed", color: T.secundario }}>Nenhum jogador com esse filtro.</Painel>}

        {dados.convidados.length > 0 && (
          <Painel className="p-3" style={{ borderColor: "rgba(192,140,255,.4)", fontSize: 11.5, color: T.secundario }}>
            <b style={{ color: T.roxo }}>Convidados (fora da classificação):</b> {dados.convidados.map((c) => `${c.nome} — ${c.J}J, ${c.gols}G`).join(" · ")}
          </Painel>
        )}

        <Painel className="p-3" style={{ fontSize: 11.5, lineHeight: 1.65, color: T.secundario }}>
          <b style={{ color: T.ouro }}>Pontuação</b> · P = J + (3 × V) + E + P⁺ − P⁻ · % = P ÷ ({cfg.baseAproveitamento === "previstas" ? cfg.rodadasPrevistas : dados.rodadasRealizadas} × {cfg.tetoPorRodada}) = ÷ {dados.teto}<br />
          <b style={{ color: T.ouro }}>Cartões</b> · {cfg.cartoesPorPonto} amarelos/azuis = −{cfg.pontosPorCicloAmarelo} ponto (contagem reinicia, Art. 82º §2º) · cada vermelho = −{cfg.pontosPorVermelho}<br />
          <b style={{ color: T.ouro }}>Atrasos</b> · 1º alerta · 2º amarelo · 3º perde a presença · 4º suspensão. Zera na virada do mês, salvo emenda (§9º)<br />
          <b style={{ color: T.ouro }}>Classe</b> · 1º-3º = 5★ · 4º-6º = 4★ · 7º-9º = 3★ · 10º-14º = 2★ · 15º+ = 1★<br />
          <span style={{ color: T.fraco }}>Escala única: a classe sai da posição geral na tabela, goleiro (<span style={{ color: T.gk }}>★ azul</span>) e linha (<span style={{ color: T.ouro }}>★ ouro</span>) na mesma fila — a cor é só identificação visual. Toque na linha para ver o rank dentro da categoria.</span><br />
          <span style={{ color: T.ouro }}>▌</span> Zona Supercopa · <IconeGoleiro tam={13} /> goleiro · <span style={{ color: T.vermelho }}>$</span> pendência · (*) a confirmar
        </Painel>

        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" onClick={() => { baixarArquivo("jpffs-classificacao.csv", csvClassificacao(dados.classificacao)); avisar("CSV exportado"); }}>Exportar CSV</Botao>
          <Botao onClick={() => { imagemTabela(dados.classificacao, cfg, { rodadas: dados.rodadasRealizadas, teto: dados.teto }); avisar("Imagem PNG gerada"); }}>Imagem PNG</Botao>
        </div>
      </>)}
    </div>
  );
}
function Resultados({ base, cfg }) {
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const [aberta, setAberta] = useState(null);
  const [jogosAbertos, setJogosAbertos] = useState({});
  const rodadas = [...(base.rodadas || [])]
    .filter((r) => (r.jogos || []).some((g) => g.encerrado))
    .sort((a, b) => b.numero - a.numero);

  if (rodadas.length === 0)
    return (
      <Painel className="p-6 text-center" style={{ borderStyle: "dashed", color: T.secundario, fontSize: 13, lineHeight: 1.6 }}>
        Ainda não há resultados lançados no app.<br />
        <span style={{ color: T.fraco, fontSize: 12 }}>As rodadas aparecem aqui assim que forem encerradas.</span>
      </Painel>
    );

  return (
    <div className="space-y-2">
      {rodadas.map((rodada) => {
        const jogos = [...(rodada.jogos || [])].filter((g) => g.encerrado).sort((a, b) => a.numero - b.numero);
        const estaAberta = aberta === rodada.id;
        return (
          <div key={rodada.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.borda}` }}>
            {/* cabeçalho clicável */}
            <button onClick={() => setAberta(estaAberta ? null : rodada.id)}
              className="flex w-full items-center justify-between"
              style={{ padding: "13px 14px", background: estaAberta ? "rgba(240,192,64,.08)" : "rgba(255,255,255,.03)" }}>
              <span className="flex items-baseline" style={{ gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: T.ouro }}>{rodada.numero}ª rodada</span>
                <span style={{ fontSize: 11, color: T.fraco }}>{jogos.length} jogo(s)</span>
              </span>
              <span className="flex items-center" style={{ gap: 10 }}>
                {rodada.data && <span style={{ fontSize: 11, color: T.fraco }}>{new Date(rodada.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                <span style={{ fontSize: 12, color: T.secundario, transform: estaAberta ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
              </span>
            </button>

            {estaAberta && (
              <div className="space-y-2" style={{ padding: 10, background: "rgba(0,0,0,.15)" }}>
                <div className="flex flex-wrap items-center" style={{ gap: "6px 12px", fontSize: 10, color: T.fraco, paddingBottom: 2 }}>
                  <span className="flex items-center" style={{ gap: 4 }}><IconeGoleiro tam={11} /> goleiro · <IconeLinha tam={11} /> linha</span>
                  <span>⚽ gol · 👟 assistência · 🟨 amarelo · 🟦 azul · 🟥 vermelho · 🔴 gol contra · ❔ gol não computado</span>
                  <span style={{ color: T.laranja, fontStyle: "italic" }}>● nome em laranja itálico = completou a equipe (§10º), não pontuou</span>
                </div>
                {jogos.map((jogo) => {
                  const p = placarDe(jogo, rodada);
                  const tA = (rodada.times || []).find((x) => x.id === jogo.timeA);
                  const tB = (rodada.times || []).find((x) => x.id === jogo.timeB);
                  const soCartoesJogo = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
                  const porGoleiroPrimeiro = (a, b) => Number(!!b.atuaComoGoleiro) - Number(!!a.atuaComoGoleiro);
                  const gA = [...(tA?.jogadores || [])].sort(porGoleiroPrimeiro);
                  const gB = [...(tB?.jogadores || [])].sort(porGoleiroPrimeiro);
                  const ev = (jid) => eventoDe(jogo, jid);
                  const linhaEventos = (grupo) => grupo.map((j) => {
                    const e = ev(j.jogadorId); const marcas = [];
                    if (e.gols > 0) marcas.push(`⚽${e.gols > 1 ? e.gols : ""}`);
                    if (e.assistencias > 0) marcas.push(`👟${e.assistencias > 1 ? e.assistencias : ""}`);
                    const doisAmarelos = cfg.converterSegundoAmarelo && e.ca >= 2;
                    const amareloAzul = cfg.converterSegundoAmarelo && !doisAmarelos && e.ca >= 1 && e.cz >= 1;
                    if (doisAmarelos) marcas.push("🟨🟨→🟥 (2º amarelo)");
                    else if (amareloAzul) marcas.push("🟨🟦→🟥 (amarelo+azul)");
                    else if (e.ca > 0) marcas.push(`🟨${e.ca > 1 ? `×${e.ca}` : ""}`);
                    if (e.cv > 0) marcas.push(`🟥${(doisAmarelos || amareloAzul) ? " extra" : " direto"}${e.cv > 1 ? ` ×${e.cv}` : ""}`);
                    if (e.cz > 0 && !amareloAzul) marcas.push(`🟦${e.cz > 1 ? ` ×${e.cz}` : ""}`);
                    const completou = soCartoesJogo.has(j.jogadorId);
                    return { nome: nomes[j.jogadorId] || "?", marcas, completou, ehGoleiro: !!j.atuaComoGoleiro };
                  });
                  const venceuA = p.A > p.B, venceuB = p.B > p.A;
                  const jogoAberto = !!jogosAbertos[jogo.id];
                  const temExtras = ((jogo.golsContraA || 0) + (jogo.golsContraB || 0) + (jogo.golsNaoComputadosA || 0) + (jogo.golsNaoComputadosB || 0)) > 0;
                  return (
                    <Painel key={jogo.id} className="p-3">
                      <button onClick={() => setJogosAbertos((s) => ({ ...s, [jogo.id]: !s[jogo.id] }))} className="w-full">
                        <div className="flex items-center justify-center" style={{ gap: 5, marginBottom: 6 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".12em", color: T.fraco }}>JOGO {jogo.numero}</span>
                          <IconeSetaDireita tam={10} cor={T.fraco} style={{ transform: jogoAberto ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                        </div>
                        <div className="flex items-center justify-between" style={{ gap: 8 }}>
                          <span className="flex-1 text-right" style={{ fontSize: 13.5, fontWeight: venceuA ? 900 : 600, color: venceuA ? T.ouro : T.texto }}>Amarelo</span>
                          <span className="font-destaque" style={{ fontSize: 19, fontWeight: 700, color: T.texto, minWidth: 58, textAlign: "center", letterSpacing: ".05em" }}>{p.A} <span style={{ color: T.fraco }}>×</span> {p.B}</span>
                          <span className="flex-1" style={{ fontSize: 13.5, fontWeight: venceuB ? 900 : 600, color: venceuB ? "#7FB0FF" : T.texto }}>Azul</span>
                        </div>
                      </button>
                      {jogoAberto && (<>
                      <div className="flex justify-between" style={{ gap: 10, marginTop: 8, fontSize: 11, lineHeight: 1.7 }}>
                        <div className="flex-1 text-right" style={{ color: T.secundario }}>
                          {linhaEventos(gA).map((r, i) => (
                            <div key={i} className="flex items-center justify-end" style={{ gap: 4, color: r.completou ? T.laranja : T.secundario, fontStyle: r.completou ? "italic" : "normal" }}>
                              {r.ehGoleiro ? <IconeGoleiro tam={11} /> : <IconeLinha tam={11} />}
                              <span>{r.nome}</span>
                              {r.marcas.length > 0 && (
                                <span style={{ paddingLeft: 6, marginLeft: 2, borderLeft: `1px solid ${T.borda}`, color: T.fraco, fontStyle: "normal" }}>{r.marcas.join(" ")}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{ width: 1, background: T.borda }} />
                        <div className="flex-1" style={{ color: T.secundario }}>
                          {linhaEventos(gB).map((r, i) => (
                            <div key={i} className="flex items-center" style={{ gap: 4, color: r.completou ? T.laranja : T.secundario, fontStyle: r.completou ? "italic" : "normal" }}>
                              {r.ehGoleiro ? <IconeGoleiro tam={11} /> : <IconeLinha tam={11} />}
                              <span>{r.nome}</span>
                              {r.marcas.length > 0 && (
                                <span style={{ paddingLeft: 6, marginLeft: 2, borderLeft: `1px solid ${T.borda}`, color: T.fraco, fontStyle: "normal" }}>{r.marcas.join(" ")}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {temExtras && (
                        <div className="flex justify-between" style={{ gap: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.borda}`, fontSize: 10, color: T.laranja }}>
                          <div className="flex-1 text-right">
                            {jogo.golsContraA > 0 && <div>🔴 gol contra ×{jogo.golsContraA}</div>}
                            {jogo.golsNaoComputadosA > 0 && <div>❔ gol não computado ×{jogo.golsNaoComputadosA}</div>}
                          </div>
                          <div style={{ width: 1 }} />
                          <div className="flex-1">
                            {jogo.golsContraB > 0 && <div>gol contra ×{jogo.golsContraB} 🔴</div>}
                            {jogo.golsNaoComputadosB > 0 && <div>gol não computado ×{jogo.golsNaoComputadosB} ❔</div>}
                          </div>
                        </div>
                      )}
                      </>)}
                    </Painel>
                  );
                })}
                {(rodada.ajustes || []).length > 0 && (
                  <Painel className="p-3" style={{ fontSize: 11.5, color: T.secundario }}>
                    <b style={{ color: T.ouro }}>Ajustes P+ / P− da rodada:</b>
                    <div className="mt-1.5 space-y-1">
                      {rodada.ajustes.map((aj) => (
                        <div key={aj.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{nomes[aj.jogadorId] || aj.jogadorId} <span style={{ color: T.fraco }}>· {aj.motivo || "sem motivo"}</span></span>
                          <b style={{ flexShrink: 0, color: aj.valor >= 0 ? T.verde : T.vermelho }}>{aj.valor >= 0 ? "+" : ""}{aj.valor}</b>
                        </div>
                      ))}
                    </div>
                  </Painel>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ======================= TELA: DOCUMENTAÇÃO ===============================*/

function ItemDoc({ id, aberta, setAberta, titulo, resumo, children }) {
  const estaAberta = aberta === id;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.borda}` }}>
      <button onClick={() => setAberta(estaAberta ? null : id)}
        className="flex w-full items-center justify-between gap-3 text-left"
        style={{ padding: "13px 14px", background: estaAberta ? "rgba(240,192,64,.08)" : "rgba(255,255,255,.03)" }}>
        <span className="min-w-0">
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: estaAberta ? T.ouro : T.texto }}>{titulo}</span>
          <span style={{ display: "block", fontSize: 11, color: T.fraco, marginTop: 2 }}>{resumo}</span>
        </span>
        <span style={{ fontSize: 12, color: T.secundario, flexShrink: 0, transform: estaAberta ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>
      {estaAberta && (
        <div style={{ padding: "4px 14px 16px", background: "rgba(0,0,0,.15)", fontSize: 12.5, lineHeight: 1.7, color: T.secundario }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Documentacao({ cfg }) {
  const [aberta, setAberta] = useState("pontuacao");
  const linhaPorTime = cfg.jogadoresPorTime - cfg.goleirosPorTime;
  const baseTexto = cfg.baseAproveitamento === "previstas" ? `${cfg.rodadasPrevistas} rodadas previstas` : "rodadas já realizadas";

  const Lista = ({ children }) => <ul style={{ margin: "6px 0", paddingLeft: 18, listStyle: "disc" }}>{children}</ul>;
  const Item = ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>;
  const Forte = ({ children, cor = T.ouro }) => <b style={{ color: cor }}>{children}</b>;

  return (
    <div className="space-y-3">
      <Painel className="p-4" style={{ background: T.ouroFraco, borderColor: "rgba(245,197,24,.3)" }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: T.ouro, marginBottom: 4 }}>Como o campeonato funciona</p>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: T.secundario }}>
          Esta página explica, em linguagem simples, todas as regras que o app aplica sozinho — pontuação, sorteio, atrasos,
          cartões, e assim por diante. Toque num tópico abaixo pra abrir os detalhes. Vale pra todo mundo, logado ou não.
        </p>
      </Painel>

      <ItemDoc id="pontuacao" aberta={aberta} setAberta={setAberta}
        titulo="Como funciona a pontuação"
        resumo="Presença e vitória somam ponto; atraso, cartão e ajuste manual tiram.">
        <p>Quem joga a partida de verdade (não só "completou equipe", veja o tópico de sorteio) ganha:</p>
        <Lista>
          <Item><Forte>{cfg.pontosPresenca} ponto</Forte> só por jogar (presença)</Item>
          <Item><Forte cor={T.verde}>+{cfg.pontosVitoria} pontos</Forte> se o time vencer</Item>
          <Item><Forte>+{cfg.pontosEmpate} ponto</Forte> se empatar</Item>
          <Item><Forte>+{cfg.pontosDerrota} ponto(s)</Forte> se perder</Item>
        </Lista>
        <p>Em cima disso, somam-se os pontos bônus (<Forte cor={T.verde}>P⁺</Forte>) e descontam-se os pontos perdidos
          (<Forte cor={T.vermelho}>P⁻</Forte> — atraso, cartão, ajuste manual etc.):</p>
        <p style={{ background: "rgba(0,0,0,.25)", padding: "8px 10px", borderRadius: 8, color: T.texto, fontWeight: 700 }}>
          P = presença + (3 × vitórias) + empates + P⁺ − P⁻
        </p>
        <p><Forte>Aproveitamento (%)</Forte> mostra o quanto do "teto" de pontos possível o jogador já aproveitou:
          pontos ÷ ({baseTexto} × {cfg.tetoPorRodada} pts/rodada). Isso não muda a posição na tabela — é só um jeito
          de comparar quem tem menos jogos feitos com quem já tem muitos.</p>
      </ItemDoc>

      <ItemDoc id="classe" aberta={aberta} setAberta={setAberta}
        titulo="Classe (as estrelas ★)"
        resumo="A classe de cada jogador sai direto da posição dele na tabela geral.">
        <p>Todo jogador — goleiro ou de linha — tem uma classe de 1 a 5 estrelas, usada pra montar times equilibrados no
          sorteio. É a mesma régua pra todo mundo, sem distinção de posição:</p>
        <Lista>
          <Item>1º ao 3º colocado geral <Estrelas n={5} tam={11} /></Item>
          <Item>4º ao 6º colocado <Estrelas n={4} tam={11} /></Item>
          <Item>7º ao 9º colocado <Estrelas n={3} tam={11} /></Item>
          <Item>10º ao 14º colocado <Estrelas n={2} tam={11} /></Item>
          <Item>15º colocado em diante <Estrelas n={1} tam={11} /></Item>
        </Lista>
        <p>Jogador novo no elenco entra direto com <Estrelas n={1} tam={11} /> (Art. 34º §11º), e vai subindo de classe
          conforme sobe na tabela geral com o passar das rodadas. O ícone <IconeGoleiro tam={12} /> é só uma marcação
          visual de "esse aqui é goleiro" — não muda a régua de estrelas.</p>
      </ItemDoc>

      <ItemDoc id="atrasos" aberta={aberta} setAberta={setAberta}
        titulo="Presença e atrasos"
        resumo="Cada atraso no mês pesa mais que o anterior — no 4º, o jogador fica de fora da rodada.">
        <p>Na chamada de cada rodada, cada jogador passa por três status, nessa ordem, ao tocar no nome dele:{" "}
          <Forte cor={T.secundario}>ausente</Forte> → <Forte cor={T.verde}>presente</Forte> → <Forte cor={T.laranja}>atrasado</Forte>.</p>
        <p>Cada vez que alguém chega atrasado, conta como mais um atraso <i>daquele mês</i>, e a punição aumenta:</p>
        <div className="space-y-1.5" style={{ margin: "8px 0" }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <SeloAtraso nivel={n} cfg={cfg} />
              <span style={{ fontSize: 11.5 }}>
                {n === 1 && "só um alerta, ainda não tira nada"}
                {n === 2 && "gera um cartão amarelo na classificação"}
                {n === 3 && `perde o ponto de presença dessa rodada (−${cfg.pontoPerdidoTerceiroAtraso})`}
                {n === cfg.atrasosParaSuspensao && n !== 3 && "fica suspenso — nem entra no sorteio dessa rodada"}
              </span>
            </div>
          ))}
        </div>
        <p>O contador zera toda virada de mês — <i>a menos que</i> o último atraso do jogador ainda não tenha sido
          "compensado" por uma chegada no horário depois dele (Art. 34º §9º, a "emenda"). Nesse caso o contador
          continua contando no mês seguinte, em vez de voltar a zero.</p>
      </ItemDoc>

      <ItemDoc id="cartoes" aberta={aberta} setAberta={setAberta}
        titulo="Cartões e suspensões"
        resumo={`A cada ${cfg.cartoesPorPonto} amarelos/azuis o jogador perde ponto; vermelho perde na hora.`}>
        <Lista>
          <Item>A cada <Forte>{cfg.cartoesPorPonto}</Forte> cartões amarelos <i>ou</i> azuis somados, o jogador perde{" "}
            <Forte cor={T.vermelho}>{cfg.pontosPorCicloAmarelo} ponto</Forte>, e a contagem recomeça do zero (Art. 82º §2º).</Item>
          <Item>Cada cartão <Forte cor={T.vermelho}>vermelho</Forte> tira <Forte cor={T.vermelho}>{cfg.pontosPorVermelho} ponto</Forte> na hora.</Item>
          {cfg.converterSegundoAmarelo && (
            <Item>Na mesma partida: o <Forte>2º amarelo</Forte> vira vermelho automaticamente, e um{" "}
              <Forte>amarelo + azul</Forte> juntos também viram vermelho (Art. 81º §único). Depois disso o jogador não
              pode receber mais nenhum cartão naquela partida — já foi expulso.</Item>
          )}
        </Lista>
      </ItemDoc>

      <ItemDoc id="sorteio" aberta={aberta} setAberta={setAberta}
        titulo="Como o sorteio monta os times"
        resumo="Craques (5★) são espalhados entre as partidas, e goleiro entra na mesma régua da linha.">
        <p>O goleiro é tratado como um jogador comum: mesma escala de estrelas de todo mundo, sorteado junto com a linha
          e pesando igual no equilíbrio da equipe — pode até ter goleiro 5★ jogando ao lado de um jogador de linha 5★.
          A única regra fixa é de formação: toda equipe fecha com <Forte>{cfg.goleirosPorTime} goleiro(s) + {linhaPorTime} de linha</Forte>.</p>
        <p>O sistema tenta deixar todas as partidas parecidas em força — não só dentro de cada partida (Amarelo x Azul),
          mas também <i>entre</i> as partidas do dia, pra não ter craque empilhado numa e vazio na outra. Ele também evita
          repetir sempre as mesmas duplas de jogadores juntos nas últimas {cfg.rodadasAntiRepeticao} rodadas.</p>
        <p>Quando o número de presentes não fecha um múltiplo exato de partida completa, sobra sempre uma partida
          extra ("sobressalentes") com vaga em aberto — nunca sobra vaga espalhada em várias partidas ao mesmo tempo.
          Essa vaga se completa na hora, conforme mais gente for chegando.</p>
        <p>Quem entra numa partida só pra <Forte>completar a equipe</Forte> porque estava faltando gente (Art. 34º §10º)
          não pontua <i>nada</i> ali — nem presença, nem gol, nem cartão. É só pra fechar o time e a partida acontecer.</p>
        <p>O sorteio nunca promove um jogador de linha a goleiro, e nunca coloca dois goleiros na mesma equipe.</p>
      </ItemDoc>

      <ItemDoc id="sumula" aberta={aberta} setAberta={setAberta}
        titulo="Súmula da partida"
        resumo="Gol, assistência, gol contra e gol não computado — o que cada um significa.">
        <Lista>
          <Item><Forte>Gol</Forte> e <Forte>assistência</Forte> contam direto na estatística de quem marcou/deu o passe.</Item>
          <Item><Forte>Gol contra</Forte> soma no placar do time adversário, mas não é gol de ninguém na estatística.</Item>
          <Item><Forte>Gol não computado</Forte> é pra quando ninguém sabe (ou não dá pra saber) quem fez o gol — soma
            no placar da própria equipe, mas não vai pra estatística de nenhum jogador.</Item>
          <Item>O placar é somado automaticamente a partir dos gols lançados, mas dá pra sobrescrever na mão se
            precisar lançar o resultado final direto.</Item>
        </Lista>
      </ItemDoc>

      <ItemDoc id="supercopa" aberta={aberta} setAberta={setAberta}
        titulo="Supercopa"
        resumo={`Os ${cfg.zonaSupercopa} primeiros de linha + os ${cfg.goleirosSupercopa} primeiros goleiros se classificam.`}>
        <p>É a zona de classificação em destaque (faixa dourada) na tabela: os <Forte>{cfg.zonaSupercopa}</Forte> primeiros
          colocados entre os jogadores de linha, e os <Forte>{cfg.goleirosSupercopa}</Forte> primeiros colocados entre os
          goleiros, entram automaticamente — cada categoria disputa a própria zona, uma não invade a vaga da outra.</p>
      </ItemDoc>

      <ItemDoc id="hendor" aberta={aberta} setAberta={setAberta}
        titulo="Copa Hendor de Penalidades"
        resumo="Os 2 campeões dessa copa paralela ganham vaga garantida na Supercopa.">
        <p>Os 2 campeões da Copa Hendor entram na zona de classificação da Supercopa mesmo que estejam fora do corte
          por pontos. Se já estiverem classificados por mérito, nada muda. Vale pra qualquer jogador, inclusive
          goleiro — que aí disputa a vaga extra só com os outros goleiros, nunca com a linha.</p>
      </ItemDoc>

      <ItemDoc id="convidados" aberta={aberta} setAberta={setAberta}
        titulo="Convidados / avulsos"
        resumo="Jogam normalmente na rodada, mas ficam fora da classificação oficial.">
        <p>Um convidado entra numa rodada, aparece na súmula e conta pro placar normalmente, mas não disputa o
          campeonato — fica de fora da tabela de classificação e da Supercopa. Começa com a classe de estrelas que
          for escolhida na hora, e essa classe não muda com o tempo (diferente de um jogador do elenco oficial).</p>
      </ItemDoc>

      <ItemDoc id="ajustes" aberta={aberta} setAberta={setAberta}
        titulo="Ajustes manuais (P⁺ / P⁻)"
        resumo="Pontos lançados na mão pelo organizador, pra casos fora do automático.">
        <p>Atrasos e cartões já descontam ponto sozinhos. Os ajustes manuais de P⁺ (bônus) e P⁻ (desconto) servem pra
          qualquer outra situação que o regulamento não cobre automaticamente — o organizador lança o valor e o
          motivo, e isso entra na conta de pontos do jogador naquela rodada.</p>
      </ItemDoc>

      <ItemDoc id="legenda" aberta={aberta} setAberta={setAberta}
        titulo="Legenda e símbolos"
        resumo="O que cada marcação na tabela e na súmula quer dizer.">
        <div className="space-y-2">
          <div className="flex items-center gap-2"><span style={{ color: T.ouro, fontWeight: 900 }}>▌</span> faixa dourada na linha = está na zona de classificação da Supercopa</div>
          <div className="flex items-center gap-2"><IconeGoleiro tam={14} /> jogador que atua como goleiro</div>
          <div className="flex items-center gap-2"><span style={{ color: T.vermelho, fontWeight: 800 }}>$</span> pendência financeira — só um aviso visual, não desconta ponto nem bloqueia o sorteio</div>
          <div className="flex items-center gap-2"><span style={{ color: T.secundario, fontWeight: 800 }}>(*)</span> pontuação a confirmar — sinaliza que os pontos aguardam alguma confirmação (ex.: pagamento)</div>
          <div className="flex items-center gap-2"><span style={{ background: "rgba(192,140,255,.22)", color: T.roxo, fontSize: 9, fontWeight: 800, padding: "1px 4px", borderRadius: 3 }}>CONV</span> jogador convidado, fora da classificação oficial</div>
          <div className="flex items-center gap-2"><span style={{ fontStyle: "italic", color: T.laranja, fontSize: 11 }}>itálico laranja</span> na súmula = entrou só pra completar a equipe, não pontuou nada</div>
        </div>
      </ItemDoc>
    </div>
  );
}

export { TelaClassificacao };
