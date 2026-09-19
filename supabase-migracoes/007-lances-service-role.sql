-- ============================================================================
-- JPFFS — Gravação de Lances: dá à Edge Function de limpeza acesso à tabela
-- ----------------------------------------------------------------------------
-- Rode no SQL Editor do painel do Supabase. É idempotente.
--
-- Por quê: a Edge Function "limpar-lances" roda como service_role. O service_role
-- ignora a RLS, mas NÃO ignora os GRANTs — e a tabela "lances" (criada por SQL no
-- 004) só liberou select/insert/delete pro papel "authenticated". Resultado: a
-- função era chamada (HTTP 200) e falhava por dentro com
-- "permission denied for table lances", sem apagar nada (mesma pegadinha do 001).
-- ============================================================================

grant select, delete on public.lances to service_role;

-- Conferir:
--   select grantee, string_agg(privilege_type, ', ') from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'lances' group by grantee;
--   -> service_role deve listar DELETE e SELECT.
