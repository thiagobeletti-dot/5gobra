// Helpers do módulo Cronograma V1
// Padrão: aceita `client` opcional (supabase autenticado ou supabasePublico anon)

import { supabase, type DbClient } from './supabase'
import type {
  Cronograma,
  CronogramaFase,
  CronogramaEvento,
  CronogramaRow,
  CronogramaFaseRow,
  CronogramaEventoRow,
  ModoContagem,
  GatilhoTipo,
  ResponsavelFase,
  DemandaAtual,
  FaseUI,
} from '../types/cronograma'

// ============================================================
// Conversão DB ↔ TS (snake_case ↔ camelCase)
// ============================================================

function rowToCronograma(row: CronogramaRow, fases: CronogramaFase[] = []): Cronograma {
  return {
    id: row.id,
    obraId: row.obra_id,
    modoContagem: row.modo_contagem,
    aceitoEm: row.aceito_em,
    aceitoIp: row.aceito_ip,
    aceitoUserAgent: row.aceito_user_agent,
    vaoLiberadoEm: row.vao_liberado_em,
    vaoLiberadoIp: row.vao_liberado_ip,
    vaoLiberadoUserAgent: row.vao_liberado_user_agent,
    versao: row.versao,
    ativo: row.ativo,
    createdAt: row.created_at,
    atualizadoEm: row.atualizado_em,
    fases,
  }
}

function rowToFase(row: CronogramaFaseRow): CronogramaFase {
  return {
    id: row.id,
    cronogramaId: row.cronograma_id,
    ordem: row.ordem,
    nome: row.nome,
    descricao: row.descricao,
    gatilhoTipo: row.gatilho_tipo,
    gatilhoFaseId: row.gatilho_fase_id,
    gatilhoData: row.gatilho_data,
    prazoDias: row.prazo_dias,
    responsavel: row.responsavel,
    status: row.status,
    iniciadaEm: row.iniciada_em,
    concluidaEm: row.concluida_em,
    previsaoInicio: row.previsao_inicio,
    previsaoFim: row.previsao_fim,
    observacoes: row.observacoes,
    createdAt: row.created_at,
    atualizadoEm: row.atualizado_em,
  }
}

function rowToEvento(row: CronogramaEventoRow): CronogramaEvento {
  return {
    id: row.id,
    cronogramaId: row.cronograma_id,
    faseId: row.fase_id,
    tipo: row.tipo,
    autorTipo: row.autor_tipo,
    autorNome: row.autor_nome,
    texto: row.texto,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }
}

// ============================================================
// LEITURA
// ============================================================

export async function pegarCronogramaPorObra(
  obraId: string,
  client: DbClient | null = supabase,
): Promise<Cronograma | null> {
  if (!client) return null

  // Pega o cronograma da obra
  const { data: cronogramaData, error: errC } = await client
    .from('cronogramas')
    .select('*')
    .eq('obra_id', obraId)
    .eq('ativo', true)
    .maybeSingle()

  if (errC) {
    console.warn('[cronograma] pegarCronogramaPorObra erro:', errC)
    return null
  }
  if (!cronogramaData) return null

  // Pega as fases dele
  const { data: fasesData, error: errF } = await client
    .from('cronograma_fases')
    .select('*')
    .eq('cronograma_id', cronogramaData.id)
    .order('ordem', { ascending: true })

  if (errF) {
    console.warn('[cronograma] listarFases erro:', errF)
    return rowToCronograma(cronogramaData as CronogramaRow, [])
  }

  const fases = (fasesData ?? []).map((r) => rowToFase(r as CronogramaFaseRow))
  return rowToCronograma(cronogramaData as CronogramaRow, fases)
}

export async function listarEventos(
  cronogramaId: string,
  client: DbClient | null = supabase,
): Promise<CronogramaEvento[]> {
  if (!client) return []
  const { data, error } = await client
    .from('cronograma_eventos')
    .select('*')
    .eq('cronograma_id', cronogramaId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[cronograma] listarEventos erro:', error)
    return []
  }
  return (data ?? []).map((r) => rowToEvento(r as CronogramaEventoRow))
}

// ============================================================
// ESCRITA — EMPRESA (autenticada)
// ============================================================

export interface NovaFaseInput {
  ordem: number
  nome: string
  descricao?: string | null
  gatilhoTipo: GatilhoTipo
  gatilhoFaseId?: string | null
  gatilhoData?: string | null
  prazoDias: number
  responsavel: ResponsavelFase
}

