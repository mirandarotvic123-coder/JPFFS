/* core/exportacao — geração de CSV e das imagens (canvas) de súmula e
 * escalação pra download. Só toca em DOM/Blob/canvas, nenhuma regra do
 * campeonato mora aqui, só formatação de saída. */
import { T, ESCUDO, AMARELO, AZUL, corDe } from "../theme";
import { eventoDe, nivelInfo, placarDe, timePorId } from "./regras";

/* --- core/exportacao -----------------------------------------------------*/
function paraCSV(l) {
  return l.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
}
function csvClassificacao(cl) {
  const cab = ["Pos", "Jogador", "Posição", "Estrelas", "P", "%", "J", "V", "E", "D", "GP", "GC", "SG", "Gols", "Ass", "CA", "CV", "P+", "P-", "Atrasos no mês", "Últimos 5"];
  return paraCSV([cab, ...cl.map((l) => [l.posicao, l.nome, l.jogador.posicao, l.estrelas, l.pontos,
  `${l.aproveitamento}%`, l.J, l.V, l.E, l.D, l.GP, l.GC, l.SG, l.gols, l.assistencias, l.CA, l.CV, l.Pmais, l.Pmenos, l.atrasosNoMes, l.ultimos5.join(" ")])]);
}
function csvSumula(rodada, nomes, niveis) {
  const linhas = [["Rodada", rodada.numero, "Data", rodada.data]];
  const atrasados = Object.entries(niveis || {});
  if (atrasados.length) {
    linhas.push([]); linhas.push(["ATRASOS (Art. 34º §8º)", "Jogador", "Nível", "Punição"]);
    for (const [jid, n] of atrasados) linhas.push(["", nomes[jid] || jid, `${n}º`, nivelInfo(n)?.rotulo || ""]);
  }
  if ((rodada.ajustes || []).length) {
    linhas.push([]); linhas.push(["AJUSTES P+ / P−", "Jogador", "Valor", "Motivo"]);
    for (const aj of rodada.ajustes) linhas.push(["", nomes[aj.jogadorId] || aj.jogadorId, aj.valor, aj.motivo || ""]);
  }
  for (const jogo of rodada.jogos || []) {
    const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
    if (!tA || !tB) continue;
    const p = placarDe(jogo, rodada);
    linhas.push([]);
    linhas.push([`PARTIDA ${jogo.numero}`, "AMARELO", p.A, "×", p.B, "AZUL", jogo.encerrado ? "encerrada" : "em aberto"]);
    if (p.divergente) linhas.push(["Divergência", `soma dos gols ${p.calcA}×${p.calcB}`, `placar lançado ${p.A}×${p.B}`]);
    linhas.push(["Gol contra", "AMARELO", jogo.golsContraA || 0, "AZUL", jogo.golsContraB || 0]);
    linhas.push(["Gol não computado", "AMARELO", jogo.golsNaoComputadosA || 0, "AZUL", jogo.golsNaoComputadosB || 0]);
    linhas.push(["Equipe", "Jogador", "Função", "Gols", "Assist.", "CA", "CV", "CAzul", "Atraso", "Observação"]);
    for (const t of [tA, tB]) for (const j of t.jogadores || []) {
      const ev = eventoDe(jogo, j.jogadorId);
      const obs = [...(jogo.completaTime || []), ...(jogo.soCartoes || [])].includes(j.jogadorId)
        ? "Completou equipe (§10º) — não pontua nada, nem cartão" : "";
      linhas.push([t.cor, nomes[j.jogadorId] || j.jogadorId, j.atuaComoGoleiro ? "Goleiro" : "Linha",
      ev.gols, ev.assistencias, ev.ca, ev.cv, ev.cz, niveis?.[j.jogadorId] ? `${niveis[j.jogadorId]}º` : "", obs]);
    }
  }
  return paraCSV(linhas);
}
function textoWhatsApp(partidas, rodada, diag, seed) {
  const data = new Date(rodada.data + "T12:00:00").toLocaleDateString("pt-BR");
  let t = `*CAMPEONATO JPFFS*\nRodada ${rodada.numero} — ${data}\n`;
  for (const p of partidas) {
    t += `\n*── PARTIDA ${p.numero}${p.extra ? " (sobressalentes)" : ""} ──*\n`;
    for (const lado of [p.amarelo, p.azul]) {
      t += `\n${lado.emoji} *${lado.cor}* — ${lado.forca}★\n`;
      for (const v of lado.vagas) {
        if (!v.jogador) { t += `${v.papel === "GOLEIRO" ? "🧤" : "•"} _(vaga em aberto)_\n`; continue; }
        const noGol = v.papel === "GOLEIRO";
        t += `${noGol ? "🧤" : "•"} ${v.jogador.nome} ${"★".repeat(v.jogador.estrelas)}\n`;
      }
    }
  }
  t += `\n⚖️ Equilíbrio ${diag.indiceEquilibrio}% · diferença de ${diag.amplitude}★\n🎲 Sorteio ${seed}`;
  return t;
}

