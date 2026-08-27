import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { id as gerarId, enviarLance, listarLances, urlAssinadaLance, excluirLance } from "../core/repositorio";
import { cameraDisponivel, abrirCamera, criarGravador } from "../core/lances";
import { Botao, Painel, CabecalhoPagina, Secao, Chip } from "../components/ui";
import { IconeCamera } from "../components/icones";

/* =============================== TELA: LANCES ==============================
 * Etapa 2 da Gravação de Lances (ver supabase-migracoes/004-lances.sql e a
 * memória do projeto). Esta é a TELA DE CÂMERA em modo de teste:
 *
 *  - liga a câmera do aparelho e roda um MediaRecorder contínuo (core/lances)
 *    mantendo os últimos ~15s num buffer local;
 *  - entra num canal Realtime da "partida" (aqui fixa em 'teste-camera') e
 *    usa Presence pra descobrir o número do ângulo (ordem de entrada);
 *  - no sinal "Gol"/"Lance" (fase 1), congela o buffer e grava +5s;
 *  - no "Salvar"/"Descartar" (fase 2), faz upload do clipe pro bucket privado
 *    'lances' ou joga fora.
 *
 * Os botões Gol/Lance/Salvar/Descartar aqui são só pra teste — mandam o sinal
 * pelo mesmo canal, então dá pra testar com um aparelho só (broadcast self) ou
 * com vários na mesma URL (Cloudflare Tunnel). Na etapa 3 quem dispara o sinal
 * é a TelaRachão do organizador; esta tela vira só "câmera burra" escutando.
 * ========================================================================= */

const PARTIDA_ID = "teste-camera";
const MODALIDADE = "rachao";
const CHAVE_DEVICE = "jpffs:camera-device";

function idDispositivo() {
  try {
    let v = localStorage.getItem(CHAVE_DEVICE);
    if (!v) { v = gerarId() + gerarId(); localStorage.setItem(CHAVE_DEVICE, v); }
    return v;
  } catch {
    return gerarId() + gerarId();
  }
}

const msgErro = (e) => e?.message || e?.error_description || String(e);

const ROTULO_FASE = {
  gravando: { txt: "gravando +5s…", cor: T.laranja },
  aguardando: { txt: "aguardando decisão", cor: T.ouro },
  enviando: { txt: "enviando…", cor: T.gk },
  enviado: { txt: "salvo", cor: T.verde },
  descartado: { txt: "descartado", cor: T.fraco },
  erro: { txt: "falhou", cor: T.vermelho },
};

