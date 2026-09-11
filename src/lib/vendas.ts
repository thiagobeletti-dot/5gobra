// Máquina de venda — acesso aos dados de /app/vendas.
//
// Não há RPC aqui de propósito: as tabelas têm RLS gated em `admins`, então
// select/insert/update normais já são seguros e são muito menos peça pra dar
// errado. A RPC do painel de clientes existe porque ela agrega meia dúzia de
// tabelas; aqui é CRUD em tabela própria.
//
// Regras que moram AQUI e não no banco (por serem de produto, não de dado):
//   - qual o próximo estado quando ele aperta "Avançar"
//   - quantos dias somar depois de cada ação
// O banco guarda a configuração (vendas_cadencia, vendas_config) e a tela
// aplica. Assim o Thiago muda prazo sem deploy.

import { supabase } from './supabase'

export type EstadoLead =
  | 'novo' | 'cadencia' | 'conversando' | 'testando' | 'decidindo'
  | 'cliente' | 'gelado' | 'perdido'

export type TipoToque = 'texto' | 'audio' | 'visualizacao_unica' | 'ligacao' | 'nota'

export interface Lead {
  id: string
  nome: string
  empresa: string | null
  telefone: string | null
  instagram: string | null
  cidade: string | null
  canal: 'whatsapp' | 'instagram'
  origem: string | null
  estado: EstadoLead
  toque: number
  proximo_em: string | null
  ultimo_contato_em: string | null
  foi_pro_whatsapp: boolean
  passou_pela_giulia: boolean
  resumo: string | null
  gancho: string | null
  motivo_fim: string | null
  notas: string | null
  /** vem da view vendas_fila */
  dias: number | null
  na_fila: boolean
  situacao: 'atrasado' | 'hoje' | 'em_dia' | null
  e_conversa_fria: boolean
  qtd_toques: number
}

export interface PassoCadencia {
  numero: number
  dias_ate_o_proximo: number
  titulo: string
  mensagem: string | null
  link: string | null
  ativo: boolean
}

export const ESTADOS: { id: EstadoLead; t: string; s: string }[] = [
  { id: 'novo',        t: 'Novo',        s: 'nunca falei' },
  { id: 'cadencia',    t: 'Em cadência', s: 'mandei, sem resposta' },
  { id: 'conversando', t: 'Conversando', s: 'respondeu' },
  { id: 'testando',    t: 'Testando',    s: 'criou conta' },
  { id: 'decidindo',   t: 'Decidindo',   s: 'viu preço' },
  { id: 'cliente',     t: 'Cliente',     s: 'assinou' },
  { id: 'gelado',      t: 'Gelado',      s: 'volta em 3 meses' },
  { id: 'perdido',     t: 'Perdido',     s: 'disse não' },
]

/** Avanço natural quando ele aperta "Avançar". Perdido e gelado são decisão
    explícita, nunca automáticos. */
const ADIANTE: Partial<Record<EstadoLead, EstadoLead>> = {
  conversando: 'testando',
  testando: 'decidindo',
  decidindo: 'cliente',
}

