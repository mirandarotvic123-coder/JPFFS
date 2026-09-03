import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T } from "../theme";
import { id as gerarId, enviarLance, listarLances, excluirLance } from "../core/repositorio";
import { cameraDisponivel, abrirCamera, criarStreamVertical, criarGravador } from "../core/lances";
import { Botao, Painel, CabecalhoPagina, Secao } from "../components/ui";
import { IconeCamera } from "../components/icones";
import { ListaClipes } from "./lances/ListaClipes";

/* =============================== TELA: CÂMERA ============================
 * Aberta pelo link separado (?camera=1) — mandado só pra quem vai
 * disponibilizar o celular. Liga a câmera, entra no canal Realtime da
 * "partida" (fixa em 'teste-camera'), Presence define o ângulo, no sinal
 * Gol/Lance grava ~20s e sobe pro bucket privado 'lances'.
 *
 * "Modo gravação": tela cheia só com o vídeo + wake lock — como o celular
 * fica no jogo. Os botões Gol/Lance/Salvar aqui são só de teste; no jogo o
 * sinal vem da tela do Rachão/Campeonato (etapa 3).
 * ======================================================================= */

/* A partida vem na URL do link de câmera (?camera=1&p=...&r=...). Sem isso,
 * cai no modo de teste. */
const PARAMS = new URLSearchParams(window.location.search);
const PARTIDA_ID = PARAMS.get("p") || "teste-camera";
const PARTIDA_ROTULO = PARAMS.get("r") || "Teste";

/* Formato do `p`:
 *  - dia-<AAAA-MM-DD>     -> link DO DIA: uma câmera cobre Campeonato E Rachão
 *      da data. A partida/modalidade de cada clipe vem no sinal `disparo`.
 *  - camp-<rodada>        -> link da rodada do Campeonato (compat).
 *  - camp-<rodada>-<jogo> -> link antigo por partida (compat).
 *  - rachao-<sessao>      -> link do rachão (compat).
 *  - teste-camera         -> modo de teste.
 * O canal Realtime é sempre `lances:<PARTIDA_ID>` — os gatilhos do Rachão e do
 * Campeonato emitem no mesmo canal quando é `dia-<data>`. */
const LINK_DIA = /^dia-\d{4}-\d{2}-\d{2}$/.test(PARTIDA_ID);
const LINK_RODADA = PARTIDA_ID.startsWith("camp-") && PARTIDA_ID.split("-").length === 2;
const MODALIDADE = PARTIDA_ID.startsWith("camp-") ? "campeonato" : "rachao"; // fallback — no dia/rodada vem no sinal

function filtroListaClipes() {
  if (LINK_DIA) {
    const inicio = new Date(`${PARTIDA_ID.slice(4)}T00:00:00`);
    return { desde: inicio.toISOString(), ate: new Date(inicio.getTime() + 864e5).toISOString() };
  }
  if (LINK_RODADA) return { partidaPrefixo: `${PARTIDA_ID}-` };
  return PARTIDA_ID;
}
const FILTRO_LISTA = filtroListaClipes();
const CHAVE_DEVICE = "jpffs:camera-device";
const CHAVE_ORIENTACAO = "jpffs:camera-orientacao"; // 'h' (padrão) | 'v'

function lerOrientacao() {
  try { return localStorage.getItem(CHAVE_ORIENTACAO) === "v" ? "v" : "h"; }
  catch { return "h"; }
}

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

