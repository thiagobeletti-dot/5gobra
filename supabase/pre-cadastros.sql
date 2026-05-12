-- =============================================================
-- G Obra — Pré-cadastros (visitantes que iniciaram compra pela landing)
-- =============================================================
-- Visitante anônimo na landing preenche form de compra → app cria
-- customer + subscription no Asaas → guarda os dados aqui.
--
-- Quando o cliente PAGA, o webhook do Asaas localiza esse registro pelo
-- asaas_customer_id e converte em empresa real, enviando o link de cadastro
-- (/cadastro?token=X) pra cliente terminar (criar senha + aceitar termos).
--
-- Status:
--   aguardando_pagamento → criou assinatura, esperando 1ª cobrança quitada
--   pago                 → 1ª cobrança paga, esperando cliente completar cadastro
--   convertido           → empresa criada, cliente acessou o app
--   expirado             → assinatura no Asaas expirou ou foi cancelada
--
-- Idempotente. Rodar no SQL Editor do Supabase.
-- =============================================================

create table if not exists pre_cadastros (
  id uuid primary key default uuid_generate_v4(),
  -- Dados informados pelo visitante
  nome_completo text not null,
  email text not null,
  whatsapp text not null,
  cpf_cnpj text not null,

  -- Cupom usado (opcional)
  cupom_codigo text,
  cupom_percentual numeric(5, 2),       -- snapshot do desconto no momento da compra

  -- Referências no Asaas
  asaas_customer_id text not null,
  asaas_subscription_id text not null,
  invoice_url text,                     -- URL pra cliente pagar
  valor_primeiro_mes_centavos integer not null,   -- valor com desconto aplicado
  valor_recorrente_centavos integer not null,     -- valor normal (R$ 349)

  -- Estado
  status text not null default 'aguardando_pagamento',
  empresa_id uuid references empresas(id),  -- preenchido após conversão
  token_cadastro text unique,           -- token usado em /cadastro?token=X

  -- Origem (rastreamento de venda)
  origem text default 'landing',        -- landing | popup-saida | etc
  ref_parceiro text,                    -- ?ref=parceiro_xpto (programa de afiliados)
  ip text,
  user_agent text,

  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_pre_cadastros_customer on pre_cadastros(asaas_customer_id);
create index if not exists idx_pre_cadastros_subscription on pre_cadastros(asaas_subscription_id);
create index if not exists idx_pre_cadastros_status on pre_cadastros(status);
create index if not exists idx_pre_cadastros_token on pre_cadastros(token_cadastro);

create or replace function set_atualizado_em_precad()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pre_cadastros_atualizado_em on pre_cadastros;
create trigger trg_pre_cadastros_atualizado_em
  before update on pre_cadastros
  for each row execute function set_atualizado_em_precad();

-- ============== RLS ==============
alter table pre_cadastros enable row level security;

-- Anon NÃO precisa acessar diretamente. Insert vai pela Edge Function (service role).
-- Pre_cadastro é dado sensível (CPF/CNPJ, dados de contato). Sem policy anon.

-- Empresa autenticada admin pode ler (futuro dashboard interno)
drop policy if exists "pre_cadastros_auth_select" on pre_cadastros;
create policy "pre_cadastros_auth_select" on pre_cadastros
  for select to authenticated using (true);

notify pgrst, 'reload schema';
