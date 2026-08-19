import React, { useState, useRef } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { CONFIG_PADRAO, placarDe } from "../core/regras";
import { csvSumula, baixarArquivo } from "../core/exportacao";
import { id, migrarBase } from "../core/repositorio";
import { baseOficial } from "../data/baseOficial";
import { Botao, Painel, inputStyle, Campo, CabecalhoPagina } from "../components/ui";
import {
  IconeTrofeu, IconeMartelo, IconeMedalha, IconeEmbaralhar, IconeCadeado,
  IconeUpload, IconeDownload, IconeSetaDireita,
} from "../components/icones";

/* ==================== TELA: HISTÓRICO E CONFIGURAÇÕES ====================*/

/* linha "rótulo à esquerda, valor num chip à direita" — usada nos cartões de
   regra travada (Pontuação/Disciplina), pra não fingir que é editável */
function LinhaValor({ rotulo, dica, valor, unidade }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.borda}` }}>
      <div className="min-w-0">
        <p style={{ fontSize: 12.5, color: T.texto }}>{rotulo}</p>
        {dica && <p style={{ fontSize: 9.5, color: T.fraco, marginTop: 1 }}>{dica}</p>}
      </div>
      <div className="flex shrink-0 items-baseline" style={{ gap: 5 }}>
        <span className="font-destaque" style={{ minWidth: 30, textAlign: "center", padding: "4px 9px", borderRadius: 6, background: T.tier2, border: `1px solid ${T.tier4}`, fontSize: 13, fontWeight: 700, color: T.ouro }}>{valor}</span>
        {unidade && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: T.fraco }}>{unidade}</span>}
      </div>
    </div>
  );
}

/* linha "rótulo em cima, slider travado embaixo" — usada no Motor de sorteio.
   Continua 100% bloqueado: é só a barrinha em vez do número numa caixa. */
const MAX_PESO = {
  amplitude: 2000, desvio: 600, varianciaInterna: 120, faixa: 100, faixaPartida: 2000,
  repeticao: 20, aproveitamento: 50, rodadasAntiRepeticao: 10, jogadoresPorTime: 10, goleirosPorTime: 3,
};
function LinhaSlider({ rotulo, dica, valor, max }) {
  return (
    <div style={{ padding: "9px 0", borderBottom: `1px solid ${T.borda}` }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 6, gap: 8 }}>
        <div className="min-w-0">
          <span style={{ fontSize: 12, color: T.texto }}>{rotulo}</span>
          {dica && <span style={{ display: "block", fontSize: 9.5, color: T.fraco }}>{dica}</span>}
        </div>
        <span className="font-destaque shrink-0" style={{ fontSize: 13, fontWeight: 700, color: T.ouro }}>{valor}</span>
      </div>
      <input type="range" value={valor} max={max} min={0} disabled readOnly
        style={{ width: "100%", opacity: .6, cursor: "not-allowed", accentColor: T.ouro }} />
    </div>
  );
}

function LinhaToggle({ texto, ligado }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.borda}` }}>
      <p style={{ fontSize: 12, lineHeight: 1.4, color: T.secundario }}>{texto}</p>
      <span className="shrink-0" style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", padding: "3px 8px", borderRadius: 999,
        background: ligado ? T.ouroFraco : "rgba(255,255,255,.06)", color: ligado ? T.ouroClaro : T.fraco,
      }}>{ligado ? "SIM" : "NÃO"}</span>
    </div>
  );
}

/* bloco recolhível padrão — mesmo tratamento visual do "Rodadas registradas":
   painel com borda própria (separação clara das outras áreas) e um cabeçalho-
   botão de drill down bem visível (chip com seta dentro de um círculo). */
function SecaoRecolhivel({ titulo, Icone, detalhe, aberto, onToggle, children }) {
  return (
    <section>
      <Painel style={{ borderColor: T.tier4, padding: 0, overflow: "hidden" }}>
        <button onClick={onToggle} className="flex w-full items-center justify-between" style={{ gap: 8, padding: "12px 14px", background: aberto ? T.tier2 : "transparent" }}>
          <span className="font-destaque flex items-center" style={{ gap: 7, fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.ouro }}>
            {Icone && <Icone tam={15} cor={T.ouro} />}{titulo}
          </span>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11, color: T.secundario, flexShrink: 0 }}>
            {detalhe}
            <span className="flex items-center justify-center" style={{ width: 23, height: 23, borderRadius: 999, background: T.tier3, border: `1px solid ${T.tier4}` }}>
              <IconeSetaDireita tam={12} cor={T.ouro} style={{ transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </span>
          </span>
        </button>
        {aberto && <div style={{ padding: "2px 12px 12px" }}>{children}</div>}
      </Painel>
    </section>
  );
}

