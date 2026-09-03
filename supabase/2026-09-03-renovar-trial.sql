-- =============================================================
-- G Obra — Segundo teste pra quem nunca chegou a usar
-- =============================================================
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar de novo).
--
-- POR QUE ISSO EXISTE
-- Em 03/09/2026 a Tatiana tentou criar conta pelo teste grátis e não
-- conseguiu: já tinha conta de maio, com o trial vencido e ZERO obra
-- criada. Cadastrou, nunca usou, esqueceu. Voltou meses depois pela
-- campanha e a única resposta que o sistema dava era "faça login" seguido
-- de "pague".
--
-- A regra nova, decisão do Thiago: quem deixou o teste vencer SEM CRIAR
-- NENHUMA OBRA ganha mais 14 dias, uma única vez. Quem usou e deixou
-- vencer, não. A diferença é entre quem não quis e quem não conseguiu
-- começar — e o segundo é problema de onboarding, não de interesse.
--
-- ONDE A RENOVAÇÃO ACONTECE, E POR QUÊ
-- Não na tela de cadastro. Se o botão "criar conta" reativasse o trial de
-- um e-mail existente, qualquer pessoa que soubesse o e-mail de outra
-- poderia mexer na conta dela. A pessoa entra com a própria senha e a
-- oferta aparece na tela de bloqueio.
--
-- A ESCRITA é feita pela Edge Function `renovar-trial` (service_role),
-- não por aqui: o trigger tg_empresas_protege_assinatura proíbe o papel
-- `authenticated` de mexer em trial_termina_em, e é bom que continue
-- proibindo. Este arquivo só cria a coluna e a CONSULTA de elegibilidade.
-- =============================================================


-- =============================================================
-- 1) MARCA DE RENOVAÇÃO — uma por empresa, pra sempre
-- =============================================================
alter table empresas add column if not exists trial_renovado_em timestamptz;

comment on column empresas.trial_renovado_em is
  'Quando o segundo teste de 14 dias foi liberado. Preenchido uma única vez, pela Edge Function renovar-trial. Null = ainda pode renovar (se cumprir as outras regras).';


-- =============================================================
-- 2) ELEGIBILIDADE — só leitura, o app pergunta antes de oferecer
-- =============================================================
-- Devolve o motivo junto, porque "não pode" tem causas diferentes e a tela
-- fala coisas diferentes pra cada uma.
--
--   elegivel = true                  -> mostra a oferta dos 14 dias
--   motivo   = 'ja_usou'             -> criou obra; é conversão normal
--   motivo   = 'ja_renovou'          -> segunda chance já foi dada
--   motivo   = 'nao_e_trial_vencido' -> pagante, suspenso ou trial em dia
create or replace function posso_renovar_trial()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  emp        record;
  qtd_obras  integer;
begin
  -- Mesma empresa que o minha_situacao() enxerga: a mais antiga do dono.
  select e.id, e.assinatura_status, e.trial_termina_em, e.trial_renovado_em
    into emp
    from empresas e
   where e.owner_user_id = auth.uid()
   order by e.created_at
   limit 1;

  if emp.id is null then
    return json_build_object('elegivel', false, 'motivo', 'sem_empresa');
  end if;

  if emp.assinatura_status <> 'trial'
     or emp.trial_termina_em is null
     or emp.trial_termina_em > now() then
    return json_build_object('elegivel', false, 'motivo', 'nao_e_trial_vencido');
  end if;

  if emp.trial_renovado_em is not null then
    return json_build_object('elegivel', false, 'motivo', 'ja_renovou');
  end if;

  select count(*) into qtd_obras from obras o where o.empresa_id = emp.id;

  if qtd_obras > 0 then
    return json_build_object('elegivel', false, 'motivo', 'ja_usou');
  end if;

  return json_build_object('elegivel', true, 'motivo', 'nunca_usou', 'dias', 14);
end;
$$;

revoke all on function posso_renovar_trial() from public;
grant execute on function posso_renovar_trial() to authenticated;

notify pgrst, 'reload schema';


-- =============================================================
-- CONFERÊNCIA (rode depois)
-- =============================================================
-- Quem está elegível hoje — trial vencido, nunca renovou, zero obra:
--
--   select e.nome, u.email,
--          (e.trial_termina_em at time zone 'America/Sao_Paulo')::date as venceu_em
--   from empresas e
--   join auth.users u on u.id = e.owner_user_id
--   where e.assinatura_status = 'trial'
--     and e.trial_termina_em < now()
--     and e.trial_renovado_em is null
--     and not exists (select 1 from obras o where o.empresa_id = e.id)
--   order by e.trial_termina_em desc;
--
-- Essa lista também é uma lista de ligação: cada linha é alguém que se
-- interessou, entrou e travou antes da primeira obra.
