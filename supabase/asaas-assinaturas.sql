-- =============================================================
-- G Obra — Integração Asaas: tabela de assinaturas
-- =============================================================
--
-- Modelo:
--   - 1 empresa = 1 assinatura (unique constraint em empresa_id)
--   - Cliente Asaas (asaas_customer_id) e assinatura Asaas (asaas_subscription_id)
--     são criados sob demanda quando o admin clica "Ativar plano"
--   - Status reflete o ciclo de vida: sem_plano -> pendente -> ativa -> atrasada/cancelada
--   - Webhook do Asaas atualiza status conforme eventos PAYMENT_*
--
-- Como rodar:
--   Supabase Dashboard -> SQL Editor -> cole esse arquivo -> Run
--   Idempotente (pode rodar várias vezes sem erro).
-- =============================================================

create table if not exists assinaturas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null unique references empresas(id) on delete cascade,

  -- IDs do Asaas (preenchidos quando ativa o plano pela primeira vez)
  asaas_customer_id text,            -- formato: cus_xxxxxxxxxxxxx
  asaas_subscription_id text,         -- formato: sub_xxxxxxxxxxxxx

  -- Status do ciclo de vida da assinatura.
  -- Transições típicas:
  --   sem_plano -> pendente (clicou Ativar, esperando 1o pagamento)
  --   pendente  -> ativa    (PAYMENT_CONFIRMED ou RECEIVED)
  --   ativa     -> atrasada (PAYMENT_OVERDUE)
  --   atrasada  -> ativa    (PAYMENT_RECEIVED após atraso)
  --   *         -> cancelada (cliente cancelou ou >60d atraso)
  status text not null default 'sem_plano' check (status in (
    'sem_plano', 'pendente', 'ativa', 'atrasada', 'cancelada'
  )),

  -- Valor da assinatura em centavos (evita float mess: 34900 = R$ 349,00)
  valor_centavos integer not null default 34900,

  -- Próxima data de vencimento (atualizada pelo webhook a cada novo PAYMENT_CREATED)
  proximo_vencimento date,

  -- Último pagamento confirmado (PAYMENT_CONFIRMED ou RECEIVED)
  ultimo_pagamento_em timestamptz,

  -- URL de pagamento da fatura mais recente (pra o "Pagar agora" no app)
  fatura_atual_url text,

  -- Audit
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists idx_assinaturas_empresa     on assinaturas(empresa_id);
create index if not exists idx_assinaturas_subscription on assinaturas(asaas_subscription_id);
create index if not exists idx_assinaturas_customer    on assinaturas(asaas_customer_id);

-- Trigger pra manter atualizada_em sincronizada
create or replace function trigger_atualizar_assinatura()
returns trigger as $$
begin
  new.atualizada_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_atualizar_assinatura on assinaturas;
create trigger trg_atualizar_assinatura
  before update on assinaturas
  for each row execute function trigger_atualizar_assinatura();

-- =============================================================
-- RLS — empresa só vê e edita a própria assinatura
-- =============================================================
alter table assinaturas enable row level security;

drop policy if exists "assinaturas_select_propria" on assinaturas;
create policy "assinaturas_select_propria" on assinaturas
  for select to authenticated
  using (
    empresa_id in (select id from empresas where owner_user_id = auth.uid())
  );

-- INSERT/UPDATE/DELETE: feito apenas pelas Edge Functions com service role
-- (que bypassa RLS). Não criamos policies pra authenticated nesses verbos —
-- assim a empresa NÃO consegue manipular a própria assinatura direto.

-- =============================================================
-- Helper view: indica se a empresa tem acesso liberado
-- =============================================================
-- Empresa tem acesso se:
--  - status = 'ativa', OU
--  - status = 'atrasada' E proximo_vencimento >= hoje - 7 dias (carência)
--
-- Empresas SEM linha em assinaturas são tratadas no app como "sem_plano".
create or replace view empresas_com_acesso as
select
  e.id as empresa_id,
  case
    when a.status = 'ativa' then true
    when a.status = 'atrasada' and a.proximo_vencimento >= current_date - interval '7 days' then true
    else false
  end as tem_acesso,
  coalesce(a.status, 'sem_plano') as status_assinatura,
  a.proximo_vencimento,
  a.fatura_atual_url
from empresas e
left join assinaturas a on a.empresa_id = e.id;

-- Permitir que usuários autenticados consultem a view (a view respeita RLS de empresas)
grant select on empresas_com_acesso to authenticated;

-- =============================================================
-- Done. Próximos passos (fora deste SQL):
--   1. Edge Function `criar-assinatura-asaas` (POST /functions/v1/...)
--   2. Edge Function `webhook-asaas` (POST /functions/v1/...)
--   3. Configurar webhook no painel Asaas apontando pra a Edge Function
-- =============================================================
