-- =============================================================
-- G Obra — Schema inicial do banco
-- Rode este script no SQL Editor do Supabase (Database > SQL Editor)
-- Cria tabelas, indices, RLS, policies basicas e o bucket de Storage.
-- =============================================================

-- ============== EXTENSOES ==============
create extension if not exists "uuid-ossp";

-- ============== TIPOS (enums) ==============
do $$ begin
  create type tipo_card as enum ('peca', 'acordo', 'reclamacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type aba_card as enum ('cliente', 'empresa', 'emandamento', 'conclusao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type autor_tipo as enum ('empresa', 'cliente', 'sistema');
exception when duplicate_object then null; end $$;

-- ============== TABELAS ==============

-- Empresa = serralheria/fabricante. Cada empresa tem um dono (auth.users).
create table if not exists empresas (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Obra = um cliente/projeto da empresa. Cliente acessa via token_cliente.
create table if not exists obras (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  endereco text,
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  inicio date,
  token_cliente uuid not null default uuid_generate_v4(),
  encerrada boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_obras_token_cliente on obras(token_cliente);
create index if not exists idx_obras_empresa on obras(empresa_id);

-- Cards: peca, acordo ou reclamacao
create table if not exists cards (
  id uuid primary key default uuid_generate_v4(),
  obra_id uuid not null references obras(id) on delete cascade,
  tipo tipo_card not null,
  sigla text not null,
  nome text not null,
  descricao text,
  aba aba_card not null default 'cliente',
  status_em_andamento text,
  prazo_contrato date,
  encerrado boolean not null default false,
  -- Auditoria do aceite final (peso juridico)
  aceite_final_at timestamptz,
  aceite_final_ip text,
  aceite_final_user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cards_obra on cards(obra_id);
create index if not exists idx_cards_aba on cards(obra_id, aba);

-- Historico: cada movimento/registro de um card
create table if not exists historico_card (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references cards(id) on delete cascade,
  autor text not null,
  autor_tipo autor_tipo not null,
  texto text not null,
  -- Auditoria de quem registrou
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_card on historico_card(card_id, created_at);

-- Anexos: fotos vinculadas a um registro de historico ou direto a um card
create table if not exists anexos (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references cards(id) on delete cascade,
  historico_id uuid references historico_card(id) on delete set null,
  storage_path text not null,
  nome_arquivo text,
  tamanho_bytes integer,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_anexos_card on anexos(card_id);

-- ============== ROW LEVEL SECURITY ==============
alter table empresas       enable row level security;
alter table obras          enable row level security;
alter table cards          enable row level security;
alter table historico_card enable row level security;
alter table anexos         enable row level security;

-- ---- EMPRESAS: dono autenticado faz tudo no proprio registro ----
drop policy if exists "empresa_owner_select" on empresas;
create policy "empresa_owner_select" on empresas
  for select using (owner_user_id = auth.uid());

drop policy if exists "empresa_owner_insert" on empresas;
create policy "empresa_owner_insert" on empresas
  for insert with check (owner_user_id = auth.uid());

drop policy if exists "empresa_owner_update" on empresas;
create policy "empresa_owner_update" on empresas
  for update using (owner_user_id = auth.uid());

-- ---- OBRAS ----
-- Empresa autenticada gerencia suas obras
drop policy if exists "obras_empresa_all" on obras;
create policy "obras_empresa_all" on obras
  for all
  using (empresa_id in (select id from empresas where owner_user_id = auth.uid()))
  with check (empresa_id in (select id from empresas where owner_user_id = auth.uid()));

-- Cliente (anon) le obra pelo token (link magico)
drop policy if exists "obras_cliente_select_by_token" on obras;
create policy "obras_cliente_select_by_token" on obras
  for select
  using (true); -- restricao de fato eh por filtro no client + token na URL; refinar com edge functions depois

-- ---- CARDS ----
drop policy if exists "cards_empresa_all" on cards;
create policy "cards_empresa_all" on cards
  for all
  using (
    obra_id in (
      select o.id from obras o
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  )
  with check (
    obra_id in (
      select o.id from obras o
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );

-- Anon (cliente) pode ler/inserir cards da obra cujo token ele tem
-- (validacao do token sera feita no client + edge function refinada depois)
drop policy if exists "cards_cliente_anon" on cards;
create policy "cards_cliente_anon" on cards
  for select using (true);

drop policy if exists "cards_cliente_anon_insert" on cards;
create policy "cards_cliente_anon_insert" on cards
  for insert with check (true);

drop policy if exists "cards_cliente_anon_update" on cards;
create policy "cards_cliente_anon_update" on cards
  for update using (true) with check (true);

-- ---- HISTORICO_CARD ----
drop policy if exists "historico_select_all" on historico_card;
create policy "historico_select_all" on historico_card
  for select using (true);

drop policy if exists "historico_insert_all" on historico_card;
create policy "historico_insert_all" on historico_card
  for insert with check (true);

-- ---- ANEXOS ----
drop policy if exists "anexos_select_all" on anexos;
create policy "anexos_select_all" on anexos
  for select using (true);

drop policy if exists "anexos_insert_all" on anexos;
create policy "anexos_insert_all" on anexos
  for insert with check (true);

-- =============================================================
-- NOTA SOBRE SEGURANCA:
-- As policies anon "all true" acima sao permissivas demais pra
-- producao. Servem pra MVP/beta fechado entre 2-3 empresas conhecidas.
-- Antes de abrir publico, refatorar pra:
--   - Edge Functions validando token_cliente da obra
--   - Ou postgres function com SECURITY DEFINER que valida token
-- =============================================================
