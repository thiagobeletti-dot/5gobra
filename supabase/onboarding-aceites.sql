-- =============================================================
-- G Obra — Phase 9: Onboarding interno + Aceites contratuais
-- =============================================================
-- Adiciona:
--   1) Coluna empresas.onboarding_status (jsonb) com flags pra controlar
--      banner condicional, tour e nudges contextuais
--   2) Tabela aceites pra registrar todos os aceites do sistema:
--      contratuais (Termos+Privacidade), aceite final da obra,
--      mudancas de tipologia, etc. Cada aceite guarda IP, user agent,
--      timestamp e hash do documento aceito.
--
-- Como rodar:
--   Supabase Dashboard -> SQL Editor -> cole esse arquivo -> Run
--   Idempotente (pode rodar varias vezes sem dar erro).
-- =============================================================

-- 1) Coluna onboarding_status na tabela empresas
alter table empresas
  add column if not exists onboarding_status jsonb not null default '{
    "tour_visto": false,
    "tour_dispensado": false,
    "primeira_obra_criada": false,
    "tecnico_convidado": false,
    "primeiro_card_criado": false,
    "cliente_acessou_link_magico": false,
    "primeiro_aceite_registrado": false
  }'::jsonb;

-- Empresas que ja existiam ganham defaults (somente se a coluna acabou de
-- ser criada ou se algum campo nao existir no jsonb da empresa atual).
update empresas
set onboarding_status = '{
  "tour_visto": false,
  "tour_dispensado": false,
  "primeira_obra_criada": false,
  "tecnico_convidado": false,
  "primeiro_card_criado": false,
  "cliente_acessou_link_magico": false,
  "primeiro_aceite_registrado": false
}'::jsonb
where onboarding_status is null
   or onboarding_status = '{}'::jsonb;

-- =============================================================
-- 2) Tabela aceites
-- =============================================================
do $$ begin
  create type tipo_aceite as enum (
    'termos_uso',
    'politica_privacidade',
    'aceite_final_obra',
    'mudanca_tipologia',
    'acordo_card',
    'liberacao_obra',
    'outro'
  );
exception when duplicate_object then null; end $$;

create table if not exists aceites (
  id uuid primary key default uuid_generate_v4(),
  tipo tipo_aceite not null,

  -- Quem aceitou (pelo menos um dos dois deve estar preenchido)
  -- empresa_id: aceite de empresa autenticada (Termos, Privacidade)
  -- contato_identificador: aceite de cliente final / tecnico via link magico
  --   (telefone, email ou nome livre — qualquer coisa que identifique)
  empresa_id uuid references empresas(id) on delete cascade,
  contato_identificador text,
  contato_tipo text check (contato_tipo in ('cliente_final', 'tecnico', 'admin_empresa', null)),

  -- Contexto opcional do aceite
  obra_id uuid references obras(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,

  -- Conteudo aceito
  documento_versao text not null,                    -- ex: "termos_uso_v1.0", "aceite_final_obra"
  documento_hash text not null,                      -- sha-256 do conteudo no momento do aceite
  documento_snapshot jsonb,                          -- copia do conteudo aceito (texto + metadados)

  -- Provas de aceite
  ip text,
  user_agent text,
  email_enviado boolean not null default false,      -- true quando o e-mail pos-aceite foi disparado
  email_enviado_em timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_aceites_empresa     on aceites(empresa_id);
create index if not exists idx_aceites_obra        on aceites(obra_id);
create index if not exists idx_aceites_card        on aceites(card_id);
create index if not exists idx_aceites_tipo        on aceites(tipo);
create index if not exists idx_aceites_created_at  on aceites(created_at desc);

-- =============================================================
-- 3) RLS na tabela aceites
-- =============================================================
alter table aceites enable row level security;

-- Empresa autenticada ve seus proprios aceites
drop policy if exists "aceites_empresa_select" on aceites;
create policy "aceites_empresa_select"
  on aceites for select to authenticated
  using (
    empresa_id in (select id from empresas where owner_user_id = auth.uid())
  );

-- Empresa autenticada cria aceites pra si
drop policy if exists "aceites_empresa_insert" on aceites;
create policy "aceites_empresa_insert"
  on aceites for insert to authenticated
  with check (
    empresa_id in (select id from empresas where owner_user_id = auth.uid())
  );

-- Anon pode criar aceite (cliente final ou tecnico via link magico).
-- Restricao: tem que vir com obra_id (pra amarrar contexto) e o
-- contato_identificador. Sem empresa_id (anon nao tem).
drop policy if exists "aceites_anon_insert" on aceites;
create policy "aceites_anon_insert"
  on aceites for insert to anon
  with check (
    obra_id is not null
    and contato_identificador is not null
    and contato_tipo in ('cliente_final', 'tecnico')
  );

-- Anon nao le aceites (privacidade)
-- (sem policy de SELECT pra anon = nada e visivel)

-- =============================================================
-- 4) Helper: marcar flag no onboarding_status
-- =============================================================
-- Usar via API: select marcar_onboarding(empresa_id, 'tour_visto');
create or replace function marcar_onboarding(p_empresa_id uuid, p_flag text)
returns void
language plpgsql
security definer
as $$
begin
  update empresas
  set onboarding_status = jsonb_set(
    coalesce(onboarding_status, '{}'::jsonb),
    array[p_flag],
    'true'::jsonb,
    true
  )
  where id = p_empresa_id
    and owner_user_id = auth.uid();
end;
$$;

grant execute on function marcar_onboarding(uuid, text) to authenticated;

-- =============================================================
-- Notas operacionais:
--
-- 1) onboarding_status default cobre empresas novas. Empresas antigas
--    ganham o default na linha do update.
--
-- 2) tabela aceites cresce sem podar (audit trail importante). Se um dia
--    virar muito grande, mover historico antigo pra um schema 'arquivo'.
--
-- 3) documento_snapshot guarda o texto aceito no momento — se o documento
--    mudar depois, o aceite mantem a versao original como prova.
--
-- 4) E-mail pos-aceite e disparado por endpoint backend (a implementar)
--    que marca email_enviado=true e email_enviado_em apos sucesso do envio.
--
-- 5) RLS isola empresas autenticadas. Anon (cliente final/tecnico via link
--    magico) so pode INSERIR aceite, nunca ler. Privacidade preservada.
-- =============================================================
