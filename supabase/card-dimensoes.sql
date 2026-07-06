-- =============================================================
-- G Obra — Largura/Altura estruturadas no card
-- =============================================================
-- Guarda a medida contratada (do orçamento) de forma estruturada, pra:
--   - mostrar no card;
--   - pré-preencher a Medição 1 do técnico (ele ajusta se o vão diferir).
-- Nullable (acordos/apontamentos não têm medida). Aditivo, idempotente.
-- Rodar no Supabase Dashboard -> SQL Editor -> Run.
-- =============================================================

alter table cards
  add column if not exists largura_mm int,
  add column if not exists altura_mm int;
