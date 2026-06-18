-- =============================================================
-- T4 — CAPI server-side (evento Lead via webhook do Calendly)
-- Tabelas de apoio. Rode no SQL Editor do Supabase.
--   - calendly_pixel_cookies: _fbp/_fbc capturados client-side, por invitee
--   - capi_events_sent: dedup/idempotência contra reentrega de webhook
-- Ambas só acessíveis pela service role (Edge Functions). RLS ligado, sem
-- policy pra anon/authenticated.
-- =============================================================

-- Cookies do Meta Pixel capturados no momento do agendamento (client-side),
-- associados ao invitee do Calendly. A função calendly-capi busca aqui pelo
-- invitee_uuid pra montar o user_data com EMQ alto (fbp/fbc + ip + ua).
create table if not exists public.calendly_pixel_cookies (
  invitee_uuid       text primary key,
  fbp                text,
  fbc                text,
  client_ip_address  text,
  client_user_agent  text,
  capi_sent_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists calendly_pixel_cookies_created_at_idx
  on public.calendly_pixel_cookies (created_at);

alter table public.calendly_pixel_cookies enable row level security;
-- Sem policy: ninguém acessa via API pública. Service role (Edge Function)
-- ignora RLS e é o único que lê/escreve.

-- Dedup de eventos enviados pro CAPI. O event_id (calendly_<invitee_uuid>) é
-- único; se o Calendly reentregar o webhook, a função não reenvia.
create table if not exists public.capi_events_sent (
  event_id  text primary key,
  sent_at   timestamptz not null default now()
);

alter table public.capi_events_sent enable row level security;
-- Idem: só service role.

-- =============================================================
-- OPCIONAL — limpeza diária (cookies/eventos expiram em 7 dias).
-- Requer a extensão pg_cron habilitada (Database > Extensions > pg_cron).
-- Descomente pra agendar:
--
-- select cron.schedule(
--   'cleanup-calendly-capi',
--   '0 4 * * *',
--   $$
--     delete from public.calendly_pixel_cookies where created_at < now() - interval '7 days';
--     delete from public.capi_events_sent       where sent_at    < now() - interval '7 days';
--   $$
-- );
-- =============================================================
