import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";
import { T, FUNDO_APP, ESCUDO } from "./theme";
import { CONFIG_PADRAO, calcularClassificacao } from "./core/regras";
import { carregarBase, salvarBase, migrarBase, buscarPerfil } from "./core/repositorio";
import { baseOficial } from "./data/baseOficial";
import {
  IconeTabela, IconeRodada, IconeElenco, IconeAjustes, IconeConta, IconeRachao, IconeCamera,
} from "./components/icones";
import { TelaLogin, TelaAguardandoAprovacao, TelaNovaSenha } from "./telas/TelaAcesso";
import { TelaRodada } from "./telas/TelaRodada";
import { TelaClassificacao } from "./telas/TelaClassificacao";
import { TelaElenco } from "./telas/TelaElenco";
import { TelaConfig } from "./telas/TelaConfig";
import { TelaRachao } from "./telas/TelaRachao";
import { TelaGaleria } from "./telas/TelaGaleria";
import { TelaCamera } from "./telas/TelaCamera";

/* ?camera=1 na URL → o aparelho vira uma câmera de gravação (link mandado só
 * pra quem vai disponibilizar o celular). Continua exigindo login aprovado. */
const MODO_CAMERA = new URLSearchParams(window.location.search).get("camera") === "1";

/* Tela cheia de "carregando…" — usada nas várias etapas de resolver sessão/
 * perfil/base antes do app de verdade poder aparecer. */
function SpinnerCarregando({ texto }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: FUNDO_APP, color: T.secundario, gap: 14 }}>
      <img src={ESCUDO} alt="JPFFS" style={{ height: 88, width: "auto", opacity: 0.9 }} />
      <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase" }}>{texto}</span>
    </div>
  );
}

