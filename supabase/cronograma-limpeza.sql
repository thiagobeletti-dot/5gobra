-- =============================================================
-- CRONOGRAMA — Limpeza de rows legacy do soft delete
-- =============================================================
-- Contexto: a versão anterior do `apagarCronograma` fazia UPDATE ativo=false
-- (soft delete). Mas o schema tem UNIQUE(obra_id) sem filtro, o que bloqueava
-- INSERT de novo cronograma na mesma obra. Trocamos pra HARD DELETE na app.
--
-- Este script limpa qualquer cronograma "fantasma" que ficou com ativo=false
-- desbloqueando a criação de novos cronogramas nessas obras.
--
-- Roda 1x no SQL Editor do Supabase. Idempotent (rodar de novo = no-op).
-- =============================================================

-- Mostra antes: quantos cronogramas estão presos (debug)
select obra_id, id, created_at
from cronogramas
where ativo = false;

-- Apaga os presos (fases e eventos caem em cascata via FK on delete cascade)
delete from cronogramas where ativo = false;

-- Confirma limpeza
select count(*) as cronogramas_restantes_inativos
from cronogramas
where ativo = false;
