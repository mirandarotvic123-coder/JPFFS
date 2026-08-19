/* data/baseOficial — a base real do campeonato: os jogadores e o histórico
 * consolidado até a 21ª rodada. É o estado inicial quando não há nada
 * salvo ainda (ver core/repositorio). */
import { CONFIG_PADRAO } from "../core/regras";

/* ==================== SEED: classificação da 21ª rodada ================== */
const SEED_20 = `
PIETRO|.|65|21|13|6|2|34|14|1|1|0|1|28|2
JOÃO VITOR|G|54|21|10|3|8|19|16|0|0|0|0|2|0
PATRICK|.|51|19|10|2|7|21|14|0|0|0|0|5|3
ALESSON|.|49|16|9|6|1|31|15|3|0|1|1|11|3
ALEX|.|49|20|9|2|9|23|30|1|0|0|0|9|4
VICTOR|.|49|20|7|8|5|21|15|2|0|0|0|6|3
RICARDINHO|.|49|21|7|7|7|13|13|1|0|0|0|2|4
WELLK|.|48|14|11|1|2|27|11|1|0|0|0|9|6
KAIKE|.|48|19|8|6|5|20|14|3|0|0|1|6|1
HUDSON|.|46|18|8|4|6|16|13|1|0|0|0|2|4
GUENO|.|45|17|9|3|5|27|18|4|0|0|2|5|5
EMANUEL|.|45|19|7|5|7|23|24|1|0|0|0|5|3
LUIS PAULO|.|45|20|6|6|8|15|19|2|0|1|0|2|3
FABIANO|.|43|19|7|3|9|23|23|0|0|0|0|7|3
RENATO|.|43|19|7|4|8|20|23|2|1|0|1|6|1
TILMAR|.|43|20|5|8|7|19|26|1|0|0|0|5|1
JEAN|.|42|17|8|1|8|18|17|0|0|0|0|1|7
EDER|.|41|15|7|5|3|16|12|2|0|0|0|2|4
ARANHA|.|41|18|6|5|7|11|15|0|0|0|0|1|3
TERUYA|.|39|16|6|5|5|13|11|1|0|0|0|2|1
PAULO CÉSAR|.|39|18|6|3|9|15|20|0|0|0|0|1|1
SAMUEL|.|39|17|6|4|7|18|25|1|1|1|1|2|2
LÁZARO|.|38|12|8|0|4|16|11|1|0|2|0|4|5
FLAVINHO|.|38|12|6|4|2|12|10|1|0|4|0|1|2
MARKS|G|38|16|5|5|6|15|16|1|0|2|0|0|0
MATHEUS CUNHA|.|37|18|4|7|7|17|17|0|0|0|0|4|5
WELLINGTON|.|36|16|5|5|6|10|12|0|0|0|0|2|1
LEON|.|35|18|4|5|9|19|24|0|0|0|0|2|1
BRUNO GORDO|.|34|11|7|2|2|15|9|1|0|0|0|5|3
DANIEL|.|33|14|6|1|7|14|21|1|0|0|0|1|3
GILMAR PAQUETÁ|.|33|13|4|8|1|19|9|0|0|0|0|5|5
HENDOR|.|30|11|6|1|4|9|8|0|0|0|0|4|2
RODRIGO NANTES|G|30|12|5|3|4|16|14|0|0|0|0|0|0
CARLOS|.|30|15|3|4|8|7|18|0|0|2|0|0|1
GABRIEL|.|28|12|4|3|5|12|15|1|0|1|0|3|2
RAFAEL DELGADO|.|27|10|5|2|3|15|10|0|0|0|0|3|4
ANDRÉ|.|27|13|3|4|6|12|13|0|0|1|0|3|1
JAPA|.|26|9|5|2|2|12|8|0|0|0|0|3|1
LUCIANO|.|23|11|3|3|5|11|10|0|0|0|0|3|0
LOTHAR|.|21|15|1|3|11|7|28|1|0|0|0|2|0
FRED|.|18|10|2|2|6|4|14|1|0|0|0|0|0
EMERSON TIXA|.|17|11|1|3|7|3|12|2|0|0|0|0|0
MÁRCIO BOM D+|.|15|11|3|0|8|14|18|0|0|0|5|2|2
LEOMAR|.|13|5|1|4|0|5|3|0|0|1|0|0|1
ALEXANDRE|.|12|6|1|3|2|5|5|0|0|0|0|0|1
BATTISTON|G|10|4|2|0|2|5|3|0|0|0|0|0|0
ENTONY|.|10|4|2|0|2|3|3|0|0|0|0|2|0
JUDSON|.|10|6|1|1|4|5|11|0|0|0|0|0|1
CARLOTA|.|9|5|1|1|3|4|4|0|0|0|0|0|1
RODRIGO COSTA|.|9|5|1|1|3|4|7|1|0|0|0|0|0
DOUGLAS|.|7|4|1|0|3|5|7|0|0|0|0|0|0
GUSTAVO|.|5|2|1|0|1|5|3|0|0|0|0|1|0
ESPINOSA|.|5|2|1|0|1|3|5|0|0|0|0|0|1
JEFERSON|.|4|1|1|0|0|4|0|0|0|0|0|1|1
LUIS FERNANDO|.|4|1|1|0|0|2|0|0|0|0|0|0|1
WESLEY SAFADÃO|.|4|3|0|1|2|2|5|1|0|0|0|1|0
GLEDSON|.|2|1|0|1|0|1|1|0|0|0|0|1|0
JHONATANN|.|2|2|0|0|2|1|5|0|0|0|0|0|0
ADRIANO|.|1|0|0|0|0|0|0|0|0|1|0|0|0
AGOSTINHO|.|1|1|0|0|1|2|3|0|0|0|0|0|0
BRUNO PORTO|.|1|1|0|0|1|0|1|0|0|0|0|0|0
`.trim();

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

function baseOficial() {
  const jogadores = [], hist = {};
  for (const l of SEED_20.split("\n")) {
    const [nome, g, P, J, V, E, D, GP, GC, CA, CV, Pmais, Pmenos, gols, ass] = l.split("|");
    const jid = slug(nome);
    jogadores.push({
      id: jid, nome, posicao: g === "G" ? "GOLEIRO" : "LINHA", ativo: true, convidado: false,
      estrelasIniciais: 1, pendenciaFinanceira: false, pontuacaoPendente: false, posicaoInferida: false
    });
    hist[jid] = { P: +P, J: +J, V: +V, E: +E, D: +D, GP: +GP, GC: +GC, CA: +CA, CV: +CV, Pmais: +Pmais, Pmenos: +Pmenos, gols: +gols, assistencias: +ass };
  }
  return {
    versao: 6, campeonato: "Campeonato JPFFS", temporada: 2026,
    config: { ...CONFIG_PADRAO }, jogadores, rodadas: [], restricoes: [],
    historicoInicial: { rodadas: 21, data: "2026-08-01", descricao: "Classificação oficial consolidada após a 21ª rodada", jogadores: hist },
  };
}

export { slug, baseOficial };
