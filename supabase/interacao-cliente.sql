-- =============================================================
-- G Obra — Toggle "interação do cliente" por obra
-- =============================================================
-- Quando false, a obra roda em modo GERENCIAL (apenas empresa):
--   - O portal do cliente (/obra/:token) fica desativado.
--   - Os passos que esperavam ação do cliente auto-avançam:
--       * itens novos entram já em "Técnica" (pula o aceite inicial do cliente);
--       * ao concluir a peça, ela é finalizada automaticamente (sem esperar o
--         aceite final do cliente).
--
-- ADITIVO + default true = comportamento atual. Zero impacto nas obras
-- existentes e nos clientes que já usam o portal. Idempotente.
--
-- Rodar no Supabase Dashboard -> SQL Editor -> Run.
-- =============================================================

alter table obras
  add column if not exists interacao_cliente boolean not null default true;

comment on column obras.interacao_cliente is
  'Se false, obra roda em modo gerencial (sem portal/aceites do cliente). Default true.';
