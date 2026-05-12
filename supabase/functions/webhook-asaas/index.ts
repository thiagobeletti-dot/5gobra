// Edge Function: webhook-asaas
//
// Recebe eventos do Asaas (PAYMENT_*, SUBSCRIPTION_*) e atualiza:
//   1. Tabela `pre_cadastros` (fluxo público — visitante comprou pela landing)
//   2. Tabela `assinaturas`  (fluxo logado — empresa existente ativou plano)
//
// URL pública desta função vai no painel do Asaas (Integrações → Webhooks).
//
// =============== FLUXO PÚBLICO (pre_cadastros) ===============
// Quando o evento de pagamento se refere a uma subscription criada por
// `comprar-publico` (visitante anônimo), executa:
//   a. Marca pre_cadastro como status='pago', pago_em=now()
//   b. Atualiza value da subscription no Asaas pra R$ 349 (remove desconto do 1º mês)
//   c. Dispara email com link /cadastro?token=X via Resend
//
// =============== FLUXO LOGADO (assinaturas) ==================
// Quando o evento se refere a empresa logada que clicou "Ativar plano",
// atualiza a linha em `assinaturas` (status / próximo vencimento / fatura).
//
// Eventos tratados:
//   PAYMENT_CREATED      — nova fatura gerada (registra fatura_atual_url)
//   PAYMENT_CONFIRMED    — pagamento confirmado (status -> ativa / pago)
//   PAYMENT_RECEIVED     — pagamento recebido/saldo (status -> ativa / pago)
//   PAYMENT_OVERDUE      — fatura vencida sem pagar (status -> atrasada)
//   PAYMENT_REFUNDED     — pagamento devolvido (status -> cancelada)
//   PAYMENT_DELETED      — fatura removida (sem alteração de status — log apenas)
//   SUBSCRIPTION_INACTIVATED — assinatura desativada (status -> cancelada / expirado)
//
// SEGURANÇA:
//   Asaas envia header `asaas-access-token` com o token configurado no painel.
//   Validamos contra o secret ASAAS_WEBHOOK_TOKEN.
//
// SECRETS NECESSÁRIOS:
//   - ASAAS_WEBHOOK_TOKEN      (mesma string que vai no painel Asaas)
//   - ASAAS_API_KEY            (pra atualizar value da subscription após 1º pgto)
//   - ASAAS_API_URL            (sandbox ou produção)
//   - SUPABASE_SERVICE_ROLE_KEY
//   - RESEND_API_KEY           (pra enviar email com link /cadastro)
//   - EMAIL_FROM               (default: 'G Obra <onboarding@resend.dev>')
//   - APP_URL                  (default: 'https://5gobra.com.br') — base do link /cadastro

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const PRECO_MENSAL_CENTAVOS = 34900 // R$ 349,00 (valor sem desconto)

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
    // ========== Validação do token de webhook ==========
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

    // ========== Localiza a subscription afetada ==========
    const subscriptionId = evento.payment?.subscription ?? evento.subscription?.id
    if (!subscriptionId) {
      console.log('[webhook-asaas] evento sem subscription — ignorado')
      return jsonResp({ ok: true, ignorado: true })
    }

    // ========== Roteamento: pre_cadastro ou assinatura logada? ==========
    // Tenta primeiro pre_cadastros — fluxo público é mais recente e tem prioridade.
    const { data: preCad } = await adminClient
      .from('pre_cadastros')
      .select('*')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()

    if (preCad) {
      return await tratarPreCadastro(adminClient, evento, preCad)
    }

    // Senão, fluxo logado tradicional
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
      console.warn('[webhook-asaas] subscription nao encontrada em pre_cadastros nem assinaturas:', subscriptionId)
      // Retorna 200 pra Asaas não retentar
      return jsonResp({ ok: true, ignorado: 'subscription nao mapeada' })
    }

    return await tratarAssinaturaLogada(adminClient, evento, assinatura)
  } catch (err) {
    console.error('[webhook-asaas] erro nao tratado:', err)
    return jsonResp({ error: String((err as { message?: string })?.message ?? err) }, 500)
  }
})

