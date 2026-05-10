import { supabase, type DbClient } from './supabase'
import type { TecnicoObra } from '../types/tecnico'

interface TecnicoRow {
  id: string
  obra_id: string
  nome: string
  papel: string | null
  token: string
  ativo: boolean
  revogado_em: string | null
  created_at: string
}

function rowParaTecnico(r: TecnicoRow): TecnicoObra {
  return {
    id: r.id,
    obraId: r.obra_id,
    nome: r.nome,
    papel: r.papel,
    token: r.token,
    ativo: r.ativo,
    revogadoEm: r.revogado_em,
    createdAt: r.created_at,
  }
}

export async function listarTecnicosDaObra(obraId: string): Promise<TecnicoObra[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tecnicos_obra')
    .select('*')
    .eq('obra_id', obraId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as TecnicoRow[]).map(rowParaTecnico)
}

export async function criarTecnico(args: { obraId: string; nome: string; papel?: string }): Promise<TecnicoObra> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase
    .from('tecnicos_obra')
    .insert({ obra_id: args.obraId, nome: args.nome, papel: args.papel ?? null })
    .select()
    .single()
  if (error) throw error
  return rowParaTecnico(data as TecnicoRow)
}

export async function revogarTecnico(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { error } = await supabase
    .from('tecnicos_obra')
    .update({ ativo: false, revogado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reativarTecnico(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { error } = await supabase
    .from('tecnicos_obra')
    .update({ ativo: true, revogado_em: null })
    .eq('id', id)
  if (error) throw error
}

// Busca técnico ativo pelo token (link mágico). Retorna o técnico + dados da obra dele.
// Aceita client opcional pra usar supabasePublico nas rotas /tec/[token]
// (evita conflito com sessão authenticated do app principal).
export async function pegarTecnicoPorToken(
  token: string,
  client: DbClient | null = supabase,
): Promise<{ tecnico: TecnicoObra; obraId: string } | null> {
  if (!client) return null
  const { data, error } = await client
    .from('tecnicos_obra')
    .select('*')
    .eq('token', token)
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const tecnico = rowParaTecnico(data as TecnicoRow)
  return { tecnico, obraId: tecnico.obraId }
}
