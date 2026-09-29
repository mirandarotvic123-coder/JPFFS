import { T } from "../theme";
import { CronometroPartida } from "./CronometroPartida";

/* components/CabecalhoAoVivo — cabeçalho das telas de partida (Rachão e Gestão
 * da Rodada): título + data, a barra de câmeras e o cronômetro juntos, numa
 * faixa que fica congelada no topo enquanto a tela rola (CSS em estilo.css,
 * .cabecalho-ao-vivo). `cameras` é o gatilho de lances da tela — opcional. */
function CabecalhoAoVivo({ titulo, descricao, cameras }) {
  return (
    <div className="cabecalho-ao-vivo">
      <div className="cabecalho-ao-vivo-titulo">
        <h1 className="font-destaque truncate" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15, color: T.texto }}>{titulo}</h1>
        {descricao && <p className="truncate" style={{ marginTop: 2, fontSize: 12.5, color: T.secundario }}>{descricao}</p>}
      </div>
      {cameras && <div className="cabecalho-ao-vivo-cameras">{cameras}</div>}
      <div className="cabecalho-ao-vivo-crono"><CronometroPartida /></div>
    </div>
  );
}

export { CabecalhoAoVivo };