// =============================================================
// Fluxo público — visitante pagou pela landing
// =============================================================
async function tratarPreCadastro(
  adminClient: ReturnType<typeof createClient>,
  evento: AsaasEvent,
  preCad: Record<string, unknown>,
): Promise<Response> {
  const status = preCad.status as string
  const id = preCad.id as string

  console.log('[webhook-asaas/precad] evento:', evento.event, 'status atual:', status)

  switch (evento.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      // Idempotência: se já está convertido, nada a fazer
      if (status === 'convertido') {
        console.log('[webhook-asaas/precad] ja convertido — idempotente')
        return jsonResp({ ok: true, ignorado: 'ja convertido' })
      }
      // Se já marcamos como pago antes, só registra a confirmação e segue
      if (status === 'pago') {
        console.log('[webhook-asaas/precad] ja pago — idempotente')
        return jsonResp({ ok: true, ignorado: 'ja pago' })
      }

      // ===== 1. Marca como pago =====
      await adminClient
        .from('pre_cadastros')
        .update({
          status: 'pago',
          pago_em: new Date().toISOString(),
        })
        .eq('id', id)

      // ===== 2. Remove desconto da subscription no Asaas (próximas mensalidades vão pra R$349) =====
      const removeu = await atualizarValorSubscriptionAsaas(
        preCad.asaas_subscription_id as string,
        PRECO_MENSAL_CENTAVOS / 100,
      )
      if (removeu) {
        await adminClient
          .from('pre_cadastros')
          .update({ desconto_removido_em: new Date().toISOString() })
          .eq('id', id)
      }

      // ===== 3. Dispara email com link de cadastro =====
      const enviou = await enviarEmailCadastro({
        email: preCad.email as string,
        nome: preCad.nome_completo as string,
        token: preCad.token_cadastro as string,
      })
      if (enviou) {
        await adminClient
          .from('pre_cadastros')
          .update({ email_cadastro_enviado_em: new Date().toISOString() })
          .eq('id', id)
      }

      return jsonResp({
        ok: true,
        evento: evento.event,
        preCadastroId: id,
        descontoRemovido: removeu,
        emailEnviado: enviou,
      })
    }

    case 'PAYMENT_OVERDUE':
      // Visitante deixou vencer. Não bloqueia, só log — Asaas vai retentar.
      console.log('[webhook-asaas/precad] PAYMENT_OVERDUE — aguardando retentativa')
      return jsonResp({ ok: true, evento: evento.event })

    case 'PAYMENT_REFUNDED':
    case 'SUBSCRIPTION_INACTIVATED': {
      if (status !== 'convertido') {
        await adminClient
          .from('pre_cadastros')
          .update({ status: 'expirado' })
          .eq('id', id)
      }
      return jsonResp({ ok: true, evento: evento.event })
    }

    case 'PAYMENT_CREATED':
    case 'PAYMENT_DELETED':
      // Sem ação no fluxo público — invoice_url já foi capturado no comprar-publico
      return jsonResp({ ok: true, evento: evento.event, sem_acao: true })

    default:
      console.log('[webhook-asaas/precad] evento nao tratado:', evento.event)
      return jsonResp({ ok: true, evento: evento.event, sem_acao: true })
  }
}

// =============================================================
// Fluxo logado — empresa existente ativou plano
// =============================================================
async function tratarAssinaturaLogada(
  adminClient: ReturnType<typeof createClient>,
  evento: AsaasEvent,
  assinatura: Record<string, unknown>,
): Promise<Response> {
  const updates: Record<string, unknown> = {}

  switch (evento.event) {
    case 'PAYMENT_CREATED':
      if (evento.payment?.invoiceUrl) updates.fatura_atual_url = evento.payment.invoiceUrl
      if (evento.payment?.dueDate) updates.proximo_vencimento = evento.payment.dueDate
      break

    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      updates.status = 'ativa'
      updates.ultimo_pagamento_em = new Date().toISOString()
      if (evento.payment?.dueDate) updates.proximo_vencimento = evento.payment.dueDate
      break

    case 'PAYMENT_OVERDUE':
      if (assinatura.status !== 'cancelada') updates.status = 'atrasada'
      break

    case 'PAYMENT_REFUNDED':
    case 'SUBSCRIPTION_INACTIVATED':
      updates.status = 'cancelada'
      break

    case 'PAYMENT_DELETED':
      console.log('[webhook-asaas/logado] PAYMENT_DELETED — sem mudanca de status')
      break

    default:
      console.log('[webhook-asaas/logado] evento nao tratado:', evento.event)
      break
  }

  if (Object.keys(updates).length > 0) {
    const { error: errUp } = await adminClient
      .from('assinaturas')
      .update(updates)
      .eq('id', assinatura.id as string)
    if (errUp) {
      console.error('[webhook-asaas/logado] erro no update:', errUp)
      return jsonResp({ error: 'Erro ao atualizar assinatura' }, 500)
    }
  }

  return jsonResp({ ok: true, evento: evento.event, atualizado: Object.keys(updates) })
}