function TelaLances({ perfil, avisar }) {
  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";

  const [suportado] = useState(() => cameraDisponivel());
  const [ligada, setLigada] = useState(false);
  const [erro, setErro] = useState(null);
  const [estGrav, setEstGrav] = useState({ rodando: false, bufferSegundos: 0, capturando: false, formato: "" });
  const [conectado, setConectado] = useState(false);
  const [angulo, setAngulo] = useState(1);
  const [numCameras, setNumCameras] = useState(1);
  const [pendentes, setPendentes] = useState([]); // { id, tipo, fase, erro? }
  const [lances, setLances] = useState([]);
  const [verUrl, setVerUrl] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const gravadorRef = useRef(null);
  const canalRef = useRef(null);
  const capturasRef = useRef(new Map()); // id -> { tipo, clipe: Promise<Blob>|Blob }
  const deviceRef = useRef(idDispositivo());
  const anguloRef = useRef(1);
  const nomeRef = useRef("");

  useEffect(() => { anguloRef.current = angulo; }, [angulo]);
  useEffect(() => {
    nomeRef.current = perfil?.nome || perfil?.email || "câmera";
  }, [perfil]);

  const recarregarLances = () => { listarLances(PARTIDA_ID).then(setLances); };
  useEffect(() => { recarregarLances(); }, []);

  // desliga tudo ao sair da tela
  useEffect(() => () => { desligar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function sumirDepois(pid, ms = 6000) {
    setTimeout(() => setPendentes((ps) => ps.filter((x) => x.id !== pid)), ms);
  }

  function aoDisparo({ id: cid, tipo }) {
    const g = gravadorRef.current;
    if (!g) return;
    const clipe = g.capturar(cid);
    if (!clipe) return; // câmera off ou já capturando (trava local)
    capturasRef.current.set(cid, { tipo, clipe });
    setPendentes((ps) => [{ id: cid, tipo, fase: "gravando" }, ...ps.filter((x) => x.id !== cid)]);
    clipe.then((blob) => {
      const reg = capturasRef.current.get(cid);
      if (reg) reg.clipe = blob;
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "aguardando" } : x)));
    });
  }

  async function aoDecisao({ id: cid, acao, jogadorNome }) {
    const reg = capturasRef.current.get(cid);
    if (acao === "descartar") {
      gravadorRef.current?.descartarCaptura(cid);
      capturasRef.current.delete(cid);
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "descartado" } : x)));
      sumirDepois(cid);
      return;
    }
    if (!reg) return;
    setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "enviando" } : x)));
    try {
      const blob = await Promise.resolve(reg.clipe);
      if (!blob || !blob.size) throw new Error("clipe vazio");
      await enviarLance({
        modalidade: MODALIDADE,
        partidaId: PARTIDA_ID,
        tipo: reg.tipo,
        jogadorNome: jogadorNome || null,
        angulo: anguloRef.current,
        blob,
        formato: gravadorRef.current?.estado?.().formato || blob.type,
      });
      capturasRef.current.delete(cid);
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "enviado" } : x)));
      recarregarLances();
      sumirDepois(cid);
    } catch (e) {
      console.error("Falha ao enviar lance:", e);
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "erro", erro: msgErro(e) } : x)));
    }
  }

  function conectarCanal() {
    return new Promise((resolve) => {
      const canal = supabase.channel(`lances:${PARTIDA_ID}`, {
        config: { presence: { key: deviceRef.current }, broadcast: { self: true } },
      });
      canal.on("presence", { event: "sync" }, () => {
        const st = canal.presenceState();
        const cams = Object.entries(st)
          .map(([k, metas]) => ({ k, entrou: metas[0]?.entrouEm ?? 0 }))
          .sort((a, b) => a.entrou - b.entrou);
        const i = cams.findIndex((c) => c.k === deviceRef.current);
        setAngulo(i >= 0 ? i + 1 : 1);
        setNumCameras(Math.max(1, cams.length));
      });
      canal.on("broadcast", { event: "disparo" }, ({ payload }) => aoDisparo(payload));
      canal.on("broadcast", { event: "decisao" }, ({ payload }) => aoDecisao(payload));
      canal.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          canal.track({ nome: nomeRef.current, entrouEm: Date.now() });
          setConectado(true);
          resolve();
        }
      });
      canalRef.current = canal;
    });
  }

  async function ligarCamera() {
    setErro(null);
    try {
      const stream = await abrirCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play?.().catch(() => {});
      }
      const g = criarGravador(stream, { aoMudarEstado: setEstGrav });
      gravadorRef.current = g;
      g.iniciar();
      await conectarCanal();
      setLigada(true);
    } catch (e) {
      console.error("Falha ao ligar a câmera:", e);
      setErro(
        e?.name === "NotAllowedError"
          ? "Permissão de câmera negada. Libere o acesso à câmera para este site e tente de novo."
          : e?.name === "NotFoundError"
          ? "Nenhuma câmera encontrada neste aparelho."
          : msgErro(e)
      );
      desligar();
    }
  }

  function desligar() {
    try { gravadorRef.current?.parar(); } catch {}
    gravadorRef.current = null;
    if (canalRef.current) { supabase.removeChannel(canalRef.current); canalRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    capturasRef.current.clear();
    setLigada(false);
    setConectado(false);
    setPendentes([]);
  }

  function enviarSinal(evento, payload) {
    canalRef.current?.send({ type: "broadcast", event: evento, payload });
  }

  async function apagarLance(l) {
    if (!confirm("Apagar este clipe de teste de vez (vídeo + registro)?")) return;
    try {
      await excluirLance(l);
      recarregarLances();
      avisar?.("Clipe apagado");
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  if (!suportado) {
    return (
      <div className="space-y-4">
        <CabecalhoPagina titulo="Lances" descricao="Gravação automática de gols e lances." />
        <Painel className="p-4" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.1)" }}>
          <p style={{ fontSize: 13, color: T.laranja }}>
            Este navegador não tem suporte a gravação de vídeo (MediaRecorder / câmera).
            Use o Chrome ou o Safari num celular, com o site aberto em HTTPS.
          </p>
        </Painel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Lances"
        descricao="Modo de teste — clipes de ~20s vão para a partida “teste-camera” no bucket privado. Ligue a câmera, deixe o celular apoiado filmando o campo e use Gol/Lance para simular o sinal."
      />

      {erro && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)" }}>
          <p style={{ fontSize: 12.5, color: T.vermelho }}>{erro}</p>
        </Painel>
      )}

      <Painel className="overflow-hidden">
        <div style={{ position: "relative", background: "#000", aspectRatio: "16 / 9" }}>
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "cover", display: ligada ? "block" : "none" }}
          />
          {!ligada && (
            <div className="flex h-full w-full flex-col items-center justify-center" style={{ gap: 10, color: T.fraco }}>
              <IconeCamera tam={34} cor={T.fraco} />
              <span style={{ fontSize: 12 }}>câmera desligada</span>
            </div>
          )}
          {ligada && (
            <div className="flex items-center" style={{ position: "absolute", top: 8, left: 8, gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "3px 9px", fontSize: 10.5, fontWeight: 800, color: "#fff" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: estGrav.capturando ? T.laranja : T.vermelho }} />
                {estGrav.capturando ? "CAPTURANDO" : "REC"}
              </span>
              <span style={{ background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "3px 9px", fontSize: 10.5, fontWeight: 800, color: "#fff" }}>
                ÂNGULO {angulo}/{numCameras}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3" style={{ gap: 10 }}>
          <div style={{ fontSize: 11.5, color: T.secundario }}>
            {ligada ? (
              <>
                buffer {estGrav.bufferSegundos}s · {conectado ? "canal ok" : "conectando…"}
                {estGrav.formato ? ` · ${estGrav.formato.replace("video/", "")}` : ""}
              </>
            ) : (
              "pronto para ligar"
            )}
          </div>
          {ligada ? (
            <Botao variante="secundario" onClick={desligar} style={{ minHeight: 40, fontSize: 11 }}>Desligar</Botao>
          ) : (
            <Botao onClick={ligarCamera} style={{ minHeight: 40, fontSize: 11 }}>Ligar câmera</Botao>
          )}
        </div>
      </Painel>

      {ligada && (
        <Painel className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <Botao
              disabled={!conectado || estGrav.capturando}
              onClick={() => enviarSinal("disparo", { id: gerarId(), tipo: "gol" })}
              style={{ minHeight: 56 }}
            >
              Gol
            </Botao>
            <Botao
              variante="secundario"
              disabled={!conectado || estGrav.capturando}
              onClick={() => enviarSinal("disparo", { id: gerarId(), tipo: "lance" })}
              style={{ minHeight: 56 }}
            >
              Lance
            </Botao>
          </div>
          <p style={{ marginTop: 8, fontSize: 10.5, color: T.fraco, lineHeight: 1.4 }}>
            O sinal vai para todas as câmeras no canal. Enquanto uma captura está nos +5s, novos cliques ficam travados.
          </p>
        </Painel>
      )}

      {pendentes.length > 0 && (
        <section>
          <Secao titulo="Capturas" detalhe={`${pendentes.length}`} />
          <div className="space-y-1.5">
            {pendentes.map((p) => {
              const f = ROTULO_FASE[p.fase] || ROTULO_FASE.aguardando;
              return (
                <Painel key={p.id} className="p-3">
                  <div className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.texto }}>
                      {p.tipo === "gol" ? "Gol" : "Lance"}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", color: f.cor }}>
                      {f.txt.toUpperCase()}
                    </span>
                  </div>
                  {p.fase === "erro" && p.erro && (
                    <p style={{ marginTop: 4, fontSize: 10.5, color: T.vermelho }}>{p.erro}</p>
                  )}
                  {p.fase === "aguardando" && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Botao onClick={() => enviarSinal("decisao", { id: p.id, acao: "salvar" })} style={{ minHeight: 40, fontSize: 11 }}>
                        Salvar
                      </Botao>
                      <Botao variante="secundario" onClick={() => enviarSinal("decisao", { id: p.id, acao: "descartar" })} style={{ minHeight: 40, fontSize: 11 }}>
                        Descartar
                      </Botao>
                    </div>
                  )}
                </Painel>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <Secao titulo="Clipes de teste" detalhe={`${lances.length}`} />
        {lances.length === 0 ? (
          <Painel className="p-4 text-center" style={{ borderStyle: "dashed" }}>
            <p style={{ fontSize: 12, color: T.fraco }}>Nenhum clipe salvo ainda nesta partida de teste.</p>
          </Painel>
        ) : (
          <div className="space-y-1.5">
            {lances.map((l) => (
              <Painel key={l.id} className="flex items-center justify-between p-3" style={{ gap: 8 }}>
                <div className="min-w-0">
                  <p style={{ fontSize: 12.5, color: T.texto }}>
                    {l.tipo === "gol" ? "Gol" : "Lance"}
                    {l.jogador_nome ? ` · ${l.jogador_nome}` : ""}
                    <Chip contorno>ângulo {l.angulo}</Chip>
                  </p>
                  <p style={{ fontSize: 10.5, color: T.fraco }}>
                    {new Date(l.criado_em).toLocaleString("pt-BR")} · {(l.formato || "").replace("video/", "")}
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
                  {souOrganizador && (
                    <Botao variante="perigo" onClick={() => apagarLance(l)} style={{ minHeight: 36, fontSize: 10.5 }}>
                      Apagar
                    </Botao>
                  )}
                </div>
              </Painel>
            ))}
          </div>
        )}
      </section>

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
    </div>
  );
}

export { TelaLances };