export async function criarCronograma(input: {
  obraId: string
  modoContagem: ModoContagem
  fases: NovaFaseInput[]
}): Promise<Cronograma | null> {
  if (!supabase) return null

  // 1. Cria o cronograma
  const { data: cronogramaData, error: errC } = await supabase
    .from('cronogramas')
    .insert({
      obra_id: input.obraId,
      modo_contagem: input.modoContagem,
    })
    .select('*')
    .single()

  if (errC || !cronogramaData) {
    console.error('[cronograma] criarCronograma erro:', errC)
    return null
  }

  const cronogramaId = (cronogramaData as CronogramaRow).id

  // 2. Cria as fases
  const fasesInsert = input.fases.map((f) => ({
    cronograma_id: cronogramaId,
    ordem: f.ordem,
    nome: f.nome,
    descricao: f.descricao ?? null,
    gatilho_tipo: f.gatilhoTipo,
    gatilho_fase_id: f.gatilhoFaseId ?? null,
    gatilho_data: f.gatilhoData ?? null,
    prazo_dias: f.prazoDias,
    responsavel: f.responsavel,
  }))

  const { data: fasesData, error: errF } = await supabase
    .from('cronograma_fases')
    .insert(fasesInsert)
    .select('*')

  if (errF) {
    console.error('[cronograma] criar fases erro:', errF)
    return null
  }

  // 3. Registra evento
  await supabase.from('cronograma_eventos').insert({
    cronograma_id: cronogramaId,
    tipo: 'cronograma_criado',
    autor_tipo: 'empresa',
    texto: `Cronograma criado com ${input.fases.length} fases`,
  })

  const fases = (fasesData ?? []).map((r) => rowToFase(r as CronogramaFaseRow))
  return rowToCronograma(cronogramaData as CronogramaRow, fases)
}

/**
 * Apaga cronograma (soft delete: marca ativo=false).
 * Só permitido se NÃO foi aceito ainda — depois do aceite vira compromisso bilateral.
 * Retorna true se apagou, false se não pôde (já aceito) ou se deu erro.
 */
export async function apagarCronograma(cronogramaId: string): Promise<{ ok: boolean; motivo?: string }> {
  if (!supabase) return { ok: false, motivo: 'Supabase não configurado' }

  // Verifica se já foi aceito
  const { data: atual, error: errGet } = await supabase
    .from('cronogramas')
    .select('aceito_em')
    .eq('id', cronogramaId)
    .maybeSingle()

  if (errGet || !atual) {
    return { ok: false, motivo: 'Cronograma não encontrado' }
  }
  if ((atual as { aceito_em: string | null }).aceito_em) {
    return { ok: false, motivo: 'Cronograma já foi aceito pelo cliente. Não pode ser apagado.' }
  }

  const { error } = await supabase
    .from('cronogramas')
    .update({ ativo: false })
    .eq('id', cronogramaId)

  if (error) {
    console.error('[cronograma] apagarCronograma erro:', error)
    return { ok: false, motivo: error.message }
  }

  return { ok: true }
}

export async function marcarFaseConcluida(
  faseId: string,
  cronogramaId: string,
  autorNome: string,
): Promise<boolean> {
  if (!supabase) return false

  const hoje = new Date().toISOString().slice(0, 10)

  const { error: errF } = await supabase
    .from('cronograma_fases')
    .update({
      status: 'concluida',
      concluida_em: hoje,
    })
    .eq('id', faseId)

  if (errF) {
    console.error('[cronograma] marcarFaseConcluida erro:', errF)
    return false
  }

  await supabase.from('cronograma_eventos').insert({
    cronograma_id: cronogramaId,
    fase_id: faseId,
    tipo: 'fase_concluida',
    autor_tipo: 'empresa',
    autor_nome: autorNome,
  })

  return true
}

// ============================================================
// ESCRITA — CLIENTE (anon via link mágico)
// ============================================================

export async function aceitarCronograma(input: {
  cronogramaId: string
  ip?: string
  userAgent?: string
  client?: DbClient | null
}): Promise<boolean> {
  const client = input.client ?? supabase
  if (!client) return false

  const agora = new Date().toISOString()

  const { error: errC } = await client
    .from('cronogramas')
    .update({
      aceito_em: agora,
      aceito_ip: input.ip ?? null,
      aceito_user_agent: input.userAgent ?? null,
    })
    .eq('id', input.cronogramaId)

  if (errC) {
    console.error('[cronograma] aceitarCronograma erro:', errC)
    return false
  }

  // Dispara fases com gatilho 'assinatura_contrato'
  await client
    .from('cronograma_fases')
    .update({ status: 'em_andamento', iniciada_em: agora.slice(0, 10) })
    .eq('cronograma_id', input.cronogramaId)
    .eq('gatilho_tipo', 'assinatura_contrato')
    .eq('status', 'aguardando_gatilho')

  await client.from('cronograma_eventos').insert({
    cronograma_id: input.cronogramaId,
    tipo: 'cronograma_aceito',
    autor_tipo: 'cliente',
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    texto: 'Cliente aceitou o cronograma',
  })

  return true
}

