import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";
import { T, FUNDO_APP, ESCUDO } from "./theme";
import { CONFIG_PADRAO, calcularClassificacao } from "./core/regras";
import { carregarBase, salvarBase, migrarBase } from "./core/repositorio";
import { baseOficial } from "./data/baseOficial";
import {
  IconeTabela, IconeRodada, IconeElenco, IconeAjustes, IconeConta,
} from "./components/icones";
import { ModalLogin } from "./components/ModalLogin";
import { TelaRodada } from "./telas/TelaRodada";
import { TelaClassificacao } from "./telas/TelaClassificacao";
import { TelaElenco } from "./telas/TelaElenco";
import { TelaConfig } from "./telas/TelaConfig";

export default function App() {
  const [base, setBase] = useState(null);
  const [aba, setAba] = useState("tabela");
  const [aviso, setAviso] = useState(null);
  const [sessao, setSessao] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const pularProximoSalvar = useRef(false);
  const salvandoPendenteRef = useRef(false); // true enquanto há uma alteração local ainda não gravada

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { (async () => setBase((await carregarBase()) || baseOficial()))(); }, []);
  useEffect(() => {
    const sincronizar = async () => {
      if (document.visibilityState !== "visible") return;
      if (salvandoPendenteRef.current) return; // há alteração local pendente de salvar — não sobrescrever
      const nova = await carregarBase();
      if (nova) { pularProximoSalvar.current = true; setBase(nova); }
    };
    document.addEventListener("visibilitychange", sincronizar);
    window.addEventListener("focus", sincronizar);
    return () => {
      document.removeEventListener("visibilitychange", sincronizar);
      window.removeEventListener("focus", sincronizar);
    };
  }, []);
  useEffect(() => {
    const canal = supabase
      .channel("base:realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "base" }, (payload) => {
        const nova = payload.new?.dados;
        if (nova && Object.keys(nova).length && !salvandoPendenteRef.current) {
          pularProximoSalvar.current = true;
          setBase(migrarBase(nova));
          if (payload.new.atualizado_por && payload.new.atualizado_por !== sessao?.user?.email) {
            setAviso(`Atualizado por ${payload.new.atualizado_por}`);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [sessao?.user?.email]);
  useEffect(() => {
    if (!base) return;
    if (pularProximoSalvar.current) { pularProximoSalvar.current = false; return; }
    if (!sessao) return;
    salvandoPendenteRef.current = true;
    const t = setTimeout(async () => {
      await salvarBase(base);
      salvandoPendenteRef.current = false;
    }, 250);
    return () => clearTimeout(t);
  }, [base, sessao]);

  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(null), 3600); return () => clearTimeout(t); } }, [aviso]);
  useEffect(() => { if (!sessao && aba !== "tabela") setAba("tabela"); }, [sessao, aba]);

  const dados = useMemo(() => (base ? calcularClassificacao(base) : null), [base]);
  if (!base || !dados)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: FUNDO_APP, color: T.secundario, gap: 14 }}>
        <img src={ESCUDO} alt="JPFFS" style={{ height: 88, width: "auto", opacity: 0.9 }} />
        <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase" }}>Carregando base…</span>
      </div>
    );

  const cfg = { ...CONFIG_PADRAO, ...base.config, pesos: { ...CONFIG_PADRAO.pesos, ...(base.config?.pesos || {}) } };
  const abas = [
    { id: "tabela", rotulo: "Tabela", Icone: IconeTabela }, { id: "rodada", rotulo: "Rodada", Icone: IconeRodada },
    { id: "elenco", rotulo: "Elenco", Icone: IconeElenco }, { id: "config", rotulo: "Ajustes", Icone: IconeAjustes },
  ].filter((a) => sessao || a.id === "tabela");

  return (
    <div style={{ minHeight: "100vh", background: FUNDO_APP, color: T.texto, fontVariantNumeric: "tabular-nums", fontFamily: "var(--fonte-corpo)" }}>
      <header className="cabecalho-app sticky top-0 z-20 px-4 py-2.5" style={{ background: "rgba(0,16,57,.94)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.borda}` }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between" style={{ gap: 8 }}>
          <div className="flex items-center" style={{ gap: 9, minWidth: 0 }}>
            <img src={ESCUDO} alt="" style={{ height: 26, width: "auto", display: "block", flexShrink: 0 }} />
            <span className="font-destaque truncate" style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: ".01em", color: T.texto }}>Campeonato JPFFS</span>
          </div>
          <div className="flex items-center" style={{ gap: 10, flexShrink: 0 }}>
            {sessao && <span className="font-destaque" style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
              color: T.ouro, border: `1px solid ${T.ouro}`, borderRadius: 999, padding: "3px 9px",
            }}>Organizador</span>}
            <button
              onClick={() => sessao ? supabase.auth.signOut() : setMostrarLogin(true)}
              className="flex items-center rounded-full"
              style={{
                gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: ".04em",
                padding: sessao ? 8 : "7px 13px 7px 9px",
                border: `1px solid ${sessao ? T.tier4 : T.borda}`,
                color: sessao ? T.secundario : T.texto, background: "transparent",
              }}
              title={sessao ? `Sair — logado como ${sessao.user.email}` : "Entrar como organizador"}>
              <IconeConta tam={15} />
              {!sessao && "Entrar"}
            </button>
          </div>
        </div>
      </header>

      {mostrarLogin && <ModalLogin fechar={() => setMostrarLogin(false)} avisar={setAviso} />}

      {aviso && <div className="fixed left-1/2 z-30 w-11/12 max-w-sm -translate-x-1/2 rounded-lg px-4 py-3 text-center"
        style={{ bottom: 150, background: T.ouro, color: T.sobreOuro, fontWeight: 800, fontSize: 13.5, boxShadow: "0 8px 28px rgba(0,0,0,.5)" }}>{aviso}</div>}

      <main className="conteudo-principal mx-auto max-w-5xl px-3 pt-4" style={{ paddingBottom: 104 }}>
        {aba === "rodada" && sessao && <TelaRodada {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
        {aba === "tabela" && <TelaClassificacao {...{ base, dados, cfg, avisar: setAviso }} />}
        {aba === "elenco" && sessao && <TelaElenco {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
        {aba === "config" && sessao && <TelaConfig {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
      </main>

      <nav className="nav-principal fixed bottom-0 left-0 right-0 z-20" style={{ background: "rgba(0,16,57,.97)", borderTop: `1px solid ${T.borda}` }}>
        <div className="mx-auto flex max-w-5xl">
          {abas.map((a) => {
            const ativo = aba === a.id;
            return (
              <button key={a.id} onClick={() => setAba(a.id)} title={a.rotulo} className="flex flex-1 flex-col items-center nav-item"
                style={{ gap: 3, padding: "11px 0 13px", color: ativo ? T.ouro : T.fraco, fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                <span className="nav-item-icone" style={{ display: "inline-flex", borderRadius: 10, padding: 6, background: ativo ? T.tier2 : "transparent" }}>
                  <a.Icone tam={19} cor={ativo ? T.ouro : T.fraco} />
                </span>
                <span className="nav-item-rotulo">{a.rotulo}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
