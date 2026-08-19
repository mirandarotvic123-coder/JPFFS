import React, { useState, useRef } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { CONFIG_PADRAO, placarDe } from "../core/regras";
import { csvSumula, baixarArquivo } from "../core/exportacao";
import { id, migrarBase } from "../core/repositorio";
import { baseOficial } from "../data/baseOficial";
import { Botao, Painel, inputStyle, Campo, CabecalhoPagina, Secao } from "../components/ui";
import {
  IconeTrofeu, IconeMartelo, IconeMedalha, IconeEmbaralhar, IconeCadeado,
} from "../components/icones";

/* ==================== TELA: HISTÓRICO E CONFIGURAÇÕES ====================*/

function Historico({ base, setBase, avisar, nomes, dados }) {
  return (
    <section>
      <Secao titulo="Rodadas registradas" detalhe="reabrir recalcula tudo" />
      <div className="space-y-2">
        {base.historicoInicial?.rodadas > 0 && (
          <Painel className="p-3" style={{ background: T.ouroFraco, borderColor: "rgba(245,197,24,.3)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.ouro }}>Rodadas 1 a {base.historicoInicial.rodadas} — base oficial</p>
            <p style={{ fontSize: 11.5, color: T.secundario }}>{base.historicoInicial.descricao} ({base.historicoInicial.data}).</p>
          </Painel>
        )}
        {[...base.rodadas].sort((a, b) => b.numero - a.numero).map((r) => (
          <Painel key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
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
              <button onClick={() => { if (confirm(`Excluir a rodada ${r.numero}? A classificação será recalculada.`)) setBase({ ...base, rodadas: base.rodadas.filter((x) => x.id !== r.id) }); }}
                style={{ borderRadius: 6, padding: "9px 10px", fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,.08)", color: T.vermelho }}>✕</button>
            </div>
          </Painel>
        ))}
        {base.rodadas.length === 0 && <Painel className="p-5 text-center" style={{ borderStyle: "dashed", fontSize: 13, color: T.secundario }}>Nenhuma rodada registrada no app ainda.</Painel>}
      </div>
    </section>
  );
}

function TelaConfig({ base, setBase, dados, cfg, avisar }) {
  const inputRef = useRef(null);
  const [ra, setRa] = useState(""); const [rb, setRb] = useState(""); const [tipo, setTipo] = useState("separados");
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const mudar = (c, v) => setBase({ ...base, config: { ...cfg, [c]: v } });
  const mudarPeso = (c, v) => setBase({ ...base, config: { ...cfg, pesos: { ...cfg.pesos, [c]: Number(v) } } });

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo="Configurações do Sistema" descricao="Regras oficiais, pesos do sorteio e dados da temporada." />
      <Historico {...{ base, setBase, avisar, nomes, dados }} />

      <Painel className="p-3" style={{ borderColor: T.gk, background: T.gkFraco, fontSize: 11.5, lineHeight: 1.55, color: T.secundario }}>
        <b style={{ color: T.gk }}>Goleiros.</b> Agora é um jogador normal: mesma escala de estrela de todo mundo (a posição geral
        na tabela), sorteado junto com a linha e pesando igual no equilíbrio da equipe — pode ter goleiro 5★ com jogador 5★ no mesmo time.
        A única regra fixa é de composição: toda equipe sai com 1 goleiro + 4 de linha. Faltando goleiro, a vaga de meta
        fica em aberto para escolha manual — o sorteio nunca promove um jogador de linha a goleiro, e nunca coloca
        dois goleiros na mesma equipe. Quem excede as vagas vira sobressalente da partida adicional (§10º).
      </Painel>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", alignItems: "start" }}>
        <section>
          <Secao titulo="Pontuação" Icone={IconeTrofeu} detalhe={<><IconeCadeado tam={11} /> bloqueado</>} />
          <Painel className="grid grid-cols-2 gap-2 p-3">
            {[["pontosVitoria", "Pontos por vitória"], ["pontosEmpate", "Pontos por empate"],
            ["pontosPresenca", "Pontos por presença"], ["tetoPorRodada", "Teto por rodada"],
            ["zonaSupercopa", "Supercopa: nº de linha"], ["goleirosSupercopa", "Supercopa: nº de goleiros"]].map(([c, r]) => (
              <Campo key={c} rotulo={r}><input type="number" value={cfg[c]} disabled onChange={(e) => mudar(c, Number(e.target.value))} style={{ ...inputStyle, padding: "10px", opacity: .55, cursor: "not-allowed" }} /></Campo>
            ))}
            <div className="col-span-2">
              <Campo rotulo="Base do aproveitamento" dica="Realizadas reproduz a tabela oficial.">
                <select value={cfg.baseAproveitamento} disabled onChange={(e) => mudar("baseAproveitamento", e.target.value)} style={{ ...inputStyle, padding: "10px", fontSize: 13, opacity: .55, cursor: "not-allowed" }}>
                  <option value="realizadas">Rodadas realizadas ({dados.rodadasRealizadas})</option>
                  <option value="previstas">Rodadas previstas ({cfg.rodadasPrevistas})</option>
                </select>
              </Campo>
            </div>
          </Painel>
        </section>

        <section>
          <Secao titulo="Disciplina" Icone={IconeMartelo} detalhe={<><IconeCadeado tam={11} /> bloqueado · Art. 34º §8º · Art. 82º</>} />
          <Painel className="grid grid-cols-2 gap-2 p-3">
            {[["pontoPerdidoTerceiroAtraso", "Pontos perdidos no 3º atraso", ""],
            ["atrasosParaSuspensao", "Atrasos para suspensão", ""],
            ["cartoesPorPonto", "Amarelos por ciclo", "Art. 82º §1º — padrão 3"],
            ["pontosPorCicloAmarelo", "Pontos por ciclo fechado", ""],
            ["pontosPorVermelho", "Pontos por vermelho", "Art. 82º §3º"],
            ["rodadasPrevistas", "Rodadas do campeonato", ""]].map(([c, r, d]) => (
              <Campo key={c} rotulo={r} dica={d}><input type="number" value={cfg[c]} disabled onChange={(e) => mudar(c, Number(e.target.value))} style={{ ...inputStyle, padding: "10px", opacity: .55, cursor: "not-allowed" }} /></Campo>
            ))}
            {[["amareloNoSegundoAtraso", "2º atraso gera cartão amarelo na classificação"],
            ["converterSegundoAmarelo", "2º amarelo, ou amarelo + azul, vira vermelho na mesma partida (Art. 81º §Único)"],
            ["perdePontoNoQuartoAtraso", "Cobrar ponto extra do suspenso (premissa em aberto)"]].map(([c, r]) => (
              <div key={c} className="col-span-2">
                <button disabled onClick={() => mudar(c, !cfg[c])} className="w-full rounded-lg p-3 text-left"
                  style={{ border: `1px solid ${cfg[c] ? T.ouro : T.borda}`, background: cfg[c] ? T.ouroFraco : "rgba(0,0,0,.2)", fontSize: 12.5, color: cfg[c] ? T.ouroClaro : T.secundario, opacity: .55, cursor: "not-allowed" }}>
                  {cfg[c] ? "☑ " : "☐ "}{r}
                </button>
              </div>
            ))}
          </Painel>
        </section>

        <section>
          <Secao titulo="Campeões Copa Hendor" Icone={IconeMedalha} detalhe="2 vagas na Supercopa" />
          <Painel className="space-y-2 p-3">
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.fraco }}>
              Os 2 campeões da Copa Hendor de Penalidades entram na zona da Supercopa mesmo se estiverem fora do corte por pontos.
              Vale para qualquer jogador — inclusive goleiro, que disputa a vaga extra com os outros goleiros. Deixe em branco
              enquanto a final não acontece.
            </p>
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
          </Painel>
        </section>
      </div>

      <section>
        <Secao titulo="Motor de sorteio" Icone={IconeEmbaralhar} detalhe={<><IconeCadeado tam={11} /> bloqueado · §12º — goleiro e linha juntos</>} />
        <Painel className="grid grid-cols-2 gap-2 p-3">
          {[["amplitude", "Diferença máx."], ["desvio", "Desvio padrão"], ["varianciaInterna", "Composição interna"],
          ["faixa", "Distribuição por faixa"], ["faixaPartida", "5★ espalhados entre partidas"],
          ["repeticao", "Anti-repetição"], ["aproveitamento", "Aproveitamento %"]].map(([c, r]) => (
            <Campo key={c} rotulo={r}><input type="number" value={cfg.pesos[c]} disabled onChange={(e) => mudarPeso(c, e.target.value)} style={{ ...inputStyle, padding: "10px", opacity: .55, cursor: "not-allowed" }} /></Campo>
          ))}
          <div className="col-span-2">
            <button disabled onClick={() => mudar("usarAproveitamento", !cfg.usarAproveitamento)} className="w-full rounded-lg p-3 text-left"
              style={{ border: `1px solid ${cfg.usarAproveitamento ? T.ouro : T.borda}`, background: cfg.usarAproveitamento ? T.ouroFraco : "rgba(0,0,0,.2)", fontSize: 12.5, color: cfg.usarAproveitamento ? T.ouroClaro : T.secundario, opacity: .55, cursor: "not-allowed" }}>
              {cfg.usarAproveitamento ? "☑ " : "☐ "}Equilibrar também o aproveitamento %
            </button>
          </div>
          {[["rodadasAntiRepeticao", "Anti-repetição (rodadas)"], ["jogadoresPorTime", "Jogadores por equipe"],
          ["goleirosPorTime", "Goleiros por equipe"]].map(([c, r]) => (
            <Campo key={c} rotulo={r}><input type="number" value={cfg[c]} disabled onChange={(e) => mudar(c, Number(e.target.value))} style={{ ...inputStyle, padding: "10px", opacity: .55, cursor: "not-allowed" }} /></Campo>
          ))}
        </Painel>
      </section>

      <section>
        <Secao titulo="Restrições por par" detalhe={<><IconeCadeado tam={11} /> bloqueado · {(base.restricoes || []).length} regra(s)</>} />
        <Painel className="space-y-2 p-3">
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
        </Painel>
      </section>

      <section>
        <Secao titulo="Backup e transferência" />
        <Painel className="space-y-2 p-3">
          <Botao className="w-full" onClick={() => { baixarArquivo(`jpffs-base-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(base, null, 2), "application/json"); avisar("Base exportada"); }}>
            Exportar base completa (JSON)
          </Botao>
          <Botao variante="secundario" className="w-full" onClick={() => inputRef.current?.click()}>Importar base (JSON)</Botao>
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
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.fraco }}>
            Salvo neste dispositivo, funciona sem internet. A classificação nunca é armazenada — é sempre recalculada.
          </p>
        </Painel>
      </section>

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
