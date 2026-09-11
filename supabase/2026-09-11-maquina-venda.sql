-- =============================================================
-- G Obra — Máquina de venda (/app/vendas)
-- =============================================================
-- Por que existe (decidido com o Thiago em 10–11/09/2026):
--   Ele levanta leads e não trabalha os que já demonstraram interesse.
--   Palavras dele: "não tenho cabeça, braço e ferramenta para acompanhar
--   e controlar isso e com certeza vou abandonar leads". O sistema tem
--   que DIZER com quem falar hoje, não perguntar o que ele quer olhar.
--
-- Decisões de modelagem que NÃO devem ser desfeitas sem conversa:
--   1. Coluna do funil é ESTADO, não número de toque. Um lead no toque 6
--      sem resposta está mais frio que um no toque 2 que respondeu — um
--      quadro por número de toque mostraria o contrário.
--   2. CADÊNCIA (2–3 dias) é para quem nunca respondeu, e é uma sequência
--      informativa: cada toque entrega uma solução. Não é cobrança.
--   3. PARADO (2–3 dias) é para quem JÁ respondeu e sumiu. Entra na mesma
--      fila do "hoje", porque conversa que esfria é como negócio morre.
--   4. Terminou o toque 7 sem resposta => 'gelado', volta em 90 dias.
--      'perdido' é só pra quem disse não. Limbo não existe de propósito.
--   5. Não existe "adiar". Empurrar sem decidir é o comportamento que faz
--      perder lead, e era o único botão que permitia isso.
--
-- Segurança: tudo gated em `admins` (mesma tabela do painel gerencial).
-- Cliente logado não enxerga nem uma linha.
--
-- Idempotente. Rodar no SQL Editor do Supabase.
-- =============================================================


-- =============================================================
-- 1) CONFIGURAÇÃO — prazos editáveis sem mexer em código
-- =============================================================
create table if not exists vendas_config (
  chave text primary key,
  valor integer not null,
  descricao text
);

insert into vendas_config (chave, valor, descricao) values
  ('parado_conversando', 2, 'Dias de silêncio depois que a pessoa respondeu, antes de voltar pra fila'),
  ('parado_testando',    3, 'Dias sem movimento de quem criou conta de teste'),
  ('parado_decidindo',   2, 'Dias de silêncio de quem já viu o preço'),
  ('parado_novo',        0, 'Lead novo entra na fila imediatamente'),
  ('gelado_dias',       90, 'Quanto tempo até um lead gelado voltar a aparecer'),
  ('teto_por_dia',      15, 'Máximo de toques por dia — protege a conta do limite do Instagram')
on conflict (chave) do nothing;


-- =============================================================
-- 2) CADÊNCIA — os 7 toques, editáveis na tela
-- =============================================================
-- `dias_ate_o_proximo` é a distância ATÉ o toque seguinte. O toque 7 é o
-- último: zero dias depois dele, o lead vira 'gelado'.
create table if not exists vendas_cadencia (
  numero              integer primary key check (numero between 1 and 12),
  dias_ate_o_proximo  integer not null default 2 check (dias_ate_o_proximo >= 0),
  titulo              text not null,
  mensagem            text,
  link                text,
  ativo               boolean not null default true
);

insert into vendas_cadencia (numero, dias_ate_o_proximo, titulo, link) values
  (1, 2, 'Abertura + a obra entra sem digitar',      'https://raiox.5gobra.com.br/?quem=seq1#e1'),
  (2, 3, 'O técnico mede na obra, com foto',          'https://raiox.5gobra.com.br/?quem=seq2#e2'),
  (3, 2, 'Vão não liberado vira prova',               'https://raiox.5gobra.com.br/?quem=seq3#e3'),
  (4, 3, 'O cliente acompanha por um link só dele',   'https://raiox.5gobra.com.br/?quem=seq4#e4'),
  (5, 2, 'O prazo conta sozinho — e a saída',         'https://raiox.5gobra.com.br/?quem=seq5#e5'),
  (6, 3, 'Produção e instalação viram placar',        'https://raiox.5gobra.com.br/?quem=seq6#e7'),
  (7, 0, 'Fechamento: o pedido é a demo',             'https://raiox.5gobra.com.br/?quem=seq7')
on conflict (numero) do nothing;


