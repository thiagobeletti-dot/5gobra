-- =============================================================
-- G Obra — HARDENING RLS ANON (2026-07-07)
-- =============================================================
-- Fecha o vazamento crítico: até aqui as policies anon eram
-- `using (true)` — qualquer pessoa com a anon key (pública no
-- bundle JS) podia listar/alterar obras/cards/histórico/anexos/
-- checklists de TODAS as empresas chamando o REST direto, sem
-- token nenhum. O filtro por token era só client-side.
--
-- SOLUÇÃO (sem reescrever a camada de dados):
-- O cliente do link mágico passa o token num header HTTP
-- `x-obra-token`. As policies anon passam a exigir que a linha
-- pertença a uma obra concedida por esse token. Como o header
-- viaja junto em TODA request daquele client (inclusive no
-- `.select()` que roda depois de um insert/update), as escritas
-- continuam funcionando — mas agora escopadas.
--
-- Idempotente. Rodar no SQL Editor do Supabase do projeto 5gobra.
-- Testar o fluxo /obra/<token> e /tec/<token> num Preview do
-- Vercel ANTES de servir em produção (ver runbook).
-- =============================================================

-- ============================================================
-- 1) HELPERS
-- ============================================================

-- Token cru vindo do header (ou null se ausente/vazio).
-- PostgREST expõe os headers da request em `request.headers` (chaves
-- em minúsculo). Não precisa ser SECURITY DEFINER — só lê a config.
create or replace function anon_obra_token()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.headers', true)::json ->> 'x-obra-token',
    ''
  )
$$;

-- Conjunto de obra_ids que o token corrente concede acesso:
--   - token de cliente casado com obras.token_cliente, OU
--   - token de técnico casado com tecnicos_obra.token (ativo).
-- SECURITY DEFINER pra ler obras/tecnicos_obra sem recursão de RLS.
create or replace function anon_obra_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from obras o
  where anon_obra_token() is not null
    and o.token_cliente::text = anon_obra_token()
  union
  select t.obra_id
  from tecnicos_obra t
  where anon_obra_token() is not null
    and t.token::text = anon_obra_token()
    and coalesce(t.ativo, true) = true
$$;

grant execute on function anon_obra_token() to anon, authenticated;
grant execute on function anon_obra_ids()   to anon, authenticated;

-- ============================================================
-- 2) OBRAS — anon lê só a(s) obra(s) do token
-- ============================================================
drop policy if exists "obras_cliente_select_by_token" on obras;
drop policy if exists "obras_anon_select_scoped" on obras;
create policy "obras_anon_select_scoped" on obras
  for select to anon
  using (id in (select anon_obra_ids()));

-- ============================================================
-- 3) CARDS — anon lê/escreve só cards das obras do token
-- ============================================================
drop policy if exists "cards_cliente_anon" on cards;
drop policy if exists "cards_cliente_anon_insert" on cards;
drop policy if exists "cards_cliente_anon_update" on cards;

drop policy if exists "cards_anon_select_scoped" on cards;
create policy "cards_anon_select_scoped" on cards
  for select to anon
  using (obra_id in (select anon_obra_ids()));

drop policy if exists "cards_anon_insert_scoped" on cards;
create policy "cards_anon_insert_scoped" on cards
  for insert to anon
  with check (obra_id in (select anon_obra_ids()));

drop policy if exists "cards_anon_update_scoped" on cards;
create policy "cards_anon_update_scoped" on cards
  for update to anon
  using (obra_id in (select anon_obra_ids()))
  with check (obra_id in (select anon_obra_ids()));

-- ============================================================
-- 4) HISTORICO_CARD — escopado via card -> obra
-- ============================================================
drop policy if exists "historico_select_all" on historico_card;
drop policy if exists "historico_insert_all" on historico_card;
drop policy if exists "historico_anon_select" on historico_card;
drop policy if exists "historico_anon_insert" on historico_card;

