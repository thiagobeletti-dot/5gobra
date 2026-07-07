// Edge Function: comprar-publico
// =============================================================
// Endpoint público chamado pela landing quando visitante clica "Comprar".
// NÃO requer auth (anon key chamando).
//
// Fluxo:
//   1. Recebe dados do visitante + cupom (opcional)
//   2. Valida cupom via RPC validar_cupom() → retorna percentual ou null
//   3. Calcula valor com desconto pro 1º mês
//   4. Cria customer no Asaas (POST /customers)
//   5. Cria assinatura no Asaas com value = valor descontado (POST /subscriptions)
//   6. Pega 1ª cobrança da assinatura pra extrair invoiceUrl
//   7. Salva pre_cadastro no Supabase com tudo
//   8. Retorna { invoiceUrl, preCadastroId }
//
// Webhook (criar-webhook-asaas, separado) cuida do que acontece quando paga:
//   - Cria empresa real
//   - Atualiza assinatura no Asaas pra value=R$349 (remove desconto após 1º mês)
//   - Dispara link de cadastro /cadastro?token=X
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsFor } from '../_shared/cors.ts'

const PRECO_MENSAL_CENTAVOS = 34900 // R$ 349,00
const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL') ?? Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3'
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Validadores simples de formato (defesa contra lixo/abuso no gateway Asaas).
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function apenasDigitos(v: string) { return (v ?? '').replace(/\D/g, '') }

