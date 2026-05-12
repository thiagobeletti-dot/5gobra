-- =============================================================
-- G Obra — Tabela de cupons de desconto
-- =============================================================
-- Cupons válidos para o checkout. Aplicados SEMPRE no primeiro mês
-- (Asaas suporta `discount` na primeira cobrança da assinatura).
--
-- Idempotente. Rodar no SQL Editor do Supabase.
-- =============================================================

create table if not exists cupons (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,        -- "OBRA10", "OBRA10EXT" — sempre uppercase
  percentual numeric(5, 2) not null,  -- 10.00 = 10%
  valido_ate timestamptz not null,    -- data/hora limite. Cupom só vale se now() < valido_ate
  ativo boolean not null default true,
  descricao text,                     -- nota interna, ex: "cupom de pop-up de saída"
  usos integer not null default 0,    -- contador (informativo, sem limite hard)
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists idx_cupons_codigo on cupons(upper(codigo));

-- Trigger atualizado_em
create or replace function set_atualizado_em_cupons()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cupons_atualizado_em on cupons;
create trigger trg_cupons_atualizado_em
  before update on cupons
  for each row execute function set_atualizado_em_cupons();

-- ============== RLS ==============
alter table cupons enable row level security;

-- Anon pode LER (precisamos validar cupom no checkout sem cliente logado)
-- Só retorna se ativo e não vencido (lógica no client/edge function)
drop policy if exists "cupons_anon_select" on cupons;
create policy "cupons_anon_select" on cupons
  for select to anon using (true);

-- Authenticated empresa pode tudo (admin via dashboard futuro)
drop policy if exists "cupons_auth_all" on cupons;
create policy "cupons_auth_all" on cupons
  for all to authenticated using (true);

-- ============== Função de validação ==============
-- Recebe código do cupom, retorna o percentual de desconto se válido.
-- Retorna null se cupom inexistente, inativo ou vencido.
-- Use no client/edge function pra calcular preço final.
create or replace function validar_cupom(p_codigo text)
returns numeric as $$
declare
  v_percentual numeric(5, 2);
begin
  select percentual into v_percentual
  from cupons
  where upper(codigo) = upper(p_codigo)
    and ativo = true
    and now() < valido_ate;

  return v_percentual;
end;
$$ language plpgsql security definer;

-- ============== Cupons iniciais do lançamento ==============
-- Idempotente: só insere se não existe
insert into cupons (codigo, percentual, valido_ate, descricao)
values
  ('OBRA10',    10.00, '2026-05-25 23:59:59-03', 'Cupom de lançamento — 10% no 1º mês, 7 dias após abertura'),
  ('OBRA10EXT', 10.00, '2026-05-28 23:59:59-03', 'Cupom estendido — para leads do pop-up de saída, +3 dias após OBRA10')
on conflict (codigo) do nothing;

notify pgrst, 'reload schema';
