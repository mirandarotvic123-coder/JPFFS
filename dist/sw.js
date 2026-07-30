/* ============================================================================
 * Service worker do JPFFS
 * ----------------------------------------------------------------------------
 * Estratégia: "network first, cache como rede de segurança".
 *  · Online  → busca na rede e atualiza o cache. Você sempre pega a versão nova.
 *  · Offline → serve o que está em cache. À beira da quadra sem sinal, o app
 *    abre normalmente, e os dados já estão no localStorage do aparelho.
 * ==========================================================================*/
const CACHE = "jpffs-v1";
const ESSENCIAIS = ["/", "/index.html", "/manifest.webmanifest", "/icone-192.png", "/icone-512.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  evento.respondWith(
    fetch(req)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resposta;
      })
      .catch(() =>
        caches.match(req).then((cacheado) => cacheado || caches.match("/index.html"))
      )
  );
});
