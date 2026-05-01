import { supabase } from './supabase'
import type { Checklist, ChecklistTipo, ChecklistAutorTipo, DadosMedicao1, DadosMedicao2 } from '../types/checklist'

interface ChecklistRow {
  id: string
  card_id: string
  tipo: ChecklistTipo
  dados: any
  autor: string
  autor_tipo: ChecklistAutorTipo
  preenchido_em: string
  atualizado_em: string
  created_at: string
}

function rowParaChecklist(r: ChecklistRow): Checklist {
  return {
    id: r.id,
    cardId: r.card_id,
    tipo: r.tipo,
    dados: r.dados ?? {},
    autor: r.autor,
    autorTipo: r.autor_tipo,
    preenchidoEm: r.preenchido_em,
    atualizadoEm: r.atualizado_em,
  }
}

// Lista todos os checklists de varios cards de uma vez (batch)
export async function listarChecklistsDeVariosCards(cardIds: string[]): Promise<Record<string, Checklist[]>> {
  if (!supabase || cardIds.length === 0) return {}
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .in('card_id', cardIds)
    .order('preenchido_em', { ascending: true })
  if (error) throw error
  const out: Record<string, Checklist[]> = {}
  for (const r of (data ?? []) as ChecklistRow[]) {
    ;(out[r.card_id] ??= []).push(rowParaChecklist(r))
  }
  return out
}

export async function pegarChecklist(cardId: string, tipo: ChecklistTipo): Promise<Checklist | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('card_id', cardId)
    .eq('tipo', tipo)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowParaChecklist(data as ChecklistRow)
}

export async function salvarMedicao1(args: {
  cardId: string
  dados: DadosMedicao1
  autor: string
  autorTipo: ChecklistAutorTipo
}): Promise<Checklist> {
  if (!supabase) throw new Error('Supabase nao configurado')
  // upsert: 1 registro de cada tipo por card
  const payload = {
    card_id: args.cardId,
    tipo: 'medicao1' as ChecklistTipo,
    dados: args.dados,
    autor: args.autor,
    autor_tipo: args.autorTipo,
    preenchido_em: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('checklists')
    .upsert(payload, { onConflict: 'card_id,tipo' })
    .select()
    .single()
  if (error) throw error
  return rowParaChecklist(data as ChecklistRow)
}

export async function salvarMedicao2(args: {
  cardId: string
  dados: DadosMedicao2
  autor: string
  autorTipo: ChecklistAutorTipo
}): Promise<Checklist> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const payload = {
    card_id: args.cardId,
    tipo: 'medicao2' as ChecklistTipo,
    dados: args.dados,
    autor: args.autor,
    autor_tipo: args.autorTipo,
    preenchido_em: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('checklists')
    .upsert(payload, { onConflict: 'card_id,tipo' })
    .select()
    .single()
  if (error) throw error
  return rowParaChecklist(data as ChecklistRow)
}

export async function removerChecklist(cardId: string, tipo: ChecklistTipo): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { error } = await supabase
    .from('checklists')
    .delete()
    .eq('card_id', cardId)
    .eq('tipo', tipo)
  if (error) throw error
}
