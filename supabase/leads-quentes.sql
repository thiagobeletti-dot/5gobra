-- =============================================================
-- G Obra — Tabela de leads quentes (pop-up de saída da landing)
-- =============================================================
-- Captura visitante da landing que tentou sair sem comprar.
-- Pop-up com exit-intent (desktop) ou timer (mobile) abre, pede
-- WhatsApp + motivo principal da dúvida.
--
-- Idempotente. Rodar no SQL Editor do Supabase.
-- =============================================================

create table if not exists leads_quentes (
  id uuid primary key default uuid_generate_v4(),
  whatsapp text not null,
  motivo text not null,             -- preco | equipe | ja_tentei | sem_tempo | outro
  motivo_texto text,                 -- texto livre se motivo='outro'
  origem text not null default 'landing-gobra', -- pra rastrear se vier de outro lugar
  status text not null default 'novo', -- novo | contatado | qualificado | descartado | virou_cliente
  notas text,                        -- empresa pode adicionar notas durante atendimento
  ip text,                           -- preenchido server-side se possivel
  user_agent text,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_leads_quentes_status on leads_quentes(status);
create index if not exists idx_leads_quentes_created on leads_quentes(created_at desc);

-- Trigger pra atualizar atualizado_em automaticamente em UPDATE
create or replace function set_atualizado_em_leads()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_quentes_atualizado_em on leads_quentes;
create trigger trg_leads_quentes_atualizado_em
  before update on leads_quentes
  for each row execute function set_atualizado_em_leads();

-- ============== RLS ==============
alter table leads_quentes enable row level security;

-- Anon (visitante da landing) pode INSERIR — eh o ponto de captura
drop policy if exists "leads_anon_insert" on leads_quentes;
create policy "leads_anon_insert" on leads_quentes
  for insert
  to anon
  with check (true);

-- Authenticated (empresa logada) pode LER tudo — futuro dashboard interno
drop policy if exists "leads_auth_select" on leads_quentes;
create policy "leads_auth_select" on leads_quentes
  for select
  to authenticated
  using (true);

-- Authenticated pode atualizar (mudar status, adicionar notas)
drop policy if exists "leads_auth_update" on leads_quentes;
create policy "leads_auth_update" on leads_quentes
  for update
  to authenticated
  using (true);

notify pgrst, 'reload schema';
