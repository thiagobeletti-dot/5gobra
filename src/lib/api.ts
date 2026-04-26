import { supabase } from './supabase'
import type { Card, DadosObra, ObraInfo, RegistroHistorico, AbaId, TipoCard } from '../types/obra'

// =============== Tipos do banco ===============
export interface ObraRow {
  id: string
  empresa_id: string
  nome: string
  endereco: string | null
  cliente_nome: string | null
  cliente_telefone: string | null
  cliente_email: string | null
  inicio: string | null
  token_cliente: string
  encerrada: boolean
  created_at: string
}

export interface CardRow {
  id: string
  obra_id: string
  tipo: TipoCard
  sigla: string
  nome: string
  descricao: string | null
  aba: AbaId
  status_em_andamento: string | null
  prazo_contrato: string | null
  encerrado: boolean
  aceite_final_at: string | null
  aceite_final_ip: string | null
  aceite_final_user_agent: string | null
  created_at: string
}

export interface HistoricoRow {
  id: string
  card_id: string
  autor: string
  autor_tipo: 'empresa' | 'cliente' | 'sistema'
  texto: string
  ip: string | null
  user_agent: string | null
  created_at: string
}

// =============== Empresa ===============

export async function pegarMinhaEmpresa() {
  if (!supabase) return null
  const { data, error } = await supabase.from('empresas').select('*').limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function criarEmpresa(nome: string) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Nao autenticado')
  const { data, error } = await supabase
    .from('empresas')
    .insert({ nome, owner_user_id: user.user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

// =============== Obras ===============

export async function listarObras() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ObraRow[]
}

export async function pegarObraPorId(id: string) {
  if (!supabase) return null
  const { data, error } = await supabase.from('obras').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ObraRow | null
}

export async function pegarObraPorToken(token: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .eq('token_cliente', token)
    .maybeSingle()
  if (error) throw error
  return data as ObraRow | null
}

export async function criarObra(dados: {
  empresa_id: string
  nome: string
  endereco?: string
  cliente_nome?: string
  cliente_telefone?: string
  cliente_email?: string
}) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase
    .from('obras')
    .insert({ ...dados, inicio: new Date().toISOString().slice(0, 10) })
    .select()
    .single()
  if (error) throw error
  return data as ObraRow
}

// =============== Cards ===============

export async function listarCardsDaObra(obraId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('obra_id', obraId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CardRow[]
}

export async function criarCard(dados: {
  obra_id: string
  tipo: TipoCard
  sigla: string
  nome: string
  descricao?: string
  aba: AbaId
  status_em_andamento?: string | null
  prazo_contrato?: string | null
}) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.from('cards').insert(dados).select().single()
  if (error) throw error
  return data as CardRow
}

export async function atualizarCard(id: string, mudancas: Partial<CardRow>) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.from('cards').update(mudancas).eq('id', id).select().single()
  if (error) throw error
  return data as CardRow
}

// =============== Historico ===============

export async function listarHistorico(cardId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('historico_card')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as HistoricoRow[]
}

export async function adicionarHistorico(dados: {
  card_id: string
  autor: string
  autor_tipo: 'empresa' | 'cliente' | 'sistema'
  texto: string
}) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.from('historico_card').insert(dados).select().single()
  if (error) throw error
  return data as HistoricoRow
}

// =============== Helpers de conversao ===============

export function rowsParaDadosObra(obraRow: ObraRow, cardsRows: CardRow[], historicoPorCard: Record<string, HistoricoRow[]>): DadosObra {
  const obra: ObraInfo = {
    nome: obraRow.nome,
    endereco: obraRow.endereco ?? '',
    cliente: obraRow.cliente_nome ?? '',
    empresa: '',
    inicio: obraRow.inicio ?? '',
  }
  const cards: Card[] = cardsRows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    sigla: r.sigla,
    nome: r.nome,
    descricao: r.descricao ?? '',
    aba: r.aba,
    statusEmAndamento: r.status_em_andamento,
    prazoContrato: r.prazo_contrato,
    encerrado: r.encerrado,
    aceiteFinal: r.aceite_final_at,
    historico: (historicoPorCard[r.id] ?? []).map<RegistroHistorico>((h) => ({
      autor: h.autor,
      tipo: h.autor_tipo,
      data: new Date(h.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      texto: h.texto,
    })),
  }))
  return { obra, cards }
}
