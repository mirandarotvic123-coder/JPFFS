import React, { useState } from "react";
import { T } from "../../theme";
import { Painel, ItemDoc } from "../../components/ui";
import { formatarData } from "./util";

/* Regras da Copa em linguagem simples, com os artigos do Estatuto Geral 2026. */

const Lista = ({ children }) => <ul style={{ margin: "6px 0", paddingLeft: 18, listStyle: "disc" }}>{children}</ul>;
const Item = ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>;
const Forte = ({ children, cor = T.ouro }) => <b style={{ color: cor }}>{children}</b>;

function DocumentacaoCopa({ copa }) {
  const [aberta, setAberta] = useState("formato");
  return (
    <div className="space-y-3">
      <Painel className="p-4" style={{ background: T.ouroFraco, borderColor: "rgba(245,197,24,.3)" }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: T.ouro, marginBottom: 4 }}>Como a Copa Hendor funciona</p>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: T.secundario }}>
          Regras do Estatuto Geral (Arts. 41 a 56 e 85) em linguagem simples, e o que o app faz sozinho. Toque num tópico para abrir.
        </p>
      </Painel>

      <ItemDoc id="formato" aberta={aberta} setAberta={setAberta} titulo="Formato e calendário" resumo="Duplas, mata-mata e datas">
        <p>Competição de <Forte>cobranças de pênaltis entre duplas</Forte>, em mata-mata (Art. 41). Cada jogador se inscreve sozinho e as duplas saem de sorteio (Art. 43).
          O número de duplas é múltiplo de quatro (Art. 44). As fases são disputadas nas datas FIFA, sem rodada do Campeonato (Art. 75).</p>
        <Lista>
          {copa.fases.map((f) => <Item key={f.id}><Forte cor={T.texto}>{f.nome}</Forte> — {formatarData(f.data)}</Item>)}
        </Lista>
      </ItemDoc>

      <ItemDoc id="disputa" aberta={aberta} setAberta={setAberta} titulo="Como é a disputa" resumo="4 cobranças por dupla, ordem e alternadas">
        <Lista>
          <Item>Cada dupla tem <Forte>4 cobranças</Forte>: cada jogador cobra 2 vezes e defende 2 vezes (Art. 49). As duas duplas fazem as 4, mesmo que a partida já pareça decidida.</Item>
          <Item>Cara ou coroa antes da partida: quem ganhar escolhe <Forte>cobrar ou defender primeiro</Forte>. A ordem dos cobradores e defensores é de cada dupla (Art. 50).</Item>
          <Item>Sequência (Art. 51): o 1º jogador da dupla X cobra contra os dois defensores da dupla Y; depois o 1º da Y contra os dois da X; depois o 2º da X; por fim o 2º da Y.</Item>
          <Item>Empate nas 4 cobranças: <Forte>alternadas</Forte>, uma por dupla, na mesma ordem e sem repetir jogador até o ciclo completar, até alguém ficar na frente (Art. 52).</Item>
          <Item>As regras de cobrança e defesa seguem a IFAB (Art. 48).</Item>
        </Lista>
      </ItemDoc>

      <ItemDoc id="ausencias" aberta={aberta} setAberta={setAberta} titulo="Ausências e substituições" resumo="Dupla ausente, jogador ausente e lesão">
        <Lista>
          <Item><Forte>Dupla inteira ausente</Forte>: está eliminada, e a adversária vence e avança (Art. 54).</Item>
          <Item><Forte>Um jogador ausente</Forte> (ou inapto): sai da Copa. O parceiro forma nova dupla com o <Forte>melhor colocado no Campeonato entre os eliminados da fase anterior</Forte> que esteja presente (Art. 55 §1). Sem ninguém disponível, o parceiro também sai (§2).</Item>
          <Item><Forte>Lesão durante a disputa</Forte>: o jogador sai e o parceiro faz as cobranças e defesas que faltam; se a dupla vencer, forma nova dupla como acima (Art. 55 §3).</Item>
          <Item>Quem se ausentar ou desistir perde <Forte cor={T.vermelho}>5 pontos no Campeonato</Forte> e paga multa de 50% da mensalidade do plano Amador, exceto por motivo familiar justificável, lesão ou saúde comprovadas por atestado, ou urgência profissional comprovada (Art. 55 §4).</Item>
        </Lista>
      </ItemDoc>

      <ItemDoc id="pagamento" aberta={aberta} setAberta={setAberta} titulo="Inscrição e pagamento" resumo="Quem pode jogar (Arts. 42 e 85)">
        <Lista>
          <Item>Só se inscreve quem está <Forte>em dia</Forte> com o JPFFS. Sócios Lendário e Pro pagam a taxa única de inscrição; Amador paga também a mensalidade do mês em que há disputa.</Item>
          <Item>Atraso ou falta de pagamento nos meses da disputa: o jogador é <Forte cor={T.vermelho}>eliminado da Copa</Forte> (Art. 42 §único e Art. 85 §2).</Item>
          <Item>No app, quem está com pendência financeira (<Forte cor={T.vermelho}>$</Forte>) é só sinalizado. Quem decide a eliminação é o organizador.</Item>
        </Lista>
      </ItemDoc>

      <ItemDoc id="supercopa" aberta={aberta} setAberta={setAberta} titulo="Campeões e Supercopa" resumo="Premiação e vaga direta">
        <Lista>
          <Item>A <Forte>dupla campeã</Forte> ganha o troféu representativo e medalhas individuais; vice e 3º lugar ganham medalhas individuais (Art. 76 §3).</Item>
          <Item>Os dois campeões têm <Forte>vaga na Supercopa</Forte> mesmo fora do corte por pontos (Art. 58). O app faz isso sozinho assim que a final termina.</Item>
        </Lista>
      </ItemDoc>

      <ItemDoc id="app" aberta={aberta} setAberta={setAberta} titulo="O que o app faz sozinho" resumo="Placar, avanço e campeões">
        <Lista>
          <Item>O placar vem das cobranças lançadas, e o vencedor <Forte>avança automaticamente</Forte> para a fase seguinte.</Item>
          <Item>Quem acompanha pelo celular vê as cobranças aparecendo ao vivo, sem atualizar a página.</Item>
          <Item>Nada da Copa conta gols, assistências ou pontos do Campeonato. As únicas ligações são a <Forte>vaga na Supercopa</Forte> e os <Forte cor={T.vermelho}>−5 pontos</Forte> por ausência.</Item>
        </Lista>
      </ItemDoc>
    </div>
  );
}

export { DocumentacaoCopa };