// =============================================================
// Helpers
// =============================================================

async function atualizarValorSubscriptionAsaas(
  subscriptionId: string,
  novoValor: number,
): Promise<boolean> {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
  const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') ?? Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3'
  if (!ASAAS_API_KEY) {
    console.warn('[webhook-asaas] ASAAS_API_KEY nao configurada — pulando atualizacao de valor')
    return false
  }
  try {
    // updatePendingPayments=false: cobranças já geradas (a próxima já criada
    // pelo Asaas após o 1º pgto) mantêm o valor atual; só as FUTURAS pegam R$349.
    // Como o Asaas só gera a próxima fatura ~1 mês antes do vencimento, dá tempo
    // do update propagar.
    const r = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: novoValor,
        updatePendingPayments: false,
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      console.warn('[webhook-asaas] falha ao atualizar valor da subscription:', t)
      return false
    }
    console.log('[webhook-asaas] valor da subscription atualizado pra R$', novoValor)
    return true
  } catch (e) {
    console.warn('[webhook-asaas] exception ao atualizar subscription:', e)
    return false
  }
}

async function enviarEmailCadastro(args: {
  email: string
  nome: string
  token: string
}): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const FROM = Deno.env.get('EMAIL_FROM') ?? 'G Obra <onboarding@resend.dev>'
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://5gobra.com.br'

  if (!RESEND_API_KEY) {
    console.warn('[webhook-asaas] RESEND_API_KEY nao configurada — pulando email')
    return false
  }

  const link = `${APP_URL}/cadastro?token=${encodeURIComponent(args.token)}`
  const primeiroNome = args.nome.trim().split(/\s+/)[0]

  const html = `
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Bem-vindo ao G Obra</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
  <div style="max-width:520px; margin:0 auto; background:white; border-radius:12px; padding:32px; border:1px solid #e2e8f0;">
    <h1 style="font-size:22px; margin:0 0 12px; color:#ea580c;">Pagamento confirmado, ${primeiroNome}!</h1>
    <p style="font-size:15px; line-height:1.55; margin:0 0 18px;">
      Seu acesso ao <strong>G Obra</strong> está pronto pra ser ativado. Falta só você criar a senha e aceitar os termos.
    </p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="display:inline-block; background:#ea580c; color:white; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; font-size:15px;">
        Criar minha conta agora →
      </a>
    </p>
    <p style="font-size:13px; color:#64748b; line-height:1.55; margin:0 0 8px;">
      Se o botão não funcionar, copia e cola este link:<br>
      <span style="word-break:break-all;">${link}</span>
    </p>
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
    <p style="font-size:12px; color:#94a3b8; line-height:1.55; margin:0;">
      Esse link é exclusivo, não compartilhe. Qualquer dúvida, responde esse email ou chama no WhatsApp da 5G.
    </p>
  </div>
</body>
</html>
`.trim()

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [args.email],
        subject: 'Pagamento confirmado — termine seu cadastro no G Obra',
        html,
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      console.warn('[webhook-asaas] Resend falhou:', t)
      return false
    }
    console.log('[webhook-asaas] email de cadastro enviado pra:', args.email)
    return true
  } catch (e) {
    console.warn('[webhook-asaas] exception no envio de email:', e)
    return false
  }
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
