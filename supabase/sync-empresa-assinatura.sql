-- =============================================================
-- G Obra — Sync empresas.assinatura_status  ←  assinaturas.status
-- =============================================================
-- Fecha o "desync do webhook Asaas": a etapa de virar
-- empresas.assinatura_status pra 'ativo' foi prometida no trial-system.sql
-- (comentário) mas NUNCA foi escrita em nenhuma Edge Function/webhook.
--
-- Este trigger é a fonte única de verdade: sempre que assinaturas.status
-- muda (via webhook, ativar-pre-cadastro, criar-assinatura-asaas OU
-- reconciliação manual), empresas.assinatura_status acompanha sozinho.
--
-- Mapeamento (decisão Esquadro 30/06 — carência de 7 dias no 'atrasada',
-- espelhando a view empresas_com_acesso):
--   assinaturas 'ativa'                          -> empresas 'ativo'  (+ zera trial)
--   assinaturas 'atrasada' e venc >= hoje-7d     -> empresas 'ativo'  (carência)
--   assinaturas 'atrasada' e venc  < hoje-7d     -> empresas 'suspenso'
--   assinaturas 'cancelada'                      -> empresas 'cancelado'
--   assinaturas 'pendente'/'sem_plano'           -> não mexe (mantém 'trial')
--
-- Idempotente. Rodar no Supabase Dashboard -> SQL Editor -> Run.
-- =============================================================

-- ========== 1. Função de sincronização ==========
create or replace function sync_empresa_assinatura_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update empresas e
  set assinatura_status = case
        when new.status = 'ativa' then 'ativo'
        when new.status = 'atrasada'
             and new.proximo_vencimento >= current_date - interval '7 days' then 'ativo'
        when new.status = 'atrasada'  then 'suspenso'
        when new.status = 'cancelada' then 'cancelado'
        else e.assinatura_status
      end,
      trial_termina_em = case
        when new.status = 'ativa' then null
        else e.trial_termina_em
      end
  where e.id = new.empresa_id;
  return new;
end;
$$;

-- ========== 2. Trigger ==========
drop trigger if exists trg_sync_empresa_status on assinaturas;
create trigger trg_sync_empresa_status
  after insert or update of status, proximo_vencimento on assinaturas
  for each row
  execute function sync_empresa_assinatura_status();

-- ========== 3. Backfill one-time (sincroniza empresas já existentes) ==========
-- Aplica o MESMO mapeamento nas empresas que já têm assinatura hoje,
-- pra estado ficar consistente na hora (não só nas mudanças futuras).
-- Empresas sem linha em assinaturas permanecem 'trial'.
update empresas e
set assinatura_status = case
      when a.status = 'ativa' then 'ativo'
      when a.status = 'atrasada'
           and a.proximo_vencimento >= current_date - interval '7 days' then 'ativo'
      when a.status = 'atrasada'  then 'suspenso'
      when a.status = 'cancelada' then 'cancelado'
      else e.assinatura_status
    end,
    trial_termina_em = case
      when a.status = 'ativa' then null
      else e.trial_termina_em
    end
from assinaturas a
where a.empresa_id = e.id;

-- ========== 4. Validação (confere antes de dar por encerrado) ==========
-- Deve mostrar cada empresa com assinatura e o status espelhado batendo.
select
  e.nome,
  e.assinatura_status               as empresa_status,
  a.status                          as asaas_status,
  a.proximo_vencimento,
  case
    when a.status = 'ativa'                                     then 'ativo (esperado)'
    when a.status = 'atrasada' and a.proximo_vencimento >= current_date - interval '7 days' then 'ativo/carência (esperado)'
    when a.status = 'atrasada'                                  then 'suspenso (esperado)'
    when a.status = 'cancelada'                                 then 'cancelado (esperado)'
    else 'trial/inalterado'
  end                               as esperado
from empresas e
join assinaturas a on a.empresa_id = e.id
order by e.nome;

-- =============================================================
-- Done. A partir daqui, qualquer escrita em assinaturas.status
-- propaga automaticamente pra empresas.assinatura_status.
-- =============================================================
