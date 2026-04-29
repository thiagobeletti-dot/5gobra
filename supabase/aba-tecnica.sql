-- =============================================================
-- G Obra — Phase 2: nova aba "Técnica" + simplificação dos status
-- de Em Andamento.
--
-- 1. Adiciona valor 'tecnica' ao enum aba_card.
-- 2. (Status em andamento são strings livres, não precisam de migration.)
--
-- Rodar no SQL Editor do Supabase.
-- =============================================================

-- Adiciona 'tecnica' como valor possível no enum.
-- Postgres permite adicionar valores em enum existente sem locking pesado.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'tecnica'
      and enumtypid = (select oid from pg_type where typname = 'aba_card')
  ) then
    alter type aba_card add value 'tecnica' before 'emandamento';
  end if;
end $$;
