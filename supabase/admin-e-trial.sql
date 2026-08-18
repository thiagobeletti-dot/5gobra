-- =============================================================
-- G Obra — Painel gerencial (admin) + Trial de 14 dias sem cartão
-- =============================================================
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar de novo).
--
-- O QUE ESTE ARQUIVO FAZ
--   1. Cria a tabela `admins` (quem enxerga o painel gerencial)
--   2. CORRIGE UM VAZAMENTO DE DADOS em pre_cadastros (ver seção 2 — importante)
--   3. Prepara o trial sem cartão (assinatura no Asaas passa a ser opcional)
--   4. Marca quando a empresa cadastrou cartão (pro desconto do incentivo)
-- =============================================================


-- =============================================================
-- 1) ADMINS — quem pode abrir o painel gerencial
-- =============================================================
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  criado_em timestamptz not null default now()
);

alter table admins enable row level security;

-- Cada admin só enxerga a própria linha (usado pelo app pra decidir se mostra o menu).
drop policy if exists "admins_self_select" on admins;
create policy "admins_self_select" on admins
  for select to authenticated
  using (user_id = auth.uid());

-- ATENÇÃO: admin é amarrado a uma CONTA DE LOGIN existente no G Obra
-- (auth.users), não a um e-mail solto. Se não existir conta com o e-mail
-- abaixo, nada é inserido e o painel vai dizer "acesso negado".
--
-- PASSO 0 — descubra quais contas existem. Rode SÓ esta linha primeiro:
--     select email, last_sign_in_at from auth.users order by last_sign_in_at desc nulls last;
--
-- Depois coloque na lista abaixo o e-mail com que VOCÊ VAI LOGAR pra abrir o
-- painel. Pode colocar mais de um (ex.: seu login de teste + seu gmail, se
-- você criar uma conta com ele depois).
insert into admins (user_id, email)
select id, email from auth.users
where lower(email) in (
  lower('thiagobeletti@gmail.com')     -- troque/adicione aqui
  -- , lower('seu-login-de-teste@exemplo.com')
)
on conflict (user_id) do nothing;

-- CONFERÊNCIA: rode depois de tudo. Tem que voltar pelo menos 1 linha.
-- Se voltar vazio, o e-mail acima não bate com nenhuma conta existente.
--     select * from admins;


-- =============================================================
-- 2) CORREÇÃO DE SEGURANÇA — pre_cadastros estava aberto
-- =============================================================
-- A policy antiga era:
--     for select to authenticated using (true)
-- Ou seja: QUALQUER cliente logado no G Obra conseguia ler a tabela inteira
-- de pré-cadastros — nome, e-mail, WhatsApp e CPF/CNPJ de todos os outros
-- clientes. Dado pessoal exposto (risco de LGPD).
--
-- Agora só admin lê.
drop policy if exists "pre_cadastros_auth_select" on pre_cadastros;
drop policy if exists "pre_cadastros_admin_select" on pre_cadastros;
create policy "pre_cadastros_admin_select" on pre_cadastros
  for select to authenticated
  using (exists (select 1 from admins a where a.user_id = auth.uid()));


-- =============================================================
-- 3) TRIAL SEM CARTÃO — assinatura no Asaas vira opcional
-- =============================================================
-- No fluxo novo a pessoa entra e usa 14 dias ANTES de existir cobrança.
-- Logo, no momento do cadastro ainda não há assinatura no Asaas.
alter table pre_cadastros alter column asaas_subscription_id drop not null;

-- Valores esperados de status agora incluem 'trial':
--   trial                → usando os 14 dias, sem cobrança criada
--   aguardando_pagamento → assinatura criada, esperando pagar
--   pago                 → 1ª cobrança quitada
--   convertido           → empresa criada e acessando
--   expirado             → trial venceu sem conversão / assinatura cancelada
-- (status é text livre, não precisa de constraint nova)

-- Valor do 1º mês também pode não existir ainda no cadastro sem cartão.
alter table pre_cadastros alter column valor_primeiro_mes_centavos drop not null;
alter table pre_cadastros alter column valor_recorrente_centavos drop not null;

