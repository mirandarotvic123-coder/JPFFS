import React, { useState } from "react";
import { supabase } from "../supabase";
import { T, FUNDO_APP, ESCUDO } from "../theme";
import { Botao } from "../components/ui";
import { IconeEmail, IconeTelefone, IconeCadeado, IconeConta, IconeSetaDireita, IconeOlhoFechado } from "../components/icones";

/* "11987654321" -> "11 9 8765-4321", formatando enquanto digita. Sempre
 * baseado só nos dígitos (ignora o que já tava formatado antes), então
 * apagar/colar no meio do campo não trava. */
function formatarTelefone(valor) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  let f = d.slice(0, 2);
  if (d.length > 2) f += " " + d.slice(2, 3);
  if (d.length > 3) f += " " + d.slice(3, 7);
  if (d.length > 7) f += "-" + d.slice(7, 11);
  return f;
}

/* ============================================================================
 * Telas de acesso — login passou a ser obrigatório pra todo mundo (ver
 * supabase-migracoes/001-*). Três modos aqui dentro de TelaLogin (entrar,
 * criar usuário, recuperar senha) + a tela de espera de quem já logou mas
 * ainda não foi aprovado + a tela de definir senha nova (link de recuperação
 * ou primeiro acesso). Tudo cai numa página cheia — não tem mais "Tabela
 * pública" pra mostrar atrás de um modal.
 * ==========================================================================*/

const CampoComIcone = ({ Icone, ...props }) => (
  <div style={{ position: "relative" }}>
    <Icone tam={16} cor={T.fraco} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    <input {...props} className="w-full rounded-md py-2.5"
      style={{ paddingLeft: 36, paddingRight: 12, background: T.tier2, color: T.texto, border: `1px solid ${T.tier4}`, fontSize: 14 }} />
  </div>
);

function CampoSenha({ valor, onChange, placeholder, onEnter }) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <IconeCadeado tam={16} cor={T.fraco} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <input type={mostrar ? "text" : "password"} placeholder={placeholder} value={valor}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="w-full rounded-md py-2.5" style={{ paddingLeft: 36, paddingRight: 38, background: T.tier2, color: T.texto, border: `1px solid ${T.tier4}`, fontSize: 14 }} />
      <button type="button" onClick={() => setMostrar((s) => !s)} title={mostrar ? "Ocultar senha" : "Mostrar senha"}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.fraco, padding: 4 }}>
        <IconeOlhoFechado tam={16} />
      </button>
    </div>
  );
}

/* compacta: header menor (usado no modo "criar", o formulário mais comprido
 * — com 5 campos, sobra menos altura de tela em celular; encolher a marca
 * evita que a página role antes mesmo de chegar no botão). */
function Moldura({ compacta, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: FUNDO_APP }}>
      <div className="w-full max-w-sm rounded-xl p-6" style={{ background: T.painel, border: `1px solid ${T.borda}`, color: T.texto }}>
        <div className="flex flex-col items-center text-center" style={{ marginBottom: compacta ? 14 : 22 }}>
          <img src={ESCUDO} alt="" style={{ height: compacta ? 40 : 52, width: "auto", marginBottom: 8, filter: "drop-shadow(0 2px 6px rgba(0,0,0,.5))" }} />
          <h2 className="font-destaque" style={{ fontSize: 19, fontWeight: 700 }}>Campeonato JPFFS</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

/* Caixa de aviso — texto de apoio (neutro), erro ou mensagem de sucesso.
 * Um único visual pras 3 telas de acesso, em vez de texto solto flutuando
 * com margem própria em cada lugar. */
