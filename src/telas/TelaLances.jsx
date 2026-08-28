import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { id as gerarId, enviarLance, listarLances, urlAssinadaLance, excluirLance } from "../core/repositorio";
import { cameraDisponivel, abrirCamera, criarGravador, criarStreamPaisagem } from "../core/lances";
import { Botao, Painel, CabecalhoPagina, Secao, Chip } from "../components/ui";
import { IconeCamera } from "../components/icones";

/* =============================== TELA: LANCES ==============================
 * Etapa 2 da Gravação de Lances (ver supabase-migracoes/004-lances.sql e a
 * memória do projeto). Esta é a TELA DE CÂMERA em modo de teste:
 *
 *  - liga a câmera do aparelho e roda o motor de buffer duplo (core/lances)
 *    mantendo ~15s de história pronta o tempo todo;
 *  - entra num canal Realtime da "partida" (aqui fixa em 'teste-camera') e
 *    usa Presence pra descobrir o número do ângulo (ordem de entrada);
 *  - no sinal "Gol"/"Lance" (fase 1), grava o clipe de ~20s;
 *  - no "Salvar"/"Descartar" (fase 2), faz upload pro bucket privado 'lances'
 *    ou joga fora.
 *
 * "Modo gravação": tela cheia só com o vídeo + infos mínimas, trava a tela
 * acesa (Wake Lock). É como os celulares-câmera vão ficar no dia do jogo —
 * ninguém toca neles depois de posicionar. Os botões Gol/Lance/Salvar aqui são
 * só pra teste; na etapa 3 quem dispara é a TelaRachão do organizador.
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
const rotuloTipo = (t) => (t === "gol" ? "Gol" : "Lance");

const ROTULO_FASE = {
  gravando: { txt: "gravando +5s…", cor: T.laranja },
  aguardando: { txt: "aguardando decisão", cor: T.ouro },
  enviando: { txt: "enviando…", cor: T.gk },
  enviado: { txt: "salvo", cor: T.verde },
  descartado: { txt: "descartado", cor: T.fraco },
  erro: { txt: "falhou", cor: T.vermelho },
};

const pilula = {
  display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,.55)",
  borderRadius: 999, padding: "3px 9px", fontSize: 10.5, fontWeight: 800, color: "#fff",
};

function TelaLances({ perfil, avisar }) {
  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";

  const [suportado] = useState(() => cameraDisponivel());
  const [ligada, setLigada] = useState(false);
  const [modoGravacao, setModoGravacao] = useState(false);
  const [erro, setErro] = useState(null);
  const [estGrav, setEstGrav] = useState({ rodando: false, bufferSegundos: 0, capturando: false, formato: "", largura: 0, altura: 0, retrato: false });
  const [conectado, setConectado] = useState(false);
  const [angulo, setAngulo] = useState(1);
  const [numCameras, setNumCameras] = useState(1);
  const [pendentes, setPendentes] = useState([]); // { id, tipo, fase, erro? }
  const [lances, setLances] = useState([]);
  const [verUrl, setVerUrl] = useState(null);
  const [avisoModo, setAvisoModo] = useState(null); // toast curto dentro do modo gravação
  const [girado, setGirado] = useState(false); // true = stream passa pelo canvas p/ virar paisagem
  const [sentidoGiro, setSentidoGiro] = useState(1); // 1 ou -1 — qual lado girar

  const videoRef = useRef(null);
  const telaRef = useRef(null);
  const streamRef = useRef(null); // o stream que alimenta preview + gravador (já corrigido)
  const streamOrigRef = useRef(null); // stream cru da câmera
  const wrapperRef = useRef(null); // { stream, ehCanvas, parar }
  const gravadorRef = useRef(null);
  const canalRef = useRef(null);
  const capturasRef = useRef(new Map()); // id -> { tipo, clipe: Promise<Blob>|Blob }
  const deviceRef = useRef(idDispositivo());
  const anguloRef = useRef(1);
  const nomeRef = useRef("");
  const wakeLockRef = useRef(null);
  const recarregarTimerRef = useRef(null);

  useEffect(() => { anguloRef.current = angulo; }, [angulo]);
  useEffect(() => { nomeRef.current = perfil?.nome || perfil?.email || "câmera"; }, [perfil]);

  const recarregarLances = () => {
    clearTimeout(recarregarTimerRef.current);
    recarregarTimerRef.current = setTimeout(() => { listarLances(PARTIDA_ID).then(setLances); }, 350);
  };
  useEffect(() => { listarLances(PARTIDA_ID).then(setLances); }, []);
  useEffect(() => () => { desligar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* mantém o <video> preso ao stream quando ele troca de lugar (card <-> tela
   * cheia) — remontar o elemento perde o srcObject. */
  useEffect(() => {
    const v = videoRef.current;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play?.().catch(() => {});
    }
  }, [modoGravacao, ligada]);

  /* toast do modo gravação: reage à última captura mudando de fase. */
  useEffect(() => {
    const ult = pendentes[0];
    if (!ult) return;
    const txt =
      ult.fase === "gravando" ? `Capturando ${ult.tipo}…` :
      ult.fase === "enviando" ? "Enviando…" :
      ult.fase === "enviado" ? `${rotuloTipo(ult.tipo)} salvo ✓` :
      ult.fase === "descartado" ? "Descartado" :
      ult.fase === "erro" ? "Falha ao salvar" : null;
    if (!txt) return;
    setAvisoModo(txt);
    const t = setTimeout(() => setAvisoModo(null), 3500);
    return () => clearTimeout(t);
  }, [pendentes]);

  /* --- Wake Lock (trava a tela acesa) ------------------------------------- */
  async function pedirWakeLock() {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener?.("release", () => { wakeLockRef.current = null; });
      }
    } catch { /* sem suporte / negado — segue sem */ }
  }
  function soltarWakeLock() {
    try { wakeLockRef.current?.release?.(); } catch {}
    wakeLockRef.current = null;
  }
  useEffect(() => {
    if (!modoGravacao) {
      soltarWakeLock();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      return;
    }
    pedirWakeLock();
    telaRef.current?.requestFullscreen?.({ navigationUI: "hide" })
      .then(() => { try { screen.orientation?.lock?.("landscape"); } catch {} })
      .catch(() => {}); // iOS ignora em <div>; o overlay fixo cobre a tela mesmo assim
    const aoVoltar = () => { if (document.visibilityState === "visible") pedirWakeLock(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [modoGravacao]);

  /* --- Captura ----------------------------------------------------------- */
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
      enviarSinal("salvo", {}); // avisa os outros aparelhos pra atualizar a lista
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
      canal.on("broadcast", { event: "salvo" }, () => recarregarLances());
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

  /* (re)monta wrapper de paisagem + gravador em cima do stream cru já aberto. */
  function montarPipeline(sentido) {
    try { gravadorRef.current?.parar(); } catch {}
    try { wrapperRef.current?.parar(); } catch {}
    const w = criarStreamPaisagem(streamOrigRef.current, sentido);
    wrapperRef.current = w;
    setGirado(w.ehCanvas);
    streamRef.current = w.stream;
    if (videoRef.current) {
      videoRef.current.srcObject = w.stream;
      videoRef.current.play?.().catch(() => {});
    }
    const g = criarGravador(w.stream, { aoMudarEstado: setEstGrav });
    gravadorRef.current = g;
    g.iniciar();
  }

  function girarVideo() {
    const novo = sentidoGiro === 1 ? -1 : 1;
    setSentidoGiro(novo);
    if (streamOrigRef.current) montarPipeline(novo);
  }

  async function ligarCamera() {
    setErro(null);
    try {
      const orig = await abrirCamera();
      streamOrigRef.current = orig;
      montarPipeline(sentidoGiro);
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
    setModoGravacao(false);
    soltarWakeLock();
    try { gravadorRef.current?.parar(); } catch {}
    gravadorRef.current = null;
    try { wrapperRef.current?.parar(); } catch {}
    wrapperRef.current = null;
    try { streamOrigRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamOrigRef.current = null;
    if (canalRef.current) { supabase.removeChannel(canalRef.current); canalRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    capturasRef.current.clear();
    setLigada(false);
    setConectado(false);
    setGirado(false);
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
      enviarSinal("salvo", {});
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

  /* ---------- Modo gravação (tela cheia) -------------------------------- */
  if (modoGravacao && ligada) {
    return (
      <div ref={telaRef} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000" }}>
        <video ref={videoRef} muted playsInline autoPlay
          style={{ width: "100%", height: "100%", objectFit: "contain" }} />

        <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: 12, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={pilula}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: estGrav.capturando ? T.laranja : T.vermelho }} />
            {estGrav.capturando ? "CAPTURANDO" : "REC"}
          </span>
          <span style={pilula}>ÂNGULO {angulo}/{numCameras}</span>
          <span style={{ ...pilula, color: conectado ? "#fff" : T.laranja }}>
            {conectado ? `buffer ${estGrav.bufferSegundos}s` : "reconectando…"}
          </span>
          {estGrav.largura > 0 && (
            <span style={{ ...pilula, color: estGrav.retrato ? T.laranja : "#fff" }}>
              {estGrav.largura}×{estGrav.altura}{estGrav.retrato ? " · EM PÉ!" : ""}
            </span>
          )}
        </div>

        <button
          onClick={() => setModoGravacao(false)}
          style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 10px)", right: 12, ...pilula, background: "rgba(0,0,0,.65)", padding: "8px 14px", fontSize: 12 }}>
          ✕ Sair
        </button>

        {estGrav.capturando && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ marginTop: "calc(env(safe-area-inset-top, 0px) + 52px)", background: "rgba(255,165,61,.95)", color: T.sobreOuro, padding: "6px 18px", borderRadius: 999, fontWeight: 900, fontSize: 13, letterSpacing: ".02em" }}>
              ● GRAVANDO LANCE
            </span>
          </div>
        )}

        {avisoModo && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ background: "rgba(0,0,0,.75)", color: "#fff", padding: "8px 18px", borderRadius: 999, fontWeight: 800, fontSize: 13 }}>{avisoModo}</span>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Tela normal --------------------------------------------------- */
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

      {ligada && girado && (
        <Painel className="p-3" style={{ borderColor: T.gk, background: "rgba(59,147,238,.1)" }}>
          <p style={{ fontSize: 12, color: T.gk }}>
            A câmera do aparelho veio “em pé”, então o vídeo está sendo <b>girado pra paisagem</b> automaticamente.
            Se a prévia estiver de cabeça pra baixo ou de lado, toque em <b>Girar vídeo</b>.
          </p>
          <Botao variante="secundario" className="mt-2" onClick={girarVideo} style={{ minHeight: 40, fontSize: 11 }}>
            Girar vídeo
          </Botao>
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
              <span style={pilula}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: estGrav.capturando ? T.laranja : T.vermelho }} />
                {estGrav.capturando ? "CAPTURANDO" : "REC"}
              </span>
              <span style={pilula}>ÂNGULO {angulo}/{numCameras}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3" style={{ gap: 10 }}>
          <div style={{ fontSize: 11.5, color: T.secundario }}>
            {ligada ? (
              <>
                buffer {estGrav.bufferSegundos}s · {conectado ? "canal ok" : "conectando…"}
                {estGrav.largura > 0 ? ` · ${estGrav.largura}×${estGrav.altura}` : ""}
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
        <>
          <Botao className="w-full" onClick={() => setModoGravacao(true)} style={{ minHeight: 52 }}>
            Modo gravação (tela cheia)
          </Botao>
          <p style={{ marginTop: -6, fontSize: 10.5, color: T.fraco, lineHeight: 1.4 }}>
            Deixa só o vídeo na tela e trava a tela acesa — é assim que os celulares-câmera ficam no jogo.
          </p>

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
              Só pra teste — no jogo o sinal vem da tela do Rachão/Campeonato. Enquanto uma captura está nos +5s, novos cliques ficam travados.
            </p>
          </Painel>
        </>
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
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.texto }}>{rotuloTipo(p.tipo)}</span>
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
                    {rotuloTipo(l.tipo)}
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
