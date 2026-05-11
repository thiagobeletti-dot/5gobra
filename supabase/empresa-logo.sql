-- =============================================================
-- G Obra — Adiciona logo personalizada da empresa
-- =============================================================
-- Permite a empresa fazer upload do proprio logo nas Configuracoes.
-- O logo aparece no header dos PDFs (Ficha de Medicao, Dossie) ao lado
-- (ou substituindo) o branding G Obra. Profissionaliza o documento.
--
-- 2 partes:
--   1. Coluna logo_url em empresas (URL publica do arquivo no Storage)
--   2. Bucket "logos-empresa" publico (read aberto, write so autenticado)
--
-- Idempotente. Rodar no SQL Editor do Supabase.
-- =============================================================

-- ============== Coluna logo_url ==============
alter table empresas
  add column if not exists logo_url text;

-- ============== Bucket de logos ==============
-- Publico (logo eh marca, nao tem PII): qualquer um pode ver via URL.
insert into storage.buckets (id, name, public)
values ('logos-empresa', 'logos-empresa', true)
on conflict (id) do nothing;

-- Policies pro bucket
-- Leitura: qualquer um (incluindo cliente acessando PDF)
drop policy if exists "logos-empresa read" on storage.objects;
create policy "logos-empresa read"
  on storage.objects for select
  using (bucket_id = 'logos-empresa');

-- Insert: so autenticado (empresa logada faz upload)
drop policy if exists "logos-empresa insert" on storage.objects;
create policy "logos-empresa insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos-empresa');

-- Update: so autenticado (substituir logo)
drop policy if exists "logos-empresa update" on storage.objects;
create policy "logos-empresa update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos-empresa');

-- Delete: so autenticado (remover logo)
drop policy if exists "logos-empresa delete" on storage.objects;
create policy "logos-empresa delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos-empresa');

-- Recarrega schema cache do PostgREST pra ver a nova coluna
notify pgrst, 'reload schema';
