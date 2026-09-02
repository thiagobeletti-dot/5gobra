-- =============================================================
-- G Obra — Raio-X: diagnósticos NÃO estavam sendo gravados (2026-09-02)
-- =============================================================
-- Causa: `diagnosticos` tem policy de INSERT pra anon mas NÃO de SELECT.
-- O front fazia `insert(...).select('id')` (RETURNING) e o RLS recusava o
-- insert inteiro ("new row violates row-level security policy"). E o
-- `update ... where id = X` de "clicou_trial/clicou_assinar" virava UPDATE 0
-- pelo mesmo motivo (UPDATE com WHERE precisa de SELECT).
--
-- Fix: o front gera o id, insere sem RETURNING, e marca o clique por esta
-- RPC (security definer, só mexe nas duas colunas booleanas, só em linhas
-- recentes). Anon continua sem ler nada da tabela.
-- Reproduzido e validado num Postgres local em 02/09. Idempotente.
-- =============================================================

create or replace function marcar_diagnostico(p_id uuid, p_campo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_campo not in ('clicou_trial', 'clicou_assinar') then
    raise exception 'campo inválido';
  end if;
  execute format(
    'update diagnosticos set %I = true where id = $1 and created_at > now() - interval ''6 hours''',
    p_campo
  ) using p_id;
end;
$$;

revoke all on function marcar_diagnostico(uuid, text) from public;
grant execute on function marcar_diagnostico(uuid, text) to anon, authenticated;

-- A policy de UPDATE anon não é mais usada (e nunca funcionou sem SELECT).
drop policy if exists "diagnosticos_anon_update" on diagnosticos;

notify pgrst, 'reload schema';

-- CONFERÊNCIA (depois de publicar o front): deve crescer a cada raio-x completo
--   select created_at, origem, quem, clicou_trial, clicou_assinar, respostas
--   from diagnosticos order by created_at desc limit 20;
