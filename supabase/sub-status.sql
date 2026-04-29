-- =============================================================
-- G Obra — Adiciona coluna sub_status ao card
-- Sub-status é o texto específico de fase (ex: "Fabricando contra-marco",
-- "Aguardando finalizar vão", "Em Produção"). Aparece no preview do card
-- substituindo o genérico "Aguardando empresa/cliente" quando preenchido.
--
-- Rodar no SQL Editor do Supabase.
-- =============================================================

alter table cards add column if not exists sub_status text;

create index if not exists idx_cards_sub_status on cards(sub_status) where sub_status is not null;