-- =============================================================
-- 3) LEADS
-- =============================================================
create table if not exists vendas_leads (
  id                uuid primary key default uuid_generate_v4(),
  nome              text not null,
  empresa           text,
  telefone          text,           -- só dígitos quando der, mas aceita como veio
  instagram         text,           -- @ sem arroba
  cidade            text,

  canal             text not null default 'whatsapp',  -- whatsapp | instagram
  origem            text,           -- comentou_video | direct | anuncio | feira | indicacao | raio_x | site

  -- estado do RELACIONAMENTO, não do número de toques
  estado            text not null default 'novo',
  -- novo | cadencia | conversando | testando | decidindo | cliente | gelado | perdido

  toque             integer not null default 0 check (toque >= 0),
  proximo_em        date,           -- quando ele volta pra fila do Hoje
  ultimo_contato_em timestamptz,

  -- O Thiago quer levar todo mundo pro WhatsApp, onde a dinâmica é melhor.
  -- Isso é uma conversão de canal e merece ser medida separado.
  foi_pro_whatsapp  boolean not null default false,

  -- A Giulia (atendimento automático) responde antes dele. Quem falou com
  -- ela já ouviu coisas — o primeiro contato humano não pode ignorar isso.
  passou_pela_giulia boolean not null default false,

  resumo            text,           -- o que já rolou, em uma frase
  gancho            text,           -- por que vale reabrir
  motivo_fim        text,           -- por que virou perdido ou gelado
  notas             text,

  empresa_id        uuid references empresas(id) on delete set null,

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  constraint vendas_leads_estado_ok check (estado in
    ('novo','cadencia','conversando','testando','decidindo','cliente','gelado','perdido')),
  constraint vendas_leads_canal_ok check (canal in ('whatsapp','instagram'))
);

create index if not exists idx_vendas_leads_estado   on vendas_leads(estado);
create index if not exists idx_vendas_leads_proximo  on vendas_leads(proximo_em);
create index if not exists idx_vendas_leads_telefone on vendas_leads(telefone);

-- evita cadastrar a mesma pessoa duas vezes (o João Paulo apareceu em duas
-- listas — WhatsApp e Direct — e só percebemos no olho)
create unique index if not exists uq_vendas_leads_telefone
  on vendas_leads(telefone) where telefone is not null and telefone <> '';
create unique index if not exists uq_vendas_leads_instagram
  on vendas_leads(instagram) where instagram is not null and instagram <> '';


-- =============================================================
-- 4) TOQUES — o histórico, uma linha por interação
-- =============================================================
create table if not exists vendas_toques (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references vendas_leads(id) on delete cascade,
  numero      integer,        -- número na cadência; null quando é conversa solta
  tipo        text not null default 'texto',
  -- texto | audio | visualizacao_unica | ligacao | nota
  canal       text,
  direcao     text not null default 'enviado',  -- enviado | recebido
  conteudo    text,
  criado_em   timestamptz not null default now(),
  constraint vendas_toques_tipo_ok check (tipo in
    ('texto','audio','visualizacao_unica','ligacao','nota')),
  constraint vendas_toques_direcao_ok check (direcao in ('enviado','recebido'))
);

create index if not exists idx_vendas_toques_lead on vendas_toques(lead_id, criado_em desc);


-- =============================================================
-- 5) atualizado_em automático
-- =============================================================
create or replace function set_atualizado_em_vendas()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_vendas_leads_atualizado on vendas_leads;
create trigger trg_vendas_leads_atualizado
  before update on vendas_leads
  for each row execute function set_atualizado_em_vendas();


-- =============================================================
-- 6) RLS — só admin, e só admin
-- =============================================================
alter table vendas_leads    enable row level security;
alter table vendas_toques   enable row level security;
alter table vendas_cadencia enable row level security;
alter table vendas_config   enable row level security;

-- Uma policy por tabela, escrita na mão de propósito: laço dinâmico aqui
-- economiza dez linhas e custa uma hora quando falha.

drop policy if exists "vendas_leads_admin_all" on vendas_leads;
create policy "vendas_leads_admin_all" on vendas_leads
  for all to authenticated
  using      (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "vendas_toques_admin_all" on vendas_toques;
create policy "vendas_toques_admin_all" on vendas_toques
  for all to authenticated
  using      (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "vendas_cadencia_admin_all" on vendas_cadencia;
create policy "vendas_cadencia_admin_all" on vendas_cadencia
  for all to authenticated
  using      (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "vendas_config_admin_all" on vendas_config;
create policy "vendas_config_admin_all" on vendas_config
  for all to authenticated
  using      (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));


-- =============================================================
-- 7) VISÃO DA FILA — quem falar hoje, de qualquer estado
-- =============================================================
-- security_invoker: a view respeita a RLS de quem chama, em vez de rodar
-- como dona. Sem isso, qualquer logado leria a fila inteira.
drop view if exists vendas_fila;
create view vendas_fila
with (security_invoker = on)
as
select
  l.*,
  (l.proximo_em - current_date)                      as dias,
  (l.proximo_em is not null and l.proximo_em <= current_date) as na_fila,
  case
    when l.estado in ('cliente','perdido')                       then null
    when l.proximo_em is null                                    then null
    when l.proximo_em <  current_date                            then 'atrasado'
    when l.proximo_em =  current_date                            then 'hoje'
    else 'em_dia'
  end                                                as situacao,
  -- 'atrasado' é toque que não saiu; 'parado' é conversa que esfriou.
  -- A palavra muda porque o problema é outro.
  (l.estado not in ('novo','cadencia'))              as e_conversa_fria,
  (select count(*) from vendas_toques t where t.lead_id = l.id) as qtd_toques
from vendas_leads l;


-- =============================================================
-- 8) CONFERÊNCIA
-- =============================================================
-- select * from vendas_cadencia order by numero;
-- select chave, valor from vendas_config order by chave;
-- select count(*) from vendas_leads;
-- select * from vendas_fila where na_fila order by dias;
