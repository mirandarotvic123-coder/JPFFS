/* Paleta gerada no Google Stitch (modelo "Elite Athletics") e adaptada aos
 * nomes de token já usados no app. Duas variantes conscientes em relação ao
 * gerado: T.secundario/T.fraco foram puxados para um cinza-azulado (em vez do
 * bege quente que o M3 derivou do dourado) — em blocos de texto grandes sobre
 * o azul-marinho, o tom quente ficava com aparência suja; em traços finos de
 * borda (T.borda) o tom original se mantém, ali quase não se percebe.
 */
export const T = {
  /* fundo do app — camada mais profunda */
  fundoTopo: "#00174a", fundoMeio: "#001b52", fundoBase: "#001039",

  /* camadas de superfície (tonal layering, sem sombra) */
  tier1: "#051c4e", tier2: "#132759", tier3: "#1f3264", tier4: "#243769",

  painel: "#051c4e",
  linhaPar: "rgba(219,225,255,0.035)", borda: "rgba(219,225,255,0.13)",

  /* dourado — cor de marca e ação primária */
  ouro: "#F5C518", ouroClaro: "#FFE08B", ouroFraco: "rgba(245,197,24,0.14)",
  sobreOuro: "#241A00",

  texto: "#DBE1FF", secundario: "#9FB3E8", fraco: "#6E7FAE",

  /* time azul / goleiro */
  gk: "#3B93EE", gkFraco: "rgba(59,147,238,0.18)", sobreAzul: "#002B50",

  verde: "#3DD68C", vermelho: "#FF6B6B", laranja: "#FFA53D", roxo: "#C08CFF",
};
export const FUNDO_APP = `linear-gradient(180deg, ${T.fundoTopo} 0%, ${T.fundoMeio} 42%, ${T.fundoBase} 100%)`;

export { default as ESCUDO } from "./assets/escudo.png";

export const AMARELO = { cor: "AMARELO", chave: "amarelo", emoji: "🟡", hex: "#F5C518" };
export const AZUL = { cor: "AZUL", chave: "azul", emoji: "🔵", hex: "#3B93EE" };
export const corDe = (c) => (c === "azul" ? AZUL : AMARELO);
