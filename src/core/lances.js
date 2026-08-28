/* core/lances — motor de captura de lances (replay automático de ~20s).
 *
 * IDEIA (buffer duplo): dois MediaRecorder gravam o MESMO stream ao mesmo
 * tempo, defasados meio ciclo. Cada um grava no máximo JANELA segundos e então
 * "recicla" (para e recomeça do zero). No sinal de gol/lance, escolhemos o
 * gravador que já tem mais história acumulada, deixamos ele rodar +5s e
 * chamamos stop() — o Blob que sai daí é um arquivo ENCERRADO de verdade pelo
 * navegador: duração correta, sem buracos, toca do começo ao fim em qualquer
 * player. O outro gravador continua cobrindo a partida.
 *
 * Por que não juntar "pedaços" de uma gravação só: MediaRecorder só finaliza os
 * metadados (duração, índice de busca) no stop(). Concatenar chunks no meio do
 * caminho gera um arquivo com duração errada e um vão de tempo morto — foi o
 * que aconteceu na 1ª versão (o player mostrava 1:00 e a barra não andava).
 *
 * Custo: o aparelho codifica 720p duas vezes em paralelo. Celular dos últimos
 * ~5 anos aguenta; se algum device velho engasgar, baixar a resolução em
 * abrirCamera() (ou o videoBitsPerSecond) é o primeiro ajuste.
 *
 * Com JANELA=20s e DEFASAGEM=10s, o gravador "mais velho" sempre tem entre ~10s
 * e ~20s de história — ou seja, o clipe sai com 10–20s ANTES do sinal + 5s
 * depois (~15–25s no total, quase sempre perto de 20).
 */

const JANELA_MS = 20000; // cada gravador grava no máximo isso, aí recicla
const DEFASAGEM_MS = 10000; // 2º gravador começa meio ciclo depois do 1º
const DEPOIS_MS = 5000; // quanto grava depois do sinal
const FATIA_MS = 1000; // timeslice — só pra ter dado parcial e status ao vivo

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

/* Câmeras "ativadas" pra uma partida ficam lembradas neste aparelho — assim o
 * organizador não precisa reativar toda vez que sai e volta da tela. */
export function lerCamerasAtivas(partidaId) {
  try { return localStorage.getItem(`jpffs:cam:${partidaId}`) === "1"; }
  catch { return false; }
}
export function salvarCamerasAtivas(partidaId, ativo) {
  try {
    if (ativo) localStorage.setItem(`jpffs:cam:${partidaId}`, "1");
    else localStorage.removeItem(`jpffs:cam:${partidaId}`);
  } catch { /* sem localStorage */ }
}

export function cameraDisponivel() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    !!window.MediaRecorder
  );
}

/* Abre a câmera "crua". NÃO adianta pedir retrato aqui: o Safari do iPhone
 * ignora width/height/aspectRatio e sempre entrega a câmera DEITADA (ex.:
 * 1280×720), na orientação nativa do sensor. A prévia parece em pé só porque
 * o <video> gira junto com o celular — mas o MediaRecorder grava os pixels
 * crus (deitados). Quem resolve a orientação é criarStreamVertical(). */
export async function abrirCamera() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: true,
  });
}

/* SAÍDA SEMPRE 720×1280 (vertical), custe o que custar.
 *
 * Desenha cada frame da câmera num <canvas> 720×1280 e devolve um stream do
 * CANVAS (captureStream) + a trilha de áudio da câmera. É esse stream que vai
 * pro MediaRecorder — então o arquivo sai vertical de verdade, pronto pra
 * postar, mesmo com o iPhone entregando a câmera deitada.
 *
 * - câmera deitada + celular em pé  -> gira 90° (encaixa sem cortar nada)
 * - câmera/celular já em pé         -> só "cover" (preenche, corta sobra)
 * - celular deitado                 -> "cover" deitado->vertical (corta muito;
 *                                       a TelaCamera avisa pra virar em pé)
 */
const SAIDA_L = 720;
const SAIDA_A = 1280;

export function criarStreamVertical(streamRaw) {
  const canvasTeste = document.createElement("canvas");
  if (typeof canvasTeste.captureStream !== "function") {
    throw new Error("canvas.captureStream não suportado");
  }

  const video = document.createElement("video");
  video.srcObject = streamRaw;
  video.muted = true;
  video.playsInline = true;
  video.play?.().catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.width = SAIDA_L;
  canvas.height = SAIDA_A;
  const ctx = canvas.getContext("2d", { alpha: false });

  const telaRetrato = () =>
    window.matchMedia?.("(orientation: portrait)")?.matches ??
    window.innerHeight >= window.innerWidth;

  let vivo = true;
  let ultimo = 0;
  let req = 0;

  function desenhar(ts) {
    if (!vivo) return;
    req = requestAnimationFrame(desenhar);
    if (ts - ultimo < 32) return; // ~30fps, poupa bateria
    ultimo = ts;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || !ctx) return;
    const girar = vw > vh && telaRetrato();
    ctx.save();
    ctx.translate(SAIDA_L / 2, SAIDA_A / 2);
    if (girar) {
      ctx.rotate(Math.PI / 2); // 90° horário — orientação de foto do iPhone
      const escala = Math.max(SAIDA_L / vh, SAIDA_A / vw);
      const dw = vw * escala, dh = vh * escala;
      ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
    } else {
      const escala = Math.max(SAIDA_L / vw, SAIDA_A / vh);
      const dw = vw * escala, dh = vh * escala;
      ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
    }
    ctx.restore();
  }
  req = requestAnimationFrame(desenhar);

  const stream = canvas.captureStream(30);
  streamRaw.getAudioTracks().forEach((t) => stream.addTrack(t));

  return {
    stream,
    /* status da fonte pra TelaCamera mostrar aviso */
    fonte() {
      const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
      return { largura: vw, altura: vh, deitada: vw > vh, corrigindo: vw > vh && telaRetrato() };
    },
    encerrar() {
      vivo = false;
      cancelAnimationFrame(req);
      try { stream.getVideoTracks().forEach((t) => t.stop()); } catch { /* nada */ }
      video.srcObject = null;
    },
  };
}