function TelaCamera({ perfil, avisar }) {
  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";

  const [suportado] = useState(() => cameraDisponivel());
  const [orientacao, setOrientacao] = useState(lerOrientacao); // 'h' | 'v'
  const [travado, setTravado] = useState(false); // recorder sem chunks há >3s (tela preta)
  const [ligada, setLigada] = useState(false);
  const [modoGravacao, setModoGravacao] = useState(false);
  const [erro, setErro] = useState(null);
  const [estGrav, setEstGrav] = useState({ rodando: false, bufferSegundos: 0, capturando: false, formato: "" });
  const [dimVid, setDimVid] = useState(null); // { w, h, retrato } — lido do <video> (getSettings mente no iOS)
  const [conectado, setConectado] = useState(false);
  const [angulo, setAngulo] = useState(1);
  const [numCameras, setNumCameras] = useState(1);
  const [pendentes, setPendentes] = useState([]); // { id, tipo, fase, erro? }
  const [lances, setLances] = useState([]);
  const [avisoModo, setAvisoModo] = useState(null); // toast curto dentro do modo gravação

  const videoRef = useRef(null);
  const telaRef = useRef(null);
  const streamRef = useRef(null);      // o que vai pro <video> e pro gravador (canvas vertical, ou cru no fallback)
  const streamRawRef = useRef(null);   // câmera crua — precisa parar à parte
  const streamVertRef = useRef(null);  // controlador do canvas vertical { stream, fonte, encerrar }
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
  useEffect(() => { try { localStorage.setItem(CHAVE_ORIENTACAO, orientacao); } catch { /* sem storage */ } }, [orientacao]);

  /* Detector de tela preta: se os chunks pararem de chegar (recorder travou com
   * a tela apagada / app em segundo plano), avisa e oferece "retomar". */
  useEffect(() => {
    if (!ligada) { setTravado(false); return; }
    const iv = setInterval(() => {
      const st = gravadorRef.current?.estado?.();
      const preso = !!st && st.rodando && st.segSemDados >= 3;
      setTravado(preso);
      if (preso) pedirWakeLock();
    }, 1000);
    return () => clearInterval(iv);
  }, [ligada]);

  async function retomar() {
    setTravado(false);
    await pedirWakeLock();
    try { await videoRef.current?.play?.(); } catch { /* nada */ }
    const track = streamRawRef.current?.getVideoTracks?.()[0];
    if (!track || track.readyState === "ended") {
      // a câmera morreu de vez — reabre tudo
      desligar();
      await ligarCamera();
      return;
    }
    gravadorRef.current?.reiniciarGravadores?.();
  }

  const recarregarLances = () => {
    clearTimeout(recarregarTimerRef.current);
    recarregarTimerRef.current = setTimeout(() => { listarLances(FILTRO_LISTA).then(setLances); }, 350);
  };
  useEffect(() => { listarLances(FILTRO_LISTA).then(setLances); }, []);
  useEffect(() => () => { desligar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* mantém o <video> preso ao stream quando ele troca de lugar (card <-> tela cheia) */
  useEffect(() => {
    const v = videoRef.current;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play?.().catch(() => {});
    }
  }, [modoGravacao, ligada]);

  /* orientação real: dimensões do <video> + orientação da tela (o iOS reporta
   * o vídeo como "deitado" mesmo com o celular em pé e a imagem certa). */
  useEffect(() => {
    if (!ligada) { setDimVid(null); return; }
    const v = videoRef.current;
    if (!v) return;
    const ler = () => {
      const w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) return;
      const f = streamVertRef.current?.fonte?.() || null;
      // com o canvas vertical, o <video> já é 720×1280 -> sempre retrato.
      // sem ele (fallback), vale a dimensão crua.
      setDimVid({
        w, h,
        retrato: h >= w,
        corrigindo: !!f?.corrigindo,        // fonte deitada + celular em pé -> girando
        fonteDeitada: !!f?.deitada && !f?.corrigindo, // celular também deitado -> corta muito
      });
    };
    ler();
    v.addEventListener("loadedmetadata", ler);
    v.addEventListener("resize", ler);
    window.addEventListener("orientationchange", ler);
    window.addEventListener("resize", ler);
    const iv = setInterval(ler, 1500);
    return () => {
      v.removeEventListener("loadedmetadata", ler);
      v.removeEventListener("resize", ler);
      window.removeEventListener("orientationchange", ler);
      window.removeEventListener("resize", ler);
      clearInterval(iv);
    };
  }, [ligada, modoGravacao]);

  /* toast do modo gravação */
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

  /* --- Wake Lock (trava a tela acesa) --------------------------------- */
  async function pedirWakeLock() {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener?.("release", () => { wakeLockRef.current = null; });
      }
    } catch { /* sem suporte / negado */ }
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
    telaRef.current?.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
    const aoVoltar = () => { if (document.visibilityState === "visible") pedirWakeLock(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [modoGravacao]);

  /* --- Captura ------------------------------------------------------- */
  function sumirDepois(pid, ms = 6000) {
    setTimeout(() => setPendentes((ps) => ps.filter((x) => x.id !== pid)), ms);
  }

  function aoDisparo({ id: cid, tipo, modalidade, partidaId, partidaRotulo }) {
    const g = gravadorRef.current;
    if (!g) return;
    const clipe = g.capturar(cid);
    if (!clipe) return; // câmera off ou já capturando (trava local)
    capturasRef.current.set(cid, {
      tipo: tipo || "lance",
      modalidade: modalidade || MODALIDADE,
      partidaId: partidaId || PARTIDA_ID,       // link da rodada: a partida vem no sinal
      partidaRotulo: partidaRotulo || PARTIDA_ROTULO,
      clipe,
    });
    setPendentes((ps) => [{ id: cid, tipo: tipo || "lance", fase: "gravando" }, ...ps.filter((x) => x.id !== cid)]);
    clipe.then((blob) => {
      const reg = capturasRef.current.get(cid);
      if (reg) reg.clipe = blob;
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "aguardando" } : x)));
    });
  }

  async function aoDecisao({ id: cid, acao, jogadorNome, tipo: tipoDecisao }) {
    const reg = capturasRef.current.get(cid);
    if (acao === "descartar") {
      gravadorRef.current?.descartarCaptura(cid);
      capturasRef.current.delete(cid);
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "descartado" } : x)));
      sumirDepois(cid);
      return;
    }
    if (!reg) return;
    const tipoFinal = tipoDecisao || reg.tipo;
    setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "enviando", tipo: tipoFinal } : x)));
    try {
      const blob = await Promise.resolve(reg.clipe);
      if (!blob || !blob.size) throw new Error("clipe vazio");
      await enviarLance({
        modalidade: reg.modalidade || MODALIDADE,
        partidaId: reg.partidaId || PARTIDA_ID,
        partidaRotulo: reg.partidaRotulo || PARTIDA_ROTULO,
        tipo: tipoFinal,
        jogadorNome: jogadorNome || null,
        angulo: anguloRef.current,
        blob,
        formato: gravadorRef.current?.estado?.().formato || blob.type,
      });
      capturasRef.current.delete(cid);
      setPendentes((ps) => ps.map((x) => (x.id === cid ? { ...x, fase: "enviado" } : x)));
      recarregarLances();
      enviarSinal("salvo", {});
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

  async function ligarCamera() {
    setErro(null);
    try {
      const raw = await abrirCamera();
      streamRawRef.current = raw;

      /* HORIZONTAL: grava o stream cru (a câmera já nasce deitada). VERTICAL:
       * transforma em 720×1280 (o iPhone entrega deitado); se o canvas não rolar
       * nesse aparelho, grava o cru mesmo — melhor deitado do que nada. */
      let usar = raw;
      if (orientacao === "v") {
        try {
          const vs = criarStreamVertical(raw);
          streamVertRef.current = vs;
          usar = vs.stream;
        } catch (e) {
          console.warn("stream vertical indisponível, usando câmera crua:", e);
        }
      }

      streamRef.current = usar;
      if (videoRef.current) {
        videoRef.current.srcObject = usar;
        videoRef.current.play?.().catch(() => {});
      }
      const g = criarGravador(usar, { aoMudarEstado: setEstGrav });
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
    setModoGravacao(false);
    soltarWakeLock();
    try { gravadorRef.current?.parar(); } catch {}
    gravadorRef.current = null;
    try { streamVertRef.current?.encerrar(); } catch {}
    streamVertRef.current = null;
    try { streamRawRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRawRef.current = null;
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
      enviarSinal("salvo", {});
      avisar?.("Clipe apagado");
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  if (!suportado) {
    return (
      <div className="space-y-4">
        <CabecalhoPagina titulo="Câmera de lances" descricao="Gravação automática de gols e lances." />
        <Painel className="p-4" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.1)" }}>
          <p style={{ fontSize: 13, color: T.laranja }}>
            Este navegador não tem suporte a gravação de vídeo (MediaRecorder / câmera).
            Use o Chrome ou o Safari num celular, com o site aberto em HTTPS.
          </p>
        </Painel>
      </div>
    );
  }

  /* ---------- Modo gravação (tela cheia) ---------------------------------- */
  if (modoGravacao && ligada) {
    const resTxt = orientacao === "h"
      ? "horizontal ✓"
      : !dimVid ? null
      : dimVid.fonteDeitada ? "deitado — vire em pé"
      : dimVid.retrato ? (dimVid.corrigindo ? "vertical ✓" : `${dimVid.w}×${dimVid.h} vertical`)
      : "deitado";
    const resOk = orientacao === "h" || (dimVid && dimVid.retrato && !dimVid.fonteDeitada);
    return (
      <div ref={telaRef} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000", overflow: "hidden" }}>
        <video ref={videoRef} muted playsInline autoPlay
          onPause={(e) => e.currentTarget.play?.().catch(() => {})}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 12px)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 12px)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
            <span style={pilula}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: estGrav.capturando ? T.laranja : T.vermelho }} />
              {estGrav.capturando ? "CAPTURANDO" : "REC"}
            </span>
            <span style={pilula}>ÂNGULO {angulo}/{numCameras}</span>
            <span style={{ ...pilula, color: conectado ? "#fff" : T.laranja }}>
              {conectado ? `buffer ${estGrav.bufferSegundos}s` : "reconectando…"}
            </span>
            {resTxt && <span style={{ ...pilula, color: resOk ? T.verde : T.laranja }}>{resTxt}</span>}
          </div>
          <button onClick={() => setModoGravacao(false)}
            style={{ ...pilula, background: "rgba(0,0,0,.7)", padding: "8px 14px", fontSize: 12, flexShrink: 0 }}>
            ✕ Sair
          </button>
        </div>

        {estGrav.capturando && (
          <div style={{
            position: "absolute", left: 0, right: 0,
            top: "calc(env(safe-area-inset-top, 0px) + 58px)",
            display: "flex", justifyContent: "center", pointerEvents: "none",
          }}>
            <span style={{ background: "rgba(255,165,61,.95)", color: T.sobreOuro, padding: "6px 18px", borderRadius: 999, fontWeight: 900, fontSize: 13, letterSpacing: ".02em" }}>
              ● GRAVANDO LANCE
            </span>
          </div>
        )}

        {avisoModo && (
          <div style={{
            position: "absolute", left: 0, right: 0,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 26px)",
            display: "flex", justifyContent: "center", pointerEvents: "none",
          }}>
            <span style={{ background: "rgba(0,0,0,.78)", color: "#fff", padding: "8px 18px", borderRadius: 999, fontWeight: 800, fontSize: 13 }}>{avisoModo}</span>
          </div>
        )}

        {travado && (
          <button onClick={retomar} style={{
            position: "absolute", inset: 0, zIndex: 5, border: "none",
            background: "rgba(176,0,0,.85)", color: "#fff",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: ".02em" }}>TELA TRAVOU</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>toque para retomar a gravação</span>
          </button>
        )}
      </div>
    );
  }

  /* ---------- Tela de preparação ---------------------------------------- */
  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Câmera de lances"
        descricao={`${LINK_DIA ? "Dia" : LINK_RODADA ? "Rodada" : "Partida"}: ${PARTIDA_ROTULO}. Apoie o celular ${orientacao === "h" ? "DEITADO (vídeo horizontal, pega mais campo)" : "EM PÉ (vídeo vertical, pronto pra postar)"}, ligue a câmera e entre em Modo gravação.`}
      />

      {erro && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)" }}>
          <p style={{ fontSize: 12.5, color: T.vermelho }}>{erro}</p>
        </Painel>
      )}

      <Painel className="p-3 space-y-2">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.ouro }}>
          Orientação do vídeo
        </span>
        <div className="grid grid-cols-2 gap-2">
          {["h", "v"].map((o) => (
            <Botao key={o} variante={orientacao === o ? "primario" : "secundario"}
              onClick={() => { if (orientacao !== o) { setOrientacao(o); if (ligada) desligar(); } }}
              style={{ minHeight: 40, fontSize: 11 }}>
              {o === "h" ? "Horizontal" : "Vertical (stories)"}
            </Botao>
          ))}
        </div>
        <p style={{ fontSize: 10, color: T.fraco, lineHeight: 1.4 }}>
          {orientacao === "h"
            ? "Grava o vídeo deitado — pega mais do campo. Trocar aqui desliga a câmera; ligue de novo."
            : "Grava em pé (720×1280), pronto pra postar. No iPhone o app gira a imagem sozinho."}
        </p>
      </Painel>

      <Painel className="p-3" style={{ borderColor: T.tier4 }}>
        <p style={{ fontSize: 11, color: T.secundario, lineHeight: 1.45 }}>
          Antes de começar: nas <b>configurações do aparelho</b>, deixe o <b>bloqueio automático de tela</b> em
          "Nunca" enquanto durar o jogo. O app trava a tela acesa sozinho, mas alguns celulares ignoram —
          e a tela apagando <b>corta a gravação</b>.
        </p>
      </Painel>

      {ligada && travado && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.12)" }}>
          <p style={{ fontSize: 12, color: T.vermelho }}>
            A gravação <b>travou</b> (a tela apagou ou o app foi pro fundo).{" "}
            <button onClick={retomar} style={{ color: T.vermelho, fontWeight: 800, textDecoration: "underline" }}>
              Tocar para retomar
            </button>.
          </p>
        </Painel>
      )}

      {orientacao === "v" && ligada && dimVid && (dimVid.fonteDeitada || !dimVid.retrato) && (
        <Painel className="p-3" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.1)" }}>
          <p style={{ fontSize: 12, color: T.laranja }}>
            O celular está <b>deitado</b> — o clipe sai muito cortado. Apoie o celular <b>em pé</b>,
            com a trava de rotação ligada{!dimVid.fonteDeitada ? ", e toque em Ligar câmera de novo" : ""}.
          </p>
        </Painel>
      )}
      {orientacao === "v" && ligada && dimVid?.corrigindo && (
        <Painel className="p-3" style={{ borderColor: T.verde, background: "rgba(61,214,140,.08)" }}>
          <p style={{ fontSize: 11.5, color: T.verde }}>
            Vídeo <b>vertical</b> (720×1280). A câmera do iPhone vem deitada — o app gira a imagem sozinho.
          </p>
        </Painel>
      )}

      <Painel className="overflow-hidden">
        <div style={{ position: "relative", background: "#000", aspectRatio: orientacao === "h" ? "16 / 9" : "3 / 4", maxWidth: orientacao === "h" ? 360 : 300, margin: "0 auto" }}>
          <video ref={videoRef} muted playsInline autoPlay
            onPause={(e) => e.currentTarget.play?.().catch(() => {})}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: ligada ? "block" : "none" }} />
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
                {orientacao === "h" ? (
                  <> · <span style={{ color: T.verde, fontWeight: 700 }}>horizontal</span></>
                ) : dimVid && (
                  <>
                    {" · "}
                    <span style={{ color: dimVid.retrato && !dimVid.fonteDeitada ? T.verde : T.laranja, fontWeight: 700 }}>
                      {dimVid.fonteDeitada ? "deitado" : `${dimVid.w}×${dimVid.h} vertical`}
                    </span>
                  </>
                )}
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
            Só o vídeo na tela (em pé) e a tela travada acesa — é assim que o celular fica no jogo.
          </p>

          {PARTIDA_ID === "teste-camera" ? (
            <Painel className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <Botao disabled={!conectado || estGrav.capturando}
                  onClick={() => enviarSinal("disparo", { id: gerarId(), tipo: "gol", modalidade: MODALIDADE, partidaRotulo: PARTIDA_ROTULO })} style={{ minHeight: 56 }}>
                  Gol
                </Botao>
                <Botao variante="secundario" disabled={!conectado || estGrav.capturando}
                  onClick={() => enviarSinal("disparo", { id: gerarId(), tipo: "lance", modalidade: MODALIDADE, partidaRotulo: PARTIDA_ROTULO })} style={{ minHeight: 56 }}>
                  Lance
                </Botao>
              </div>
              <p style={{ marginTop: 8, fontSize: 10.5, color: T.fraco, lineHeight: 1.4 }}>
                Botões só do modo de teste — no jogo o sinal vem da tela do Rachão/Campeonato.
              </p>
            </Painel>
          ) : (
            <Painel className="p-3" style={{ background: "rgba(61,214,140,.08)", borderColor: T.verde }}>
              <p style={{ fontSize: 11.5, color: T.verde, lineHeight: 1.4 }}>
                Câmera pronta. O organizador dispara os lances pela tela do Rachão — não precisa tocar em mais nada neste aparelho.
              </p>
            </Painel>
          )}
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
                  {p.fase === "aguardando" && PARTIDA_ID === "teste-camera" && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Botao onClick={() => enviarSinal("decisao", { id: p.id, acao: "salvar" })} style={{ minHeight: 40, fontSize: 11 }}>
                        Salvar
                      </Botao>
                      <Botao variante="secundario" onClick={() => enviarSinal("decisao", { id: p.id, acao: "descartar" })} style={{ minHeight: 40, fontSize: 11 }}>
                        Descartar
                      </Botao>
                    </div>
                  )}
                  {p.fase === "aguardando" && PARTIDA_ID !== "teste-camera" && (
                    <p style={{ marginTop: 4, fontSize: 10.5, color: T.fraco }}>o organizador decide na tela do Rachão…</p>
                  )}
                </Painel>
              );
            })}
          </div>
        </section>
      )}

      <ListaClipes
        lances={lances}
        titulo={LINK_DIA ? "Clipes do dia" : LINK_RODADA ? "Clipes desta rodada" : "Clipes desta partida"}
        vazio="Nada salvo ainda."
        souOrganizador={souOrganizador}
        onApagar={apagarLance}
      />
    </div>
  );
}

export { TelaCamera };
