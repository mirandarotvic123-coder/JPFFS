/* Pequenos ajudantes de apresentação da Copa (nada de regra aqui — regra é core/copaHendor). */
import { duplaEfetiva, partidaPorId } from "../../core/copaHendor";

const formatarData = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

const FASE_CURTA = { oitavas: "Oitavas", quartas: "Quartas", semis: "Semis", final: "Final" };

const nomesDe = (base) => Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));

const nomeDupla = (ids, nomes) => ids.map((i) => nomes[i] || i).join(" / ");

/* Texto da dupla de um lado: os nomes, ou "Vencedor de Semifinal 1" enquanto não existe. */
function textoDaDupla(copa, partida, lado, nomes) {
  const { jogadores } = duplaEfetiva(copa, partida, lado);
  if (jogadores.length === 2) return { texto: nomeDupla(jogadores, nomes), definida: true };
  const o = partida.origem?.[lado];
  const de = o && partidaPorId(copa, o.de);
  return { texto: de ? `${o.tipo === "perdedor" ? "Perdedor" : "Vencedor"} de ${de.rotulo}` : "A definir", definida: false };
}

/* "Teruya entrou no lugar de Alexandre" — quem foi substituído na dupla. */
const notasDeSubstituicao = (copa, partida, nomes) =>
  ["A", "B"].flatMap((l) => (partida[`dupla${l}`]?.subs || []).map((s) => ({
    lado: l, texto: `${nomes[s.entra] || s.entra} entrou no lugar de ${nomes[s.sai] || s.sai}`,
  })));

export { formatarData, FASE_CURTA, nomesDe, nomeDupla, textoDaDupla, notasDeSubstituicao };
