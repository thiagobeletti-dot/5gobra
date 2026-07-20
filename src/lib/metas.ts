// G Obra — Motor da página Metas (gamificação)
//
// Feature cravada pelo Thiago 14-15/07/2026 (mockup v3.1 na vault).
// PRINCÍPIO INEGOCIÁVEL (mesmo do Cronograma): o placar é REFLEXO dos
// registros reais — nada é digitado como "cumprido".
//
// ============== DE ONDE VEM CADA EVENTO ==============
// - Peça FABRICADA em D: primeiro registro do historico_card (interno, autor
//   sistema) cujo texto 'Status: "X" -> "Y".' tem Y ∈ FABRICADO_EM_DIANTE
//   (Pronto pra instalação ou além — cobre status legados).
// - Peça INSTALADA em D: primeiro registro com Y = Concluído/Concluido.
// - Peça CONCLUÍDA em D: aceite_final_at (ou, obra gerencial sem cliente,
//   a data de instalada com encerrado=true).
// - RETRABALHO: card tipo 'reclamacao' criado no período (desconta pontos).
// - Datas-limite do calendário: fases do cronograma com previsaoFim.
//
// Períodos: dia = hoje · semana = seg→dom corrente · mês = mês corrente.
// Streak: dias consecutivos (terminando hoje ou ontem) com fabricadas ≥ alvo
// diário. Estado: 'ativo' | 'quebrado' | 'critico' (3+ dias sem bater).

import { supabase } from './supabase'
import {
  listarObras,
  listarCardsDaObra,
  listarHistoricoEmLote,
  pegarMinhaEmpresa,
  type CardRow,
} from './api'
import { pegarCronogramaPorObra } from './cronograma'

// ============== CONFIG ==============

export interface MetasConfig {
  alvo_fabricar_dia: number
  alvo_fabricar_semana: number
  alvo_fabricar_mes: number
  alvo_instalar_dia: number
  alvo_instalar_semana: number
  alvo_instalar_mes: number
  pts_fabricar: number
  pts_instalar: number
  pts_concluir: number
  pts_reclamacao: number
}

export const METAS_CONFIG_DEFAULT: MetasConfig = {
  alvo_fabricar_dia: 3,
  alvo_fabricar_semana: 15,
  alvo_fabricar_mes: 60,
  alvo_instalar_dia: 3,
  alvo_instalar_semana: 15,
  alvo_instalar_mes: 60,
  pts_fabricar: 10,
  pts_instalar: 10,
  pts_concluir: 30,
  pts_reclamacao: -20,
}

export async function pegarMetasConfig(): Promise<MetasConfig> {
  if (!supabase) return METAS_CONFIG_DEFAULT
  const { data, error } = await supabase
    .from('metas_config')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error || !data) return METAS_CONFIG_DEFAULT
  return { ...METAS_CONFIG_DEFAULT, ...data }
}

export async function salvarMetasConfig(config: MetasConfig): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado')
  const empresa = await pegarMinhaEmpresa()
  if (!empresa) throw new Error('Empresa não encontrada')
  const { error } = await supabase
    .from('metas_config')
    .upsert({ empresa_id: empresa.id, ...config, atualizado_em: new Date().toISOString() })
  if (error) throw error
}

// ============== EVENTOS ==============

export type Periodo = 'dia' | 'semana' | 'mes'

// Status que significam "já saiu da fabricação" (inclui legados do banco)
const FABRICADO_EM_DIANTE = new Set([
  'Pronto pra instalação',
  'Entregue',
  'Em Instalação',
  'Concluído',
  'Concluido',
  // legados (continuam válidos se estiverem no banco)
  'Entregue em obra',
  'Aguardando instalacao',
  'Instalando',
])
const INSTALADO = new Set(['Concluído', 'Concluido'])

const RE_STATUS = /^Status: ".*" -> "(.+)"\.?$/

interface EventosCard {
  fabricadaEm: Date | null
  instaladaEm: Date | null
  concluidaEm: Date | null
}

export interface Deadline {
  data: Date
  fase: string
  obra: string
  responsavel: string
}

export interface LinhaRanking {
  obraId: string
  obraNome: string
  pontos: number
}

