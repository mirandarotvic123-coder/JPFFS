import React, { useState } from "react";
import { T } from "../../theme";
import { urlAssinadaLance, tituloLance, nomeArquivoLance } from "../../core/repositorio";
import { Botao, Painel, Secao } from "../../components/ui";
import { IconeDownload, IconeLixeira, IconePlay } from "../../components/icones";

const msgErro = (e) => e?.message || e?.error_description || String(e);

/* Baixa o clipe no aparelho. No celular tenta o menu "compartilhar" do
 * sistema (que tem "Salvar vídeo"); senão, link de download comum. */
async function baixarClipe(l, aoErro, aoAviso) {
  try {
    aoAviso?.("Preparando download…");
    const url = await urlAssinadaLance(l.caminho_storage);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("falha ao buscar o vídeo");
    const blob = await resp.blob();
    const nome = nomeArquivoLance(l);
    const arquivo = new File([blob], nome, { type: blob.type || "video/mp4" });

    if (navigator.canShare?.({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo] }); aoAviso?.(null); return; }
      catch (e) { if (e?.name === "AbortError") { aoAviso?.(null); return; } }
    }

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 15000);
    aoAviso?.(null);
  } catch (e) {
    aoAviso?.(null);
    aoErro?.(msgErro(e));
  }
}

/* Os ângulos de um mesmo lance chegam como linhas separadas (cada câmera sobe
 * o seu arquivo). Junta num cartão só quem é da mesma partida + tipo + jogador
 * e subiu até JUNTAR_MS depois do anterior — e nunca dois do mesmo ângulo no
 * mesmo cartão (ângulo repetido vira cartão próprio, pra não esconder nada). */
const JUNTAR_MS = 90 * 1000;

function juntarAngulos(itens) {
  const asc = [...itens].sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
  const lances = [];
  for (const l of asc) {
    const t = new Date(l.criado_em).getTime();
    const chave = `${l.partida_id}|${l.tipo}|${(l.jogador_nome || "").trim()}`;
    let alvo = null;
    for (let k = lances.length - 1; k >= 0; k--) {
      const g = lances[k];
      if (t - g.ultimo > JUNTAR_MS) break;
      if (g.chave === chave && !g.angulos.some((x) => x.angulo === l.angulo)) { alvo = g; break; }
    }
    if (alvo) { alvo.angulos.push(l); alvo.ultimo = t; }
    else lances.push({ chave, id: l.id, ultimo: t, angulos: [l] });
  }
  for (const g of lances) g.angulos.sort((a, b) => a.angulo - b.angulo);
  return lances.reverse(); // mais recente primeiro
}

const botaoIcone = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
  border: `1px solid ${T.tier4}`, background: "transparent", color: T.secundario,
};

