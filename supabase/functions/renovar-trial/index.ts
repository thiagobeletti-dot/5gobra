// =============================================================
// renovar-trial — segundo teste de 14 dias pra quem nunca usou
// =============================================================
//   POST /functions/v1/renovar-trial
//   Headers: Authorization: Bearer <user JWT>
//   Body: (vazio)
//   Resposta: { ok: true, dias: 14, trial_termina_em } | { ok: false, error }
//
// Regra (decisão do Thiago em 03/09/2026): quem deixou o trial vencer SEM
// CRIAR NENHUMA OBRA ganha mais 14 dias, uma única vez. Quem usou e deixou
// vencer, não — a diferença é entre quem não quis e quem não conseguiu
// começar, e o segundo é problema de onboarding.
//
// POR QUE É EDGE FUNCTION E NÃO RPC
// O trigger tg_empresas_protege_assinatura proíbe o papel `authenticated` de
// mexer em trial_termina_em — e é bom que continue proibindo, senão o dono
// renova sozinho pelo console do navegador. Aqui a escrita sai pelo
// service_role, que o trigger deixa passar.
//
// POR QUE EXIGE JWT
// A renovação NÃO pode acontecer na tela de cadastro: se o botão "criar
// conta" reativasse o trial de um e-mail existente, qualquer um que soubesse
// o e-mail alheio mexeria na conta dos outros. A pessoa entra com a própria
// senha e a oferta aparece na tela de bloqueio.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DIAS = 14

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed')

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError(401, 'Faça login pra continuar.')

    // Quem está pedindo? Validado com o JWT dele, não com o que ele diz ser.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: errUser } = await userClient.auth.getUser()
    const userId = userData?.user?.id
    if (errUser || !userId) return jsonError(401, 'Sessão inválida. Entre de novo.')

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Mesma empresa que o minha_situacao() enxerga: a mais antiga do dono.
    const { data: empresa, error: errEmp } = await admin
      .from('empresas')
      .select('id, nome, assinatura_status, trial_termina_em, trial_renovado_em')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (errEmp) {
      console.error('[renovar-trial] erro lendo empresa:', errEmp)
      return jsonError(500, 'Não consegui verificar sua conta. Tenta de novo.')
    }
    if (!empresa) return jsonError(404, 'Não encontrei uma empresa nessa conta.')

    // ---------- As quatro regras, revalidadas aqui ----------
    // O front já pergunta pelo posso_renovar_trial() antes de mostrar o botão,
    // mas o front é sugestão. Quem decide é este bloco.
    const venceu =
      empresa.assinatura_status === 'trial' &&
      empresa.trial_termina_em !== null &&
      new Date(empresa.trial_termina_em as string).getTime() < Date.now()

    if (!venceu) {
      return jsonError(400, 'Essa conta não está com o teste vencido.')
    }
    if (empresa.trial_renovado_em) {
      return jsonError(400, 'Esse teste já foi reaberto uma vez. Fale com a gente no WhatsApp.')
    }

    const { count, error: errObras } = await admin
      .from('obras')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresa.id)

    if (errObras) {
      console.error('[renovar-trial] erro contando obras:', errObras)
      return jsonError(500, 'Não consegui verificar sua conta. Tenta de novo.')
    }
    if ((count ?? 0) > 0) {
      return jsonError(400, 'Seu teste já foi usado. Assine pra continuar de onde parou.')
    }

    // ---------- Libera ----------
    const novoFim = new Date(Date.now() + DIAS * 86400000).toISOString()
    const { error: errUp } = await admin
      .from('empresas')
      .update({ trial_termina_em: novoFim, trial_renovado_em: new Date().toISOString() })
      .eq('id', empresa.id)

    if (errUp) {
      console.error('[renovar-trial] erro atualizando empresa:', errUp)
      return jsonError(500, 'Não consegui reabrir seu teste. Tenta de novo.')
    }

    console.log('[renovar-trial] reaberto pra empresa', empresa.id, empresa.nome)

    return new Response(
      JSON.stringify({ ok: true, dias: DIAS, trial_termina_em: novoFim }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[renovar-trial] erro geral:', e)
    return jsonError(500, 'Não consegui reabrir seu teste. Tenta de novo.')
  }
})

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