interface CompraPublicaInput {
  nome_completo: string
  email: string
  whatsapp: string
  cpf_cnpj: string
  cupom?: string
  ref_parceiro?: string
  origem?: string
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req)
  const jsonError = (status: number, error: string) =>
    new Response(JSON.stringify({ ok: false, error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'Método não permitido')
  }

  try {
    const input: CompraPublicaInput = await req.json()

    // ========== Validação básica ==========
    if (!input.nome_completo || !input.email || !input.whatsapp || !input.cpf_cnpj) {
      return jsonError(400, 'Dados obrigatórios: nome_completo, email, whatsapp, cpf_cnpj')
    }

    // ========== Validação de formato (anti-abuso) ==========
    const nome = String(input.nome_completo).trim()
    const email = String(input.email).trim().toLowerCase()
    const whatsappDig = apenasDigitos(input.whatsapp)
    const cpfCnpjDig = apenasDigitos(input.cpf_cnpj)
    if (nome.length < 3 || nome.length > 120) {
      return jsonError(400, 'Nome inválido')
    }
    if (!RE_EMAIL.test(email) || email.length > 150) {
      return jsonError(400, 'E-mail inválido')
    }
    if (whatsappDig.length < 10 || whatsappDig.length > 13) {
      return jsonError(400, 'WhatsApp inválido')
    }
    if (cpfCnpjDig.length !== 11 && cpfCnpjDig.length !== 14) {
      return jsonError(400, 'CPF/CNPJ inválido')
    }
    if (input.cupom && String(input.cupom).length > 40) {
      return jsonError(400, 'Cupom inválido')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ========== Validar cupom (se informado) ==========
    let percentualDesconto = 0
    let cupomCodigo: string | null = null
    if (input.cupom) {
      const { data: pct } = await supabase.rpc('validar_cupom', { p_codigo: input.cupom.toUpperCase() })
      if (pct !== null && pct !== undefined) {
        percentualDesconto = Number(pct)
        cupomCodigo = input.cupom.toUpperCase()
      }
      // Se cupom inválido, não retorna erro — só ignora silenciosamente (visitante errou o código)
    }

    // ========== Calcular preços ==========
    const valor1oMesCentavos = Math.round(PRECO_MENSAL_CENTAVOS * (100 - percentualDesconto) / 100)
    const valor1oMesReais = (valor1oMesCentavos / 100).toFixed(2)
    const cpfCnpjLimpo = input.cpf_cnpj.replace(/\D/g, '')
    const whatsappLimpo = input.whatsapp.replace(/\D/g, '')

    // ========== Criar customer no Asaas ==========
    const customerResp = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name: input.nome_completo,
        cpfCnpj: cpfCnpjLimpo,
        email: input.email,
        mobilePhone: whatsappLimpo,
        notificationDisabled: false,
      }),
    })
    if (!customerResp.ok) {
      const err = await customerResp.text()
      console.error('[comprar-publico] Erro ao criar customer:', err)
      return jsonError(502, 'Erro ao criar cliente no Asaas: ' + err)
    }
    const customer = await customerResp.json()
    const asaasCustomerId = customer.id

    // ========== Criar assinatura no Asaas ==========
    // Value vai com desconto aplicado no 1º mês.
    // Após o 1º pagamento, o webhook atualiza pra R$ 349 (sem desconto) pras próximas cobranças.
    const hoje = new Date()
    const proximoVencimento = new Date(hoje)
    proximoVencimento.setDate(proximoVencimento.getDate() + 3) // 3 dias pra pagar
    const proximoVencimentoISO = proximoVencimento.toISOString().slice(0, 10)

    const subscriptionResp = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED', // cliente escolhe na hora (cartão/PIX/boleto)
        value: Number(valor1oMesReais),
        nextDueDate: proximoVencimentoISO,
        cycle: 'MONTHLY',
        description: 'G Obra — Assinatura mensal',
        externalReference: `pre_cad_${Date.now()}`,
      }),
    })
    if (!subscriptionResp.ok) {
      const err = await subscriptionResp.text()
      console.error('[comprar-publico] Erro ao criar subscription:', err)
      return jsonError(502, 'Erro ao criar assinatura no Asaas: ' + err)
    }
    const subscription = await subscriptionResp.json()
    const asaasSubscriptionId = subscription.id

    // ========== Pegar invoiceUrl da 1ª cobrança gerada ==========
    // Asaas gera a 1ª cobrança automaticamente ao criar subscription. Listar pagamentos:
    const paymentsResp = await fetch(
      `${ASAAS_BASE_URL}/payments?subscription=${asaasSubscriptionId}&limit=1`,
      {
        headers: { 'access_token': ASAAS_API_KEY },
      },
    )
    let invoiceUrl: string | null = null
    if (paymentsResp.ok) {
      const payments = await paymentsResp.json()
      if (payments.data?.[0]?.invoiceUrl) {
        invoiceUrl = payments.data[0].invoiceUrl
      }
    }

    // ========== Salvar pre_cadastro no Supabase ==========
    const tokenCadastro = crypto.randomUUID()
    const { error: insertErr } = await supabase
      .from('pre_cadastros')
      .insert({
        nome_completo: input.nome_completo,
        email: input.email,
        whatsapp: whatsappLimpo,
        cpf_cnpj: cpfCnpjLimpo,
        cupom_codigo: cupomCodigo,
        cupom_percentual: percentualDesconto > 0 ? percentualDesconto : null,
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscriptionId,
        invoice_url: invoiceUrl,
        valor_primeiro_mes_centavos: valor1oMesCentavos,
        valor_recorrente_centavos: PRECO_MENSAL_CENTAVOS,
        token_cadastro: tokenCadastro,
        origem: input.origem ?? 'landing',
        ref_parceiro: input.ref_parceiro ?? null,
        ip: req.headers.get('x-forwarded-for') ?? null,
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      })
    if (insertErr) {
      console.error('[comprar-publico] Erro ao salvar pre_cadastro:', insertErr)
      // Não retorna erro — pagamento no Asaas já foi criado, melhor seguir
    }

    // ========== Incrementar contador de uso do cupom ==========
    // Best-effort: se falhar, não bloqueia o fluxo principal (cobrança já criada).
    if (cupomCodigo) {
      try {
        const { data: cupomRow } = await supabase
          .from('cupons')
          .select('id, usos')
          .ilike('codigo', cupomCodigo)
          .maybeSingle()
        if (cupomRow) {
          await supabase
            .from('cupons')
            .update({ usos: (cupomRow.usos ?? 0) + 1 })
            .eq('id', cupomRow.id)
        }
      } catch (e) {
        console.warn('[comprar-publico] Falha ao incrementar uso do cupom:', e)
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        invoiceUrl,
        asaasCustomerId,
        asaasSubscriptionId,
        valor1oMesCentavos,
        cupomAplicado: cupomCodigo,
        percentualDesconto,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[comprar-publico] Erro geral:', e)
    return jsonError(500, (e as Error).message ?? 'Erro desconhecido')
  }
})