function Aviso({ tom = "neutro", children }) {
  const cor = { neutro: T.secundario, erro: T.vermelho, sucesso: T.verde }[tom];
  const fundo = { neutro: "rgba(255,255,255,.04)", erro: "rgba(255,107,107,.1)", sucesso: "rgba(61,214,140,.1)" }[tom];
  const borda = { neutro: T.borda, erro: "rgba(255,107,107,.35)", sucesso: "rgba(61,214,140,.35)" }[tom];
  return (
    <div style={{ background: fundo, border: `1px solid ${borda}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, lineHeight: 1.55, color: cor }}>
      {children}
    </div>
  );
}

/* --------------------------------- Login ----------------------------------
 * "entrar": e-mail + senha de sempre.
 * "criar": autocadastro — vira jogador/pendente, precisa de aprovação.
 * "recuperar": manda o e-mail de redefinição de senha do Supabase.        */
function TelaLogin({ avisar }) {
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const trocarModo = (m) => { setModo(m); setErro(""); setMensagem(""); setSenha(""); setConfirmarSenha(""); setNome(""); setTelefone(""); };

  const entrar = async () => {
    setCarregando(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) { setErro("E-mail ou senha inválidos."); return; }
    avisar("Login realizado");
  };

  const criarConta = async () => {
    if (!nome.trim()) { setErro("Informe seu nome."); return; }
    if (telefone.replace(/\D/g, "").length < 10) { setErro("Informe um telefone válido, com DDD."); return; }
    if (senha.length < 6) { setErro("A senha precisa de pelo menos 6 caracteres."); return; }
    if (senha !== confirmarSenha) { setErro("As senhas não são iguais."); return; }
    setCarregando(true); setErro(""); setMensagem("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: senha,
      options: { data: { nome: nome.trim(), telefone } },
    });
    setCarregando(false);
    if (error) { setErro(error.message === "User already registered" ? "Já existe uma conta com esse e-mail — tente entrar." : "Não deu pra criar a conta: " + error.message); return; }
    if (data.session) {
      avisar("Cadastro criado — aguardando aprovação do organizador");
    } else {
      // só cai aqui se a confirmação de e-mail estiver ligada no Supabase
      setMensagem("Cadastro criado! Se pedirem confirmação de e-mail, confira sua caixa de entrada (e o spam). Depois é só aguardar a aprovação do organizador.");
    }
  };

  const recuperar = async () => {
    if (!email.trim()) { setErro("Informe o e-mail da conta."); return; }
    setCarregando(true); setErro(""); setMensagem("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setCarregando(false);
    if (error) { setErro("Não deu pra enviar o e-mail: " + error.message); return; }
    setMensagem("Se esse e-mail tiver uma conta, chegou um link pra você definir uma senha nova.");
  };

  return (
    <Moldura compacta={modo === "criar"}>
      {modo === "entrar" && (
        <div className="space-y-4">
          <Aviso>Entre com seu e-mail e senha pra acessar o sistema.</Aviso>
          <div className="space-y-2.5">
            <CampoComIcone Icone={IconeEmail} type="email" placeholder="E-mail" value={email} autoFocus onChange={(e) => setEmail(e.target.value)} />
            <CampoSenha valor={senha} onChange={setSenha} placeholder="Senha" onEnter={entrar} />
          </div>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div>
            <Botao className="flex w-full items-center justify-center" style={{ gap: 6 }} onClick={entrar} disabled={carregando || !email || !senha}>
              {carregando ? "Entrando…" : <>Entrar <IconeSetaDireita tam={16} /></>}
            </Botao>
            <div className="mt-5 flex items-center justify-between" style={{ fontSize: 11.5 }}>
              <button onClick={() => trocarModo("criar")} style={{ color: T.secundario, textDecoration: "underline" }}>Criar usuário</button>
              <button onClick={() => trocarModo("recuperar")} style={{ color: T.secundario, textDecoration: "underline" }}>Esqueci minha senha</button>
            </div>
          </div>
        </div>
      )}

      {modo === "criar" && (
        <div className="space-y-4">
          <Aviso>
            <ol style={{ paddingLeft: 16 }}>
              <li>Preencha seus dados, um e-mail válido e crie uma senha.</li>
              <li className="mt-1">Aguarde a aprovação do organizador.</li>
              <li className="mt-1">Assim que ele aprovar, é só entrar com esse e-mail e senha.</li>
            </ol>
          </Aviso>
          <div className="space-y-2.5">
            <CampoComIcone Icone={IconeConta} type="text" placeholder="Nome" value={nome} autoFocus onChange={(e) => setNome(e.target.value)} />
            <CampoComIcone Icone={IconeTelefone} type="tel" placeholder="DDD 9 9999-9999" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} />
            <CampoComIcone Icone={IconeEmail} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <CampoSenha valor={senha} onChange={setSenha} placeholder="Crie uma senha (mín. 6 caracteres)" />
            <CampoSenha valor={confirmarSenha} onChange={setConfirmarSenha} placeholder="Confirme a senha" onEnter={criarConta} />
          </div>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          {mensagem && <Aviso tom="sucesso">{mensagem}</Aviso>}
          <div>
            <Botao className="flex w-full items-center justify-center" style={{ gap: 6 }} onClick={criarConta}
              disabled={carregando || !nome || !telefone || !email || !senha || !confirmarSenha}>
              {carregando ? "Criando…" : "Criar usuário"}
            </Botao>
            <button className="mt-5 w-full" onClick={() => trocarModo("entrar")} style={{ fontSize: 11.5, color: T.secundario, textDecoration: "underline" }}>
              Já tenho conta — entrar
            </button>
          </div>
        </div>
      )}

      {modo === "recuperar" && (
        <div className="space-y-4">
          <Aviso>Informe o e-mail da sua conta — mandamos um link pra você criar uma senha nova.</Aviso>
          <CampoComIcone Icone={IconeEmail} type="email" placeholder="E-mail" value={email} autoFocus onChange={(e) => setEmail(e.target.value)} />
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          {mensagem && <Aviso tom="sucesso">{mensagem}</Aviso>}
          <div>
            <Botao className="flex w-full items-center justify-center" style={{ gap: 6 }} onClick={recuperar} disabled={carregando || !email}>
              {carregando ? "Enviando…" : "Enviar link de recuperação"}
            </Botao>
            <button className="mt-5 w-full" onClick={() => trocarModo("entrar")} style={{ fontSize: 11.5, color: T.secundario, textDecoration: "underline" }}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </Moldura>
  );
}

/* ----------------------------- Aguardando aprovação -------------------------
 * Conta já logada (senão nem chegaria aqui), mas sem status "aprovado" ainda
 * — ver App.jsx. "recusado" e "sem perfil" (falha ao carregar) caem aqui
 * também, com um texto um pouco diferente. */
function TelaAguardandoAprovacao({ perfil, sessao }) {
  const recusado = perfil?.status === "recusado";
  return (
    <Moldura>
      <div className="space-y-4 text-center">
        <p style={{ fontSize: 15, fontWeight: 700, color: recusado ? T.vermelho : T.ouro }}>
          {recusado ? "Cadastro não aprovado" : "Cadastro em análise"}
        </p>
        <Aviso tom={recusado ? "erro" : "neutro"}>
          {recusado
            ? "O organizador não aprovou este cadastro. Se achar que foi engano, fale direto com ele."
            : "Sua conta foi criada e está esperando um organizador aprovar o acesso. Assim que aprovar, é só entrar de novo."}
        </Aviso>
        <p style={{ fontSize: 12, color: T.fraco }}>{sessao?.user?.email}</p>
        <Botao variante="secundario" className="w-full" onClick={() => supabase.auth.signOut()}>Sair</Botao>
      </div>
    </Moldura>
  );
}

/* ------------------------------- Nova senha ---------------------------------
 * Usada tanto no link de "esqueci minha senha" (Supabase loga a pessoa numa
 * sessão de recuperação e dispara o evento PASSWORD_RECOVERY, ver App.jsx)
 * quanto, se um dia precisar, num primeiro acesso com senha provisória. */
function TelaNovaSenha({ avisar, onConcluir }) {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    if (senha.length < 6) { setErro("A senha precisa de pelo menos 6 caracteres."); return; }
    if (senha !== confirmarSenha) { setErro("As senhas não são iguais."); return; }
    setCarregando(true); setErro("");
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) { setErro("Não deu pra salvar: " + error.message); return; }
    avisar("Senha atualizada");
    onConcluir();
  };

  return (
    <Moldura>
      <div className="space-y-4">
        <Aviso>Defina sua nova senha.</Aviso>
        <div className="space-y-2.5">
          <CampoSenha valor={senha} onChange={setSenha} placeholder="Senha nova (mín. 6 caracteres)" />
          <CampoSenha valor={confirmarSenha} onChange={setConfirmarSenha} placeholder="Confirme a senha nova" onEnter={salvar} />
        </div>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao className="flex w-full items-center justify-center" style={{ gap: 6 }} onClick={salvar} disabled={carregando || !senha || !confirmarSenha}>
          {carregando ? "Salvando…" : "Salvar senha"}
        </Botao>
      </div>
    </Moldura>
  );
}

export { TelaLogin, TelaAguardandoAprovacao, TelaNovaSenha };
