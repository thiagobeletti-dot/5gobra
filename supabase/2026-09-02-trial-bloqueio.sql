-- =============================================================
-- G Obra — TRIAL DE 14 DIAS SEM CARTÃO + BLOQUEIO NO DIA 15 (2026-09-02)
-- =============================================================
-- Rodar no SQL Editor do Supabase (projeto 5gobra). Idempotente.
--
-- DESENHO: o BANCO decide se a empresa tem acesso; o front só obedece.
--
--   1. Conserta pre_cadastros pra `iniciar-trial` conseguir gravar
--      (constraint de status sem 'trial' + asaas_customer_id not null).
--   2. Traz pra main o trigger assinaturas -> empresas (só existia na
--      branch feat/admin-console) + backfill. Fonte única: empresas.assinatura_status.
--   3. Funções de acesso: empresa_tem_acesso(), usuario_tem_acesso(),
--      minha_situacao() (RPC que o app chama em toda tela protegida).
--   4. Trava o dono: authenticated NÃO altera assinatura_status /
--      trial_termina_em / cartao / desconto, nem cria 2ª empresa.
--   5. Bloqueia ESCRITA de authenticated sem acesso em todas as tabelas de
--      domínio + storage (paywall total: o front nem mostra o app, mas se
--      alguém burlar o front, o banco recusa).
--   6. Links públicos (/obra/:token e /tec/:token) bloqueiam junto:
--      anon_obra_ids() passa a exigir empresa com acesso.
--   7. situacao_link_publico(token) pro cliente/técnico ver "acesso pausado"
--      em vez de "link inválido".
--
-- ANTES DE RODAR, veja quem vai ficar bloqueado na hora (seção 0).
-- =============================================================


-- =============================================================
-- 0) PREVIEW — quem fica bloqueado assim que este arquivo rodar
-- =============================================================
-- Rode SÓ este select primeiro. Quem aparecer aqui vai cair no paywall.
-- Pra dar mais prazo a alguém:
--   update empresas set trial_termina_em = now() + interval '14 days' where id = '<uuid>';
-- Pra marcar como pagante sem Asaas (ex.: sua própria empresa):
--   update empresas set assinatura_status = 'ativo', trial_termina_em = null where id = '<uuid>';
--
--   select e.id, e.nome, e.assinatura_status, e.trial_termina_em,
--          a.status as assinatura_asaas
--   from empresas e
--   left join assinaturas a on a.empresa_id = e.id
--   where not (
--     e.assinatura_status = 'ativo'
--     or (e.assinatura_status = 'trial' and e.trial_termina_em is not null and e.trial_termina_em > now())
--   )
--   order by e.created_at;


-- =============================================================
-- 1) PRE_CADASTROS — deixa o trial gravar
-- =============================================================
-- `iniciar-trial` grava status='trial' e não tem customer no Asaas.
alter table pre_cadastros alter column asaas_customer_id drop not null;
alter table pre_cadastros alter column asaas_subscription_id drop not null;
alter table pre_cadastros alter column valor_primeiro_mes_centavos drop not null;
alter table pre_cadastros alter column valor_recorrente_centavos drop not null;
alter table pre_cadastros alter column cpf_cnpj drop not null;
-- WhatsApp é opcional no /teste-gratis (a função manda null quando vazio).
alter table pre_cadastros alter column whatsapp drop not null;

alter table pre_cadastros drop constraint if exists pre_cadastros_status_check;
alter table pre_cadastros add constraint pre_cadastros_status_check
  check (status in (
    'trial',                 -- usando os 14 dias, sem cobrança criada
    'aguardando_pagamento',  -- assinatura criada no Asaas, esperando 1ª fatura
    'pago',                  -- 1ª cobrança paga, esperando terminar /cadastro
    'convertido',            -- empresa criada e acessando
    'expirado',              -- trial venceu sem converter / cancelada antes de pagar
    'erro'
  ));


-- =============================================================
-- 2) SYNC assinaturas -> empresas (fonte única de verdade)
-- =============================================================
-- Mapeamento (decisão 30/06, carência de 7 dias no 'atrasada'):
--   ativa                          -> ativo (+ zera trial)
--   atrasada, venc >= hoje-7d      -> ativo (carência)
--   atrasada, venc <  hoje-7d      -> suspenso
--   cancelada                      -> cancelado
--   pendente / sem_plano           -> não mexe
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

