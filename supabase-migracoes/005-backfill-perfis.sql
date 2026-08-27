-- ============================================================================
-- JPFFS — rede de segurança: cria "perfis" pra contas que ficaram sem
-- ----------------------------------------------------------------------------
-- Rode no SQL Editor do painel do Supabase, depois do 001/002/003/004.
-- É idempotente.
--
-- POR QUE: o gatilho "ao_criar_usuario" (migração 001) cria a linha em
-- "perfis" pra toda conta nova. Mas contas criadas ENQUANTO a 001 ainda não
-- tinha rodado inteira (o gatilho ainda não existia) ficaram órfãs: existem em
-- auth.users, não têm perfil, e por isso NÃO aparecem na tela de "Cadastros de
-- acesso" pro organizador aprovar. Isto aqui varre e conserta.
--
-- Contas órfãs entram como jogador/pendente (padrão da tabela) — ou seja,
-- passam a aparecer pro organizador decidir. Não mexe em quem já tem perfil.
-- ============================================================================

insert into public.perfis (id, email, nome, telefone)
select u.id,
       u.email,
       u.raw_user_meta_data ->> 'nome',
       u.raw_user_meta_data ->> 'telefone'
from auth.users u
left join public.perfis p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Confira o resultado:
select p.email, p.papel, p.status, p.nome, p.criado_em
from public.perfis p
order by p.criado_em;
