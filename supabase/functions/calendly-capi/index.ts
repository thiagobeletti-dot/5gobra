// Edge Function: calendly-capi
//
// Webhook do Calendly (invitee.created). Dispara o evento Lead server-side pro
// Meta Conversions API (CAPI) com:
//   - dedup: event_id `calendly_<invitee_uuid>` (o MESMO que o Pixel client-side
//     usa em main.tsx → o Meta une os 2 eventos num só)
//   - EMQ alto: em + ph (hasheados SHA-256, lowercase/trim antes) + fbp/fbc (raw)
//     + client_ip_address + client_user_agent (buscados na tabela de cookies)
//   - idempotência: capi_events_sent guarda os event_id já enviados
//   - degradação graceful: sem cookies, manda só em/ph (EMQ ~7.5 em vez de 8.5+)
//
// IMPORTANTE — deploy SEM verificação de JWT (chamada externa do Calendly):
//   supabase functions deploy calendly-capi --no-verify-jwt
//   (ou, no Dashboard, desligar "Verify JWT with legacy secret")
//
// SECRETS: META_CAPI_TOKEN, CALENDLY_WEBHOOK_SECRET,
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// TESTE: pra validar no Meta Test Events, descomente `test_event_code` abaixo
// com o código do Business Suite. REMOVER antes de prod.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const PIXEL_ID = '3639344652872395'
const GRAPH_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`

// const TEST_EVENT_CODE = 'TESTXXXXX' // <- descomente só em teste; remova em prod

serve(async (req) => {
  if (req.method !== 'POST') return resp({ error: 'Method not allowed' }, 405)

  const raw = await req.text()

  // 1) Valida a assinatura do Calendly (anti-spoof).
  if (!(await assinaturaValida(req, raw))) {
    return resp({ error: 'Assinatura inválida' }, 401)
  }

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return resp({ error: 'JSON inválido' }, 400)
  }

  // Só tratamos agendamento criado. Outros eventos: 200 e ignora.
  if (body?.event !== 'invitee.created') {
    return resp({ ok: true, ignored: body?.event ?? null })
  }

  const invitee = body.payload ?? {}
  const inviteeUuid: string | undefined = String(invitee.uri ?? '')
    .split('/')
    .filter(Boolean)
    .pop()
  if (!inviteeUuid) return resp({ error: 'invitee.uri ausente no payload' }, 400)
  const eventId = `calendly_${inviteeUuid}`

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 2) Idempotência — se já enviamos esse event_id, não reenvia.
  const { data: jaEnviado } = await supabase
    .from('capi_events_sent')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (jaEnviado) return resp({ ok: true, dedup: true })

  // 3) Busca cookies do Pixel gravados client-side (graceful se não achar).
  const { data: cookies } = await supabase
    .from('calendly_pixel_cookies')
    .select('fbp, fbc, client_ip_address, client_user_agent')
    .eq('invitee_uuid', inviteeUuid)
    .maybeSingle()

  // 4) Monta user_data. em/ph hasheados; fbp/fbc/ip/ua RAW.
  const email: string | undefined = invitee.email
  const phone = extrairTelefone(invitee)

  const userData: Record<string, unknown> = {}
  if (email) userData.em = [await hashSha256(normalizeEmail(email))]
  if (phone) userData.ph = [await hashSha256(normalizePhone(phone))]
  if (cookies?.fbp) userData.fbp = cookies.fbp
  if (cookies?.fbc) userData.fbc = cookies.fbc
  if (cookies?.client_ip_address) userData.client_ip_address = cookies.client_ip_address
  if (cookies?.client_user_agent) userData.client_user_agent = cookies.client_user_agent

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: 'https://www.5gobra.com.br/',
        action_source: 'website',
        user_data: userData,
        custom_data: { value: 349.0, currency: 'BRL' },
      },
    ],
  }
  // if (typeof TEST_EVENT_CODE !== 'undefined') payload.test_event_code = TEST_EVENT_CODE

  // 5) Envia pro Meta CAPI.
  const token = Deno.env.get('META_CAPI_TOKEN')!
  const r = await fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const metaResp = await r.json().catch(() => ({}))

  if (!r.ok) {
    console.error('[calendly-capi] erro Meta CAPI:', JSON.stringify(metaResp))
    return resp({ error: 'Meta CAPI falhou', meta: metaResp }, 502)
  }

  // 6) Marca como enviado (idempotência) e registra que o CAPI saiu.
  await supabase.from('capi_events_sent').upsert({ event_id: eventId }, { onConflict: 'event_id' })
  await supabase
    .from('calendly_pixel_cookies')
    .update({ capi_sent_at: new Date().toISOString() })
    .eq('invitee_uuid', inviteeUuid)

  console.info('[calendly-capi] Lead enviado', {
    event_id: eventId,
    tem_cookies: !!cookies,
    tem_telefone: !!phone,
    events_received: metaResp?.events_received,
    fbtrace_id: metaResp?.fbtrace_id,
  })
  return resp({ ok: true, event_id: eventId, meta: metaResp })
})

// ===================== helpers =====================

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `+${withCountry}`
}

async function hashSha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Calendly não tem campo `phone` fixo: pode vir em text_reminder_number
// (lembrete SMS) ou numa resposta do formulário (questions_and_answers).
function extrairTelefone(invitee: any): string | undefined {
  if (invitee?.text_reminder_number) return String(invitee.text_reminder_number)
  const qa = invitee?.questions_and_answers
  if (Array.isArray(qa)) {
    for (const item of qa) {
      const ans = String(item?.answer ?? '')
      if (ans.replace(/\D/g, '').length >= 10) return ans
    }
  }
  return undefined
}

// Verifica a assinatura do webhook do Calendly.
// Header: "Calendly-Webhook-Signature: t=<unix>,v1=<hmac_sha256_hex>"
// HMAC de `${t}.${rawBody}` com o CALENDLY_WEBHOOK_SECRET.
async function assinaturaValida(req: Request, raw: string): Promise<boolean> {
  const secret = Deno.env.get('CALENDLY_WEBHOOK_SECRET')
  if (!secret) return false
  const header = req.headers.get('Calendly-Webhook-Signature') ?? ''
  const parts: Record<string, string> = {}
  for (const kv of header.split(',')) {
    const [k, v] = kv.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  }
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`))
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return expected === v1
}

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
