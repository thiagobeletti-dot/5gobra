-- =============================================================
-- G Obra — Último ACESSO ao sistema (painel gerencial)
-- =============================================================
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar de novo).
--
-- POR QUE ISSO EXISTE
-- O painel mostrava "último acesso" lendo `auth.users.last_sign_in_at`, que
-- só muda quando a pessoa digita a senha de novo. Quem fica logado usa o
-- sistema todo dia e aparece como "há 1 semana" — foi o que aconteceu com a
-- 5G Gerenciamento em 02/09/2026.
--
-- O semáforo de "parou de usar" também olhava movimentação de card. Card é
-- criado no começo da obra; a obra corre por meses. Cliente ativo aparecia
-- como abandonado.
--
-- Agora existe um carimbo de verdade: toda vez que alguém abre uma tela do
-- app, o banco registra o acesso da empresa dele.
-- =============================================================


-- =============================================================
-- 1) TABELA DO CARIMBO
-- =============================================================
-- Tabela separada de propósito: `empresas` tem trigger de bloqueio de
-- escrita pra quem está sem acesso, e o carimbo precisa gravar mesmo pra
-- empresa vencida (é justamente ela que a gente quer saber se ainda tenta
-- entrar).
create table if not exists acessos_empresa (
  empresa_id       uuid primary key references empresas(id) on delete cascade,
  ultimo_acesso_em timestamptz not null default now()
);

alter table acessos_empresa enable row level security;
-- Sem policy nenhuma: ninguém lê nem escreve direto. Só as funções abaixo
-- (security definer) e o service_role.


-- =============================================================
-- 2) SEMENTE — pra o painel não nascer todo "nunca"
-- =============================================================
-- Melhor estimativa do que já existe hoje: o mais recente entre o último
-- login e a última movimentação de card. Só preenche quem ainda não tem
-- carimbo; rodar de novo não sobrescreve nada.
insert into acessos_empresa (empresa_id, ultimo_acesso_em)
select e.id,
       greatest(
         coalesce(u.last_sign_in_at, 'epoch'::timestamptz),
         coalesce(h.ult,             'epoch'::timestamptz)
       )
from empresas e
left join auth.users u on u.id = e.owner_user_id
left join (
  select o.empresa_id as emp, max(hc.created_at) as ult
  from historico_card hc
  join cards c on c.id = hc.card_id
  join obras o on o.id = c.obra_id
  group by o.empresa_id
) h on h.emp = e.id
where greatest(
        coalesce(u.last_sign_in_at, 'epoch'::timestamptz),
        coalesce(h.ult,             'epoch'::timestamptz)
      ) > 'epoch'::timestamptz
on conflict (empresa_id) do nothing;


-- =============================================================
-- 3) REGISTRAR ACESSO — chamada pelo app em toda troca de tela
-- =============================================================
-- Grava no máximo uma vez a cada 10 minutos por empresa. Sem esse freio,
-- cada clique no menu viraria um write.
create or replace function registrar_acesso()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into acessos_empresa (empresa_id, ultimo_acesso_em)
  select e.id, now()
  from empresas e
  where e.owner_user_id = auth.uid()
  on conflict (empresa_id) do update
     set ultimo_acesso_em = now()
   where acessos_empresa.ultimo_acesso_em < now() - interval '10 minutes';
end;
$$;

revoke all on function registrar_acesso() from public;
grant execute on function registrar_acesso() to authenticated;


-- =============================================================
-- 4) LEITURA DO PAINEL — só admin
-- =============================================================
-- Função separada em vez de mexer na painel_admin_clientes(): o painel
-- busca as duas e junta. Assim a função grande, que já funciona, não é
-- recriada.
create or replace function painel_admin_acessos()
returns table (
  empresa_id       uuid,
  ultimo_acesso_em timestamptz
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
    select ac.empresa_id, ac.ultimo_acesso_em
    from acessos_empresa ac;
end;
$$;

revoke all on function painel_admin_acessos() from public;
grant execute on function painel_admin_acessos() to authenticated;

notify pgrst, 'reload schema';


-- =============================================================
-- CONFERÊNCIA (rode depois)
-- =============================================================
-- Tem que voltar uma linha por empresa, com data plausível:
--   select e.nome, ac.ultimo_acesso_em
--   from empresas e
--   left join acessos_empresa ac on ac.empresa_id = e.id
--   order by ac.ultimo_acesso_em desc nulls last;
--
-- E depois de abrir o app logado, a sua empresa tem que virar "agora":
--   select e.nome, ac.ultimo_acesso_em
--   from acessos_empresa ac join empresas e on e.id = ac.empresa_id
--   order by ac.ultimo_acesso_em desc limit 5;
