import React, { useState } from "react";
import { T } from "../../theme";
import { urlAssinadaLance, tituloLance } from "../../core/repositorio";
import { Botao, Painel, Secao } from "../../components/ui";

const msgErro = (e) => e?.message || e?.error_description || String(e);

/* Uma linha de clipe: título automático + Ver + (Apagar, se organizador). */
function LinhaClipe({ l, souOrganizador, onApagar, onVer }) {
  return (
    <Painel className="flex items-center justify-between p-3" style={{ gap: 8 }}>
      <p className="min-w-0" style={{ fontSize: 12.5, color: T.texto, lineHeight: 1.35 }}>
        {tituloLance(l)}
      </p>
      <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
        <Botao variante="secundario" onClick={() => onVer(l)} style={{ minHeight: 36, fontSize: 10.5 }}>Ver</Botao>
        {souOrganizador && onApagar && (
          <Botao variante="perigo" onClick={() => onApagar(l)} style={{ minHeight: 36, fontSize: 10.5 }}>Apagar</Botao>
        )}
      </div>
    </Painel>
  );
}

/* Lista de clipes + player em tela cheia. `grupos` opcional: [{ chave, rotulo, itens }].
 * Se vier `lances` (lista plana), renderiza sem agrupar. */
function ListaClipes({ lances, grupos, titulo = "Clipes", vazio = "Nenhum clipe ainda.", souOrganizador, onApagar }) {
  const [verUrl, setVerUrl] = useState(null);
  const [erro, setErro] = useState(null);

  const abrir = (l) =>
    urlAssinadaLance(l.caminho_storage).then(setVerUrl).catch((e) => setErro(msgErro(e)));

  const total = grupos ? grupos.reduce((n, g) => n + g.itens.length, 0) : (lances?.length ?? 0);
  const vazioDeVerdade = total === 0;

  return (
    <section>
      <Secao titulo={titulo} detalhe={`${total}`} />
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
                {g.itens.map((l) => (
                  <LinhaClipe key={l.id} {...{ l, souOrganizador, onApagar }} onVer={abrir} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {lances.map((l) => (
            <LinhaClipe key={l.id} {...{ l, souOrganizador, onApagar }} onVer={abrir} />
          ))}
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
