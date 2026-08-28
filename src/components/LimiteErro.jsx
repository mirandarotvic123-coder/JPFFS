import React from "react";

/* Barreira de erro: se algo dentro quebrar na renderização, mostra um aviso
 * pequeno (ou nada) em vez de derrubar a tela inteira. Usado pra isolar peças
 * novas/opcionais (ex.: gatilho de gravação de lances) do resto do app. */
class LimiteErro extends React.Component {
  constructor(props) {
    super(props);
    this.state = { caiu: false };
  }
  static getDerivedStateFromError() {
    return { caiu: true };
  }
  componentDidCatch(erro, info) {
    console.error("LimiteErro capturou:", erro, info);
  }
  render() {
    if (this.state.caiu) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export { LimiteErro };
