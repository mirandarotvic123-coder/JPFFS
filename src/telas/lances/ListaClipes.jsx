import React, { useState } from "react";
import { T } from "../../theme";
import { urlAssinadaLance } from "../../core/repositorio";
import { Botao, Painel, Secao, Chip } from "../../components/ui";

const rotuloTipo = (t) => (t === "gol" ? "Gol" : "Lance");
const msgErro = (e) => e?.message || e?.error_description || String(e);

/* Lista de clipes + player em tela cheia. Usada pela Galeria (todo mundo) e
 * pela tela de Câmera (o operador confere se o ângulo dele subiu). */
function ListaClipes({ lances, titulo = "Clipes", vazio = "Nenhum clipe ainda.", souOrganizador, onApagar }) {
  const [verUrl, setVerUrl] = useState(null);
  const [erro, setErro] = useState(null);

  return (
    <section>
      <Secao titulo={titulo} detalhe={`${lances.length}`} />
      {erro && <p style={{ margin: "0 0 8px", fontSize: 11, color: T.vermelho }}>{erro}</p>}

      {lances.length === 0 ? (
        <Painel className="p-4 text-center" style={{ borderStyle: "dashed" }}>
          <p style={{ fontSize: 12, color: T.fraco }}>{vazio}</p>
        </Painel>
      ) : (
        <div className="space-y-1.5">
          {lances.map((l) => (
            <Painel key={l.id} className="flex items-center justify-between p-3" style={{ gap: 8 }}>
              <div className="min-w-0">
                <p style={{ fontSize: 12.5, color: T.texto }}>
                  {rotuloTipo(l.tipo)}
                  {l.jogador_nome ? ` · ${l.jogador_nome}` : ""}
                  <Chip contorno>ângulo {l.angulo}</Chip>
                </p>
                <p style={{ fontSize: 10.5, color: T.fraco }}>
                  {new Date(l.criado_em).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
                <Botao
                  variante="secundario"
                  onClick={() => urlAssinadaLance(l.caminho_storage).then(setVerUrl).catch((e) => setErro(msgErro(e)))}
                  style={{ minHeight: 36, fontSize: 10.5 }}
                >
                  Ver
                </Botao>
                {souOrganizador && onApagar && (
                  <Botao variante="perigo" onClick={() => onApagar(l)} style={{ minHeight: 36, fontSize: 10.5 }}>
                    Apagar
                  </Botao>
                )}
              </div>
            </Painel>
          ))}
        </div>
      )}

      {verUrl && (
        <div
          onClick={() => setVerUrl(null)}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <video
            src={verUrl}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, background: "#000" }}
          />
        </div>
      )}
    </section>
  );
}

export { ListaClipes };