export interface DadosMetas {
  config: MetasConfig
  // contagens por período ativo
  fabricadas: Record<Periodo, number>
  instaladas: Record<Periodo, number>
  concluidas: Record<Periodo, number>
  reclamacoes: Record<Periodo, number>
  ranking: Record<Periodo, LinhaRanking[]>
  // streak
  streakDias: number
  streakRecorde: number
  diasSemBater: number
  estadoStreak: 'ativo' | 'quebrado' | 'critico'
  // placar do mês
  obrasConcluidasMes: { nome: string; data: Date }[]
  // calendário
  deadlines: Deadline[]
}

function inicioDoDia(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function inicioDaSemana(d: Date): Date {
  const x = inicioDoDia(d)
  const dow = x.getDay() // 0=dom
  const diff = dow === 0 ? 6 : dow - 1 // segunda como início
  x.setDate(x.getDate() - diff)
  return x
}

function inicioDoMes(d: Date): Date {
  const x = inicioDoDia(d)
  x.setDate(1)
  return x
}

function extrairEventos(card: CardRow, historico: { texto: string; created_at: string }[]): EventosCard {
  let fabricadaEm: Date | null = null
  let instaladaEm: Date | null = null
  for (const h of historico) {
    const m = RE_STATUS.exec(h.texto.trim())
    if (!m) continue
    const destino = m[1]
    const quando = new Date(h.created_at)
    if (!fabricadaEm && FABRICADO_EM_DIANTE.has(destino)) fabricadaEm = quando
    if (!instaladaEm && INSTALADO.has(destino)) instaladaEm = quando
    if (fabricadaEm && instaladaEm) break
  }
  // Concluída: aceite do cliente OU (obra gerencial) encerramento na instalação
  let concluidaEm: Date | null = card.aceite_final_at ? new Date(card.aceite_final_at) : null
  if (!concluidaEm && card.encerrado && instaladaEm) concluidaEm = instaladaEm
  return { fabricadaEm, instaladaEm, concluidaEm }
}

export async function calcularMetas(): Promise<DadosMetas> {
  const agora = new Date()
  const limites: Record<Periodo, Date> = {
    dia: inicioDoDia(agora),
    semana: inicioDaSemana(agora),
    mes: inicioDoMes(agora),
  }

  const [config, obras] = await Promise.all([pegarMetasConfig(), listarObras()])

  // Cards de todas as obras (paralelo — mesmo padrão do Dashboard)
  const cardsPorObra = await Promise.all(
    obras.map(async (o) => ({ obra: o, cards: await listarCardsDaObra(o.id) })),
  )
  const todosCards = cardsPorObra.flatMap((x) => x.cards)
  const cardsPeca = todosCards.filter((c) => c.tipo === 'peca')

  // Histórico em lote (INTERNO incluído — é onde vivem as mudanças de status)
  const historicoMapa = await listarHistoricoEmLote(
    cardsPeca.map((c) => c.id),
    { incluirInterno: true },
  )

  const eventosPorCard = new Map<string, EventosCard>()
  for (const c of cardsPeca) {
    eventosPorCard.set(c.id, extrairEventos(c, historicoMapa.get(c.id) ?? []))
  }

  // ===== contagens por período =====
  const contar = (
    selecionar: (e: EventosCard) => Date | null,
    desde: Date,
  ): number => {
    let n = 0
    for (const e of eventosPorCard.values()) {
      const d = selecionar(e)
      if (d && d >= desde && d <= agora) n++
    }
    return n
  }

  const fabricadas = {} as Record<Periodo, number>
  const instaladas = {} as Record<Periodo, number>
  const concluidas = {} as Record<Periodo, number>
  const reclamacoes = {} as Record<Periodo, number>
  const ranking = {} as Record<Periodo, LinhaRanking[]>

  for (const p of ['dia', 'semana', 'mes'] as Periodo[]) {
    const desde = limites[p]
    fabricadas[p] = contar((e) => e.fabricadaEm, desde)
    instaladas[p] = contar((e) => e.instaladaEm, desde)
    concluidas[p] = contar((e) => e.concluidaEm, desde)
    reclamacoes[p] = todosCards.filter(
      (c) => c.tipo === 'reclamacao' && new Date(c.created_at) >= desde,
    ).length

    // ranking por obra
    const linhas: LinhaRanking[] = cardsPorObra.map(({ obra, cards }) => {
      let pontos = 0
      for (const c of cards) {
        if (c.tipo === 'reclamacao' && new Date(c.created_at) >= desde) {
          pontos += config.pts_reclamacao
          continue
        }
        if (c.tipo !== 'peca') continue
        const e = eventosPorCard.get(c.id)
        if (!e) continue
        if (e.fabricadaEm && e.fabricadaEm >= desde) pontos += config.pts_fabricar
        if (e.instaladaEm && e.instaladaEm >= desde) pontos += config.pts_instalar
        if (e.concluidaEm && e.concluidaEm >= desde) pontos += config.pts_concluir
      }
      return { obraId: obra.id, obraNome: obra.nome, pontos }
    })
    ranking[p] = linhas.filter((l) => l.pontos !== 0).sort((a, b) => b.pontos - a.pontos)
  }

  // ===== streak (últimos 90 dias de fabricação) — datas LOCAIS =====
  const chaveDia = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const fabPorDia = new Map<string, number>()
  for (const e of eventosPorCard.values()) {
    if (!e.fabricadaEm) continue
    const chave = chaveDia(e.fabricadaEm)
    fabPorDia.set(chave, (fabPorDia.get(chave) ?? 0) + 1)
  }
  const bateu = (d: Date) => (fabPorDia.get(chaveDia(d)) ?? 0) >= config.alvo_fabricar_dia

  let streakDias = 0
  {
    // começa de hoje se hoje já bateu; senão de ontem
    const cursor = inicioDoDia(agora)
    if (!bateu(cursor)) cursor.setDate(cursor.getDate() - 1)
    for (let i = 0; i < 90; i++) {
      if (bateu(cursor)) {
        streakDias++
        cursor.setDate(cursor.getDate() - 1)
      } else break
    }
  }
  let diasSemBater = 0
  {
    const cursor = inicioDoDia(agora)
    cursor.setDate(cursor.getDate() - 1) // hoje ainda em curso não conta contra
    for (let i = 0; i < 90; i++) {
      if (!bateu(cursor)) {
        diasSemBater++
        cursor.setDate(cursor.getDate() - 1)
      } else break
    }
  }
  // recorde: maior sequência nos últimos 90 dias
  let streakRecorde = 0
  {
    let atual = 0
    const cursor = inicioDoDia(agora)
    cursor.setDate(cursor.getDate() - 89)
    for (let i = 0; i < 90; i++) {
      if (bateu(cursor)) {
        atual++
        if (atual > streakRecorde) streakRecorde = atual
      } else atual = 0
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  const estadoStreak: DadosMetas['estadoStreak'] =
    streakDias > 0 ? 'ativo' : diasSemBater >= 3 ? 'critico' : 'quebrado'

  // ===== obras concluídas no mês =====
  const obrasConcluidasMes: { nome: string; data: Date }[] = []
  for (const { obra, cards } of cardsPorObra) {
    const pecas = cards.filter((c) => c.tipo === 'peca')
    if (pecas.length === 0) continue
    const todasConcluidas = pecas.every((c) => {
      const e = eventosPorCard.get(c.id)
      return !!e?.concluidaEm || c.encerrado
    })
    if (!todasConcluidas) continue
    const datas = pecas
      .map((c) => eventosPorCard.get(c.id)?.concluidaEm)
      .filter((d): d is Date => !!d)
    if (datas.length === 0) continue
    const ultima = new Date(Math.max(...datas.map((d) => d.getTime())))
    if (ultima >= limites.mes) obrasConcluidasMes.push({ nome: obra.nome, data: ultima })
  }

  // ===== calendário: fases futuras/abertas dos cronogramas =====
  const deadlines: Deadline[] = []
  const cronogramas = await Promise.all(
    obras.filter((o) => !o.encerrada).map(async (o) => ({
      obra: o,
      cron: await pegarCronogramaPorObra(o.id).catch(() => null),
    })),
  )
  for (const { obra, cron } of cronogramas) {
    if (!cron) continue
    for (const fase of cron.fases) {
      if (fase.status === 'concluida' || !fase.previsaoFim) continue
      deadlines.push({
        data: new Date(fase.previsaoFim + 'T00:00:00'),
        fase: fase.nome,
        obra: obra.nome,
        responsavel: fase.responsavel,
      })
    }
  }
  deadlines.sort((a, b) => a.data.getTime() - b.data.getTime())

  return {
    config,
    fabricadas,
    instaladas,
    concluidas,
    reclamacoes,
    ranking,
    streakDias,
    streakRecorde,
    diasSemBater,
    estadoStreak,
    obrasConcluidasMes,
    deadlines,
  }
}

// Alvo da meta pro período selecionado
export function alvoDe(config: MetasConfig, meta: 'fabricar' | 'instalar', p: Periodo): number {
  const chave = `alvo_${meta}_${p}` as keyof MetasConfig
  return config[chave] as number
}
