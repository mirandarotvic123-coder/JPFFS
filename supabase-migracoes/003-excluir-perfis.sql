-- ============================================================================
-- JPFFS — organizador pode excluir um cadastro de acesso
-- ----------------------------------------------------------------------------
-- Rode este arquivo no SQL Editor do Supabase, depois do 001 e 002.
--
-- IMPORTANTE: isso apaga só a linha em "perfis" (o pedido de acesso — nome,
-- telefone, papel, status). NÃO apaga o login em si (a conta de e-mail/senha
-- fica em auth.users, fora do alcance do app sem a chave secreta do
-- Supabase). Pra apagar o login de verdade também — por exemplo, pra poder
-- reusar aquele e-mail do zero — use o painel do Supabase:
-- Authentication → Users → (selecionar a conta) → Delete user.
-- ============================================================================

drop policy if exists "organizador exclui perfis" on public.perfis;
create policy "organizador exclui perfis" on public.perfis
  for delete to authenticated
  using (public.eh_organizador_aprovado());

grant delete on public.perfis to authenticated;
