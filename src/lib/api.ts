import { supabase } from './supabase'
import type { Card, DadosObra, ObraInfo, RegistroHistorico, AbaId, TipoCard, FotoCard } from '../types/obra'
import type { Checklist } from '../types/checklist'
import type { Anexo } from './anexos'

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
  sub_status: string | null
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
  autor_tipo: 'empresa' | 'cliente' | 'sistema' | 'tecnico'
  texto: string
  interno: boolean
  ip: string | null
  user_agent: string | null
  created_at: string
}

// =============== Empresa ===============

export async function pegarMinhaEmpresa() {
  if (!supabase) return null
  // Campos especificos — evita trazer onboarding_status (jsonb pesado) e
  // colunas de auditoria. Onboarding status tem sua propria query.
  // Audit Sprint B item P2.
  const { data, error } = await supabase
    .from('empresas')
    .select('id, nome, cnpj, telefone, owner_user_id, atualizado_em')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function criarEmpresa(nome: string, extras: { cnpj?: string; telefone?: string } = {}) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Não autenticado')
  const payload: Record<string, unknown> = { nome, owner_user_id: user.user.id }
  if (extras.cnpj) payload.cnpj = extras.cnpj
  if (extras.telefone) payload.telefone = extras.telefone
  const { data, error } = await supabase
    .from('empresas')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarMinhaEmpresa(mudancas: { nome?: string; cnpj?: string; telefone?: string }) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const empresa = await pegarMinhaEmpresa()
  if (!empresa) throw new Error('Empresa nao encontrada')
  const payload: Record<string, unknown> = {}
  if (mudancas.nome !== undefined) payload.nome = mudancas.nome
  if (mudancas.cnpj !== undefined) payload.cnpj = mudancas.cnpj
  if (mudancas.telefone !== undefined) payload.telefone = mudancas.telefone
  const { data, error } = await supabase.from('empresas').update(payload).eq('id', empresa.id).select().single()
  if (error) throw error
  return data
}

export async function trocarSenha(novaSenha: string) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) throw error
}

export interface AceiteRow {
  id: string
  tipo: string
  documento_versao: string
  documento_hash: string
  documento_snapshot: { texto?: string; versao?: string } | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export async function listarMeusAceites(): Promise<AceiteRow[]> {
  if (!supabase) return []
  const empresa = await pegarMinhaEmpresa()
  if (!empresa) return []
  const { data, error } = await supabase
    .from('aceites')
    .select('id, tipo, documento_versao, documento_hash, documento_snapshot, ip, user_agent, created_at')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as AceiteRow[]
}

// =============== Obras ===============

export async function listarObras() {
  if (!supabase) return []
  // Campos especificos — pra listagem na tela /app/obras nao precisamos de
  // cliente_email/telefone, e_encerrada (raro), nem outros pesados.
  // Audit Sprint B item P2.
  const { data, error } = await supabase
    .from('obras')
    .select('id, empresa_id, nome, endereco, cliente_nome, inicio, token_cliente, encerrada, created_at')
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

export async function criarVariosCards(dados: Array<{
  obra_id: string
  tipo: TipoCard
  sigla: string
  nome: string
  descricao?: string
  aba: AbaId
  status_em_andamento?: string | null
  prazo_contrato?: string | null
}>) {
  if (!supabase) throw new Error('Supabase nao configurado')
  if (dados.length === 0) return []
  const { data, error } = await supabase.from('cards').insert(dados).select()
  if (error) throw error
  return (data ?? []) as CardRow[]
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

// Busca em lote o historico de varios cards (so eventos NAO internos por padrao,
// pra usar no PDF de Dossie — documento oficial que vai pro cliente).
// Retorna um Map cardId -> HistoricoRow[] em ordem cronologica crescente.
export async function listarHistoricoEmLote(cardIds: string[], opts: { incluirInterno?: boolean } = {}) {
  const mapa = new Map<string, HistoricoRow[]>()
  if (!supabase || cardIds.length === 0) return mapa
  let q = supabase
    .from('historico_card')
    .select('*')
    .in('card_id', cardIds)
    .order('created_at', { ascending: true })
  if (!opts.incluirInterno) q = q.eq('interno', false)
  const { data, error } = await q
  if (error) throw error
  for (const id of cardIds) mapa.set(id, [])
  for (const row of (data ?? []) as HistoricoRow[]) {
    const arr = mapa.get(row.card_id) ?? []
    arr.push(row)
    mapa.set(row.card_id, arr)
  }
  return mapa
}

export async function adicionarHistorico(dados: {
  card_id: string
  autor: string
  autor_tipo: 'empresa' | 'cliente' | 'sistema' | 'tecnico'
  texto: string
  interno?: boolean
}) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const payload = { ...dados, interno: dados.interno ?? false }
  const { data, error } = await supabase.from('historico_card').insert(payload).select().single()
  if (error) throw error
  return data as HistoricoRow
}

// =============== Helpers de conversao ===============

export function rowsParaDadosObra(
  obraRow: ObraRow,
  cardsRows: CardRow[],
  historicoPorCard: Record<string, HistoricoRow[]>,
  anexosPorCard: Record<string, Anexo[]> = {},
  checklistsPorCard: Record<string, Checklist[]> = {}
): DadosObra {
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
    subStatus: r.sub_status ?? null,
    prazoContrato: r.prazo_contrato,
    encerrado: r.encerrado,
    aceiteFinal: r.aceite_final_at,
    historico: (historicoPorCard[r.id] ?? []).map<RegistroHistorico>((h) => ({
      autor: h.autor,
      tipo: h.autor_tipo,
      data: new Date(h.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      texto: h.texto,
      interno: h.interno ?? false,
    })),
    fotos: (anexosPorCard[r.id] ?? []).map<FotoCard>((a) => ({
      id: a.id,
      url: a.url,
      nome: a.nome_arquivo,
      createdAt: a.created_at,
    })),
    checklists: checklistsPorCard[r.id] ?? [],
  }))
  return { obra, cards }
}

