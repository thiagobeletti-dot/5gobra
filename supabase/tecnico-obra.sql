-- =============================================================
-- G Obra — Link mágico do técnico (3º ator, separado da empresa)
--
-- Empresa cadastra técnicos por obra (ex: "Edson - medidor"),
-- cada um com seu próprio token. Técnico abre /tec/<token> no
-- celular em obra e preenche M1/M2 + fotos. Cliente não vê
-- a aba do técnico nem registros internos.
--
-- Rodar no SQL Editor do Supabase.
-- =============================================================

-- ============== TIPOS (enum) ==============
-- Adiciona 'tecnico' ao enum autor_tipo se ainda não existir.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'tecnico'
      and enumtypid = (select oid from pg_type where typname = 'autor_tipo')
  ) then
    alter type autor_tipo add value 'tecnico';
  end if;
end $$;

-- ============== TABELA ==============
create table if not exists tecnicos_obra (
  id uuid primary key default uuid_generate_v4(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null, -- ex: "Edson"
  papel text, -- ex: "medidor", "instalador"
  token uuid not null unique default uuid_generate_v4(),
  ativo boolean not null default true,
  revogado_em timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_tecnicos_obra_token on tecnicos_obra(token);
create index if not exists idx_tecnicos_obra_obra on tecnicos_obra(obra_id);

-- ============== ROW LEVEL SECURITY ==============
alter table tecnicos_obra enable row level security;

-- Empresa autenticada gerencia técnicos das próprias obras
drop policy if exists "tecnicos_empresa_all" on tecnicos_obra;
create policy "tecnicos_empresa_all" on tecnicos_obra
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

-- Anon (técnico via link) lê seu próprio registro pelo token na URL.
-- A validação real do token + restrição de escrita vai ser por
-- edge functions futuramente. Por hora, anon pode ler.
drop policy if exists "tecnicos_anon_select" on tecnicos_obra;
create policy "tecnicos_anon_select" on tecnicos_obra
  for select using (true);
