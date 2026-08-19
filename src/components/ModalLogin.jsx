import React, { useState } from "react";
import { supabase } from "../supabase";
import { T, ESCUDO } from "../theme";
import { Botao } from "./ui";
import { IconeEmail, IconeCadeado, IconeSetaDireita, IconeSetaEsquerda, IconeOlhoFechado } from "./icones";

function ModalLogin({ fechar, avisar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const entrar = async () => {
    setCarregando(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) { setErro("E-mail ou senha inválidos."); return; }
    avisar("Entrou como organizador");
    fechar();
  };

  const campoComIcone = (Icone, props) => (
    <div style={{ position: "relative" }}>
      <Icone tam={16} cor={T.fraco} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <input {...props} className="w-full rounded-md py-2.5"
        style={{ paddingLeft: 36, paddingRight: 12, background: T.tier2, color: T.texto, border: `1px solid ${T.tier4}`, fontSize: 14 }} />
    </div>
  );

  return (
    <div onClick={fechar} className="fixed inset-0 z-30 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,.65)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl p-6"
        style={{ background: T.painel, border: `1px solid ${T.borda}`, color: T.texto }}>
        <div className="flex flex-col items-center text-center" style={{ marginBottom: 20 }}>
          <img src={ESCUDO} alt="" style={{ height: 52, width: "auto", marginBottom: 10, filter: "drop-shadow(0 2px 6px rgba(0,0,0,.5))" }} />
          <h2 className="font-destaque" style={{ fontSize: 19, fontWeight: 700 }}>Acesso Restrito</h2>
          <p style={{ fontSize: 12.5, color: T.secundario, marginTop: 4, lineHeight: 1.4 }}>
            Entre para gerenciar presenças, realizar sorteios e registrar súmulas em tempo real.
          </p>
        </div>

        <div className="space-y-2">
          {campoComIcone(IconeEmail, {
            type: "email", placeholder: "E-mail do organizador", value: email, autoFocus: true,
            onChange: (e) => setEmail(e.target.value),
          })}
          <div style={{ position: "relative" }}>
            <IconeCadeado tam={16} cor={T.fraco} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input type={mostrarSenha ? "text" : "password"} placeholder="Senha de acesso" value={senha}
              onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()}
              className="w-full rounded-md py-2.5" style={{ paddingLeft: 36, paddingRight: 38, background: T.tier2, color: T.texto, border: `1px solid ${T.tier4}`, fontSize: 14 }} />
            <button type="button" onClick={() => setMostrarSenha((s) => !s)} title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.fraco, padding: 4 }}>
              <IconeOlhoFechado tam={16} />
            </button>
          </div>
        </div>

        {erro && <div style={{ color: T.vermelho, fontSize: 12, marginTop: 10 }}>{erro}</div>}

        <Botao className="mt-4 flex w-full items-center justify-center" style={{ gap: 6 }}
          onClick={entrar} disabled={carregando || !email || !senha}>
          {carregando ? "Entrando…" : <>Entrar no Sistema <IconeSetaDireita tam={16} /></>}
        </Botao>
        <Botao variante="secundario" className="mt-2 flex w-full items-center justify-center" style={{ gap: 6 }} onClick={fechar}>
          <IconeSetaEsquerda tam={15} /> Voltar à Tabela
        </Botao>
      </div>
    </div>
  );
}

export { ModalLogin };
