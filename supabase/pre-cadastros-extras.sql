-- =============================================================
-- G Obra — Pré-cadastros: colunas de auditoria do ciclo
-- =============================================================
-- Roda DEPOIS de pre-cadastros.sql. Acrescenta:
--   - pago_em                  timestamptz   (quando o webhook confirmou pagamento)
--   - email_cadastro_enviado_em timestamptz  (quando disparamos o link /cadastro?token)
--   - convertido_em            timestamptz   (quando a empresa foi criada)
--   - desconto_removido_em     timestamptz   (quando o value da sub foi atualizado pra R$349)
--
-- Também troca o default-livre por um CHECK explícito de status válido.
--
-- Idempotente.
-- =============================================================

alter table pre_cadastros
  add column if not exists pago_em                   timestamptz,
  add column if not exists email_cadastro_enviado_em timestamptz,
  add column if not exists convertido_em             timestamptz,
  add column if not exists desconto_removido_em      timestamptz;

-- Constraint de status (drop antes pra ser idempotente)
alter table pre_cadastros drop constraint if exists pre_cadastros_status_check;
alter table pre_cadastros add constraint pre_cadastros_status_check
  check (status in (
    'aguardando_pagamento',  -- assinatura criada no Asaas, esperando 1ª fatura quitar
    'pago',                  -- 1ª cobrança paga, esperando cliente terminar /cadastro
    'convertido',            -- empresa criada, cliente já tem acesso ao app
    'expirado',              -- assinatura cancelada no Asaas antes de pagar
    'erro'                   -- falha persistente ao tentar converter (precisa intervenção manual)
  ));

notify pgrst, 'reload schema';