// =============== Phase 9: Onboarding status ===============

export type OnboardingStatus = {
  tour_visto: boolean
  tour_dispensado: boolean
  tour_obra_visto: boolean
  primeira_obra_criada: boolean
  tecnico_convidado: boolean
  primeiro_card_criado: boolean
  cliente_acessou_link_magico: boolean
  primeiro_aceite_registrado: boolean
}

const onboardingDefault: OnboardingStatus = {
  tour_visto: false,
  tour_dispensado: false,
  tour_obra_visto: false,
  primeira_obra_criada: false,
  tecnico_convidado: false,
  primeiro_card_criado: false,
  cliente_acessou_link_magico: false,
  primeiro_aceite_registrado: false,
}

export async function pegarOnboardingStatus(): Promise<OnboardingStatus> {
  if (!supabase) return onboardingDefault
  const { data, error } = await supabase
    .from('empresas')
    .select('onboarding_status')
    .limit(1)
    .maybeSingle()
  if (error) {
    // Se a coluna nao existir ainda (migration nao rodada), volta default
    return onboardingDefault
  }
  return { ...onboardingDefault, ...(data?.onboarding_status ?? {}) }
}

export async function marcarOnboardingFlag(flag: keyof OnboardingStatus): Promise<void> {
  if (!supabase) return
  // Usa a function helper do banco (evita race condition na fusao do jsonb)
  const { error } = await supabase.rpc('marcar_onboarding', { p_flag: flag })
  if (error) {
    // Fallback: update direto se a function ainda nao existir.
    // Query especifica pra trazer apenas o jsonb (em vez de pegarMinhaEmpresa
    // que foi otimizada pra nao trazer onboarding_status — Sprint B.2).
    const { data: row } = await supabase
      .from('empresas')
      .select('id, onboarding_status')
      .limit(1)
      .maybeSingle()
    if (!row) return
    const statusAtual = (row as { onboarding_status?: Partial<OnboardingStatus> }).onboarding_status ?? {}
    const novoStatus = { ...onboardingDefault, ...statusAtual, [flag]: true }
    await supabase.from('empresas').update({ onboarding_status: novoStatus }).eq('id', row.id)
  }
}

// =============== Phase 9: Aceites ===============

export type TipoAceite =
  | 'termos_uso'
  | 'politica_privacidade'
  | 'aceite_final_obra'
  | 'mudanca_tipologia'
  | 'acordo_card'
  | 'liberacao_obra'
  | 'outro'

export interface AceiteInput {
  tipo: TipoAceite
  documentoVersao: string
  documentoHash: string
  documentoSnapshot?: Record<string, unknown>
  empresaId?: string | null
  obraId?: string | null
  cardId?: string | null
  contatoIdentificador?: string | null
  contatoTipo?: 'cliente_final' | 'tecnico' | 'admin_empresa' | null
}

export async function gravarAceite(input: AceiteInput) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const ip = await pegarIpClienteLocal() // best-effort, opcional
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

  const { data, error } = await supabase
    .from('aceites')
    .insert({
      tipo: input.tipo,
      documento_versao: input.documentoVersao,
      documento_hash: input.documentoHash,
      documento_snapshot: input.documentoSnapshot ?? null,
      empresa_id: input.empresaId ?? null,
      obra_id: input.obraId ?? null,
      card_id: input.cardId ?? null,
      contato_identificador: input.contatoIdentificador ?? null,
      contato_tipo: input.contatoTipo ?? null,
      ip,
      user_agent: userAgent,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function pegarIpClienteLocal(): Promise<string | null> {
  // Best-effort: chama um endpoint publico que retorna o IP do cliente.
  // Se falhar (offline, bloqueado, etc), retorna null. O importante eh
  // o aceite ser registrado mesmo sem IP.
  try {
    const r = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000),
    })
    if (!r.ok) return null
    const j = await r.json()
    return typeof j?.ip === 'string' ? j.ip : null
  } catch {
    return null
  }
}

// Hash SHA-256 de uma string usando Web Crypto API (browser).
// Usado pra fixar o documento aceito no momento do aceite.
export async function hashSha256(texto: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(texto))
  const arr = Array.from(new Uint8Array(buf))
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('')
}
