-- =============================================================
-- G Obra — Bucket de Storage pra anexos (fotos)
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase.
-- =============================================================

-- Cria o bucket "obra-anexos" se ainda nao existe
insert into storage.buckets (id, name, public)
values ('obra-anexos', 'obra-anexos', false)
on conflict (id) do nothing;

-- Policies pra leitura/escrita no bucket
-- (mesmo padrao permissivo do schema; refinar depois)

drop policy if exists "obra-anexos read" on storage.objects;
create policy "obra-anexos read"
  on storage.objects for select
  using (bucket_id = 'obra-anexos');

drop policy if exists "obra-anexos insert" on storage.objects;
create policy "obra-anexos insert"
  on storage.objects for insert
  with check (bucket_id = 'obra-anexos');

drop policy if exists "obra-anexos update" on storage.objects;
create policy "obra-anexos update"
  on storage.objects for update
  using (bucket_id = 'obra-anexos');
