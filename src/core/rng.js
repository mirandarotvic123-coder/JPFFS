/* Utilidades de aleatoriedade determinística — a mesma seed sempre gera o
 * mesmo sorteio, o que permite reabrir/conferir uma rodada depois. */
function hashSeed(t) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function criarRng(seed) {
  let a = hashSeed(String(seed));
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function novaSeed() {
  const al = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => al[Math.floor(Math.random() * al.length)]).join("");
}
function embaralharRng(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function distribuirProporcional(itens, alvos, rng) {
  const usados = alvos.map(() => 0);
  const grupos = alvos.map(() => []);
  for (const item of itens) {
    let candidatos = [], melhorRazao = Infinity;
    for (let g = 0; g < alvos.length; g++) {
      if (usados[g] >= alvos[g]) continue;
      const razao = alvos[g] > 0 ? usados[g] / alvos[g] : Infinity;
      if (razao < melhorRazao - 1e-9) { melhorRazao = razao; candidatos = [g]; }
      else if (Math.abs(razao - melhorRazao) <= 1e-9) { candidatos.push(g); }
    }
    if (!candidatos.length) break;
    // empate entre partidas e sorteado, nao sempre a de menor indice --
    // evita que a mesma partida (a menor) fique sempre em desvantagem/vantagem
    const escolhido = candidatos[Math.floor((rng ? rng() : Math.random()) * candidatos.length)];
    grupos[escolhido].push(item);
    usados[escolhido]++;
  }
  return grupos;
}
export { hashSeed, criarRng, novaSeed, embaralharRng, distribuirProporcional };
