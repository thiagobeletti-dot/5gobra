// Edge Function: ativar-pre-cadastro
// =============================================================
// Chamada pela página /cadastro?token=X quando o cliente que JÁ PAGOU
// clica no link do email. Cria:
//   1. user no auth.users (com senha definida pelo cliente)
//   2. linha em `empresas` vinculada ao user
//   3. linha em `assinaturas` já como 'ativa' (assinatura no Asaas já existe e foi paga)
//   4. atualiza pre_cadastro pra status='convertido' com empresa_id
//
// Após sucesso, frontend faz signIn com email+senha e grava aceites de termos
// (fluxo existente em /cadastro etapa 2).
//
// SEGURANÇA:
//   - Função pública (anon), mas só faz coisas se o token bater com um
//     pre_cadastro em status='pago'. Token é uuid v4 — impraticável de
//     adivinhar.
//   - Idempotente: se pre_cadastro já está convertido, retorna o estado
//     atual sem criar nada.
//
// CHAMADA:
//   POST /functions/v1/ativar-pre-cadastro
//   Body: { token, senha, cnpj?, telefone? }
//
// SECRETS NECESSÁRIOS:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (pra createUser e bypass de RLS)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Input {
  token: string
  senha: string
  cnpj?: string
  telefone?: string
  nome_empresa?: string  // opcional — se omitido, usa o nome_completo do pre_cadastro
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed')

  try {
    const input = await req.json() as Input
    if (!input.token) return jsonError(400, 'token é obrigatório')
    if (!input.senha || input.senha.length < 6) return jsonError(400, 'senha precisa ter ao menos 6 caracteres')

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // ========== 1. Localiza pre_cadastro pelo token ==========
    const { data: preCad, error: errCad } = await admin
      .from('pre_cadastros')
      .select('*')
      .eq('token_cadastro', input.token)
      .maybeSingle()

    if (errCad) {
      console.error('[ativar-pre-cadastro] erro buscando pre_cadastro:', errCad)
      return jsonError(500, 'Erro de banco')
    }
    if (!preCad) {
      return jsonError(404, 'Token inválido ou expirado')
    }

    // ========== Idempotência: já convertido ==========
    if (preCad.status === 'convertido' && preCad.empresa_id) {
      return jsonOk({
        ja_convertido: true,
        empresa_id: preCad.empresa_id,
        email: preCad.email,
      })
    }

    // ========== 2. Valida estado ==========
    if (preCad.status !== 'pago') {
      return jsonError(
        409,
        preCad.status === 'aguardando_pagamento'
          ? 'O pagamento ainda não foi confirmado. Aguarde alguns minutos e tente novamente.'
          : `Status do cadastro não permite ativação (status atual: ${preCad.status}).`,
      )
    }

    const email = preCad.email as string
    const nomeCompleto = preCad.nome_completo as string
    const nomeEmpresa = (input.nome_empresa?.trim() || nomeCompleto)
    const asaasCustomerId = preCad.asaas_customer_id as string
    const asaasSubscriptionId = preCad.asaas_subscription_id as string
    const valorRecorrente = (preCad.valor_recorrente_centavos as number) ?? 34900

    // ========== 3. Cria user no auth ==========
    // confirmamos email automaticamente — pagamento já é prova de propriedade do email
    const { data: userCriado, error: errUser } = await admin.auth.admin.createUser({
      email,
      password: input.senha,
      email_confirm: true,
      user_metadata: {
        nome_completo: nomeCompleto,
        origem: 'pre_cadastro',
        pre_cadastro_id: preCad.id,
      },
    })

    if (errUser || !userCriado?.user) {
      // Pode ser que o user já exista (cliente clicou no link 2x, etc).
      // Tenta achar user existente pelo email.
      const msg = String(errUser?.message ?? '')
      const jaExiste = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exist')
      if (!jaExiste) {
        console.error('[ativar-pre-cadastro] erro criando user:', errUser)
        return jsonError(500, 'Erro ao criar conta: ' + msg)
      }
      // Caso "já existe" — busca user existente
      const { data: list } = await admin.auth.admin.listUsers()
      const userExistente = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (!userExistente) {
        return jsonError(500, 'Email já cadastrado mas user não encontrado. Use "Esqueci a senha" na tela de login.')
      }
      // Atualiza senha pro novo valor (cliente está literalmente no fluxo de criar conta)
      await admin.auth.admin.updateUserById(userExistente.id, { password: input.senha })
      return await criarEmpresaEAssinatura(admin, {
        userId: userExistente.id,
        preCadId: preCad.id as string,
        nomeEmpresa,
        cnpj: input.cnpj,
        telefone: input.telefone ?? (preCad.whatsapp as string | null) ?? undefined,
        asaasCustomerId,
        asaasSubscriptionId,
        valorCentavos: valorRecorrente,
        email,
      })
    }

    return await criarEmpresaEAssinatura(admin, {
      userId: userCriado.user.id,
      preCadId: preCad.id as string,
      nomeEmpresa,
      cnpj: input.cnpj,
      telefone: input.telefone ?? (preCad.whatsapp as string | null) ?? undefined,
      asaasCustomerId,
      asaasSubscriptionId,
      valorCentavos: valorRecorrente,
      email,
    })
  } catch (e) {
    console.error('[ativar-pre-cadastro] erro geral:', e)
    return jsonError(500, (e as Error).message ?? 'Erro desconhecido')
  }
})

