-- =============================================================
-- G Obra — Conformidade LGPD na leads_quentes
--
-- Adiciona colunas de consentimento conforme LGPD (Lei 13.709/2018).
--
-- Base legal aplicada: consentimento (art. 7, I) — visitante da
-- landing ainda nao e cliente, nao ha contrato firmado, entao a
-- unica base juridica valida pra reter os dados pessoais (whatsapp)
-- e o consentimento explicito do titular.
--
-- O PopupSaida passa a exigir checkbox marcado antes do envio.
-- Os campos abaixo registram a versao da Politica que estava em
-- vigor + timestamp. Esses dados sao a trilha probatoria do consentimento.
--
-- Idempotente — pode rodar varias vezes.
-- =============================================================

alter table leads_quentes
  add column if not exists consentimento_versao text,
  add column if not exists consentimento_em timestamptz;

comment on column leads_quentes.consentimento_versao is
  'Versao da Politica de Privacidade aceita pelo lead (ex: 1.2). NULL para registros anteriores a 14/05/2026 (sem checkbox).';

comment on column leads_quentes.consentimento_em is
  'Timestamp do aceite do checkbox. NULL para registros anteriores a 14/05/2026.';

notify pgrst, 'reload schema';