drop policy if exists "historico_anon_select_scoped" on historico_card;
create policy "historico_anon_select_scoped" on historico_card
  for select to anon
  using (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "historico_anon_insert_scoped" on historico_card;
create policy "historico_anon_insert_scoped" on historico_card
  for insert to anon
  with check (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

-- ============================================================
-- 5) ANEXOS — escopado via card -> obra
-- ============================================================
drop policy if exists "anexos_select_all" on anexos;
drop policy if exists "anexos_insert_all" on anexos;
drop policy if exists "anexos_anon_select" on anexos;
drop policy if exists "anexos_anon_insert" on anexos;

drop policy if exists "anexos_anon_select_scoped" on anexos;
create policy "anexos_anon_select_scoped" on anexos
  for select to anon
  using (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "anexos_anon_insert_scoped" on anexos;
create policy "anexos_anon_insert_scoped" on anexos
  for insert to anon
  with check (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

-- Técnico pode remover foto que ele mesmo subiu (UI chama removerAnexo).
drop policy if exists "anexos_anon_delete_scoped" on anexos;
create policy "anexos_anon_delete_scoped" on anexos
  for delete to anon
  using (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

-- ============================================================
-- 6) CHECKLISTS — escopado via card -> obra
-- ============================================================
drop policy if exists "checklists_anon_select" on checklists;
drop policy if exists "checklists_anon_insert" on checklists;
drop policy if exists "checklists_anon_update" on checklists;

drop policy if exists "checklists_anon_select_scoped" on checklists;
create policy "checklists_anon_select_scoped" on checklists
  for select to anon
  using (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "checklists_anon_insert_scoped" on checklists;
create policy "checklists_anon_insert_scoped" on checklists
  for insert to anon
  with check (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "checklists_anon_update_scoped" on checklists;
create policy "checklists_anon_update_scoped" on checklists
  for update to anon
  using (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  )
  with check (
    card_id in (select c.id from cards c where c.obra_id in (select anon_obra_ids()))
  );

-- ============================================================
-- 7) TECNICOS_OBRA — anon lê técnicos da(s) obra(s) do token
-- ============================================================
drop policy if exists "tecnicos_anon_select" on tecnicos_obra;
drop policy if exists "tecnicos_anon_select_scoped" on tecnicos_obra;
create policy "tecnicos_anon_select_scoped" on tecnicos_obra
  for select to anon
  using (obra_id in (select anon_obra_ids()));

-- ============================================================
-- 8) CRONOGRAMA (3 tabelas) — escopado via obra
-- ============================================================
drop policy if exists "cronogramas_cliente_anon_select" on cronogramas;
drop policy if exists "cronogramas_cliente_anon_update" on cronogramas;

drop policy if exists "cronogramas_anon_select_scoped" on cronogramas;
create policy "cronogramas_anon_select_scoped" on cronogramas
  for select to anon
  using (obra_id in (select anon_obra_ids()));

drop policy if exists "cronogramas_anon_update_scoped" on cronogramas;
create policy "cronogramas_anon_update_scoped" on cronogramas
  for update to anon
  using (obra_id in (select anon_obra_ids()))
  with check (obra_id in (select anon_obra_ids()));

drop policy if exists "cronograma_fases_cliente_anon_select" on cronograma_fases;
drop policy if exists "cronograma_fases_cliente_anon_update" on cronograma_fases;

drop policy if exists "cronograma_fases_anon_select_scoped" on cronograma_fases;
create policy "cronograma_fases_anon_select_scoped" on cronograma_fases
  for select to anon
  using (
    cronograma_id in (select cg.id from cronogramas cg where cg.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "cronograma_fases_anon_update_scoped" on cronograma_fases;
create policy "cronograma_fases_anon_update_scoped" on cronograma_fases
  for update to anon
  using (
    cronograma_id in (select cg.id from cronogramas cg where cg.obra_id in (select anon_obra_ids()))
  )
  with check (
    cronograma_id in (select cg.id from cronogramas cg where cg.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "cronograma_eventos_anon_select" on cronograma_eventos;
drop policy if exists "cronograma_eventos_anon_insert" on cronograma_eventos;

drop policy if exists "cronograma_eventos_anon_select_scoped" on cronograma_eventos;
create policy "cronograma_eventos_anon_select_scoped" on cronograma_eventos
  for select to anon
  using (
    cronograma_id in (select cg.id from cronogramas cg where cg.obra_id in (select anon_obra_ids()))
  );

drop policy if exists "cronograma_eventos_anon_insert_scoped" on cronograma_eventos;
create policy "cronograma_eventos_anon_insert_scoped" on cronograma_eventos
  for insert to anon
  with check (
    cronograma_id in (select cg.id from cronogramas cg where cg.obra_id in (select anon_obra_ids()))
  );

-- ============================================================
-- 9) STORAGE (bucket obra-anexos) — escrita anon escopada
-- ============================================================
-- OBS: o bucket ainda é PÚBLICO pra leitura (getPublicUrl). Tornar
-- privado + signed URLs é passo separado (exige refactor async no
-- front). Aqui fechamos a ESCRITA anon: sem token válido, anon não
-- insere/atualiza/apaga objeto de obra nenhuma.
drop policy if exists "obra-anexos insert" on storage.objects;
drop policy if exists "obra-anexos update" on storage.objects;

drop policy if exists "obra_anexos_auth_write" on storage.objects;
create policy "obra_anexos_auth_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'obra-anexos')
  with check (bucket_id = 'obra-anexos');

drop policy if exists "obra_anexos_anon_insert" on storage.objects;
create policy "obra_anexos_anon_insert" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'obra-anexos'
    and ((storage.foldername(name))[1])::uuid in (select anon_obra_ids())
  );

drop policy if exists "obra_anexos_anon_update" on storage.objects;
create policy "obra_anexos_anon_update" on storage.objects
  for update to anon
  using (
    bucket_id = 'obra-anexos'
    and ((storage.foldername(name))[1])::uuid in (select anon_obra_ids())
  )
  with check (
    bucket_id = 'obra-anexos'
    and ((storage.foldername(name))[1])::uuid in (select anon_obra_ids())
  );

drop policy if exists "obra_anexos_anon_delete" on storage.objects;
create policy "obra_anexos_anon_delete" on storage.objects
  for delete to anon
  using (
    bucket_id = 'obra-anexos'
    and ((storage.foldername(name))[1])::uuid in (select anon_obra_ids())
  );

notify pgrst, 'reload schema';

-- ============================================================
-- VALIDAÇÃO
-- ============================================================
-- 1. Sem header (ataque direto na API):
--      set role anon;
--      select count(*) from obras;     -- deve dar 0
--      reset role;
-- 2. Com header de um token de cliente válido, via REST:
--      curl "$URL/rest/v1/obras?select=*" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--        -H "x-obra-token: <TOKEN_CLIENTE>"
--    deve retornar SÓ aquela obra.
-- 3. No app: abrir /obra/<token> e /tec/<token> num Preview do Vercel
--    e exercitar: ver cards, confirmar item, técnico salvar M1/M2,
--    subir/remover foto. Tudo deve funcionar. Só depois, mergear na main.
-- ============================================================
