/* core/lances — motor de captura de lances (replay automático de ~20s).
 *
 * IDEIA: um único MediaRecorder roda a partida inteira em "fatias" (timeslice)
 * de 1s. Guardamos só as fatias dos últimos ~15s num anel (as mais velhas são
 * descartadas) MAIS, sempre, a primeira fatia — ela carrega o cabeçalho do
 * arquivo e, sem ela, o WebM/MP4 remontado não abre. No sinal de gol/lance,
 * congela-se o que está no anel e grava-se +5s; o clipe final é só a
 * concatenação [cabeçalho, ...anel congelado, ...5s de depois] — mesma sessão
 * de gravação, fatias sequenciais, sem ffmpeg nem processamento em servidor.
 * Resolve sozinho o "padronizar iPhone×Android": cada formato toca no <video>.
 *
 * RISCO CONHECIDO: quando a captura acontece com a partida já adiantada, existe
 * um buraco de tempo entre o cabeçalho (fatia 0) e a janela dos últimos 15s.
 * A maioria dos players do Chrome/Safari toca assim mesmo (a barra de duração
 * fica torta), mas se em celular real travar, o plano B é buffer duplo — dois
 * MediaRecorder defasados, cada um gerando um arquivo completo. Bem mais
 * código; só se precisar. Por isso o teste em aparelho de verdade vem primeiro.
 */

/* Alvo: clipe de ~20s. O arquivo final é [fatia-cabeçalho] + [antes] + [depois].
 * A fatia-cabeçalho sozinha já vale ~1s de vídeo (o 1º segundo desde que a
 * câmera ligou — sem ela o arquivo remontado não abre), então miramos 14+5 pra
 * o total fechar perto de 20. Ajuste estes dois números se quiser mais/menos. */
const SEGUNDOS_ANTES = 14;
const SEGUNDOS_DEPOIS = 5;
const FATIA_MS = 1000;
const MARGEM_ANEL_MS = (SEGUNDOS_ANTES + 2) * 1000; // anel guarda um pouco mais que o corte

export function formatosSuportados() {
  const cand = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const MR = typeof window !== "undefined" ? window.MediaRecorder : null;
  if (!MR || !MR.isTypeSupported) return [];
  return cand.filter((t) => MR.isTypeSupported(t));
}

export function cameraDisponivel() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    !!window.MediaRecorder
  );
}

export async function abrirCamera() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: true,
  });
}

/* Cria o gravador em cima de um stream já aberto. `aoMudarEstado` recebe um
 * objeto { rodando, bufferSegundos, capturando, formato, ext } a cada mudança. */
export function criarGravador(stream, { aoMudarEstado } = {}) {
  const mime = formatosSuportados()[0] || "";
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";

  let cabecalho = null; // 1ª fatia — nunca descartada
  let anel = []; // { blob, t } das fatias recentes
  const capturas = new Map(); // id -> captura em andamento
  let rec = null;
  let rodando = false;

  function podarAnel() {
    const limite = performance.now() - MARGEM_ANEL_MS;
    while (anel.length > 1 && anel[0].t < limite) anel.shift();
  }

  function estado() {
    const seg = anel.length
      ? Math.round((anel[anel.length - 1].t - anel[0].t) / 1000)
      : 0;
    return {
      rodando,
      bufferSegundos: Math.min(SEGUNDOS_ANTES, seg),
      capturando: [...capturas.values()].some((c) => c.coletando),
      formato: mime,
      ext,
    };
  }

  function fecharCaptura(cap) {
    cap.coletando = false;
    const partes = [cabecalho, ...cap.antes, ...cap.depois].filter(Boolean);
    const vistos = new Set();
    const blobs = partes.filter((b) => (vistos.has(b) ? false : vistos.add(b)));
    cap.resolver(new Blob(blobs, { type: mime || "video/webm" }));
    capturas.delete(cap.id);
    aoMudarEstado?.(estado());
  }

  function aoDado(ev) {
    if (!ev.data || !ev.data.size) return;
    if (!cabecalho) cabecalho = ev.data;
    anel.push({ blob: ev.data, t: performance.now() });
    podarAnel();
    for (const cap of capturas.values()) {
      if (!cap.coletando) continue;
      cap.depois.push(ev.data);
      cap.restantes -= 1;
      if (cap.restantes <= 0) fecharCaptura(cap);
    }
    aoMudarEstado?.(estado());
  }

  return {
    iniciar() {
      if (rodando) return;
      const opts = { videoBitsPerSecond: 1_800_000 };
      if (mime) opts.mimeType = mime;
      rec = new MediaRecorder(stream, opts);
      rec.ondataavailable = aoDado;
      rec.start(FATIA_MS);
      rodando = true;
      aoMudarEstado?.(estado());
    },

    /* Congela o anel atual e passa a coletar +5s. Devolve Promise<Blob> do
     * clipe, ou null se já houver captura em andamento (trava local). */
    capturar(id) {
      if (!rodando) return null;
      if ([...capturas.values()].some((c) => c.coletando)) return null;
      podarAnel();
      // pega só as fatias dos últimos SEGUNDOS_ANTES — não o anel inteiro, que
      // guarda folga a mais e faria o clipe passar de 20s.
      const corte = performance.now() - SEGUNDOS_ANTES * 1000;
      const cap = {
        id,
        antes: anel.filter((f) => f.t >= corte).map((f) => f.blob),
        depois: [],
        restantes: Math.max(1, Math.round((SEGUNDOS_DEPOIS * 1000) / FATIA_MS)),
        coletando: true,
        resolver: null,
      };
      const p = new Promise((res) => { cap.resolver = res; });
      capturas.set(id, cap);
      aoMudarEstado?.(estado());
      return p;
    },

    descartarCaptura(id) {
      capturas.delete(id);
      aoMudarEstado?.(estado());
    },

    estado,

    parar() {
      rodando = false;
      try { if (rec && rec.state !== "inactive") rec.stop(); } catch { /* já parado */ }
      stream.getTracks().forEach((t) => t.stop());
      capturas.clear();
      anel = [];
      cabecalho = null;
      aoMudarEstado?.(estado());
    },
  };
}