async function criarEmpresaEAssinatura(
  admin: ReturnType<typeof createClient>,
  args: {
    userId: string
    preCadId: string
    nomeEmpresa: string
    cnpj?: string
    telefone?: string
    asaasCustomerId: string
    asaasSubscriptionId: string
    valorCentavos: number
    email: string
  },
): Promise<Response> {
  // ========== Cria empresa ==========
  // Se essa empresa-user já tem empresa (caso de reativação), reusa
  const { data: empresaExistente } = await admin
    .from('empresas')
    .select('id, nome')
    .eq('owner_user_id', args.userId)
    .maybeSingle()

  let empresaId: string
  if (empresaExistente) {
    empresaId = empresaExistente.id as string
  } else {
    const empresaPayload: Record<string, unknown> = {
      nome: args.nomeEmpresa,
      owner_user_id: args.userId,
    }
    if (args.cnpj) empresaPayload.cnpj = args.cnpj
    if (args.telefone) empresaPayload.telefone = args.telefone

    const { data: novaEmp, error: errEmp } = await admin
      .from('empresas')
      .insert(empresaPayload)
      .select('id')
      .single()
    if (errEmp || !novaEmp) {
      console.error('[ativar-pre-cadastro] erro criando empresa:', errEmp)
      return jsonError(500, 'Erro ao criar empresa: ' + (errEmp?.message ?? 'desconhecido'))
    }
    empresaId = novaEmp.id as string
  }

  // ========== Cria/atualiza linha em assinaturas ==========
  const { data: assinaturaExistente } = await admin
    .from('assinaturas')
    .select('id')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  const assinaturaPayload = {
    empresa_id: empresaId,
    asaas_customer_id: args.asaasCustomerId,
    asaas_subscription_id: args.asaasSubscriptionId,
    status: 'ativa',
    valor_centavos: args.valorCentavos,
    ultimo_pagamento_em: new Date().toISOString(),
  }

  if (assinaturaExistente) {
    await admin
      .from('assinaturas')
      .update(assinaturaPayload)
      .eq('id', assinaturaExistente.id as string)
  } else {
    const { error: errAss } = await admin.from('assinaturas').insert(assinaturaPayload)
    if (errAss) {
      console.error('[ativar-pre-cadastro] erro criando assinatura:', errAss)
      // Não é fatal — empresa já existe, cliente entra e admin resolve depois
    }
  }

  // ========== Marca pre_cadastro como convertido ==========
  await admin
    .from('pre_cadastros')
    .update({
      status: 'convertido',
      empresa_id: empresaId,
      convertido_em: new Date().toISOString(),
    })
    .eq('id', args.preCadId)

  return jsonOk({
    ok: true,
    empresa_id: empresaId,
    email: args.email,
  })
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify({ ok: true, ...body as object }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
