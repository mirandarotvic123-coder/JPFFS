-- ============================================================================
-- JPFFS — Lances no Cloudflare R2
-- ----------------------------------------------------------------------------
-- Rode no SQL Editor do painel, depois do 006/007. É idempotente.
-- Rode ANTES de subir o app novo (o app grava as colunas novas no insert).
--
-- Por quê: o Supabase free dá 5 GB/mês de download (egress) e os vídeos de
-- lance estouraram isso em out/2026 (12,7 GB). O R2 da Cloudflare no plano
-- gratuito não cobra download e guarda até 10 GB. Os metadados continuam aqui
-- (tabela "lances", RLS, Realtime) — só o arquivo de vídeo muda de lugar.
--
-- O que faz:
--  1) "armazenamento": onde está o arquivo ('supabase' = clipes antigos,
--     'r2' = novos). O app e a limpeza olham isso pra saber de onde ler/apagar.
--  2) "tamanho_bytes": tamanho do arquivo — no R2 não dá pra somar via
--     storage.objects, então a trava de espaço soma esta coluna.
--  3) uso_r2_lances(): bytes ocupados no R2 (só pro service_role / limpeza).
--  4) GRANT do service_role na tabela (mesmo conteúdo do 007 — repetido aqui
--     pra garantir caso o 007 não tenha sido rodado; sem ele a limpeza dá
--     "permission denied for table lances").
-- ============================================================================

-- 1) e 2) colunas novas -------------------------------------------------------
alter table public.lances
  add column if not exists armazenamento text not null default 'supabase';
alter table public.lances
  add column if not exists tamanho_bytes bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lances_armazenamento_check'
  ) then
    alter table public.lances
      add constraint lances_armazenamento_check check (armazenamento in ('supabase', 'r2'));
  end if;
end $$;

-- 3) uso do R2 ----------------------------------------------------------------
create or replace function public.uso_r2_lances()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(tamanho_bytes), 0)::bigint
  from public.lances
  where armazenamento = 'r2';
$$;

revoke all on function public.uso_r2_lances() from public;
grant execute on function public.uso_r2_lances() to service_role;

-- 4) limpeza (service_role) ---------------------------------------------------
grant select, delete on public.lances to service_role;

-- ============================================================================
-- Confira depois de rodar:
--   select column_name, data_type, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'lances'
--     and column_name in ('armazenamento', 'tamanho_bytes');
-- Deve listar as duas colunas (armazenamento com default 'supabase').
-- ============================================================================
