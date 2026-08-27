-- ============================================================================
-- JPFFS — Gravação de Lances: tabela de metadados + bucket de vídeo
-- ----------------------------------------------------------------------------
-- Rode este arquivo no SQL Editor do Supabase, depois do 001/002/003.
--
-- Clipes de TESTE devem usar partida_id = 'teste-camera' — assim dá pra
-- identificar e apagar em massa depois:
--   delete from public.lances where partida_id = 'teste-camera';
-- (o bucket organiza os arquivos em pastas por partida_id, então os vídeos de
-- teste ficam isolados na pasta lances/teste-camera/ no Storage também — dá
-- pra apagar a pasta inteira ali no painel se preferir.)
-- ============================================================================

-- 1) Tabela de metadados -----------------------------------------------------
create table if not exists public.lances (
  id uuid primary key default gen_random_uuid(),
  modalidade text not null check (modalidade in ('campeonato', 'rachao')),
  partida_id text not null,
  tipo text not null check (tipo in ('gol', 'lance')),
  jogador_id text,
  jogador_nome text,
  angulo int not null,
  caminho_storage text not null,
  formato text not null,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

alter table public.lances enable row level security;

drop policy if exists "aprovados leem lances" on public.lances;
create policy "aprovados leem lances" on public.lances
  for select to authenticated
  using (public.eh_aprovado());

drop policy if exists "aprovados registram lances" on public.lances;
create policy "aprovados registram lances" on public.lances
  for insert to authenticated
  with check (public.eh_aprovado());

drop policy if exists "organizador exclui lances" on public.lances;
create policy "organizador exclui lances" on public.lances
  for delete to authenticated
  using (public.eh_organizador_aprovado());

-- GRANT à parte da RLS (mesma pegadinha do 001 — tabela criada por SQL direto
-- não libera acesso pro papel authenticated sozinha).
grant select, insert, delete on public.lances to authenticated;

-- 2) Bucket de vídeo ----------------------------------------------------------
-- Privado (não público) — acesso só via link assinado (createSignedUrl),
-- gerado no app pra quem está aprovado. Mesma filosofia do "avatares".
insert into storage.buckets (id, name, public)
values ('lances', 'lances', false)
on conflict (id) do nothing;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (qual ilike '%lances%' or with_check ilike '%lances%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "aprovados enviam lances" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lances' and public.eh_aprovado());

create policy "aprovados leem lances (storage)" on storage.objects
  for select to authenticated
  using (bucket_id = 'lances' and public.eh_aprovado());

create policy "organizador exclui lances (storage)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'lances' and public.eh_organizador_aprovado());

-- ============================================================================
-- Depois de rodar, confira: select * from storage.buckets where id = 'lances';
-- deve aparecer public = false.
-- ============================================================================
