-- =============================================================
-- G Obra — Uso real no painel gerencial
-- =============================================================
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar de novo).
--
-- POR QUE ISSO EXISTE
-- Em 03/09/2026, rodando na mão, apareceu o que o painel não mostrava:
--
--   MS VIDROS   505 movimentos/30d, 24 obras abertas  -> rotina instalada
--   Funifér      11 movimentos/30d,  2 obras abertas  -> usa uma fatia
--   WS VIDROS     0 movimentos/30d, 42 obras abertas  -> parou em 29/07
--
-- A WS é a que mais colocou coisa dentro e a que menos usa: cadastrou 42
-- obras e abandonou. Cliente pagante, 42 links de cliente que podem estar
-- sendo abertos e mostrando obra parada. O painel dizia só "último acesso".
--
-- Agora o painel carrega junto o uso real, e "obra aberta sem movimento
-- nenhum em 30 dias" acende sozinho.
--
-- Depende de: 2026-09-02-ultimo-acesso.sql (tabela acessos_empresa).
-- =============================================================

-- A função ganha colunas novas, então precisa cair antes de ser recriada
-- (o Postgres não troca o RETURNS TABLE com create or replace).
drop function if exists painel_admin_acessos();

create or replace function painel_admin_acessos()
returns table (
  empresa_id       uuid,
  ultimo_acesso_em timestamptz,
  -- Movimentações de card nos últimos 30 dias. É o pulso: mede trabalho
  -- acontecendo, não cadastro feito uma vez.
  movimentos_30d   integer,
  -- Obras não encerradas. Sozinho não diz nada; cruzado com movimentos_30d
  -- em zero, vira alarme.
  obras_abertas    integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins a where a.user_id = auth.uid()) then
    raise exception 'Acesso negado: apenas administradores.';
  end if;

  return query
  with mov as (
    select o.empresa_id as emp,
           count(*) filter (where hc.created_at > now() - interval '30 days')::int as qtd
    from historico_card hc
    join cards c on c.id = hc.card_id
    join obras o on o.id = c.obra_id
    group by o.empresa_id
  ),
  abertas as (
    select o.empresa_id as emp, count(*)::int as qtd
    from obras o
    where not o.encerrada
    group by o.empresa_id
  )
  select e.id,
         ac.ultimo_acesso_em,
         coalesce(mv.qtd, 0),
         coalesce(ab.qtd, 0)
  from empresas e
  left join acessos_empresa ac on ac.empresa_id = e.id
  left join mov     mv on mv.emp = e.id
  left join abertas ab on ab.emp = e.id;
end;
$$;

revoke all on function painel_admin_acessos() from public;
grant execute on function painel_admin_acessos() to authenticated;

notify pgrst, 'reload schema';


-- =============================================================
-- CONFERÊNCIA (rode depois)
-- =============================================================
-- Tem que voltar uma linha por empresa. O que o painel vai pintar de
-- vermelho é toda linha com obras_abertas > 0 e movimentos_30d = 0:
--
--   select e.nome, e.assinatura_status,
--          (ac.ultimo_acesso_em at time zone 'America/Sao_Paulo')::date as acesso
--   from empresas e
--   left join acessos_empresa ac on ac.empresa_id = e.id
--   order by ac.ultimo_acesso_em desc nulls last;