export default function App() {
  const [base, setBase] = useState(null);
  const [aba, setAba] = useState("tabela");
  const [aviso, setAviso] = useState(null);
  const [sessao, setSessao] = useState(null);
  const [sessaoResolvida, setSessaoResolvida] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [perfilResolvido, setPerfilResolvido] = useState(false);
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const pularProximoSalvar = useRef(false);
  const salvandoPendenteRef = useRef(false); // true enquanto há uma alteração local ainda não gravada

  /* Todo mundo precisa logar hoje em dia (ver supabase-migracoes/001-*) —
   * "organizador" é quem tem papel=organizador E status=aprovado no perfil;
   * "jogador" aprovado só enxerga a Tabela, igual o visitante público de
   * antes. PASSWORD_RECOVERY é o evento que o Supabase dispara quando a
   * pessoa clica no link de "esqueci minha senha". */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSessao(data.session); setSessaoResolvida(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === "PASSWORD_RECOVERY") setModoRecuperacao(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* Busca o perfil (papel/status) sempre que a sessão muda, e de novo quando
   * a aba volta a ficar visível — assim, quem está na tela de "aguardando
   * aprovação" entra sozinho assim que o organizador aprovar, sem precisar
   * deslogar e logar de novo. */
  useEffect(() => {
    if (!sessao) { setPerfil(null); setPerfilResolvido(true); return; }
    let cancelado = false;
    const buscar = async () => {
      const p = await buscarPerfil(sessao.user.id);
      if (!cancelado) { setPerfil(p); setPerfilResolvido(true); }
    };
    setPerfilResolvido(false);
    buscar();
    const aoFicarVisivel = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", aoFicarVisivel);
    window.addEventListener("focus", aoFicarVisivel);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoFicarVisivel);
      window.removeEventListener("focus", aoFicarVisivel);
    };
  }, [sessao?.user?.id]);

  const souOrganizador = perfil?.papel === "organizador" && perfil?.status === "aprovado";
  const souAprovado = perfil?.status === "aprovado";

  /* A base só é buscada depois que o perfil está aprovado — antes disso a
   * RLS do banco bloqueia a leitura mesmo (ver migração), então nem vale
   * tentar. Refaz sozinho se a aprovação chegar sem reload (ver efeito acima). */
  useEffect(() => {
    if (!souAprovado) return;
    let cancelado = false;
    (async () => { const b = await carregarBase(); if (!cancelado) setBase(b || baseOficial()); })();
    return () => { cancelado = true; };
  }, [souAprovado]);

  useEffect(() => {
    const sincronizar = async () => {
      if (!souAprovado) return;
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
  }, [souAprovado]);
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
    if (!souOrganizador) return; // só organizador grava — jogador aprovado é só leitura
    salvandoPendenteRef.current = true;
    const t = setTimeout(async () => {
      await salvarBase(base);
      salvandoPendenteRef.current = false;
    }, 250);
    return () => clearTimeout(t);
  }, [base, souOrganizador]);

  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(null), 3600); return () => clearTimeout(t); } }, [aviso]);
  useEffect(() => {
    if (!souOrganizador && aba !== "tabela" && aba !== "lances") setAba("tabela");
  }, [souOrganizador, aba]);

  const dados = useMemo(() => (base ? calcularClassificacao(base) : null), [base]);

  if (modoRecuperacao) return <TelaNovaSenha avisar={setAviso} onConcluir={() => setModoRecuperacao(false)} />;
  if (!sessaoResolvida) return <SpinnerCarregando texto="Carregando…" />;
  if (!sessao) return <TelaLogin avisar={setAviso} />;
  if (!perfilResolvido) return <SpinnerCarregando texto="Carregando…" />;
  if (!souAprovado) return <TelaAguardandoAprovacao perfil={perfil} sessao={sessao} />;

  /* Modo câmera: shell mínimo (sem navegação) — o aparelho é só uma câmera. */
  if (MODO_CAMERA) {
    return (
      <div style={{ minHeight: "100vh", background: FUNDO_APP, color: T.texto, fontFamily: "var(--fonte-corpo)" }}>
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5"
          style={{ background: "rgba(0,16,57,.94)", borderBottom: `1px solid ${T.borda}` }}>
          <div className="flex items-center" style={{ gap: 9 }}>
            <img src={ESCUDO} alt="" style={{ height: 24, width: "auto" }} />
            <span className="font-destaque" style={{ fontSize: 14, fontWeight: 700 }}>Câmera JPFFS</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} title={`Sair — ${sessao.user.email}`}
            style={{ padding: 8, border: `1px solid ${T.tier4}`, borderRadius: 999, color: T.secundario, background: "transparent" }}>
            <IconeConta tam={15} />
          </button>
        </header>
        {aviso && <div className="fixed left-1/2 z-30 w-11/12 max-w-sm -translate-x-1/2 rounded-lg px-4 py-3 text-center"
          style={{ bottom: 24, background: T.ouro, color: T.sobreOuro, fontWeight: 800, fontSize: 13.5, boxShadow: "0 8px 28px rgba(0,0,0,.5)" }}>{aviso}</div>}
        <main className="mx-auto px-3 pt-4" style={{ maxWidth: 520, paddingBottom: 40 }}>
          <TelaCamera perfil={perfil} avisar={setAviso} />
        </main>
      </div>
    );
  }

  if (!base || !dados) return <SpinnerCarregando texto="Carregando base…" />;

  const cfg = { ...CONFIG_PADRAO, ...base.config, pesos: { ...CONFIG_PADRAO.pesos, ...(base.config?.pesos || {}) } };
  const abas = [
    { id: "tabela", rotulo: "Tabela", Icone: IconeTabela }, { id: "rodada", rotulo: "Rodada", Icone: IconeRodada },
    { id: "rachao", rotulo: "Rachão", Icone: IconeRachao },
    { id: "lances", rotulo: "Lances", Icone: IconeCamera },
    { id: "elenco", rotulo: "Elenco", Icone: IconeElenco }, { id: "config", rotulo: "Ajustes", Icone: IconeAjustes },
  ].filter((a) => souOrganizador || a.id === "tabela" || a.id === "lances");

  return (
    <div style={{ minHeight: "100vh", background: FUNDO_APP, color: T.texto, fontVariantNumeric: "tabular-nums", fontFamily: "var(--fonte-corpo)" }}>
      <header className="cabecalho-app sticky top-0 z-20 px-4 py-2.5" style={{ background: "rgba(0,16,57,.94)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.borda}` }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between" style={{ gap: 8 }}>
          <div className="flex items-center" style={{ gap: 9, minWidth: 0 }}>
            <img src={ESCUDO} alt="" style={{ height: 26, width: "auto", display: "block", flexShrink: 0 }} />
            <span className="font-destaque truncate" style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: ".01em", color: T.texto }}>Campeonato JPFFS</span>
          </div>
          <div className="flex items-center" style={{ gap: 10, flexShrink: 0 }}>
            {souOrganizador && <span className="font-destaque" style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
              color: T.ouro, border: `1px solid ${T.ouro}`, borderRadius: 999, padding: "3px 9px",
            }}>Organizador</span>}
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center rounded-full"
              style={{ gap: 6, padding: 8, border: `1px solid ${T.tier4}`, color: T.secundario, background: "transparent" }}
              title={`Sair — logado como ${sessao.user.email}`}>
              <IconeConta tam={15} />
            </button>
          </div>
        </div>
      </header>

      {aviso && <div className="fixed left-1/2 z-30 w-11/12 max-w-sm -translate-x-1/2 rounded-lg px-4 py-3 text-center"
        style={{ bottom: 150, background: T.ouro, color: T.sobreOuro, fontWeight: 800, fontSize: 13.5, boxShadow: "0 8px 28px rgba(0,0,0,.5)" }}>{aviso}</div>}

      <main className="conteudo-principal mx-auto max-w-5xl px-3 pt-4" style={{ paddingBottom: 104 }}>
        {aba === "rodada" && souOrganizador && <TelaRodada {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
        {aba === "rachao" && souOrganizador && <TelaRachao {...{ base, avisar: setAviso }} />}
        {aba === "lances" && souAprovado && <TelaGaleria {...{ perfil, avisar: setAviso }} />}
        {aba === "tabela" && <TelaClassificacao {...{ base, dados, cfg, avisar: setAviso }} />}
        {aba === "elenco" && souOrganizador && <TelaElenco {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
        {aba === "config" && souOrganizador && <TelaConfig {...{ base, setBase, dados, cfg, avisar: setAviso, sessao }} />}
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
