// Edge Function: criar-assinatura-asaas
//
// Quando admin clica "Ativar plano" no app, esta função:
//   1. Valida que o solicitante é dono de uma empresa (RLS via JWT)
//   2. Se ainda não tem cliente Asaas, cria via POST /v3/customers
//   3. Cria assinatura via POST /v3/subscriptions (cycle MONTHLY, billingType UNDEFINED
//      pra deixar Asaas oferecer cartão+boleto+PIX na página hospedada)
//   4. Pega a invoiceUrl do primeiro payment gerado e retorna pro frontend
//   5. Salva tudo na tabela `assinaturas` com status 'pendente'
//
// O frontend redireciona o usuário pra essa invoiceUrl, onde ele paga.
// Webhook (`webhook-asaas`) cuida de atualizar o status pra 'ativa' quando confirmar.
//
// CHAMADA:
//   POST /functions/v1/criar-assinatura-asaas
//   Headers: Authorization: Bearer <user JWT>
//   Body: { empresaId: "uuid", cpfCnpj: "12345678901", nomeCompleto: "...", email: "..." }
//
// SECRETS NECESSÁRIOS:
//   - ASAAS_API_KEY        ($aact_hmlg_... em sandbox, $aact_prod_... em produção)
//   - ASAAS_API_URL        ("https://api-sandbox.asaas.com/v3" ou "https://api.asaas.com/v3")

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BodyRequest {
  empresaId: string
  cpfCnpj: string
  nomeCompleto: string
  email: string
  telefone?: string
}

interface AssinaturaRow {
  id: string
  empresa_id: string
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  status: string
  valor_centavos: number
  fatura_atual_url: string | null
}

const VALOR_PADRAO_CENTAVOS = 34900 // R$ 349,00

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405)

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<BodyRequest>
    if (!body.empresaId || !body.cpfCnpj || !body.nomeCompleto || !body.email) {
      return jsonResp({ error: 'empresaId, cpfCnpj, nomeCompleto e email sao obrigatorios' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') ?? 'https://api-sandbox.asaas.com/v3'

    if (!ASAAS_API_KEY) {
      return jsonResp({ error: 'ASAAS_API_KEY nao configurado nos secrets do Supabase' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResp({ error: 'Sem auth' }, 401)

    // Cliente como o usuário pra validar que ele é dono da empresa
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: empresa, error: errEmpresa } = await userClient
      .from('empresas')
      .select('id, nome')
      .eq('id', body.empresaId)
      .single()
    if (errEmpresa || !empresa) {
      return jsonResp({ error: 'Empresa nao encontrada ou sem permissao' }, 403)
    }

    // Cliente service role pra ler/escrever em `assinaturas` (RLS estrito)
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)

    // Pega assinatura existente (pode ser que esteja em 'pendente' antiga ou 'cancelada')
    const { data: assinaturaExistente } = await adminClient
      .from('assinaturas')
      .select('*')
      .eq('empresa_id', body.empresaId)
      .maybeSingle()

    // Se já tem assinatura ATIVA, não cria outra
    if (assinaturaExistente?.status === 'ativa') {
      return jsonResp({
        error: 'Esta empresa ja tem assinatura ativa',
        assinatura: assinaturaExistente,
      }, 409)
    }

    // Reusa cliente Asaas se já existe (evita duplicatas)
    let asaasCustomerId = assinaturaExistente?.asaas_customer_id ?? null

    if (!asaasCustomerId) {
      // Cria cliente no Asaas
      const customerBody = {
        name: body.nomeCompleto,
        cpfCnpj: limparDigitos(body.cpfCnpj),
        email: body.email,
        ...(body.telefone ? { mobilePhone: limparDigitos(body.telefone) } : {}),
        externalReference: body.empresaId, // facilita rastreio
      }
      const respCustomer = await chamarAsaas('POST', '/customers', customerBody, ASAAS_API_KEY, ASAAS_API_URL)
      if (!respCustomer.ok) {
        return jsonResp({
          error: 'Erro ao criar cliente no Asaas',
          asaasErro: respCustomer.body,
        }, 502)
      }
      asaasCustomerId = (respCustomer.body as { id: string }).id
    }

    // Cria assinatura no Asaas — billingType UNDEFINED deixa o Asaas oferecer
    // cartão + boleto + PIX na página de pagamento hospedada.
    const valorReais = (assinaturaExistente?.valor_centavos ?? VALOR_PADRAO_CENTAVOS) / 100
    const proximoVencimento = dataDaqui(3) // 3 dias pra primeiro pagamento (não muito apertado)
    const subscriptionBody = {
      customer: asaasCustomerId,
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      value: valorReais,
      nextDueDate: proximoVencimento,
      description: 'G Obra — assinatura mensal (' + (empresa as { nome: string }).nome + ')',
      externalReference: body.empresaId,
    }
    const respSubscription = await chamarAsaas('POST', '/subscriptions', subscriptionBody, ASAAS_API_KEY, ASAAS_API_URL)
    if (!respSubscription.ok) {
      return jsonResp({
        error: 'Erro ao criar assinatura no Asaas',
        asaasErro: respSubscription.body,
      }, 502)
    }
    const subscription = respSubscription.body as { id: string }

    // Pega o primeiro payment gerado pra ter a invoiceUrl
    const respPayments = await chamarAsaas(
      'GET',
      '/payments?subscription=' + subscription.id + '&limit=1',
      null,
      ASAAS_API_KEY,
      ASAAS_API_URL,
    )
    let invoiceUrl: string | null = null
    if (respPayments.ok) {
      const data = respPayments.body as { data?: Array<{ invoiceUrl?: string }> }
      invoiceUrl = data.data?.[0]?.invoiceUrl ?? null
    }

    // Persiste no banco
    const dadosAssinatura: Partial<AssinaturaRow> = {
      empresa_id: body.empresaId,
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: subscription.id,
      status: 'pendente',
      valor_centavos: assinaturaExistente?.valor_centavos ?? VALOR_PADRAO_CENTAVOS,
      fatura_atual_url: invoiceUrl,
    }
    if (assinaturaExistente) {
      await adminClient.from('assinaturas').update(dadosAssinatura).eq('id', assinaturaExistente.id)
    } else {
      await adminClient.from('assinaturas').insert(dadosAssinatura)
    }

    return jsonResp({
      ok: true,
      asaasCustomerId,
      asaasSubscriptionId: subscription.id,
      invoiceUrl,
      proximoVencimento,
    })
  } catch (err) {
    console.error('criar-assinatura-asaas erro:', err)
    return jsonResp({ error: String((err as { message?: string })?.message ?? err) }, 500)
  }
})

// =============== Helpers ===============

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function chamarAsaas(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  apiKey: string,
  baseUrl: string,
): Promise<{ ok: boolean; body: unknown }> {
  const r = await fetch(baseUrl + path, {
    method,
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'GObra/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const respBody = await r.json().catch(() => ({}))
  return { ok: r.ok, body: respBody }
}

function limparDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

function dataDaqui(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const pad = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
