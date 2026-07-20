-- ============================================================
-- G Obra — Metas Gamificadas: configuração por empresa
-- ============================================================
-- Feature cravada pelo Thiago 14-15/07/2026 (mockup v3.1 aprovado).
-- 1 linha por empresa: alvos por período + pontos por ação do ranking.
-- O placar em si NÃO tem tabela — é derivado dos registros reais
-- (historico_card / aceite_final_at / cronograma), princípio do Cronograma.
--
-- Rodar no SQL Editor do Supabase (idempotente).
-- ============================================================

create table if not exists metas_config (
  empresa_id uuid primary key references empresas(id) on delete cascade,

  -- Alvos por período (metas quantitativas)
  alvo_fabricar_dia    int not null default 3,
  alvo_fabricar_semana int not null default 15,
  alvo_fabricar_mes    int not null default 60,
  alvo_instalar_dia    int not null default 3,
  alvo_instalar_semana int not null default 15,
  alvo_instalar_mes    int not null default 60,

  -- Pontos por ação (ranking por obra)
  pts_fabricar   int not null default 10,
  pts_instalar   int not null default 10,
  pts_concluir   int not null default 30,
  pts_reclamacao int not null default -20,   -- anti-gaming: apontamento desconta

  atualizado_em timestamptz not null default now()
);

alter table metas_config enable row level security;

drop policy if exists "metas_config_select" on metas_config;
create policy "metas_config_select" on metas_config
  for select to authenticated
  using (empresa_id in (select e.id from empresas e where e.owner_user_id = auth.uid()));

drop policy if exists "metas_config_insert" on metas_config;
create policy "metas_config_insert" on metas_config
  for insert to authenticated
  with check (empresa_id in (select e.id from empresas e where e.owner_user_id = auth.uid()));

drop policy if exists "metas_config_update" on metas_config;
create policy "metas_config_update" on metas_config
  for update to authenticated
  using (empresa_id in (select e.id from empresas e where e.owner_user_id = auth.uid()));

notify pgrst, 'reload schema';
