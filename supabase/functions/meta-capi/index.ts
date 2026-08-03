// Edge Function: meta-capi
//
// Espelho server-side generico do Meta Pixel (Conversions API).
//
// POR QUE ELA EXISTE (auditoria do funil, 03/08/2026):
//   O Event Match Quality do dataset GObra estava travado em 6,1/10 e a
//   desduplicacao marcada como "nao atende as melhores praticas". Motivo: os
//   eventos de servidor chegavam pela integracao automatica do painel, sem
//   `event_id` compartilhado com o browser e sem dado nenhum de match. O
//   resultado pratico era PageView contado em dobro e algoritmo otimizando
//   no escuro.
//
//   Esta funcao recebe o evento do browser (que ja disparou o pixel com o
//   MESMO `event_id`), hasheia os dados pessoais aqui no servidor e manda pro
//   Meta com IP e user-agent reais. O Meta une os dois lados num evento so.
//
// O QUE ELA NUNCA FAZ:
//   - Nao registra email/telefone em log (so o booleano de presenca).
//   - Nao confia no IP mandado pelo cliente — usa o da conexao.
//   - Nao aceita evento fora da whitelist.
//
// DEPLOY (verificacao de JWT LIGADA — quem chama e' o browser com a anon key):
//   supabase functions deploy meta-capi
//
// SECRETS: META_CAPI_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// TESTE: preencha META_TEST_EVENT_CODE (secret) com o codigo do Test Events
// do Business Suite. Com ele setado, os eventos aparecem em tempo real na aba
// de teste. REMOVA o secret quando terminar de validar.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsFor } from '../_shared/cors.ts'

const PIXEL_ID = '3639344652872395'
const GRAPH_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`

/**
 * Whitelist de eventos. Endpoint publico (anon key roda no browser), entao
 * so passa o que faz parte do funil. Sem isso, qualquer um com a chave
 * publica poderia poluir o dataset com eventos inventados e estragar a
 * otimizacao das campanhas.
 */
const EVENTOS_PERMITIDOS = new Set([
  'Contact',
  'Schedule',
  'Lead',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
  'CompleteRegistration',
])

type Pessoa = {
  email?: string
  telefone?: string
  nome?: string
  cpfCnpj?: string
}

serve(async (req) => {
  const cors = corsFor(req)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return resp({ error: 'Method not allowed' }, 405, cors)

  let body: any
  try {
    body = await req.json()
  } catch {
    return resp({ error: 'JSON invalido' }, 400, cors)
  }

  const evento = String(body?.evento ?? '')
  const eventId = String(body?.event_id ?? '')

  if (!EVENTOS_PERMITIDOS.has(evento)) {
    return resp({ error: 'Evento nao permitido', evento }, 400, cors)
  }
  if (!eventId) {
    return resp({ error: 'event_id obrigatorio' }, 400, cors)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Idempotencia — o mesmo event_id nunca sai duas vezes daqui.
  // (A dedup com o evento do BROWSER e' feita pelo proprio Meta, via event_id.)
  const { data: jaEnviado } = await supabase
    .from('capi_events_sent')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (jaEnviado) return resp({ ok: true, dedup: true }, 200, cors)

  // --- user_data -----------------------------------------------------------
  // em/ph/fn/ln/external_id: SHA-256 do valor normalizado.
  // fbp/fbc/ip/ua: valor cru, e' assim que o Meta espera.
  const pessoa: Pessoa = body?.pessoa ?? {}
  const userData: Record<string, unknown> = {}

  if (pessoa.email) userData.em = [await sha256(pessoa.email.trim().toLowerCase())]
  if (pessoa.telefone) userData.ph = [await sha256(normalizarTelefone(pessoa.telefone))]
  if (pessoa.nome) {
    const partes = pessoa.nome.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (partes[0]) userData.fn = [await sha256(partes[0])]
    if (partes.length > 1) userData.ln = [await sha256(partes[partes.length - 1])]
  }
  // CPF/CNPJ so' de digitos vira external_id — identificador estavel e forte
  // pra correspondencia, e o Meta nunca ve o documento em claro.
  if (pessoa.cpfCnpj) {
    const digitos = pessoa.cpfCnpj.replace(/\D/g, '')
    if (digitos.length >= 11) userData.external_id = [await sha256(digitos)]
  }

  if (typeof body?.fbp === 'string' && body.fbp) userData.fbp = body.fbp
  if (typeof body?.fbc === 'string' && body.fbc) userData.fbc = body.fbc

  // IP e UA: da CONEXAO, nunca do corpo da requisicao (que o cliente controla).
  const ip = ipDoRequest(req)
  if (ip) userData.client_ip_address = ip
  const ua = req.headers.get('user-agent')
  if (ua) userData.client_user_agent = ua

  // --- custom_data ---------------------------------------------------------
  const customEntrada = (body?.custom ?? {}) as Record<string, unknown>
  const customData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(customEntrada)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      customData[k] = v
    }
  }

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: evento,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: typeof body?.url === 'string' ? body.url : 'https://www.5gobra.com.br/',
        action_source: 'website',
        user_data: userData,
        custom_data: customData,
      },
    ],
  }

  const testCode = Deno.env.get('META_TEST_EVENT_CODE')
  if (testCode) payload.test_event_code = testCode

  // --- envio ---------------------------------------------------------------
  const token = Deno.env.get('META_CAPI_TOKEN')
  if (!token) {
    console.error('[meta-capi] META_CAPI_TOKEN ausente')
    return resp({ error: 'CAPI nao configurado' }, 500, cors)
  }

  const r = await fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const metaResp = await r.json().catch(() => ({}))

  if (!r.ok) {
    console.error('[meta-capi] erro Meta:', evento, JSON.stringify(metaResp))
    return resp({ error: 'Meta CAPI falhou', meta: metaResp }, 502, cors)
  }

  await supabase.from('capi_events_sent').upsert({ event_id: eventId }, { onConflict: 'event_id' })

  // Log sem dado pessoal: so' o que da' pra auditar sem vazar nada.
  console.info('[meta-capi] enviado', {
    evento,
    event_id: eventId,
    tem_email: !!pessoa.email,
    tem_telefone: !!pessoa.telefone,
    tem_fbp: !!userData.fbp,
    tem_fbc: !!userData.fbc,
    campos_match: Object.keys(userData).length,
    events_received: metaResp?.events_received,
    fbtrace_id: metaResp?.fbtrace_id,
  })

  return resp({ ok: true, event_id: eventId, campos_match: Object.keys(userData).length }, 200, cors)
})

// ===================== helpers =====================

function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  return digitos.startsWith('55') ? digitos : `55${digitos}`
}

async function sha256(valor: string): Promise<string> {
  const data = new TextEncoder().encode(valor)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Primeiro IP do x-forwarded-for (o do cliente); cai pro x-real-ip. */
function ipDoRequest(req: Request): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const primeiro = xff.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }
  return req.headers.get('x-real-ip') ?? undefined
}

function resp(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
