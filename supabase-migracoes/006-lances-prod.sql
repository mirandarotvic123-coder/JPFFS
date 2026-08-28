-- ============================================================================
-- JPFFS — Gravação de Lances: ajustes pra produção
-- ----------------------------------------------------------------------------
-- Rode no SQL Editor do painel do Supabase, depois do 004. É idempotente.
--
-- O que faz:
--  1) Liga o Realtime na tabela "lances" (a Galeria atualiza sozinha).
--  2) Adiciona "partida_rotulo" (texto amigável da partida, ex.: "Rachão ·
--     sábado, 30 de agosto") — a Galeria agrupa por isso sem depender da base.
--  3) Cria uma função que devolve quanto o bucket "lances" está ocupando
--     (bytes) — usada pela limpeza automática pra saber quando expurgar por
--     falta de espaço.
--  4) Índices pra Galeria e pra limpeza.
--
-- A limpeza automática em si é uma Edge Function ("limpar-lances") + um Cron
-- Job — ver supabase-migracoes/limpar-lances/ e o passo-a-passo no fim deste
-- arquivo.
-- ============================================================================

-- 1) Realtime -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lances'
  ) then
    execute 'alter publication supabase_realtime add table public.lances';
  end if;
end $$;
alter table public.lances replica identity full;

-- 2) Rótulo da partida --------------------------------------------------------
alter table public.lances add column if not exists partida_rotulo text;

-- 3) Uso do bucket "lances" (bytes) — pra limpeza por espaço -----------------
-- security definer porque "storage.objects" não é acessível pro service_role
-- por padrão via API; a função roda como dona e o EXECUTE fica só pro
-- service_role (quem chama é a Edge Function de limpeza).
create or replace function public.uso_bucket_lances()
returns bigint
language sql
security definer
set search_path = public, storage
stable
as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)
  from storage.objects
  where bucket_id = 'lances';
$$;

revoke all on function public.uso_bucket_lances() from public;
grant execute on function public.uso_bucket_lances() to service_role;

-- 4) Índices ---------------------------------------------------------------
create index if not exists lances_partida_criado_idx on public.lances (partida_id, criado_em desc);
create index if not exists lances_modalidade_criado_idx on public.lances (modalidade, criado_em desc);
create index if not exists lances_criado_idx on public.lances (criado_em);

-- ============================================================================
-- LIMPEZA AUTOMÁTICA — passo a passo (só uma vez)
-- ----------------------------------------------------------------------------
-- a) Deploy da Edge Function:
--    - Painel → Edge Functions → Deploy a new function → nome "limpar-lances"
--    - cole o conteúdo de supabase-migracoes/limpar-lances/index.ts
--    - (a função usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY, que o Supabase
--      injeta automaticamente — não precisa configurar secret nenhum)
--
-- b) Agende o Cron Job. O jeito mais simples é pelo painel:
--    - Painel → Integrations → Cron → Create job
--    - Name: limpar-lances   |   Schedule: */30 * * * *   (a cada 30 min)
--    - Type: "Supabase Edge Function" → selecione "limpar-lances" → método POST
--    - Create
--
--    (Alternativa por SQL, se preferir — precisa guardar a service_role key no
--    Vault antes: Project Settings → API copia a "service_role" secret, aí:
--      select vault.create_secret('COLE_A_SERVICE_ROLE_KEY_AQUI', 'service_role_key');
--    e então:
--      select cron.schedule('limpar-lances', '*/30 * * * *', $$
--        select net.http_post(
--          url := 'https://njwhdzntwzgoxcyhhwod.supabase.co/functions/v1/limpar-lances',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
--          )
--        );
--      $$);
--    )
--
-- c) Conferir depois de um tempo: select * from cron.job_run_details order by start_time desc limit 5;
-- ============================================================================