drop trigger if exists trg_sync_empresa_status on assinaturas;
create trigger trg_sync_empresa_status
  after insert or update of status, proximo_vencimento on assinaturas
  for each row
  execute function sync_empresa_assinatura_status();

-- Backfill (idempotente): alinha as empresas que já têm assinatura.
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


-- =============================================================
-- 3) FUNÇÕES DE ACESSO
-- =============================================================
-- Regra única do sistema:
--   ativo                                  -> tem acesso
--   trial e trial_termina_em > now()       -> tem acesso (dias 1..14)
--   trial vencido / suspenso / cancelado   -> SEM acesso (dia 15 em diante)
create or replace function empresa_tem_acesso(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select e.assinatura_status = 'ativo'
        or (e.assinatura_status = 'trial'
            and e.trial_termina_em is not null
            and e.trial_termina_em > now())
    from empresas e
    where e.id = p_empresa_id
  ), false)
$$;

-- Admin (tabela admins) nunca fica trancado pra fora — evita o Thiago perder
-- o /app/admin se a própria empresa vencer.
create or replace function usuario_e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins a where a.user_id = auth.uid())
$$;

-- O app é single-owner: o usuário logado tem acesso se alguma empresa dele
-- tem acesso (ou se é admin).
create or replace function usuario_tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select usuario_e_admin()
      or exists (
        select 1 from empresas e
        where e.owner_user_id = auth.uid()
          and empresa_tem_acesso(e.id)
      )
$$;

-- RPC que o front chama em toda tela protegida (RotaProtegida).
create or replace function minha_situacao()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'empresa_id',       e.id,
    'status',           e.assinatura_status,
    'trial_termina_em', e.trial_termina_em,
    'acesso',           empresa_tem_acesso(e.id) or usuario_e_admin(),
    'admin',            usuario_e_admin(),
    'dias_restantes',   case
                          when e.assinatura_status = 'trial' and e.trial_termina_em is not null
                            then greatest(0, ceil(extract(epoch from (e.trial_termina_em - now())) / 86400))::int
                          else null
                        end
  )
  from empresas e
  where e.owner_user_id = auth.uid()
  order by e.created_at
  limit 1
$$;

revoke all on function empresa_tem_acesso(uuid) from public;
revoke all on function usuario_e_admin()        from public;
revoke all on function usuario_tem_acesso()     from public;
revoke all on function minha_situacao()         from public;
grant execute on function empresa_tem_acesso(uuid) to authenticated, anon, service_role;
grant execute on function usuario_e_admin()        to authenticated, service_role;
grant execute on function usuario_tem_acesso()     to authenticated, service_role;
grant execute on function minha_situacao()         to authenticated;


-- =============================================================
-- 4) TRAVA DO DONO — authenticated não mexe no próprio status
-- =============================================================
-- Antes: empresa_owner_update deixava o dono fazer
--   PATCH empresas {assinatura_status:'ativo'} ou {trial_termina_em:'2030-01-01'}
-- com a anon key + o próprio JWT. Agora essas colunas só mudam via
-- service_role (Edge Functions / webhook / trigger de sync) ou SQL Editor.
create or replace function tg_empresas_protege_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;  -- service_role, postgres (SQL Editor), triggers internos
  end if;

  if tg_op = 'INSERT' then
    -- Fluxo A (/cadastro sem token): empresa nasce em trial, sempre 14 dias.
    -- Ignora qualquer valor que o cliente tenha mandado.
    new.assinatura_status      := 'trial';
    new.trial_termina_em       := now() + interval '14 days';
    new.cartao_cadastrado_em   := null;
    new.desconto_incentivo_pct := null;
    -- Uma empresa por login: sem isso dava pra criar a 2ª e ganhar +14 dias.
    if exists (select 1 from empresas e where e.owner_user_id = new.owner_user_id) then
      raise exception 'Você já tem uma empresa cadastrada.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE: colunas de cobrança são somente leitura pro dono
  if new.assinatura_status      is distinct from old.assinatura_status
  or new.trial_termina_em       is distinct from old.trial_termina_em
  or new.cartao_cadastrado_em   is distinct from old.cartao_cadastrado_em
  or new.desconto_incentivo_pct is distinct from old.desconto_incentivo_pct
  or new.pre_cadastro_id        is distinct from old.pre_cadastro_id
  or new.owner_user_id          is distinct from old.owner_user_id then
    raise exception 'Status da assinatura não pode ser alterado pelo app.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_empresas_protege_assinatura on empresas;
