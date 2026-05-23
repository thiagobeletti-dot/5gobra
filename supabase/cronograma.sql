-- =============================================================
-- CRONOGRAMA V1 — programação manual de fases de obra
-- =============================================================
-- Permite empresa configurar prazos contratuais + cliente aceitar digitalmente
-- Implementa "Demanda na obra (cliente)" vs "Demanda na fábrica (empresa)"
--
-- Cronograma é COMPROMISSO. Uma vez aceito, não se edita pra estender prazos.
-- (Edição/renegociação fica pra V1.1 futuro.)
--
-- Idempotent — pode rodar várias vezes sem efeito colateral
-- =============================================================


-- =============================================================
-- TABELA 1: cronogramas (1 por obra, opcional)
-- =============================================================
create table if not exists cronogramas (
  id uuid primary key default uuid_generate_v4(),
  obra_id uuid not null references obras(id) on delete cascade,

  -- "por_lote": última peça liberada dispara o cronograma da obra inteira
  -- "por_peca": cada peça tem seu próprio gatilho (futuro)
  modo_contagem text not null default 'por_lote'
    check (modo_contagem in ('por_lote', 'por_peca')),

  -- Aceite do cliente (assinatura digital)
  aceito_em timestamptz,
  aceito_ip text,
  aceito_user_agent text,

  -- Liberação do vão (cliente marca quando obra está pronta pra receber esquadria)
  vao_liberado_em timestamptz,
  vao_liberado_ip text,
  vao_liberado_user_agent text,

  versao int not null default 1,
  ativo boolean not null default true,

  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- 1 cronograma ativo por obra
  unique (obra_id)
);

create index if not exists idx_cronogramas_obra on cronogramas(obra_id);


-- =============================================================
-- TABELA 2: cronograma_fases (várias por cronograma)
-- =============================================================
create table if not exists cronograma_fases (
  id uuid primary key default uuid_generate_v4(),
  cronograma_id uuid not null references cronogramas(id) on delete cascade,

  ordem int not null,                      -- sequência: 1, 2, 3...
  nome text not null,                      -- "Medição M1", "Entrega Contramarco", etc
  descricao text,

  -- O que dispara a fase começar a contar
  gatilho_tipo text not null
    check (gatilho_tipo in (
      'assinatura_contrato',               -- dispara quando cliente aceita
      'fim_fase_anterior',                 -- dispara quando outra fase conclui
      'liberacao_vao',                     -- dispara quando cliente marca vão liberado
      'data_fixa'                          -- dispara em data específica
    )),
  gatilho_fase_id uuid references cronograma_fases(id),  -- se 'fim_fase_anterior'
  gatilho_data date,                       -- se 'data_fixa'

  prazo_dias int not null default 0,       -- duração da fase em dias corridos

  -- De quem é a DEMANDA durante essa fase
  responsavel text not null
    check (responsavel in ('empresa', 'cliente')),

  status text not null default 'aguardando_gatilho'
    check (status in (
      'aguardando_gatilho',                -- ainda não disparou
      'em_andamento',                      -- disparou, em curso
      'concluida',                         -- empresa/cliente marcou como feita
      'atrasada'                           -- prazo estourou sem conclusão
    )),

  iniciada_em date,                        -- quando fase começou
  concluida_em date,                       -- quando fase terminou
  previsao_inicio date,                    -- calculado
  previsao_fim date,                       -- previsao_inicio + prazo_dias

  observacoes text,

  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (cronograma_id, ordem)
);

create index if not exists idx_cronograma_fases_cronograma on cronograma_fases(cronograma_id);
create index if not exists idx_cronograma_fases_status on cronograma_fases(status);


-- =============================================================
-- TABELA 3: cronograma_eventos (audit log)
-- =============================================================
create table if not exists cronograma_eventos (
  id uuid primary key default uuid_generate_v4(),
  cronograma_id uuid not null references cronogramas(id) on delete cascade,
  fase_id uuid references cronograma_fases(id) on delete set null,

  tipo text not null
    check (tipo in (
      'cronograma_criado',
      'cronograma_aceito',
      'vao_liberado',
      'fase_iniciada',
      'fase_concluida',
      'fase_atrasou'
    )),

  autor_tipo text not null
    check (autor_tipo in ('empresa', 'cliente', 'sistema')),
  autor_nome text,
  texto text,                              -- descrição livre

  ip text,
  user_agent text,

  created_at timestamptz not null default now()
);

