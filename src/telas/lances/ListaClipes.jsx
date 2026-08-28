import React, { useState } from "react";
import { T } from "../../theme";
import { urlAssinadaLance, tituloLance, nomeArquivoLance } from "../../core/repositorio";
import { Botao, Painel, Secao } from "../../components/ui";

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

/* Uma linha de clipe: título automático + Ver + Baixar + (Apagar, só organizador). */
function LinhaClipe({ l, souOrganizador, onApagar, onVer, onBaixar, baixando }) {
  return (
    <Painel className="p-3" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <p className="min-w-0" style={{ fontSize: 12.5, color: T.texto, lineHeight: 1.35, flex: "1 1 140px" }}>
        {tituloLance(l)}
      </p>
      <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
        <Botao variante="secundario" onClick={() => onVer(l)} style={{ minHeight: 36, fontSize: 10.5 }}>Ver</Botao>
        <Botao variante="secundario" onClick={() => onBaixar(l)} disabled={baixando} style={{ minHeight: 36, fontSize: 10.5 }}>
          {baixando ? "…" : "Baixar"}
        </Botao>
        {souOrganizador && onApagar && (
          <Botao variante="perigo" onClick={() => onApagar(l)} style={{ minHeight: 36, fontSize: 10.5 }}>Apagar</Botao>
        )}
      </div>
    </Painel>
  );
}

/* Lista de clipes + player em tela cheia. `grupos` opcional: [{ chave, rotulo, itens }].
 * Se vier `lances` (lista plana), renderiza sem agrupar. Ver e Baixar são pra
 * todo mundo; Apagar só aparece pro organizador (e a RLS barra no servidor). */
function ListaClipes({ lances, grupos, titulo = "Clipes", vazio = "Nenhum clipe ainda.", souOrganizador, onApagar }) {
  const [verUrl, setVerUrl] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [baixandoId, setBaixandoId] = useState(null);

  const abrir = (l) =>
    urlAssinadaLance(l.caminho_storage).then(setVerUrl).catch((e) => setErro(msgErro(e)));

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
              <div className="space-y-1.5">
                {g.itens.map((l) => <LinhaClipe key={l.id} {...props(l)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {lances.map((l) => <LinhaClipe key={l.id} {...props(l)} />)}
        </div>
      )}

      {verUrl && (
        <div onClick={() => setVerUrl(null)}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <video src={verUrl} controls autoPlay playsInline onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, background: "#000" }} />
        </div>
      )}
    </section>
  );
}

export { ListaClipes };
