// Service do Admin Console — chama as 5 RPCs criadas em supabase/admin-console.sql
//
// Todas as RPCs têm guarda interna `is_super_admin()`. Se um user não-admin
// chamar daqui, vai receber erro "Acesso negado: apenas super-admins" do banco.
// O gate de UI (RotaAdmin) intercepta antes pra evitar a chamada.

import { supabase } from './supabase'

// ============================================================
// TIPOS
// ============================================================

export interface AdminMetricas {
  mrr_centavos: number
  clientes_trial: number
  clientes_ativos: number
  clientes_atrasados: number
  clientes_cancelados: number
  total_empresas: number
}

export interface AdminCliente {
  empresa_id: string
  nome: string
  owner_email: string | null
  created_at: string
  trial_termina_em: string | null
  assinatura_status: string
  asaas_status: string
  valor_centavos: number
  proximo_vencimento: string | null
  ultimo_pagamento_em: string | null
  fatura_atual_url: string | null
  total_obras: number
  obras_ativas: number
  total_cards: number
  ultimo_card_em: string | null
}

export interface AdminClienteDetalhe {
  empresa: Record<string, any>
  dono_email: string | null
  assinatura: Record<string, any> | null
  metricas: {
    obras_total: number
    obras_ativas: number
    cards_total: number
    ultimo_card_em: string | null
    historicos_total: number
    ultimo_historico_em: string | null
  }
}

export interface AdminAlertaTrial {
  empresa_id: string
  nome: string
  owner_email: string | null
  trial_termina_em: string
  dias_restantes: number
}

export interface AdminAlertaAtraso {
  empresa_id: string
  nome: string
  owner_email: string | null
  asaas_status: string
  proximo_vencimento: string
  fatura_atual_url: string | null
  dias_atrasado: number
}

export interface AdminAlertaInativo {
  empresa_id: string
  nome: string
  owner_email: string | null
  assinatura_status: string
  ultimo_card_em: string | null
}

export interface AdminAlertaSemObras {
  empresa_id: string
  nome: string
  owner_email: string | null
  created_at: string
  dias_desde_cadastro: number
}

export interface AdminAlertas {
  trial_vencendo: AdminAlertaTrial[]
  atrasados: AdminAlertaAtraso[]
  inativos_7d: AdminAlertaInativo[]
  sem_obras: AdminAlertaSemObras[]
}

// ============================================================
// FUNÇÕES (chamam as RPCs)
// ============================================================

export async function checarSuperAdmin(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('is_super_admin')
  if (error) {
    console.error('Erro ao checar super-admin:', error)
    return false
  }
  return Boolean(data)
}

export async function pegarMetricasDashboard(): Promise<AdminMetricas> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('admin_dashboard_metricas')
  if (error) throw error
  return data as AdminMetricas
}

export async function listarClientes(): Promise<AdminCliente[]> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('admin_listar_clientes')
  if (error) throw error
  return (data ?? []) as AdminCliente[]
}

export async function pegarDetalheCliente(empresaId: string): Promise<AdminClienteDetalhe> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('admin_cliente_detalhe', {
    p_empresa_id: empresaId,
  })
  if (error) throw error
  return data as AdminClienteDetalhe
}

export async function pegarAlertas(): Promise<AdminAlertas> {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.rpc('admin_alertas')
  if (error) throw error
  return data as AdminAlertas
}

// ============================================================
// FORMATADORES (helpers de UI)
// ============================================================

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatarDataRelativa(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const agora = new Date()
  const diffMs = agora.getTime() - d.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDias === 0) return 'hoje'
  if (diffDias === 1) return 'ontem'
  if (diffDias < 7) return `há ${diffDias} dias`
  if (diffDias < 30) return `há ${Math.floor(diffDias / 7)} sem`
  if (diffDias < 365) return `há ${Math.floor(diffDias / 30)} meses`
  return `há ${Math.floor(diffDias / 365)} ano${Math.floor(diffDias / 365) > 1 ? 's' : ''}`
}

export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function corStatusAssinatura(status: string): string {
  switch (status) {
    case 'ativa':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'trial':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'atrasada':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'cancelada':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}
