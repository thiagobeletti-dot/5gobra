-- =============================================================
-- G Obra — Tabela de checklists tecnicos
-- Adiciona suporte a Medicao 1 (visita tecnica), Medicao 2 (medida fina)
-- e Item (controle de qualidade pre-expedicao).
--
-- Rode no SQL Editor do Supabase apos o schema.sql principal.
-- =============================================================

-- ============== TIPOS (enums) ==============
do $$ begin
  create type checklist_tipo as enum ('medicao1', 'medicao2', 'item');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checklist_autor_tipo as enum ('empresa', 'tecnico');
exception when duplicate_object then null; end $$;

-- ============== TABELA ==============
create table if not exists checklists (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references cards(id) on delete cascade,
  tipo checklist_tipo not null,
  dados jsonb not null default '{}'::jsonb,
  autor text not null,
  autor_tipo checklist_autor_tipo not null,
  preenchido_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- regra: 1 checklist de cada tipo por card (editavel)
  unique (card_id, tipo)
);

create index if not exists idx_checklists_card on checklists(card_id);

-- Trigger pra atualizar atualizado_em automaticamente
create or replace function tg_checklists_atualizado_em() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_checklists_atualizado_em on checklists;
create trigger trg_checklists_atualizado_em
  before update on checklists
  for each row execute function tg_checklists_atualizado_em();

-- ============== ROW LEVEL SECURITY ==============
alter table checklists enable row level security;

-- Empresa autenticada gerencia checklists dos cards das proprias obras
drop policy if exists "checklists_empresa_all" on checklists;
create policy "checklists_empresa_all" on checklists
  for all
  using (
    card_id in (
      select c.id from cards c
      join obras o on o.id = c.obra_id
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  )
  with check (
    card_id in (
      select c.id from cards c
      join obras o on o.id = c.obra_id
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );

-- Anon (cliente pelo link magico) NAO ve checklists tecnicos.
-- (Sem policy de SELECT pra anon = bloqueado.)
-- Quando entrar o 3o ator (tecnico), abrir policy controlada por token do tecnico.

-- =============================================================
-- NOTA:
-- Cliente nao tem acesso a esta tabela. Tudo que aparece pra ele
-- e o que a empresa publicou no historico_card (registros normais).
-- =============================================================
