// Edge Function: salvar-pixel-cookies
//
// Recebe (client-side, no momento do agendamento no Calendly) os cookies do
// Meta Pixel (_fbp / _fbc) e grava associados ao invitee do Calendly, pra a
// função `calendly-capi` usar depois no evento server-side (CAPI). Eleva o
// Event Match Quality (EMQ).
//
// IMPORTANTE — deploy SEM verificação de JWT (é chamada pública do browser):
//   supabase functions deploy salvar-pixel-cookies --no-verify-jwt
//   (ou, no Dashboard, desligar "Verify JWT with legacy secret")
//
// SECRETS usados (já existem no projeto): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { invitee_uuid, fbp, fbc } = await req.json().catch(() => ({}))
    if (!invitee_uuid || typeof invitee_uuid !== 'string') {
      return json({ error: 'invitee_uuid obrigatório' }, 400)
    }

    // IP e User-Agent saem dos HEADERS da requisição — não confiar no client.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      null
    const ua = req.headers.get('user-agent') || null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error } = await supabase
      .from('calendly_pixel_cookies')
      .upsert(
        {
          invitee_uuid,
          fbp: fbp ?? null,
          fbc: fbc ?? null,
          client_ip_address: ip,
          client_user_agent: ua,
        },
        { onConflict: 'invitee_uuid' },
      )

    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