create index if not exists idx_cronograma_eventos_cronograma on cronograma_eventos(cronograma_id, created_at desc);


-- =============================================================
-- TRIGGER: atualiza atualizado_em automaticamente
-- =============================================================
create or replace function tg_cronograma_atualizar_timestamp() returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cronogramas_atualizar on cronogramas;
create trigger trg_cronogramas_atualizar
  before update on cronogramas
  for each row execute function tg_cronograma_atualizar_timestamp();

drop trigger if exists trg_cronograma_fases_atualizar on cronograma_fases;
create trigger trg_cronograma_fases_atualizar
  before update on cronograma_fases
  for each row execute function tg_cronograma_atualizar_timestamp();


-- =============================================================
-- RLS POLICIES — seguindo padrão das outras tabelas do 5gobra
-- =============================================================

-- ============ cronogramas ============
alter table cronogramas enable row level security;

drop policy if exists "cronogramas_empresa_all" on cronogramas;
create policy "cronogramas_empresa_all" on cronogramas
  for all to authenticated
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

drop policy if exists "cronogramas_cliente_anon_select" on cronogramas;
create policy "cronogramas_cliente_anon_select" on cronogramas
  for select to anon using (true);

drop policy if exists "cronogramas_cliente_anon_update" on cronogramas;
create policy "cronogramas_cliente_anon_update" on cronogramas
  for update to anon using (true) with check (true);


-- ============ cronograma_fases ============
alter table cronograma_fases enable row level security;

drop policy if exists "cronograma_fases_empresa_all" on cronograma_fases;
create policy "cronograma_fases_empresa_all" on cronograma_fases
  for all to authenticated
  using (
    cronograma_id in (
      select c.id from cronogramas c
      join obras o on o.id = c.obra_id
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  )
  with check (
    cronograma_id in (
      select c.id from cronogramas c
      join obras o on o.id = c.obra_id
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );

drop policy if exists "cronograma_fases_cliente_anon_select" on cronograma_fases;
create policy "cronograma_fases_cliente_anon_select" on cronograma_fases
  for select to anon using (true);

drop policy if exists "cronograma_fases_cliente_anon_update" on cronograma_fases;
create policy "cronograma_fases_cliente_anon_update" on cronograma_fases
  for update to anon using (true) with check (true);


-- ============ cronograma_eventos ============
alter table cronograma_eventos enable row level security;

drop policy if exists "cronograma_eventos_empresa_select" on cronograma_eventos;
create policy "cronograma_eventos_empresa_select" on cronograma_eventos
  for select to authenticated
  using (
    cronograma_id in (
      select c.id from cronogramas c
      join obras o on o.id = c.obra_id
      join empresas e on e.id = o.empresa_id
      where e.owner_user_id = auth.uid()
    )
  );

drop policy if exists "cronograma_eventos_empresa_insert" on cronograma_eventos;
create policy "cronograma_eventos_empresa_insert" on cronograma_eventos
  for insert to authenticated with check (true);

drop policy if exists "cronograma_eventos_anon_select" on cronograma_eventos;
create policy "cronograma_eventos_anon_select" on cronograma_eventos
  for select to anon using (true);

drop policy if exists "cronograma_eventos_anon_insert" on cronograma_eventos;
create policy "cronograma_eventos_anon_insert" on cronograma_eventos
  for insert to anon with check (true);


-- =============================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- =============================================================
comment on table cronogramas is 'V1: cronograma manual da obra. 1 por obra, opcional.';
comment on table cronograma_fases is 'Fases do cronograma com gatilhos, prazos e responsável (empresa ou cliente).';
comment on table cronograma_eventos is 'Audit log: criação, aceite, liberação, fases iniciadas/concluídas.';

comment on column cronogramas.modo_contagem is 'por_lote: ultima peça libera tudo. por_peca: futura V2.';
comment on column cronograma_fases.responsavel is 'De quem é a DEMANDA durante esta fase: empresa ou cliente.';
comment on column cronograma_fases.gatilho_tipo is 'O que faz a fase começar: assinatura_contrato | fim_fase_anterior | liberacao_vao | data_fixa.';


-- =============================================================
-- FIM — testar com:
-- SELECT * FROM cronogramas LIMIT 0;
-- SELECT * FROM cronograma_fases LIMIT 0;
-- SELECT * FROM cronograma_eventos LIMIT 0;
-- =============================================================
