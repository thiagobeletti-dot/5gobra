-- =============================================================
-- G Obra — Sistema de trial e assinatura
-- =============================================================
-- Adiciona controle de período de teste (14 dias) e status de assinatura
-- na tabela empresas. Webhook do Asaas vai atualizar assinatura_status
-- pra 'ativo' quando o pagamento confirmar (a ser configurado depois).
--
-- Como rodar:
--   Supabase Dashboard → SQL Editor → cole esse arquivo → Run
--   Pode rodar várias vezes sem dar erro (idempotente).
-- =============================================================

-- 1) Adiciona colunas se ainda não existirem
alter table empresas
  add column if not exists trial_termina_em timestamptz default (now() + interval '14 days');

alter table empresas
  add column if not exists assinatura_status text not null default 'trial';

-- 2) Constraint pros valores válidos de assinatura_status
do $$ begin
  alter table empresas
    add constraint empresas_assinatura_status_check
    check (assinatura_status in ('trial', 'ativo', 'suspenso', 'cancelado'));
exception when duplicate_object then null; end $$;

-- 3) Empresas que já existiam antes (incluindo a sua) ganham 14 dias de trial
--    a partir de agora. Se quiser deixar a sua empresa como 'ativo' direto
--    (já que você é o dono), descomente a linha do update específico abaixo
--    e troque o id pelo da sua empresa após rodar o passo 3.
update empresas
set trial_termina_em = now() + interval '14 days'
where trial_termina_em is null;

-- OPCIONAL: deixar SUA empresa como assinante ativa (sem precisar do trial).
-- Pega o id da sua empresa em Table Editor → empresas, depois descomenta:
--
--   update empresas
--   set assinatura_status = 'ativo', trial_termina_em = null
--   where id = 'COLE-AQUI-O-UUID-DA-SUA-EMPRESA';

-- 4) Índice pra consulta rápida do status (opcional, performance)
create index if not exists idx_empresas_assinatura_status on empresas(assinatura_status);
