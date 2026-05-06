-- =============================================================
-- G Obra — Adiciona campos extras na tabela empresas
-- =============================================================
-- Adiciona CNPJ e telefone (preenchidos no cadastro etapa 1) e a
-- coluna pra rastreio de quando o admin atualiza dados.
-- Idempotente (pode rodar varias vezes sem dar erro).
--
-- Como rodar:
--   Supabase Dashboard -> SQL Editor -> cole esse arquivo -> Run
-- =============================================================

alter table empresas
  add column if not exists cnpj text;

alter table empresas
  add column if not exists telefone text;

alter table empresas
  add column if not exists atualizado_em timestamptz default now();

-- Trigger pra atualizar atualizado_em automaticamente em UPDATE
create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_empresas_atualizado_em on empresas;
create trigger trg_empresas_atualizado_em
  before update on empresas
  for each row execute function set_atualizado_em();

-- =============================================================
-- Notas:
-- 1) cnpj/telefone sao opcionais (nullable). Empresas existentes
--    nao quebram. Cadastros novos preenchem direto.
-- 2) atualizado_em ajuda a saber quando o admin tocou nos dados
--    da empresa (util pra log e auditoria interna).
-- =============================================================