/* Um ângulo dentro do cartão: Ver + Baixar + (Apagar, só organizador). */
function CelulaAngulo({ l, souOrganizador, onApagar, onVer, onBaixar, baixando }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 8, background: "rgba(0,0,0,.2)", border: `1px solid ${T.borda}` }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.secundario }}>
        Ângulo {l.angulo}
      </span>
      <div className="flex items-center" style={{ gap: 5 }}>
        <Botao variante="secundario" onClick={() => onVer([l])} className="flex items-center justify-center"
          style={{ flex: 1, minWidth: 0, minHeight: 34, height: 34, gap: 5, padding: "0 8px", fontSize: 10.5 }}>
          <IconePlay tam={12} /> Ver
        </Botao>
        <button onClick={() => onBaixar(l)} disabled={baixando} title="Baixar" style={{ ...botaoIcone, opacity: baixando ? 0.4 : 1 }}>
          {baixando ? "…" : <IconeDownload tam={15} />}
        </button>
        {souOrganizador && onApagar && (
          <button onClick={() => onApagar(l)} title="Apagar este ângulo"
            style={{ ...botaoIcone, color: T.vermelho, borderColor: "rgba(255,107,107,.45)" }}>
            <IconeLixeira tam={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* Um lance: título (sem o ângulo) + os ângulos lado a lado. Com 2+ ângulos,
 * "Ver juntos" abre os vídeos lado a lado no player. */
function CartaoLance({ lance, props, onVer }) {
  const { angulos } = lance;
  return (
    <Painel className="p-3">
      <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 8 }}>
        <p className="min-w-0" style={{ fontSize: 12.5, fontWeight: 700, color: T.texto, lineHeight: 1.35 }}>
          {tituloLance(angulos[0], { semAngulo: true })}
        </p>
        {angulos.length > 1 && (
          <button onClick={() => onVer(angulos)} className="flex items-center"
            style={{ gap: 5, flexShrink: 0, padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.ouro}`, color: T.ouro, fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>
            <IconePlay tam={11} cor={T.ouro} /> Ver juntos
          </button>
        )}
      </div>
      <div className="clipe-angulos" style={angulos.length > 2 ? { gridTemplateColumns: `repeat(${angulos.length}, minmax(0, 1fr))` } : undefined}>
        {angulos.map((l) => <CelulaAngulo key={l.id} {...props(l)} />)}
      </div>
    </Painel>
  );
}

/* Player em tela cheia: 1 vídeo, ou vários lado a lado (com o aparelho em pé,
 * um embaixo do outro). Só o primeiro sai com som, pra não embolar o áudio. */
function Player({ urls, onFechar }) {
  const paisagem = window.innerWidth >= window.innerHeight;
  const varios = urls.length > 1;
  return (
    <div onClick={onFechar}
      style={{
        position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.88)", padding: 16,
        display: "flex", flexDirection: paisagem ? "row" : "column", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
      {urls.map((u, i) => (
        <video key={u} src={u} controls autoPlay playsInline muted={i > 0} onClick={(e) => e.stopPropagation()}
          style={varios
            ? { flex: "1 1 0", minWidth: 0, minHeight: 0, width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }
            : { maxWidth: "100%", maxHeight: "100%", borderRadius: 10, background: "#000" }} />
      ))}
      {varios && (
        <button onClick={onFechar} title="Fechar"
          style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 16 }}>✕</button>
      )}
    </div>
  );
}

/* Lista de clipes + player em tela cheia. `grupos` opcional: [{ chave, rotulo, itens }].
 * Se vier `lances` (lista plana), renderiza sem agrupar por partida. Nos dois
 * casos os ângulos do mesmo lance viram um cartão só. Ver e Baixar são pra
 * todo mundo; Apagar só aparece pro organizador (e a RLS barra no servidor). */
function ListaClipes({ lances, grupos, titulo = "Clipes", vazio = "Nenhum clipe ainda.", souOrganizador, onApagar }) {
  const [verUrls, setVerUrls] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [baixandoId, setBaixandoId] = useState(null);

  const abrir = (lista) =>
    Promise.all(lista.map((l) => urlAssinadaLance(l.caminho_storage)))
      .then(setVerUrls)
      .catch((e) => setErro(msgErro(e)));

  const baixar = async (l) => {
    setErro(null);
    setBaixandoId(l.id);
    await baixarClipe(l, setErro, setAviso);
    setBaixandoId(null);
  };

  const props = (l) => ({
    l, souOrganizador, onApagar, onVer: abrir, onBaixar: baixar, baixando: baixandoId === l.id,
  });

  const total = grupos ? grupos.reduce((n, g) => n + g.itens.length, 0) : (lances?.length ?? 0);
  const vazioDeVerdade = total === 0;
  const cartoes = (itens) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {juntarAngulos(itens).map((g) => <CartaoLance key={g.id} lance={g} props={props} onVer={abrir} />)}
    </div>
  );

  return (
    <section>
      <Secao titulo={titulo} detalhe={`${total}`} />
      {aviso && <p style={{ margin: "0 0 8px", fontSize: 11, color: T.secundario }}>{aviso}</p>}
      {erro && <p style={{ margin: "0 0 8px", fontSize: 11, color: T.vermelho }}>{erro}</p>}

      {vazioDeVerdade ? (
        <Painel className="p-4 text-center" style={{ borderStyle: "dashed" }}>
          <p style={{ fontSize: 12, color: T.fraco }}>{vazio}</p>
        </Painel>
      ) : grupos ? (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.chave}>
              <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.ouro }}>
                {g.rotulo} · {g.itens.length}
              </p>
              {cartoes(g.itens)}
            </div>
          ))}
        </div>
      ) : (
        cartoes(lances)
      )}

      {verUrls && <Player urls={verUrls} onFechar={() => setVerUrls(null)} />}
    </section>
  );
}

export { ListaClipes };
