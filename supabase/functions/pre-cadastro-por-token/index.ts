// Edge Function: pre-cadastro-por-token
// =============================================================
// Leitura pública (anon) de um pre_cadastro VIA TOKEN UUID exclusivo.
// Usada pela página /cadastro?token=X pra pré-preencher email + nome do
// cliente que acabou de pagar.
//
// Retorno é minimalista: NÃO expõe CPF/CNPJ completo, ID de cobrança, etc.
// Apenas dados que o próprio cliente já forneceu na compra.
//
// CHAMADA:
//   POST /functions/v1/pre-cadastro-por-token
//   Body: { token: "uuid-v4" }
//
// SECRETS NECESSÁRIOS:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY  (RLS de pre_cadastros bloqueia anon)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed')

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string') return jsonError(400, 'token é obrigatório')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await admin
      .from('pre_cadastros')
      .select('id, nome_completo, email, whatsapp, cpf_cnpj, status, empresa_id')
      .eq('token_cadastro', token)
      .maybeSingle()

    if (error) {
      console.error('[pre-cadastro-por-token] erro:', error)
      return jsonError(500, 'Erro de banco')
    }
    if (!data) return jsonError(404, 'Token inválido')

    // Mascarar CPF/CNPJ: mantém só últimos 2 dígitos pra confirmação visual
    const cpfCnpj = (data.cpf_cnpj as string | null) ?? ''
    const cpfCnpjMascarado = cpfCnpj
      ? '••••••••' + cpfCnpj.slice(-2)
      : null

    return new Response(
      JSON.stringify({
        ok: true,
        preCadastro: {
          id: data.id,
          nome_completo: data.nome_completo,
          email: data.email,
          whatsapp: data.whatsapp,
          cpf_cnpj_mascarado: cpfCnpjMascarado,
          status: data.status,
          empresa_id: data.empresa_id,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[pre-cadastro-por-token] erro geral:', e)
    return jsonError(500, (e as Error).message ?? 'Erro desconhecido')
  }
})

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
