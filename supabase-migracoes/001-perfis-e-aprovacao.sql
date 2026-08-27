-- ============================================================================
-- JPFFS — perfis de usuário, login obrigatório e aprovação pelo organizador
-- ----------------------------------------------------------------------------
-- Rode este arquivo INTEIRO, de uma vez, no SQL Editor do painel do Supabase
-- (projeto do JPFFS → SQL Editor → New query → cola tudo → Run).
-- É idempotente: pode rodar de novo sem duplicar nada.
--
-- O que ele faz:
--  1) Cria a tabela "perfis" (papel jogador/organizador, status pendente/
--     aprovado/recusado) — uma linha por conta de login.
--  2) Cria um gatilho que dá um perfil "jogador"/"pendente" pra toda conta
--     nova sozinho (ninguém escolhe o próprio papel, evita autopromoção).
--  3) Promove quem JÁ tem login hoje (as contas de organizador que você já
--     usa) pra "organizador"/"aprovado" automaticamente — sem isso, seu
--     próprio login pararia de funcionar depois deste script.
--  4) Reaperta as regras da tabela "base": leitura passa a exigir login +
--     aprovação (acaba o acesso público de hoje); escrita continua só pra
--     organizador aprovado, do jeito que já era.
--  5) Reaperta o bucket de fotos ("avatares") do mesmo jeito.
-- ============================================================================

-- 1) Tabela de perfis --------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  papel text not null default 'jogador' check (papel in ('jogador', 'organizador')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references auth.users(id)
);

alter table public.perfis enable row level security;

-- 2) Gatilho: toda conta nova ganha um perfil "jogador"/"pendente" sozinha --
-- O client NUNCA insere em "perfis" diretamente (não existe policy de INSERT
-- pra authenticated mais abaixo) — só este gatilho grava, rodando com
-- privilégio de dono (security definer). É o que impede alguém se cadastrar
-- já como organizador ou já aprovado.
create or replace function public.lidar_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.lidar_novo_usuario();

-- 3) Backfill: quem já tinha login antes desse recurso existir é organizador
-- aprovado — era o único tipo de conta que existia até agora. Sem isso o seu
-- próprio login de organizador ficaria bloqueado depois deste script.
insert into public.perfis (id, email, papel, status)
select id, email, 'organizador', 'aprovado' from auth.users
on conflict (id) do update set papel = 'organizador', status = 'aprovado';

-- 4) Funções auxiliares -------------------------------------------------------
-- security definer só pra furar a recursão de RLS em cima da própria
-- "perfis" (uma policy de "perfis" não pode consultar "perfis" direto sob a
-- própria RLS). Não recebem parâmetro nenhum do chamador — só olham
-- auth.uid() do usuário logado — e o EXECUTE fica restrito a "authenticated"
-- logo abaixo (não fica exposta pra "anon" nem callable como endpoint
-- público de graça).
create or replace function public.eh_aprovado()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfis where id = auth.uid() and status = 'aprovado'
  );
$$;

create or replace function public.eh_organizador_aprovado()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'organizador' and status = 'aprovado'
  );
$$;

revoke all on function public.eh_aprovado() from public;
revoke all on function public.eh_organizador_aprovado() from public;
grant execute on function public.eh_aprovado() to authenticated;
grant execute on function public.eh_organizador_aprovado() to authenticated;

-- 5) Policies de "perfis" -----------------------------------------------------
drop policy if exists "usuario ve o proprio perfil" on public.perfis;
create policy "usuario ve o proprio perfil" on public.perfis
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "organizador ve todos os perfis" on public.perfis;
create policy "organizador ve todos os perfis" on public.perfis
  for select to authenticated
  using (public.eh_organizador_aprovado());

drop policy if exists "organizador decide sobre perfis" on public.perfis;
create policy "organizador decide sobre perfis" on public.perfis
  for update to authenticated
  using (public.eh_organizador_aprovado())
  with check (public.eh_organizador_aprovado());

-- Sem policy de INSERT/DELETE pra "perfis": só o gatilho grava. Se um dia
-- precisar apagar de vez um cadastro recusado, faça pelo Table Editor do
-- painel (ou peça pra eu adicionar uma policy de delete pro organizador).

-- 6) Reaperta "base": derruba QUALQUER policy antiga (não sei os nomes das
-- que já existem no seu projeto, então em vez de chutar nomes — e correr o
-- risco de uma policy antiga mais aberta continuar valendo ao lado da nova
-- — apaga todas e recria do zero) -------------------------------------------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'base'
  loop
    execute format('drop policy %I on public.base', pol.policyname);
  end loop;
end $$;

create policy "aprovados leem a base" on public.base
  for select to authenticated
  using (public.eh_aprovado());

create policy "organizadores inserem na base" on public.base
  for insert to authenticated
  with check (public.eh_organizador_aprovado());

create policy "organizadores atualizam a base" on public.base
  for update to authenticated
  using (public.eh_organizador_aprovado())
  with check (public.eh_organizador_aprovado());

create policy "organizadores excluem da base" on public.base
  for delete to authenticated
  using (public.eh_organizador_aprovado());

-- 7) Reaperta o bucket de fotos "avatares" (mesmo raciocínio do passo 6:
-- apaga as policies antigas do bucket e recria). Envio/troca de foto continua
-- só organizador; LEITURA fica pra qualquer aprovado (jogador ou
-- organizador) — a Tabela pública mostra a foto ao expandir um jogador, não
-- é só tela de organizador. Isso NÃO mexe em quem pode ver a foto pela URL
-- pública direto (bypassa RLS se o bucket estiver marcado "Public" em
-- Storage > avatares) — só afeta acesso que passa pela RLS mesmo. --------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (qual ilike '%avatares%' or with_check ilike '%avatares%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "organizadores enviam avatares" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and public.eh_organizador_aprovado());

create policy "organizadores atualizam avatares" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and public.eh_organizador_aprovado())
  with check (bucket_id = 'avatares' and public.eh_organizador_aprovado());

create policy "aprovados leem avatares" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and public.eh_aprovado());

-- ============================================================================
-- Depois de rodar: confira o resultado abaixo. As contas que você já usa hoje
-- pra logar como organizador devem aparecer com papel='organizador' e
-- status='aprovado'. Se alguma não aparecer assim, ajuste na mão:
--   update public.perfis set papel = 'organizador', status = 'aprovado'
--   where email = 'email-do-organizador@exemplo.com';
-- ============================================================================
select id, email, papel, status, criado_em from public.perfis order by criado_em;