/* Cria o gravador em cima de um stream já aberto. `aoMudarEstado` recebe
 * { rodando, bufferSegundos, capturando, formato, ext } a cada mudança. */
export function criarGravador(stream, { aoMudarEstado } = {}) {
  const mime = formatosSuportados()[0] || "";
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const opts = { videoBitsPerSecond: 1_800_000, ...(mime ? { mimeType: mime } : {}) };

  let rodando = false;
  let inicioGeral = 0;
  let idCaptura = null; // id da captura em andamento (trava local durante os +5s)
  const canais = []; // { rec, chunks, inicio, fase, timer, alvo, resolver }

  const idade = (c) => performance.now() - c.inicio;
  const gravando = (c) => c.rec && c.rec.state === "recording";

  function notificar() {
    aoMudarEstado?.(estado());
  }

  function estado() {
    const ativos = canais.filter(gravando);
    const maisVelho = ativos.length ? Math.max(...ativos.map(idade)) : 0;
    return {
      rodando,
      bufferSegundos: Math.min(Math.round(JANELA_MS / 1000), Math.round(maisVelho / 1000)),
      capturando: idCaptura != null,
      formato: mime,
      ext,
    };
  }

  /* próximo instante em que este canal deve reciclar, travado numa grade
   * absoluta (fase + k*JANELA) pra os dois canais não entrarem em fase com o
   * tempo por causa de pequenos atrasos de restart. */
  function agendarReciclagem(canal) {
    clearTimeout(canal.timer);
    const decorrido = performance.now() - inicioGeral;
    const k = Math.max(1, Math.ceil((decorrido - canal.fase) / JANELA_MS));
    const alvoMs = inicioGeral + canal.fase + k * JANELA_MS;
    canal.timer = setTimeout(() => {
      if (!rodando || canal.alvo === "captura") return;
      canal.alvo = "reciclar";
      try { canal.rec.stop(); } catch { /* já parado */ }
    }, Math.max(1000, alvoMs - performance.now()));
  }

  function iniciarCanal(canal) {
    canal.chunks = [];
    canal.alvo = null;
    canal.resolver = null;
    canal.inicio = performance.now();
    const rec = new MediaRecorder(stream, opts);
    canal.rec = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) canal.chunks.push(ev.data);
      notificar();
    };
    rec.onstop = () => {
      const eraCaptura = canal.alvo === "captura";
      if (eraCaptura && canal.resolver) {
        canal.resolver(new Blob(canal.chunks.slice(), { type: mime || "video/webm" }));
      }
      if (eraCaptura) idCaptura = null;
      if (rodando) {
        iniciarCanal(canal);
        agendarReciclagem(canal);
      }
      notificar();
    };
    try { rec.start(FATIA_MS); } catch { /* stream encerrado */ }
  }

  return {
    iniciar() {
      if (rodando) return;
      rodando = true;
      inicioGeral = performance.now();
      const a = { fase: 0 };
      const b = { fase: DEFASAGEM_MS };
      canais.push(a, b);
      iniciarCanal(a);
      agendarReciclagem(a);
      setTimeout(() => {
        if (!rodando) return;
        iniciarCanal(b);
        agendarReciclagem(b);
      }, DEFASAGEM_MS);
      notificar();
    },

    /* Escolhe o gravador com mais história, deixa rodar +5s e para pra fechar o
     * arquivo. Devolve Promise<Blob> do clipe, ou null se já houver captura em
     * andamento (trava local) ou a câmera estiver desligada. */
    capturar(id) {
      if (!rodando || idCaptura != null) return null;
      const cands = canais.filter(gravando);
      if (!cands.length) return null;
      const canal = cands.reduce((m, c) => (idade(c) > idade(m) ? c : m));
      idCaptura = id;
      canal.alvo = "captura";
      clearTimeout(canal.timer);
      const p = new Promise((res) => { canal.resolver = res; });
      setTimeout(() => {
        if (canal.alvo === "captura" && canal.rec) {
          try { canal.rec.stop(); } catch { /* já parado */ }
        }
        // rede de segurança: se o stop não disparar o onstop, libera a trava
        setTimeout(() => { if (idCaptura === id) { idCaptura = null; notificar(); } }, 3000);
      }, DEPOIS_MS);
      notificar();
      return p;
    },

    descartarCaptura(id) {
      if (idCaptura === id) idCaptura = null;
      notificar();
    },

    estado,

    parar() {
      rodando = false;
      for (const c of canais) {
        clearTimeout(c.timer);
        try {
          if (c.rec && c.rec.state !== "inactive") {
            c.alvo = null;
            c.rec.onstop = null;
            c.rec.stop();
          }
        } catch { /* já parado */ }
      }
      canais.length = 0;
      idCaptura = null;
      stream.getTracks().forEach((t) => t.stop());
      notificar();
    },
  };
}