-- CPF/CNPJ deixa de ser obrigatório no cadastro sem cartão (só pedimos na cobrança).
alter table pre_cadastros alter column cpf_cnpj drop not null;


-- =============================================================
-- 4) EMPRESAS — rastro do cartão e da origem do trial
-- =============================================================
-- Quando a empresa cadastra o cartão durante o teste (e ganha o desconto).
alter table empresas
  add column if not exists cartao_cadastrado_em timestamptz;

-- Guarda o desconto prometido pelo incentivo (%), aplicado na 1ª cobrança.
alter table empresas
  add column if not exists desconto_incentivo_pct numeric(5, 2);

-- Liga a empresa ao pré-cadastro que a originou (pro painel mostrar contato).
alter table empresas
  add column if not exists pre_cadastro_id uuid references pre_cadastros(id);

create index if not exists idx_empresas_trial_termina on empresas(trial_termina_em);
create index if not exists idx_empresas_pre_cadastro on empresas(pre_cadastro_id);


-- =============================================================
-- 5) FUNÇÃO DO PAINEL — uma linha por cliente, com uso real
-- =============================================================
-- Roda com privilégio elevado (security definer) MAS checa na primeira linha
-- se quem chamou está em `admins`. Cliente comum recebe "acesso negado".
-- Assim o painel não precisa de Edge Function nova.
create or replace function painel_admin_clientes()
returns table (
  empresa_id uuid,
  empresa_nome text,
  entrou_em timestamptz,
  contato_nome text,
  contato_email text,
  contato_whatsapp text,
  origem text,
  assinatura_status text,
  trial_termina_em timestamptz,
  dias_restantes integer,
  cartao_cadastrado_em timestamptz,
  ultimo_login timestamptz,
  ultima_atividade timestamptz,
  qtd_obras integer,
  qtd_pecas integer,
  qtd_fotos integer,
  cliente_interagiu boolean,
  ativado boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from admins a where a.user_id = auth.uid()) then
    raise exception 'Acesso negado: apenas administradores.';
  end if;

  return query
  with cards_emp as (
    select c.id as card_id, o.empresa_id as emp, c.tipo::text as tipo
    from cards c
    join obras o on o.id = c.obra_id
  ),
  hist as (
    select ce.emp,
           max(h.created_at) as ult,
           bool_or(h.autor_tipo::text = 'cliente') as interagiu
    from historico_card h
    join cards_emp ce on ce.card_id = h.card_id
    group by ce.emp
  ),
  fotos as (
    select ce.emp, count(*)::int as qtd
    from anexos an
    join cards_emp ce on ce.card_id = an.card_id
    group by ce.emp
  ),
  cont_obras as (
    select o2.empresa_id as emp, count(*)::int as qtd
    from obras o2
    group by o2.empresa_id
  ),
  cont_pecas as (
    select ce2.emp, count(*)::int as qtd
    from cards_emp ce2
    where ce2.tipo = 'peca'
    group by ce2.emp
  )
  select
    e.id,
    e.nome,
    e.created_at,
    pc.nome_completo,
    coalesce(pc.email, u.email),
    pc.whatsapp,
    pc.origem,
    e.assinatura_status,
    e.trial_termina_em,
    case
      when e.trial_termina_em is null then null
      else greatest(0, ceil(extract(epoch from (e.trial_termina_em - now())) / 86400)::int)
    end,
    e.cartao_cadastrado_em,
    u.last_sign_in_at,
    h.ult,
    coalesce(co.qtd, 0),
    coalesce(cp.qtd, 0),
    coalesce(f.qtd, 0),
    coalesce(h.interagiu, false),
    (coalesce(co.qtd, 0) > 0 and coalesce(cp.qtd, 0) > 0)
  from empresas e
  left join pre_cadastros pc on pc.id = e.pre_cadastro_id
  left join auth.users u on u.id = e.owner_user_id
  left join hist h on h.emp = e.id
  left join fotos f on f.emp = e.id
  left join cont_obras co on co.emp = e.id
  left join cont_pecas cp on cp.emp = e.id
  order by e.created_at desc;
end;
$$;

revoke all on function painel_admin_clientes() from public;
grant execute on function painel_admin_clientes() to authenticated;

notify pgrst, 'reload schema';