function Historico({ base, setBase, avisar, nomes, dados }) {
  const [aberta, setAberta] = useState(false);
  const [selecionada, setSelecionada] = useState("");
  const ordenadas = [...base.rodadas].sort((a, b) => b.numero - a.numero);
  const r = ordenadas.find((x) => x.id === selecionada) || null;

  return (
    <SecaoRecolhivel titulo="Rodadas registradas" aberto={aberta} onToggle={() => setAberta((v) => !v)} detalhe="reabrir recalcula tudo">
      <div className="space-y-3">
        {base.historicoInicial?.rodadas > 0 && (
          <div className="rounded-lg p-3" style={{ background: T.ouroFraco, border: "1px solid rgba(245,197,24,.3)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.ouro }}>Rodadas 1 a {base.historicoInicial.rodadas} — base oficial</p>
            <p style={{ fontSize: 11.5, color: T.secundario }}>{base.historicoInicial.descricao} ({base.historicoInicial.data}).</p>
          </div>
        )}

        {ordenadas.length === 0 ? (
          <p className="rounded-lg p-4 text-center" style={{ border: `1px dashed ${T.borda}`, fontSize: 13, color: T.secundario }}>Nenhuma rodada registrada no app ainda.</p>
        ) : (
          <Campo rotulo="Ver / ajustar rodada">
            <select value={selecionada} onChange={(e) => setSelecionada(e.target.value)} style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
              <option value="">— escolher —</option>
              {ordenadas.map((x) => (
                <option key={x.id} value={x.id}>
                  Rodada {x.numero}{x.status === "aberta" ? " · aberta" : ""} — {x.data || "sem data"}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {r && (
          <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(0,0,0,.22)" }}>
            <div className="min-w-0">
              <p style={{ fontSize: 13.5, fontWeight: 700 }}>Rodada {r.numero} {r.status === "aberta" && <span style={{ color: T.ouro }}>· aberta</span>}</p>
              <p className="truncate" style={{ fontSize: 11.5, color: T.secundario }}>
                {r.data} · {(r.jogos || []).map((g) => { const p = placarDe(g, r); return `${p.A}×${p.B}`; }).join(" · ") || "sem partidas"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => { baixarArquivo(`jpffs-sumula-r${r.numero}.csv`, csvSumula(r, nomes, dados.disciplina.porRodada[r.id])); avisar("Súmula exportada"); }}
                style={{ borderRadius: 6, padding: 9, fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: "rgba(255,255,255,.08)", color: T.secundario }}>Súmula</button>
              <button onClick={() => setBase({ ...base, rodadas: base.rodadas.map((x) => x.id === r.id ? { ...x, status: x.status === "aberta" ? "fechada" : "aberta" } : x) })}
                style={{ borderRadius: 6, padding: 9, fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: "rgba(255,255,255,.08)", color: T.secundario }}>{r.status === "aberta" ? "Fechar" : "Reabrir"}</button>
              <button onClick={() => { if (confirm(`Excluir a rodada ${r.numero}? A classificação será recalculada.`)) { setBase({ ...base, rodadas: base.rodadas.filter((x) => x.id !== r.id) }); setSelecionada(""); } }}
                style={{ borderRadius: 6, padding: "9px 10px", fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,.08)", color: T.vermelho }}>✕</button>
            </div>
          </div>
        )}
      </div>
    </SecaoRecolhivel>
  );
}

function TelaConfig({ base, setBase, dados, cfg, avisar }) {
  const inputRef = useRef(null);
  const [pontuacaoAberta, setPontuacaoAberta] = useState(false);
  const [disciplinaAberta, setDisciplinaAberta] = useState(false);
  const [hendorAberto, setHendorAberto] = useState(false);
  const [motorAberto, setMotorAberto] = useState(false);
  const [restricoesAbertas, setRestricoesAbertas] = useState(false);
  const [ra, setRa] = useState(""); const [rb, setRb] = useState(""); const [tipo, setTipo] = useState("separados");
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const mudar = (c, v) => setBase({ ...base, config: { ...cfg, [c]: v } });

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Configurações do Sistema" descricao="Regras oficiais, pesos do sorteio e dados da temporada."
        acao={
          <div className="flex" style={{ gap: 8 }}>
            <Botao variante="secundario" className="flex items-center" style={{ gap: 6, whiteSpace: "nowrap" }} onClick={() => inputRef.current?.click()}>
              <IconeUpload tam={14} /> Importar JSON
            </Botao>
            <Botao className="flex items-center" style={{ gap: 6, whiteSpace: "nowrap" }}
              onClick={() => { baixarArquivo(`jpffs-base-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(base, null, 2), "application/json"); avisar("Base exportada"); }}>
              <IconeDownload tam={14} /> Exportar Dados
            </Botao>
            <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fr = new FileReader();
              fr.onload = () => {
                try {
                  const d = JSON.parse(fr.result);
                  if (!Array.isArray(d.jogadores) || !Array.isArray(d.rodadas)) throw new Error();
                  setBase(migrarBase(d)); avisar(`Base importada · ${d.jogadores.length} jogadores`);
                } catch { avisar("Arquivo inválido. Use um JSON exportado pelo sistema."); }
              };
              fr.readAsText(f); e.target.value = "";
            }} />
          </div>
        } />
      <p style={{ marginTop: -12, fontSize: 11, color: T.fraco }}>
        O JSON exportado é salvo neste dispositivo e funciona sem internet — é o seu backup e o jeito de levar os dados para outro aparelho.
      </p>
      <Historico {...{ base, setBase, avisar, nomes, dados }} />

      <Painel className="p-3" style={{ borderColor: T.gk, background: T.gkFraco, fontSize: 11.5, lineHeight: 1.55, color: T.secundario }}>
        <b style={{ color: T.gk }}>Goleiros.</b> Agora é um jogador normal: mesma escala de estrela de todo mundo (a posição geral
        na tabela), sorteado junto com a linha e pesando igual no equilíbrio da equipe — pode ter goleiro 5★ com jogador 5★ no mesmo time.
        A única regra fixa é de composição: toda equipe sai com 1 goleiro + 4 de linha. Faltando goleiro, a vaga de meta
        fica em aberto para escolha manual — o sorteio nunca promove um jogador de linha a goleiro, e nunca coloca
        dois goleiros na mesma equipe. Quem excede as vagas vira sobressalente da partida adicional (§10º).
      </Painel>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", alignItems: "start" }}>
        <SecaoRecolhivel titulo="Pontuação" Icone={IconeTrofeu} aberto={pontuacaoAberta} onToggle={() => setPontuacaoAberta((v) => !v)}
          detalhe={<><IconeCadeado tam={11} /> bloqueado</>}>
          <LinhaValor rotulo="Vitória" valor={cfg.pontosVitoria} unidade="pts" />
          <LinhaValor rotulo="Empate" valor={cfg.pontosEmpate} unidade="pts" />
          <LinhaValor rotulo="Derrota" valor={cfg.pontosDerrota ?? 0} unidade="pts" />
          <LinhaValor rotulo="Presença" valor={cfg.pontosPresenca} unidade="pts" />
          <LinhaValor rotulo="Teto por rodada" valor={cfg.tetoPorRodada} unidade="pts" />
          <LinhaValor rotulo="Supercopa — linha" dica="Vagas de linha classificadas" valor={cfg.zonaSupercopa} unidade="vagas" />
          <LinhaValor rotulo="Supercopa — goleiro" dica="Vagas de goleiro classificadas" valor={cfg.goleirosSupercopa} unidade="vagas" />
          <div style={{ paddingTop: 9 }}>
            <Campo rotulo="Base do aproveitamento" dica="Realizadas reproduz a tabela oficial.">
              <select value={cfg.baseAproveitamento} disabled onChange={(e) => mudar("baseAproveitamento", e.target.value)} style={{ ...inputStyle, padding: "10px", fontSize: 13, opacity: .55, cursor: "not-allowed" }}>
                <option value="realizadas">Rodadas realizadas ({dados.rodadasRealizadas})</option>
                <option value="previstas">Rodadas previstas ({cfg.rodadasPrevistas})</option>
              </select>
            </Campo>
          </div>
        </SecaoRecolhivel>

        <SecaoRecolhivel titulo="Disciplina" Icone={IconeMartelo} aberto={disciplinaAberta} onToggle={() => setDisciplinaAberta((v) => !v)}
          detalhe={<><IconeCadeado tam={11} /> bloqueado</>}>
          <LinhaValor rotulo="Cartão amarelo" dica="por ciclo fechado (Art. 82º §1º)" valor={-cfg.pontosPorCicloAmarelo} unidade="pts" />
          <LinhaValor rotulo="Cartão vermelho" dica="Art. 82º §3º" valor={-cfg.pontosPorVermelho} unidade="pts" />
          <LinhaValor rotulo="3º atraso" dica="ponto de presença perdido" valor={-cfg.pontoPerdidoTerceiroAtraso} unidade="pts" />
          <LinhaValor rotulo="Amarelos por ciclo" dica="Art. 82º §1º — padrão 3" valor={cfg.cartoesPorPonto} unidade="cartões" />
          <LinhaValor rotulo="Atrasos para suspensão" valor={cfg.atrasosParaSuspensao} unidade="atrasos" />
          <LinhaValor rotulo="Rodadas do campeonato" valor={cfg.rodadasPrevistas} unidade="rodadas" />
          <LinhaToggle ligado={cfg.amareloNoSegundoAtraso} texto="2º atraso gera cartão amarelo na classificação" />
          <LinhaToggle ligado={cfg.converterSegundoAmarelo} texto="2º amarelo, ou amarelo + azul, vira vermelho na mesma partida (Art. 81º §Único)" />
          <LinhaToggle ligado={cfg.perdePontoNoQuartoAtraso} texto="Cobrar ponto extra do suspenso (premissa em aberto)" />
          <p style={{ fontSize: 10, color: T.fraco, paddingTop: 8 }}>Art. 34º §8º · Art. 82º</p>
        </SecaoRecolhivel>

        <SecaoRecolhivel titulo="Campeões Copa Hendor" Icone={IconeMedalha} aberto={hendorAberto} onToggle={() => setHendorAberto((v) => !v)}
          detalhe="2 vagas">
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.fraco, paddingBottom: 8 }}>
            Os 2 campeões da Copa Hendor de Penalidades entram na zona da Supercopa mesmo se estiverem fora do corte por pontos.
            Vale para qualquer jogador — inclusive goleiro, que disputa a vaga extra com os outros goleiros. Deixe em branco
            enquanto a final não acontece.
          </p>
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Campo key={i} rotulo={`Campeão ${i + 1}`}>
                <select
                  value={(cfg.campeoesHendor || [])[i] || ""}
                  onChange={(e) => {
                    const atual = [...(cfg.campeoesHendor || [])];
                    atual[i] = e.target.value || null;
                    mudar("campeoesHendor", atual);
                  }}
                  style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
                  <option value="">— a definir —</option>
                  {base.jogadores.filter((j) => !j.convidado).map((j) => (
                    <option key={j.id} value={j.id}>{j.nome}{j.posicao === "GOLEIRO" ? " (GK)" : ""}</option>
                  ))}
                </select>
              </Campo>
            ))}
          </div>
        </SecaoRecolhivel>
      </div>

      <SecaoRecolhivel titulo="Motor de sorteio" Icone={IconeEmbaralhar} aberto={motorAberto} onToggle={() => setMotorAberto((v) => !v)}
        detalhe={<><IconeCadeado tam={11} /> bloqueado</>}>
        <p style={{ fontSize: 11, color: T.fraco, marginBottom: 4 }}>§12º — goleiro e linha juntos. Pesos internos do algoritmo de equilíbrio, travados.</p>
        {[["amplitude", "Diferença máx."], ["desvio", "Desvio padrão"], ["varianciaInterna", "Composição interna"],
        ["faixa", "Distribuição por faixa"], ["faixaPartida", "5★ espalhados entre partidas"],
        ["repeticao", "Anti-repetição"], ["aproveitamento", "Aproveitamento %"]].map(([c, r]) => (
          <LinhaSlider key={c} rotulo={r} valor={cfg.pesos[c]} max={MAX_PESO[c]} />
        ))}
        <LinhaToggle ligado={cfg.usarAproveitamento} texto="Equilibrar também o aproveitamento %" />
        {[["rodadasAntiRepeticao", "Anti-repetição (rodadas)"], ["jogadoresPorTime", "Jogadores por equipe"],
        ["goleirosPorTime", "Goleiros por equipe"]].map(([c, r]) => (
          <LinhaSlider key={c} rotulo={r} valor={cfg[c]} max={MAX_PESO[c]} />
        ))}
      </SecaoRecolhivel>

      <SecaoRecolhivel titulo="Restrições por par" aberto={restricoesAbertas} onToggle={() => setRestricoesAbertas((v) => !v)}
        detalhe={<><IconeCadeado tam={11} /> bloqueado · {(base.restricoes || []).length} regra(s)</>}>
        <div className="space-y-2">
          {(base.restricoes || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.25)", fontSize: 12 }}>
              <span className="truncate" style={{ color: T.secundario }}>{nomes[r.a]} <span style={{ color: r.tipo === "juntos" ? T.verde : T.vermelho }}>{r.tipo === "juntos" ? "sempre com" : "nunca com"}</span> {nomes[r.b]}</span>
              <button disabled onClick={() => setBase({ ...base, restricoes: base.restricoes.filter((x) => x.id !== r.id) })} style={{ color: T.fraco, opacity: .55, cursor: "not-allowed" }}>✕</button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <select value={ra} disabled onChange={(e) => setRa(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 4px", fontSize: 12, opacity: .55, cursor: "not-allowed" }}>
              <option value="">Jogador A</option>{base.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
            </select>
            <select value={tipo} disabled onChange={(e) => setTipo(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12, opacity: .55, cursor: "not-allowed" }}>
              <option value="separados">nunca com</option><option value="juntos">sempre com</option>
            </select>
            <select value={rb} disabled onChange={(e) => setRb(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 4px", fontSize: 12, opacity: .55, cursor: "not-allowed" }}>
              <option value="">Jogador B</option>{base.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
            </select>
          </div>
          <Botao className="w-full" disabled onClick={() => {
            if (!ra || !rb || ra === rb) return avisar("Escolha dois jogadores diferentes");
            setBase({ ...base, restricoes: [...(base.restricoes || []), { id: id(), a: ra, b: rb, tipo }] });
            setRa(""); setRb("");
          }}>Adicionar restrição</Botao>
        </div>
      </SecaoRecolhivel>

      <Botao variante="secundario" className="w-full" onClick={async () => {
        if (!confirm("Restaurar todas as regras dos Ajustes para o padrão? Suas rodadas e jogadores NÃO são afetados — só os parâmetros voltam ao original.")) return;
        const { data: s } = await supabase.auth.getSession();
        if (!s?.session) { alert("Você precisa estar logado para restaurar."); return; }
        const novaBase = { ...base, config: { ...CONFIG_PADRAO } };
        const { error } = await supabase.from("base")
          .update({ dados: novaBase, atualizado_em: new Date().toISOString(), atualizado_por: s.session.user.email || null })
          .eq("id", 1);
        if (error) { alert("Falha ao restaurar: " + error.message); return; }
        avisar("Regras restauradas — recarregando…");
        setTimeout(() => window.location.reload(), 400);
      }}>Restaurar regras-padrão</Botao>

      <Botao variante="perigo" className="w-full" onClick={async () => {
        if (!confirm("Recarregar a base oficial da 21ª rodada? Todas as rodadas lançadas no app serão perdidas em TODOS os dispositivos.")) return;
        const { data: s } = await supabase.auth.getSession();
        if (!s?.session) { alert("Você precisa estar logado para restaurar."); return; }
        const oficial = baseOficial();
        const { error } = await supabase.from("base")
          .update({ dados: oficial, atualizado_em: new Date().toISOString(), atualizado_por: s.session.user.email || null })
          .eq("id", 1);
        if (error) { alert("Falha ao restaurar: " + error.message); return; }
        try { localStorage.removeItem("jpffs:backup"); } catch { }
        avisar("Base oficial restaurada — recarregando…");
        setTimeout(() => window.location.reload(), 400);
      }}>Restaurar base oficial</Botao>
      <p className="pb-4 text-center" style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.18)" }}>Campeonato JPFFS · {base.temporada}</p>
    </div>
  );
}

export { Historico, TelaConfig };