create trigger trg_empresas_protege_assinatura
  before insert or update on empresas
  for each row
  execute function tg_empresas_protege_assinatura();


-- =============================================================
-- 5) BLOQUEIO DE ESCRITA — authenticated sem acesso não grava nada
-- =============================================================
-- Um trigger genérico em cada tabela de domínio. Só age no papel
-- `authenticated`; anon (cliente/técnico) é coberto pela seção 6 e
-- service_role/SQL Editor passam direto.
create or replace function tg_bloquear_escrita_sem_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and not usuario_tem_acesso() then
    raise exception 'Seu período de teste acabou. Assine pra continuar usando o G Obra.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'obras', 'cards', 'historico_card', 'anexos', 'checklists',
    'cronogramas', 'cronograma_fases', 'cronograma_eventos',
    'tecnicos_obra', 'metas_config'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'tabela % não existe, pulando', t;
      continue;
    end if;
    execute format('drop trigger if exists trg_bloqueio_acesso on %I', t);
    execute format(
      'create trigger trg_bloqueio_acesso before insert or update or delete on %I
         for each row execute function tg_bloquear_escrita_sem_acesso()', t);
  end loop;
end $$;

-- Storage: fotos. Além de exigir acesso, ESCOPA por obra da própria empresa
-- (antes qualquer logado podia apagar/sobrescrever foto de outra empresa —
-- path = obraId/cardId/arquivo).
drop policy if exists "obra_anexos_auth_write" on storage.objects;
drop policy if exists "obra_anexos_auth_insert" on storage.objects;
drop policy if exists "obra_anexos_auth_update" on storage.objects;
drop policy if exists "obra_anexos_auth_delete" on storage.objects;

-- (comparação em texto, sem cast — um path fora do padrão não derruba a policy)
create policy "obra_anexos_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'obra-anexos'
    and usuario_tem_acesso()
    and (storage.foldername(name))[1] in (
      select o.id::text from obras o
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );

create policy "obra_anexos_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'obra-anexos'
    and usuario_tem_acesso()
    and (storage.foldername(name))[1] in (
      select o.id::text from obras o
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );

create policy "obra_anexos_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'obra-anexos'
    and usuario_tem_acesso()
    and (storage.foldername(name))[1] in (
      select o.id::text from obras o
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );


-- =============================================================
-- 6) LINKS PÚBLICOS bloqueiam junto (cliente e técnico)
-- =============================================================
-- anon_obra_ids() é o único ponto por onde TODAS as policies anon passam
-- (hardening 07/07). Basta exigir empresa com acesso aqui.
create or replace function anon_obra_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from obras o
  where anon_obra_token() is not null
    and o.token_cliente::text = anon_obra_token()
    and empresa_tem_acesso(o.empresa_id)
  union
  select t.obra_id
  from tecnicos_obra t
  join obras o on o.id = t.obra_id
  where anon_obra_token() is not null
    and t.token::text = anon_obra_token()
    and coalesce(t.ativo, true) = true
    and empresa_tem_acesso(o.empresa_id)
$$;


-- =============================================================
-- 7) O que o cliente/técnico vê quando o link não abre
-- =============================================================
-- 'ok' | 'bloqueado' (empresa sem acesso) | 'invalido' (token não existe)
create or replace function situacao_link_publico(p_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when empresa_tem_acesso(o.empresa_id) then 'ok' else 'bloqueado' end
    from obras o
    where o.token_cliente::text = p_token
    union all
    select case when empresa_tem_acesso(o.empresa_id) then 'ok' else 'bloqueado' end
    from tecnicos_obra t
    join obras o on o.id = t.obra_id
    where t.token::text = p_token and coalesce(t.ativo, true) = true
    limit 1
  ), 'invalido')
$$;

revoke all on function situacao_link_publico(text) from public;
grant execute on function situacao_link_publico(text) to anon, authenticated;


-- =============================================================
-- 8) CONFERÊNCIA — rode depois de tudo
-- =============================================================
-- a) trigger de sync existe?               (1 linha)
--   select tgname from pg_trigger where tgname = 'trg_sync_empresa_status';
-- b) triggers de bloqueio nas 10 tabelas   (10 linhas)
--   select tgrelid::regclass from pg_trigger where tgname = 'trg_bloqueio_acesso';
-- c) situação de cada empresa
--   select nome, assinatura_status, trial_termina_em, empresa_tem_acesso(id) as acesso
--   from empresas order by created_at;
-- d) constraint aceita 'trial'
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'pre_cadastros_status_check';
