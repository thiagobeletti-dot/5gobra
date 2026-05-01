-- =============================================================
-- G Obra — RLS pra técnico anon (link mágico) salvar checklists
--
-- Problema: o RLS de checklists só permite empresa autenticada
-- (auth.uid() existir). Técnico abre o link sem login (anon),
-- então não consegue inserir/atualizar M1/M2.
--
-- Solução MVP (igual ao que já tá em cards/historico_card/anexos):
-- policies permissivas pra anon. Validação real do token via
-- edge function fica pra antes de produção pública.
--
-- Rodar no SQL Editor do Supabase.
-- =============================================================

-- Anon (técnico/cliente via link) pode ler checklists
drop policy if exists "checklists_anon_select" on checklists;
create policy "checklists_anon_select" on checklists
  for select using (true);

-- Anon pode inserir checklists (técnico preenchendo M1/M2)
drop policy if exists "checklists_anon_insert" on checklists;
create policy "checklists_anon_insert" on checklists
  for insert with check (true);

-- Anon pode atualizar checklists (técnico editando M1/M2 já salvo)
drop policy if exists "checklists_anon_update" on checklists;
create policy "checklists_anon_update" on checklists
  for update using (true) with check (true);

-- =============================================================
-- NOTA DE SEGURANÇA:
-- Igual ao que já existia em cards/historico_card/anexos, essas
-- policies "all true" são permissivas demais pra produção.
-- Servem pra MVP/beta fechado entre 2-3 empresas conhecidas.
-- Antes de abrir público, refatorar pra:
--   - Edge Functions validando token do técnico
--   - Postgres function com SECURITY DEFINER que valida token
-- =============================================================
