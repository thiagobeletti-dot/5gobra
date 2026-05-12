// Wrappers das Edge Functions do Asaas + helpers de leitura da tabela assinaturas.
//
// Frontend NUNCA fala direto com a API do Asaas — sempre via Edge Function
// (que detém a API key segura). Isso evita expor a key no bundle e centraliza
// validações.

import { supabase } from './supabase'

export type StatusAssinatura =
  | 'sem_plano'
  | 'pendente'
  | 'ativa'
  | 'atrasada'
  | 'cancelada'

export interface AssinaturaRow {
  id: string
  empresa_id: string
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  status: StatusAssinatura
  valor_centavos: number
  proximo_vencimento: string | null
  ultimo_pagamento_em: string | null
  fatura_atual_url: string | null
  criada_em: string
  atualizada_em: string
}

export interface ResultadoAtivar {
  ok: boolean
  invoiceUrl?: string
  asaasCustomerId?: string
  asaasSubscriptionId?: string
  proximoVencimento?: string
  error?: string
  asaasErro?: unknown
}

/**
 * Busca a assinatura da empresa logada. Retorna null se nunca foi criada.
 */
export async function pegarMinhaAssinatura(): Promise<AssinaturaRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[asaas] pegarMinhaAssinatura erro:', error)
    return null
  }
  return data as AssinaturaRow | null
}

/**
 * Cria a assinatura no Asaas (ou reusa se já existe pendente).
 * Retorna a invoiceUrl pra redirecionar o usuário pra página de pagamento Asaas.
 */
export async function ativarAssinatura(input: {
  empresaId: string
  cpfCnpj: string
  nomeCompleto: string
  email: string
  telefone?: string
}): Promise<ResultadoAtivar> {
  if (!supabase) return { ok: false, error: 'Supabase nao configurado' }
  try {
    const { data, error } = await supabase.functions.invoke('criar-assinatura-asaas', {
      body: input,
    })
    if (error) return { ok: false, error: error.message }
    return data as ResultadoAtivar
  } catch (e) {
    return { ok: false, error: (e as { message?: string })?.message ?? 'Erro desconhecido' }
  }
}

// =============== Compra pública (landing) ===============

export interface CompraPublicaInput {
  nome_completo: string
  email: string
  whatsapp: string
  cpf_cnpj: string
  cupom?: string
  ref_parceiro?: string
  origem?: string
}

export interface ResultadoCompraPublica {
  ok: boolean
  invoiceUrl?: string
  asaasCustomerId?: string
  asaasSubscriptionId?: string
  valor1oMesCentavos?: number
  cupomAplicado?: string | null
  percentualDesconto?: number
  error?: string
}

/**
 * Chamada do botão "Comprar" na landing pública. Cria customer + assinatura
 * no Asaas (com cupom aplicado se válido) e retorna a invoiceUrl pra redirecionar
 * o visitante pra página de pagamento Asaas.
 *
 * Não exige usuário autenticado — qualquer visitante pode chamar.
 */
export async function comprarPublico(input: CompraPublicaInput): Promise<ResultadoCompraPublica> {
  if (!supabase) return { ok: false, error: 'Supabase nao configurado' }
  try {
    const { data, error } = await supabase.functions.invoke('comprar-publico', {
      body: input,
    })
    if (error) return { ok: false, error: error.message }
    return data as ResultadoCompraPublica
  } catch (e) {
    return { ok: false, error: (e as { message?: string })?.message ?? 'Erro desconhecido' }
  }
}

/**
 * Helper de label visível pra cada status.
 */
export function rotuloStatus(status: StatusAssinatura): string {
  const mapa: Record<StatusAssinatura, string> = {
    sem_plano: 'Sem plano ativo',
    pendente: 'Aguardando primeiro pagamento',
    ativa: 'Plano ativo',
    atrasada: 'Pagamento em atraso',
    cancelada: 'Assinatura cancelada',
  }
  return mapa[status] ?? status
}

/**
 * Cor semântica pra cada status (usada em badges).
 */
export function corStatus(status: StatusAssinatura): 'verde' | 'amarelo' | 'vermelho' | 'cinza' {
  if (status === 'ativa') return 'verde'
  if (status === 'pendente') return 'amarelo'
  if (status === 'atrasada' || status === 'cancelada') return 'vermelho'
  return 'cinza'
}
