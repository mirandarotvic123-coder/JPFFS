/* Copa Hendor de Penalidades 2026 — chaveamento transcrito da arte oficial.
 * Oitavas e quartas já foram jogadas (só o placar final existe); as semifinais em diante
 * saem sozinhas dos vencedores. As substituições das quartas seguem o Art. 55 §1: quem faltou
 * foi trocado por um eliminado das oitavas. */
import { slug } from "./baseOficial";

const dupla = (a, b) => ({ jogadores: [slug(a), slug(b)], subs: [] });
const sub = (sai, entra) => ({ subs: [{ sai: slug(sai), entra: slug(entra), motivo: "Ausente (Art. 55 §1)" }] });

function copaHendor2026() {
  const oitavas = [
    ["o1", "Oitavas 1", ["Samuel", "Jean"], 5, ["Alexandre", "Renato"], 6],
    ["o2", "Oitavas 2", ["Pietro", "Flavinho"], 10, ["Gueno", "Daniel"], 9],
    ["o3", "Oitavas 3", ["Wellk", "Alex"], 4, ["Teruya", "Hendor"], 3],
    ["o4", "Oitavas 4", ["Tilmar", "Rafael Delgado"], 2, ["Lázaro", "Victor"], 1],
    ["o5", "Oitavas 5", ["Emanuel", "Wesley Safadão"], 6, ["Aranha", "Hudson"], 7],
    ["o6", "Oitavas 6", ["Lothar", "Eder"], 5, ["João Vitor", "Kaike"], 4],
    ["o7", "Oitavas 7", ["Marks", "Ricardinho"], 7, ["Luis Paulo", "Carlos"], 6],
    ["o8", "Oitavas 8", ["Gustavo", "Leon"], 2, ["André", "Paulo César"], 3],
  ].map(([id, rotulo, a, pa, b, pb]) => ({
    id, fase: "oitavas", rotulo,
    duplaA: dupla(...a), duplaB: dupla(...b), placarManual: { A: pa, B: pb },
  }));

  const quartas = [
    ["q1", "Quartas 1", "o1", "o2", sub("Alexandre", "Teruya"), {}, 3, 2],
    ["q2", "Quartas 2", "o3", "o4", sub("Wellk", "Kaike"), {}, 3, 0],
    ["q3", "Quartas 3", "o5", "o6", sub("Hudson", "Lázaro"), {}, 4, 3],
    ["q4", "Quartas 4", "o7", "o8", sub("Marks", "Victor"), {}, 4, 3],
  ].map(([id, rotulo, oA, oB, dA, dB, pa, pb]) => ({
    id, fase: "quartas", rotulo,
    origem: { A: { de: oA, tipo: "vencedor" }, B: { de: oB, tipo: "vencedor" } },
    duplaA: dA, duplaB: dB, placarManual: { A: pa, B: pb },
  }));

  const daFase = (id, rotulo, fase, oA, tA, oB, tB) => ({
    id, fase, rotulo, duplaA: {}, duplaB: {},
    origem: { A: { de: oA, tipo: tA }, B: { de: oB, tipo: tB } },
  });

  return {
    id: "hendor-2026", tipo: "hendor", nome: "Copa Hendor de Penalidades", ano: 2026,
    fases: [
      { id: "oitavas", nome: "Oitavas de final", data: "2026-04-04" },
      { id: "quartas", nome: "Quartas de final", data: "2026-09-05" },
      { id: "semis", nome: "Semifinais", data: "2026-10-31" },
      { id: "final", nome: "Final e 3º lugar", data: "2026-11-21" },
    ],
    partidas: [
      ...oitavas, ...quartas,
      daFase("s1", "Semifinal 1", "semis", "q1", "vencedor", "q2", "vencedor"),
      daFase("s2", "Semifinal 2", "semis", "q3", "vencedor", "q4", "vencedor"),
      daFase("final", "Final", "final", "s1", "vencedor", "s2", "vencedor"),
      daFase("t3", "3º lugar", "final", "s1", "perdedor", "s2", "perdedor"),
    ],
    penalidades: [],
  };
}

export { copaHendor2026 };
