// Edge Function: webhook-asaas
//
// Recebe eventos do Asaas (PAYMENT_*, SUBSCRIPTION_*) e atualiza a tabela
// `assinaturas` do G Obra. URL pública desta função vai no painel do Asaas
// (Integrações → Webhooks).
//
// Eventos tratados:
//   PAYMENT_CREATED      — nova fatura gerada (registra fatura_atual_url)
//   PAYMENT_CONFIRMED    — pagamento confirmado (status -> ativa)
//   PAYMENT_RECEIVED     — pagamento recebido/saldo (status -> ativa)
//   PAYMENT_OVERDUE      — fatura vencida sem pagar (status -> atrasada)
//   PAYMENT_REFUNDED     — pagamento devolvido (status -> cancelada)
//   PAYMENT_DELETED      — fatura removida (sem alteração de status — log apenas)
//   SUBSCRIPTION_INACTIVATED — assinatura desativada (status -> cancelada)
//
// SEGURANÇA:
//   Asaas envia header `asaas-access-token` com o token configurado no painel.
//   Validamos contra o secret ASAAS_WEBHOOK_TOKEN.
//
// SECRETS NECESSÁRIOS:
//   - ASAAS_WEBHOOK_TOKEN (mesma string que vai no painel Asaas)
//   - SUPABASE_SERVICE_ROLE_KEY (já existe — service role pra escrever em assinaturas)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PaymentObj {
  id: string
  status?: string
  value?: number
  customer?: string
  subscription?: string
  invoiceUrl?: string
  dueDate?: string
  paymentDate?: string
}

interface AsaasEvent {
  id: string
  event: string
  dateCreated: string
  payment?: PaymentObj
  subscription?: { id: string }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // Validação do token de webhook
    const tokenEsperado = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
    const tokenRecebido = req.headers.get('asaas-access-token')
    if (!tokenEsperado) {
      console.error('[webhook-asaas] ASAAS_WEBHOOK_TOKEN nao configurado')
      return jsonResp({ error: 'Webhook nao configurado no servidor' }, 500)
    }
    if (tokenRecebido !== tokenEsperado) {
      console.warn('[webhook-asaas] token invalido recebido:', tokenRecebido?.slice(0, 10) + '...')
      return jsonResp({ error: 'Unauthorized' }, 401)
    }

    const evento = (await req.json().catch(() => ({}))) as AsaasEvent
    if (!evento.event) {
      return jsonResp({ error: 'Payload invalido — campo "event" ausente' }, 400)
    }

    console.log('[webhook-asaas] evento:', evento.event, 'payment:', evento.payment?.id)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)

    // Localiza a assinatura afetada
    const subscriptionId = evento.payment?.subscription ?? evento.subscription?.id
    if (!subscriptionId) {
      // Eventos de payment avulso (não-assinatura) podemos ignorar com sucesso
      console.log('[webhook-asaas] evento sem subscription — ignorado')
      return jsonResp({ ok: true, ignorado: true })
    }

    const { data: assinatura, error: errAssin } = await adminClient
      .from('assinaturas')
      .select('*')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()

    if (errAssin) {
      console.error('[webhook-asaas] erro ao buscar assinatura:', errAssin)
      return jsonResp({ error: 'Erro de banco' }, 500)
    }

    if (!assinatura) {
      console.warn('[webhook-asaas] assinatura nao encontrada pra sub:', subscriptionId)
      // Retorna 200 pra Asaas não retentar (nada que possamos fazer)
      return jsonResp({ ok: true, ignorado: 'assinatura nao encontrada' })
    }

    // Decide o novo estado e payload de update baseado no evento
    const updates: Record<string, unknown> = {}

    switch (evento.event) {
      case 'PAYMENT_CREATED':
        // Nova fatura gerada — atualiza a invoiceUrl pra "Pagar agora"
        if (evento.payment?.invoiceUrl) {
          updates.fatura_atual_url = evento.payment.invoiceUrl
        }
        if (evento.payment?.dueDate) {
          updates.proximo_vencimento = evento.payment.dueDate
        }
        break

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        // Pagamento confirmado: ativa a assinatura
        updates.status = 'ativa'
        updates.ultimo_pagamento_em = new Date().toISOString()
        if (evento.payment?.dueDate) {
          updates.proximo_vencimento = evento.payment.dueDate
        }
        break

      case 'PAYMENT_OVERDUE':
        // Fatura venceu sem pagar
        if (assinatura.status !== 'cancelada') {
          updates.status = 'atrasada'
        }
        break

      case 'PAYMENT_REFUNDED':
      case 'SUBSCRIPTION_INACTIVATED':
        // Reembolso ou cancelamento de assinatura
        updates.status = 'cancelada'
        break

      case 'PAYMENT_DELETED':
        // Fatura removida — geralmente quando admin cancela manualmente.
        // Não muda status (pode ser limpeza), só logamos.
        console.log('[webhook-asaas] PAYMENT_DELETED — sem mudanca de status')
        break

      default:
        console.log('[webhook-asaas] evento nao tratado:', evento.event)
        break
    }

    if (Object.keys(updates).length > 0) {
      const { error: errUp } = await adminClient
        .from('assinaturas')
        .update(updates)
        .eq('id', assinatura.id)
      if (errUp) {
        console.error('[webhook-asaas] erro no update:', errUp)
        return jsonResp({ error: 'Erro ao atualizar assinatura' }, 500)
      }
    }

    return jsonResp({ ok: true, evento: evento.event, atualizado: Object.keys(updates) })
  } catch (err) {
    console.error('[webhook-asaas] erro nao tratado:', err)
    return jsonResp({ error: String((err as { message?: string })?.message ?? err) }, 500)
  }
})

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
