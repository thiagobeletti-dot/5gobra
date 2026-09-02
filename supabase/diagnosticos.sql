-- =============================================================
-- G Obra — Raio-X da gestão (página /raio-x)
-- =============================================================
-- Guarda as respostas do diagnóstico interativo. Serve pra dois fins:
--   1. Capturar o e-mail de quem quer receber o resultado (lead que NÃO
--      comprou na hora — hoje essa gente some sem deixar rastro).
--   2. Inteligência de mercado: a distribuição das dores de quem visita
--      ("70% diz que o problema é o cliente cobrar coisa não combinada")
--      vale ouro pra pauta de conteúdo e pro pitch.
--
-- Rodar no SQL Editor do Supabase. Idempotente.
-- =============================================================

create table if not exists diagnosticos (
  id uuid primary key default uuid_generate_v4(),

  -- Respostas
  dor text,                          -- cliente | visibilidade | tecnico | digitacao
  controle text,                     -- planilha | whatsapp | caderno | sistema
  obras_mes integer,
  viagens_mes integer,
  economia_estimada_centavos integer,

  -- Contato (opcional — só quem pediu o resultado por e-mail)
  email text,

  -- Jornada
  chegou_ao_fim boolean not null default false,
  clicou_trial boolean not null default false,
  clicou_assinar boolean not null default false,

  origem text default 'raio-x',
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_diagnosticos_created on diagnosticos(created_at desc);
create index if not exists idx_diagnosticos_dor on diagnosticos(dor);
create index if not exists idx_diagnosticos_email on diagnosticos(email);

-- ============== RLS ==============
alter table diagnosticos enable row level security;

-- Visitante anônimo PODE inserir (é o próprio diagnóstico dele) e PODE
-- atualizar a própria linha na mesma sessão — mas NÃO pode ler nada.
drop policy if exists "diagnosticos_anon_insert" on diagnosticos;
create policy "diagnosticos_anon_insert" on diagnosticos
  for insert to anon, authenticated
  with check (true);

drop policy if exists "diagnosticos_anon_update" on diagnosticos;
create policy "diagnosticos_anon_update" on diagnosticos
  for update to anon, authenticated
  using (created_at > now() - interval '2 hours')
  with check (true);

-- Só admin lê (mesma regra do painel gerencial).
drop policy if exists "diagnosticos_admin_select" on diagnosticos;
create policy "diagnosticos_admin_select" on diagnosticos
  for select to authenticated
  using (exists (select 1 from admins a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';

-- =============================================================
-- CONSULTA ÚTIL — distribuição das dores (rode quando tiver volume)
-- =============================================================
--   select dor, count(*) as qtd,
--          count(*) filter (where chegou_ao_fim) as terminaram,
--          count(*) filter (where clicou_trial)  as foram_pro_teste
--   from diagnosticos
--   group by dor
--   order by qtd desc;