export async function marcarVaoLiberado(input: {
  cronogramaId: string
  ip?: string
  userAgent?: string
  client?: DbClient | null
}): Promise<boolean> {
  const client = input.client ?? supabase
  if (!client) return false

  const agora = new Date().toISOString()

  const { error: errC } = await client
    .from('cronogramas')
    .update({
      vao_liberado_em: agora,
      vao_liberado_ip: input.ip ?? null,
      vao_liberado_user_agent: input.userAgent ?? null,
    })
    .eq('id', input.cronogramaId)

  if (errC) {
    console.error('[cronograma] marcarVaoLiberado erro:', errC)
    return false
  }

  // Dispara fases com gatilho 'liberacao_vao'
  await client
    .from('cronograma_fases')
    .update({ status: 'em_andamento', iniciada_em: agora.slice(0, 10) })
    .eq('cronograma_id', input.cronogramaId)
    .eq('gatilho_tipo', 'liberacao_vao')
    .eq('status', 'aguardando_gatilho')

  await client.from('cronograma_eventos').insert({
    cronograma_id: input.cronogramaId,
    tipo: 'vao_liberado',
    autor_tipo: 'cliente',
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    texto: 'Cliente marcou vão liberado pra instalação',
  })

  return true
}

// ============================================================
// HELPERS DE UI — DEMANDA / PRAZOS
// ============================================================

/**
 * Quem tem a DEMANDA atual do cronograma?
 *   - 'cliente': precisa aceitar OU tem fase em andamento com responsavel=cliente
 *   - 'empresa': tem fase em andamento com responsavel=empresa
 *   - 'concluido': todas fases concluídas
 *   - 'aguardando_inicio': cronograma criado mas não tem fase ativa ainda
 */
export function calcularDemandaAtual(cronograma: Cronograma | null): {
  demanda: DemandaAtual
  faseAtual: CronogramaFase | null
} {
  if (!cronograma) return { demanda: 'aguardando_inicio', faseAtual: null }
  if (!cronograma.aceitoEm) return { demanda: 'cliente', faseAtual: null }

  const faseEmAndamento = cronograma.fases.find((f) => f.status === 'em_andamento')
  if (faseEmAndamento) {
    return { demanda: faseEmAndamento.responsavel, faseAtual: faseEmAndamento }
  }

  const todasConcluidas =
    cronograma.fases.length > 0 && cronograma.fases.every((f) => f.status === 'concluida')

  return {
    demanda: todasConcluidas ? 'concluido' : 'aguardando_inicio',
    faseAtual: null,
  }
}

export function calcularDiasRestantes(fase: CronogramaFase): number | null {
  if (!fase.previsaoFim) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(fase.previsaoFim)
  fim.setHours(0, 0, 0, 0)
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function estaFaseAtrasada(fase: CronogramaFase): boolean {
  if (fase.status === 'concluida') return false
  if (!fase.previsaoFim) return false
  return new Date(fase.previsaoFim) < new Date()
}

/** Aumenta a fase com infos calculadas pra UI. */
export function montarFaseUI(fase: CronogramaFase, demandaAtual: CronogramaFase | null): FaseUI {
  return {
    ...fase,
    diasRestantes: calcularDiasRestantes(fase),
    estaAtrasada: estaFaseAtrasada(fase),
    demandaAtual: demandaAtual?.id === fase.id,
  }
}

// ============================================================
// LABELS
// ============================================================

export function rotuloGatilho(tipo: GatilhoTipo): string {
  const mapa: Record<GatilhoTipo, string> = {
    assinatura_contrato: 'Assinatura do contrato',
    fim_fase_anterior: 'Fim da fase anterior',
    liberacao_vao: 'Vão liberado pelo cliente',
    data_fixa: 'Data fixa',
  }
  return mapa[tipo] ?? tipo
}

export function rotuloResponsavel(r: ResponsavelFase): string {
  return r === 'empresa' ? 'Fábrica (empresa)' : 'Obra (cliente)'
}

export function emojiDemanda(d: DemandaAtual): string {
  const mapa: Record<DemandaAtual, string> = {
    empresa: '🟢',
    cliente: '🟡',
    concluido: '✅',
    aguardando_inicio: '⏳',
  }
  return mapa[d]
}

export function rotuloDemanda(d: DemandaAtual): string {
  const mapa: Record<DemandaAtual, string> = {
    empresa: 'Demanda na fábrica',
    cliente: 'Demanda na obra',
    concluido: 'Concluído',
    aguardando_inicio: 'Aguardando',
  }
  return mapa[d]
}
