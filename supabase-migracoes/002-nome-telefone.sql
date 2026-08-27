-- ============================================================================
-- JPFFS — nome e telefone no cadastro
-- ----------------------------------------------------------------------------
-- Rode este arquivo INTEIRO no SQL Editor do Supabase, depois do 001. Também
-- é idempotente.
-- ============================================================================

-- 1) Colunas novas em "perfis" (contas já existentes ficam com nome/telefone
-- em branco — não é obrigatório em quem já tinha login antes disso existir).
alter table public.perfis add column if not exists nome text;
alter table public.perfis add column if not exists telefone text;

-- 2) O gatilho de conta nova passa a gravar nome/telefone também — eles vêm
-- no "options.data" do signUp (ver TelaAcesso.jsx), que o Supabase guarda em
-- auth.users.raw_user_meta_data.
create or replace function public.lidar_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome, telefone)
  values (new.id, new.email, new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'telefone')
  on conflict (id) do nothing;
  return new;
end;
$$;