function imagemTabela(cl, cfg, meta) {
  const cols = [
    { k: "posicao", r: "#", w: 46, al: "center" }, { k: "nome", r: "JOGADOR", w: 208, al: "left" },
    { k: "estrelas", r: "CLASSE", w: 82, al: "center" }, { k: "pontos", r: "P", w: 52, al: "right" },
    { k: "aproveitamento", r: "%", w: 56, al: "right" }, { k: "J", r: "J", w: 38, al: "right" },
    { k: "V", r: "V", w: 38, al: "right" }, { k: "E", r: "E", w: 38, al: "right" }, { k: "D", r: "D", w: 38, al: "right" },
    { k: "GP", r: "GP", w: 44, al: "right" }, { k: "GC", r: "GC", w: 44, al: "right" }, { k: "SG", r: "SG", w: 48, al: "right" },
    { k: "gols", r: "GOLS", w: 50, al: "right" }, { k: "assistencias", r: "ASS", w: 46, al: "right" },
    { k: "ultimos5", r: "ÚLT. 5", w: 106, al: "center" },
  ];
  const esc = 2, pad = 26, hCab = 116, hLinha = 34, hHead = 34;
  const larg = cols.reduce((s, c) => s + c.w, 0) + pad * 2;
  const alt = hCab + hHead + cl.length * hLinha + 56;

  const logo = new Image();
  logo.onload = () => desenhar(logo);
  logo.onerror = () => desenhar(null);
  logo.src = ESCUDO;

  function desenhar(escudo) {
    const cv = document.createElement("canvas");
    cv.width = larg * esc; cv.height = alt * esc;
    const x = cv.getContext("2d");
    x.scale(esc, esc); x.textBaseline = "middle";
    const g = x.createLinearGradient(0, 0, 0, alt);
    g.addColorStop(0, T.fundoTopo); g.addColorStop(0.45, "#0a2557"); g.addColorStop(1, T.fundoBase);
    x.fillStyle = g; x.fillRect(0, 0, larg, alt);

    const hEscudo = 70;
    if (escudo) {
      const wEscudo = escudo.width * (hEscudo / escudo.height);
      x.drawImage(escudo, pad, 18, wEscudo, hEscudo);
    }
    const xTexto = pad + (escudo ? escudo.width * (hEscudo / escudo.height) + 18 : 0);
    x.textAlign = "left";
    x.fillStyle = T.ouro; x.font = "900 26px system-ui, sans-serif";
    x.fillText("CAMPEONATO JPFFS", xTexto, 40);
    x.fillStyle = T.texto; x.font = "700 15px system-ui, sans-serif";
    x.fillText("CLASSIFICAÇÃO GERAL", xTexto, 64);
    x.fillStyle = T.secundario; x.font = "400 12px system-ui, sans-serif";
    x.fillText(`${meta.rodadas} rodadas · teto ${meta.teto} pts · P = J + 3V + E + P⁺ − P⁻`, xTexto, 86);
    x.textAlign = "right"; x.fillText(new Date().toLocaleDateString("pt-BR"), larg - pad, 86);

    let y = hCab;
    x.fillStyle = "rgba(255,255,255,0.06)"; x.fillRect(0, y, larg, hHead);
    x.fillStyle = T.ouro; x.fillRect(0, y + hHead - 2, larg, 2);
    x.font = "800 11px system-ui, sans-serif"; x.fillStyle = T.secundario;
    let cx = pad;
    for (const c of cols) {
      x.textAlign = c.al === "center" ? "center" : c.al;
      x.fillText(c.r, c.al === "left" ? cx : c.al === "center" ? cx + c.w / 2 : cx + c.w - 6, y + hHead / 2);
      cx += c.w;
    }
    y += hHead;
    cl.forEach((l, i) => {
      if (i % 2 === 1) { x.fillStyle = "rgba(255,255,255,0.04)"; x.fillRect(0, y, larg, hLinha); }
      if (l.supercopa) { x.fillStyle = T.ouroFraco; x.fillRect(0, y, larg, hLinha); x.fillStyle = T.ouro; x.fillRect(0, y, 4, hLinha); }
      let cx2 = pad;
      for (const c of cols) {
        const cy = y + hLinha / 2;
        x.textAlign = c.al === "center" ? "center" : c.al;
        const px = c.al === "left" ? cx2 : c.al === "center" ? cx2 + c.w / 2 : cx2 + c.w - 6;
        if (c.k === "estrelas") {
          x.font = "13px system-ui, sans-serif"; x.fillStyle = T.ouro;
          x.fillText("★".repeat(l.estrelas), px, cy);
        } else if (c.k === "ultimos5") {
          const w = 16, gap = 3;
          let sx = cx2 + (c.w - (l.ultimos5.length * (w + gap) - gap)) / 2;
          for (const r of l.ultimos5) {
            x.fillStyle = r === "V" ? T.verde : r === "E" ? "#5A76A8" : r === "D" ? T.vermelho : "rgba(255,255,255,.08)";
            x.fillRect(sx, cy - 8, w, 16);
            x.fillStyle = r === "V" || r === "D" ? "#06122b" : T.texto;
            x.font = "800 10px system-ui, sans-serif"; x.textAlign = "center";
            x.fillText(r, sx + w / 2, cy); sx += w + gap;
          }
        } else {
          let v = l[c.k];
          if (c.k === "aproveitamento") v = `${v}%`;
          if (c.k === "SG") v = (l.SG > 0 ? "+" : "") + l.SG;
          x.font = c.k === "pontos" ? "800 15px system-ui, sans-serif" : c.k === "nome" ? "600 13px system-ui, sans-serif" : "400 12px system-ui, sans-serif";
          x.fillStyle = c.k === "pontos" ? T.ouro : c.k === "posicao" ? (l.supercopa ? T.ouro : T.fraco)
            : c.k === "nome" ? T.texto : c.k === "SG" ? (l.SG > 0 ? T.verde : l.SG < 0 ? T.vermelho : T.fraco) : T.secundario;
          if (c.k === "nome" && l.jogador.posicao === "GOLEIRO") {
            x.fillStyle = T.gk; x.font = "800 10px system-ui, sans-serif"; x.fillText("G", px, cy);
            x.fillStyle = T.texto; x.font = "600 13px system-ui, sans-serif"; x.fillText(String(v), px + 14, cy);
          } else x.fillText(String(v), px, cy);
        }
        cx2 += c.w;
      }
      y += hLinha;
    });
    x.textAlign = "left"; x.fillStyle = T.fraco; x.font = "400 11px system-ui, sans-serif";
    x.fillText(`Faixa dourada: zona de classificação da Supercopa (1º ao ${cfg.zonaSupercopa}º)  ·  G = goleiro`, pad, y + 26);
    cv.toBlob((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url; a.download = "jpffs-classificacao.png"; a.click();
      URL.revokeObjectURL(url);
    });
  }
}

