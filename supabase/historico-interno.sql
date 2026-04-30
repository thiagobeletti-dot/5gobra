-- =============================================================
-- G Obra — Adiciona flag "interno" ao historico_card
-- Registros marcados como interno=true só aparecem pra empresa.
-- O cliente (link mágico) recebe historico filtrado.
--
-- Uso:
--   - Auto-gerados pela Medição 1, mudanças automáticas de status,
--     decisões internas → interno=true
--   - Mensagens digitadas pela empresa pro cliente, mensagens do
--     próprio cliente, sistema pings que fazem sentido pros 2 →
--     interno=false (default)
--
-- Rodar no SQL Editor do Supabase.
-- =============================================================

alter table historico_card
  add column if not exists interno boolean not null default false;

create index if not exists idx_historico_card_interno
  on historico_card(card_id, interno, created_at);