// Data no fuso DELE, não em UTC.
//
// toISOString() converte pra UTC: às 21h de Jundiaí (UTC-3) já é o dia
// seguinte em Londres. Um lead cadastrado de noite ganharia prazo de amanhã
// e sumiria da fila de hoje — e ele trabalha de noite, os prints da conversa
// são 19h20. Já tinha aparecido fuso errado no painel em 03/09.
function hojeMais(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export async function pegarLeads(): Promise<Lead[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('vendas_fila')
    .select('*')
    .order('proximo_em', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Lead[]
}

export async function pegarCadencia(): Promise<PassoCadencia[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('vendas_cadencia').select('*').eq('ativo', true).order('numero')
  if (error) throw new Error(error.message)
  return (data ?? []) as PassoCadencia[]
}

export async function pegarConfig(): Promise<Record<string, number>> {
  if (!supabase) return {}
  const { data, error } = await supabase.from('vendas_config').select('chave, valor')
  if (error) throw new Error(error.message)
  const m: Record<string, number> = {}
  for (const r of data ?? []) m[(r as { chave: string }).chave] = (r as { valor: number }).valor
  return m
}

/** Dias de silêncio tolerados antes de o lead voltar pra fila. */
export function diasDeParado(estado: EstadoLead, cfg: Record<string, number>): number {
  if (estado === 'conversando') return cfg.parado_conversando ?? 2
  if (estado === 'testando')    return cfg.parado_testando ?? 3
  if (estado === 'decidindo')   return cfg.parado_decidindo ?? 2
  return 0
}

async function gravarToque(
  leadId: string, numero: number | null, tipo: TipoToque,
  canal: string | null, direcao: 'enviado' | 'recebido', conteudo?: string,
): Promise<void> {
  if (!supabase) return
  await supabase.from('vendas_toques').insert({
    lead_id: leadId, numero, tipo, canal, direcao, conteudo: conteudo ?? null,
  })
}

/** "Mandei" — o toque de cadência saiu. Incrementa o contador e agenda o
    próximo pelo espaçamento configurado. */
export async function registrarEnvio(
  lead: Lead, cadencia: PassoCadencia[], tipo: TipoToque = 'texto',
): Promise<void> {
  if (!supabase) return
  const novo = lead.toque + 1
  const passo = cadencia.find((p) => p.numero === novo)
  const ultimo = !passo || passo.dias_ate_o_proximo === 0 || novo >= cadencia.length

  await supabase.from('vendas_leads').update({
    toque: novo,
    // Acabou a sequência sem resposta: não é "perdido", é "gelado". Ele não
    // disse não — só não era a hora. Volta em 90 dias.
    estado: ultimo ? 'gelado' : 'cadencia',
    proximo_em: ultimo ? hojeMais(90) : hojeMais(passo.dias_ate_o_proximo),
    ultimo_contato_em: new Date().toISOString(),
    motivo_fim: ultimo ? 'terminou a sequência sem responder' : null,
  }).eq('id', lead.id)

  await gravarToque(lead.id, novo, tipo, lead.canal, 'enviado', passo?.titulo)
}

/** "Respondeu" — sai da cadência. Não se persegue quem já está falando. */
export async function registrarResposta(lead: Lead, cfg: Record<string, number>): Promise<void> {
  if (!supabase) return
  await supabase.from('vendas_leads').update({
    estado: 'conversando',
    proximo_em: hojeMais(diasDeParado('conversando', cfg)),
    ultimo_contato_em: new Date().toISOString(),
  }).eq('id', lead.id)
  await gravarToque(lead.id, null, 'nota', lead.canal, 'recebido', 'respondeu')
}

/** "Falei hoje" — conversa quente. Zera o relógio do parado e NÃO mexe no
    contador de toque, porque ele já saiu da cadência. */
export async function registrarConversa(
  lead: Lead, cfg: Record<string, number>, tipo: TipoToque = 'texto',
): Promise<void> {
  if (!supabase) return
  await supabase.from('vendas_leads').update({
    proximo_em: hojeMais(diasDeParado(lead.estado, cfg) || 2),
    ultimo_contato_em: new Date().toISOString(),
  }).eq('id', lead.id)
  await gravarToque(lead.id, null, tipo, lead.canal, 'enviado', 'falei hoje')
}

export async function avancarEstado(lead: Lead, cfg: Record<string, number>): Promise<void> {
  if (!supabase) return
  const destino = ADIANTE[lead.estado] ?? lead.estado
  await supabase.from('vendas_leads').update({
    estado: destino,
    proximo_em: destino === 'cliente' ? null : hojeMais(diasDeParado(destino, cfg) || 2),
    ultimo_contato_em: new Date().toISOString(),
  }).eq('id', lead.id)
  await gravarToque(lead.id, null, 'nota', lead.canal, 'enviado', 'avançou para ' + destino)
}

/** Migrou a conversa do Instagram pro WhatsApp. É conversão de canal e o
    Thiago quer medir — por isso é campo próprio, não uma nota. */
export async function migrouProWhats(lead: Lead, telefone: string): Promise<void> {
  if (!supabase) return
  await supabase.from('vendas_leads').update({
    foi_pro_whatsapp: true, canal: 'whatsapp', telefone,
    ultimo_contato_em: new Date().toISOString(),
  }).eq('id', lead.id)
  await gravarToque(lead.id, null, 'nota', 'whatsapp', 'enviado', 'migrou do Direct pro WhatsApp')
}

export async function encerrar(
  lead: Lead, como: 'perdido' | 'gelado', motivo: string,
): Promise<void> {
  if (!supabase) return
  await supabase.from('vendas_leads').update({
    estado: como,
    motivo_fim: motivo,
    proximo_em: como === 'gelado' ? hojeMais(90) : null,
  }).eq('id', lead.id)
  await gravarToque(lead.id, null, 'nota', lead.canal, 'enviado', como + ': ' + motivo)
}

export async function criarLead(dados: Partial<Lead>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('vendas_leads').insert({
    ...dados, estado: 'novo', toque: 0, proximo_em: hojeMais(0),
  })
  if (error) {
    // índice único de telefone/@ — é a trava anti-duplicata
    if (error.code === '23505') throw new Error('Esse contato já está no funil.')
    throw new Error(error.message)
  }
}

/** wa.me com o texto dentro: um toque abre o WhatsApp já escrito. */
export function linkWhats(lead: Lead, texto?: string): string {
  const so = (lead.telefone ?? '').replace(/\D/g, '')
  const num = so.startsWith('55') ? so : '55' + so
  return 'https://wa.me/' + num + (texto ? '?text=' + encodeURIComponent(texto) : '')
}