function imagemEscalacoes(rodada, nomes, niveis, cfg) {
  const jogos = [...(rodada.jogos || [])].sort((a, b) => a.numero - b.numero);
  const blocos = jogos.map((jogo) => {
    const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
    if (!tA || !tB) return null;
    const soCartoes = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
    const ladoDe = (t) => {
      const jogadores = [...(t.jogadores || [])].sort((a, b) => Number(!!b.atuaComoGoleiro) - Number(!!a.atuaComoGoleiro));
      const itens = jogadores.map((j) => ({
        vaga: false, nome: nomes[j.jogadorId] || "?", goleiro: !!j.atuaComoGoleiro,
        completou: soCartoes.has(j.jogadorId), nivel: niveis?.[j.jogadorId] || 0,
        estrelas: j.estrelaNoSorteio || 1,
      }));
      const vagas = (t.vagasAbertas || []).map((papel) => ({ vaga: true, papel }));
      // conta média por jogador que pontua, não soma bruta — um time ainda com vaga em
      // aberto tem menos gente e por isso soma menos, sem que isso signifique desequilíbrio
      const quePontuam = itens.filter((i) => !i.completou);
      const forca = quePontuam.reduce((s, i) => s + i.estrelas, 0);
      const forcaMedia = quePontuam.length ? forca / quePontuam.length : 0;
      return { cor: t.cor, hex: corDe(t.chave).hex, itens: [...itens, ...vagas], forca, forcaMedia };
    };
    return { numero: jogo.numero, extra: !!jogo.extra, A: ladoDe(tA), B: ladoDe(tB) };
  }).filter(Boolean);
  if (!blocos.length) return;

  const somasForca = blocos.flatMap((b) => [b.A.forcaMedia, b.B.forcaMedia]);
  const mediaForca = somasForca.reduce((s, v) => s + v, 0) / (somasForca.length || 1);
  const amplitudeForca = somasForca.length ? Math.max(...somasForca) - Math.min(...somasForca) : 0;
  const indiceEquilibrio = mediaForca > 0 ? Math.max(0, Math.min(100, Math.round(100 - (amplitudeForca / mediaForca) * 70))) : 100;

  const esc = 2, pad = 24, larg = 680, colGap = 14;
  const hCab = 104, hPartidaHead = 28, hTimeHead = 20, hLinha = 24, gapPartida = 16, gapFinal = 34;
  const colW = (larg - pad * 2 - colGap) / 2;

  let alt = hCab;
  for (const b of blocos) alt += hPartidaHead + 6 + hTimeHead + Math.max(b.A.itens.length, b.B.itens.length, 1) * hLinha + gapPartida;
  alt += gapFinal;

  const logo = new Image();
  logo.onload = () => desenhar(logo);
  logo.onerror = () => desenhar(null);
  logo.src = ESCUDO;

  function desenhar(escudo) {
    const cv = document.createElement("canvas");
    cv.width = larg * esc; cv.height = alt * esc;
    const x = cv.getContext("2d");
    x.scale(esc, esc); x.textBaseline = "middle";
    const g = x.createLinearGradient(0, 0, 0, alt);
    g.addColorStop(0, T.fundoTopo); g.addColorStop(0.45, "#0a2557"); g.addColorStop(1, T.fundoBase);
    x.fillStyle = g; x.fillRect(0, 0, larg, alt);

    const hEscudo = 60;
    if (escudo) {
      const wEscudo = escudo.width * (hEscudo / escudo.height);
      x.drawImage(escudo, pad, 16, wEscudo, hEscudo);
    }
    const xTexto = pad + (escudo ? escudo.width * (hEscudo / escudo.height) + 16 : 0);
    x.textAlign = "left";
    x.fillStyle = T.ouro; x.font = "900 21px system-ui, sans-serif";
    x.fillText("CAMPEONATO JPFFS", xTexto, 34);
    x.fillStyle = T.texto; x.font = "700 13px system-ui, sans-serif";
    x.fillText(`ESCALAÇÕES · RODADA ${rodada.numero}`, xTexto, 54);
    x.fillStyle = T.secundario; x.font = "400 11px system-ui, sans-serif";
    x.fillText(rodada.data ? new Date(rodada.data + "T12:00:00").toLocaleDateString("pt-BR") : "", xTexto, 72);

    const corEq = indiceEquilibrio >= 90 ? T.verde : indiceEquilibrio >= 75 ? T.ouro : T.laranja;
    x.textAlign = "right"; x.fillStyle = T.fraco; x.font = "800 9.5px system-ui, sans-serif";
    x.fillText("EQUILÍBRIO DA RODADA", larg - pad, 28);
    x.fillStyle = corEq; x.font = "900 26px system-ui, sans-serif";
    x.fillText(`${indiceEquilibrio}%`, larg - pad, 54);

    let y = hCab;
    for (const b of blocos) {
      x.fillStyle = "rgba(255,255,255,0.06)"; x.fillRect(pad, y, larg - pad * 2, hPartidaHead);
      x.fillStyle = T.ouro; x.font = "800 12px system-ui, sans-serif"; x.textAlign = "center";
      x.fillText(`PARTIDA ${b.numero}${b.extra ? " · SOBRESSALENTES" : ""}`, larg / 2, y + hPartidaHead / 2);
      y += hPartidaHead + 6;

      const colX = [pad, pad + colW + colGap];
      [b.A, b.B].forEach((t, ci) => {
        x.textAlign = "left"; x.fillStyle = t.hex; x.font = "800 11.5px system-ui, sans-serif";
        x.fillText(t.cor, colX[ci], y + hTimeHead / 2);
        x.textAlign = "right"; x.fillStyle = T.ouro; x.font = "800 11px system-ui, sans-serif";
        x.fillText(`${t.forca}★`, colX[ci] + colW, y + hTimeHead / 2);
      });
      y += hTimeHead;

      const nLinhas = Math.max(b.A.itens.length, b.B.itens.length, 1);
      for (let li = 0; li < nLinhas; li++) {
        [b.A, b.B].forEach((t, ci) => {
          const item = t.itens[li];
          if (!item) return;
          const rowY = y + hLinha / 2;
          if (item.vaga) {
            x.fillStyle = "rgba(255,165,61,.12)"; x.fillRect(colX[ci], y, colW, hLinha - 4);
            x.fillStyle = T.laranja; x.font = "700 10.5px system-ui, sans-serif"; x.textAlign = "left";
            x.fillText(`vaga de ${item.papel === "GOLEIRO" ? "goleiro" : "linha"} em aberto`, colX[ci] + 8, rowY);
            return;
          }
          x.fillStyle = item.completou ? "rgba(255,165,61,.06)" : (li % 2 ? "rgba(255,255,255,0.03)" : "transparent");
          x.fillRect(colX[ci], y, colW, hLinha - 4);
          x.textAlign = "left";
          x.font = item.completou ? "italic 600 11px system-ui, sans-serif" : "600 11px system-ui, sans-serif";
          x.fillStyle = item.completou ? T.fraco : T.texto;
          const textoNome = (item.goleiro ? "G · " : "") + item.nome;
          x.fillText(textoNome, colX[ci] + 8, rowY);
          const wNome = x.measureText(textoNome).width;
          x.font = "10px system-ui, sans-serif";
          x.fillStyle = item.completou ? "rgba(245,197,24,.4)" : T.ouro;
          x.fillText(" " + "★".repeat(item.estrelas), colX[ci] + 10 + wNome, rowY);

          const badges = [];
          if (item.nivel > 0) { const ni = nivelInfo(item.nivel, cfg); if (ni) badges.push(`${ni.curto} atraso`); }
          if (item.completou) badges.push("COMPLETOU");
          if (badges.length) {
            x.textAlign = "right"; x.font = "800 8.5px system-ui, sans-serif"; x.fillStyle = T.laranja;
            x.fillText(badges.join(" · "), colX[ci] + colW - 6, rowY);
          }
        });
        y += hLinha;
      }
      y += gapPartida;
    }

    x.textAlign = "left"; x.fillStyle = T.fraco; x.font = "400 10px system-ui, sans-serif";
    x.fillText("COMPLETOU = entrou só para completar a equipe (Art. 34º §10º), não pontua · badge = nível de atraso na rodada · ★ = classe do jogador no sorteio", pad, alt - 16);

    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `jpffs-escalacoes-r${rodada.numero}.png`; a.click();
      URL.revokeObjectURL(url);
    });
  }
}

function baixarArquivo(nome, conteudo, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

export { paraCSV, csvClassificacao, csvSumula, textoWhatsApp, imagemTabela, imagemEscalacoes, baixarArquivo };
