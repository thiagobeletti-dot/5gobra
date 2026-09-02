// Edge Function: iniciar-trial
// =============================================================
// Cadastro SEM pagamento — 14 dias de teste. É o destino do botão
// "Testar 14 dias grátis" da página de diagnóstico e da landing.
//
// Diferente de `ativar-pre-cadastro` (que exige status='pago' e cria a linha
// em `assinaturas`), aqui NÃO existe cobrança nem assinatura no Asaas ainda.
// A empresa nasce com assinatura_status='trial' e trial_termina_em = +14 dias
// (defaults da tabela, ver supabase/trial-system.sql) e NENHUMA linha em
// `assinaturas` — é isso que a mantém em trial.
//
// Também grava um `pre_cadastros` com status='trial' pra o painel gerencial
// (/app/admin) conseguir mostrar nome, e-mail e WhatsApp de quem está testando.
//
// CHAMADA:
//   POST /functions/v1/iniciar-trial
//   Body: { nome_completo, email, whatsapp, nome_empresa, senha, origem? }
//
// SECRETS: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Cravado 31/08/2026 — estratégia rep-free (67% dos compradores B2B preferem
// comprar sem vendedor; página de trial converte 2-3x mais que "agende demo").

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DIAS_TRIAL = 14
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Input {
  nome_completo: string
  email: string
  whatsapp?: string
  nome_empresa: string
  senha: string
  origem?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed')

  try {
    const input = (await req.json()) as Input

    // ========== Validação ==========
    const nome = String(input.nome_completo ?? '').trim()
    const email = String(input.email ?? '').trim().toLowerCase()
    const nomeEmpresa = String(input.nome_empresa ?? '').trim()
    const senha = String(input.senha ?? '')
    const whatsapp = String(input.whatsapp ?? '').replace(/\D/g, '')

    if (nome.length < 3) return jsonError(400, 'Informe seu nome completo.')
    if (!RE_EMAIL.test(email)) return jsonError(400, 'E-mail inválido.')
    if (nomeEmpresa.length < 2) return jsonError(400, 'Informe o nome da empresa.')
    if (senha.length < 6) return jsonError(400, 'A senha precisa ter ao menos 6 caracteres.')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ========== 1. Cria o usuário ==========
    // email_confirm: true — não queremos fricção de confirmar e-mail num trial.
    const { data: userCriado, error: errUser } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome_completo: nome, origem: input.origem ?? 'trial' },
    })

    if (errUser || !userCriado?.user) {
      const msg = String(errUser?.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('exist') || msg.includes('registered')) {
        return jsonError(
          409,
          'Já existe uma conta com esse e-mail. Faça login, ou use "Esqueci minha senha" na tela de entrada.',
        )
      }
      console.error('[iniciar-trial] erro criando user:', errUser)
      return jsonError(500, 'Não consegui criar sua conta: ' + (errUser?.message ?? 'erro desconhecido'))
    }

    const userId = userCriado.user.id

    // A partir daqui, se algo falhar, removemos o usuário pra não deixar
    // conta órfã (sem empresa a pessoa loga e vê o app quebrado).
    const desfazer = async () => {
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch (e) {
        console.error('[iniciar-trial] falha ao desfazer user órfão:', e)
      }
    }

    // ========== 2. Pre-cadastro (dados de contato pro painel gerencial) ==========
    const trialTerminaEm = new Date(Date.now() + DIAS_TRIAL * 86400000).toISOString()

    const { data: preCad, error: errPre } = await admin
      .from('pre_cadastros')
      .insert({
        nome_completo: nome,
        email,
        whatsapp: whatsapp || null,
        status: 'trial',
        token_cadastro: crypto.randomUUID(),
        origem: input.origem ?? 'trial',
        ip: req.headers.get('x-forwarded-for') ?? null,
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      })
      .select('id')
      .single()

    if (errPre || !preCad) {
      console.error('[iniciar-trial] erro criando pre_cadastro:', errPre)
      await desfazer()
      return jsonError(500, 'Erro ao registrar seu cadastro. Tente de novo.')
    }

    // ========== 3. Empresa em TRIAL ==========
    const { data: empresa, error: errEmp } = await admin
      .from('empresas')
      .insert({
        nome: nomeEmpresa,
        owner_user_id: userId,
        telefone: whatsapp || null,
        assinatura_status: 'trial',
        trial_termina_em: trialTerminaEm,
        pre_cadastro_id: preCad.id,
      })
      .select('id')
      .single()

    if (errEmp || !empresa) {
      console.error('[iniciar-trial] erro criando empresa:', errEmp)
      await admin.from('pre_cadastros').delete().eq('id', preCad.id)
      await desfazer()
      return jsonError(500, 'Erro ao criar sua empresa: ' + (errEmp?.message ?? 'desconhecido'))
    }

    // Liga o pre_cadastro à empresa (best-effort — não bloqueia o acesso)
    await admin.from('pre_cadastros').update({ empresa_id: empresa.id }).eq('id', preCad.id)

    return new Response(
      JSON.stringify({
        ok: true,
        empresa_id: empresa.id,
        email,
        trial_termina_em: trialTerminaEm,
        dias: DIAS_TRIAL,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[iniciar-trial] erro geral:', e)
    return jsonError(500, (e as Error).message ?? 'Erro desconhecido')
  }
})

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
