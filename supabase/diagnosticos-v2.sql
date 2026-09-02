-- =============================================================
-- G Obra — Raio-X v2 (página /raio-x reformulada em 02/09/2026)
-- =============================================================
-- A v1 guardava colunas fixas (dor, controle, obras_mes, viagens_mes) que
-- não existem mais: o quiz agora tem 7 perguntas e duas bifurcações, e o
-- formato pode mudar de novo conforme a gente aprender. Por isso as
-- respostas passam a ir num JSONB — muda a pergunta, não muda o banco.
--
-- Idempotente. Roda por cima da v1 sem perder nada.
-- =============================================================

-- Cria a tabela se ela ainda não existir (instalação nova)
create table if not exists diagnosticos (
  id uuid primary key default uuid_generate_v4(),
  origem text default 'raio-x',
  chegou_ao_fim boolean not null default false,
  clicou_trial boolean not null default false,
  clicou_assinar boolean not null default false,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Colunas novas da v2
alter table diagnosticos
  add column if not exists respostas    jsonb,   -- { q1..q7, ramo2, ramo3 }
  add column if not exists utm_campaign text,
  add column if not exists quem         text;    -- ?quem=vilumi (envio individual)

-- 'ref' NÃO é usado aqui de propósito: já pertence ao programa de afiliados
-- no fluxo de compra (ModalComprar). Usar o mesmo nome misturaria as duas
-- coisas no relatório.

comment on column diagnosticos.respostas is
  'Respostas do raio-x em JSON. Chaves q1..q7 + ramo2/ramo3 (qual lado da bifurcação).';
comment on column diagnosticos.quem is
  'Identificador de quem recebeu o link, quando o Thiago manda pra uma empresa específica.';

create index if not exists idx_diagnosticos_created on diagnosticos(created_at desc);
create index if not exists idx_diagnosticos_respostas on diagnosticos using gin (respostas);

-- ============== RLS (mantida da v1) ==============
alter table diagnosticos enable row level security;

drop policy if exists "diagnosticos_anon_insert" on diagnosticos;
create policy "diagnosticos_anon_insert" on diagnosticos
  for insert to anon, authenticated
  with check (true);

drop policy if exists "diagnosticos_anon_update" on diagnosticos;
create policy "diagnosticos_anon_update" on diagnosticos
  for update to anon, authenticated
  using (created_at > now() - interval '2 hours')
  with check (true);

drop policy if exists "diagnosticos_admin_select" on diagnosticos;
create policy "diagnosticos_admin_select" on diagnosticos
  for select to authenticated
  using (exists (select 1 from admins a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';

-- =============================================================
-- CONSULTAS ÚTEIS (rode quando tiver volume)
-- =============================================================
-- Tamanho de quem chega na página:
--   select respostas->>'q1' as obras, count(*)
--   from diagnosticos group by 1 order by 2 desc;
--
-- Como o mercado controla obra hoje:
--   select respostas->>'q2' as controle, count(*)
--   from diagnosticos group by 1 order by 2 desc;
--
-- Qual dor puxa mais (a bifurcação que ele escolheu):
--   select respostas->>'ramo2' as desgaste, count(*),
--          count(*) filter (where clicou_trial)   as foram_pro_teste,
--          count(*) filter (where clicou_assinar) as foram_contratar
--   from diagnosticos group by 1 order by 2 desc;
--
-- De onde veio quem converteu:
--   select origem, quem, count(*) filter (where clicou_trial or clicou_assinar) as agiram
--   from diagnosticos group by 1,2 order by 3 desc;
