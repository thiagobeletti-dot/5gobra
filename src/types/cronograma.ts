// Tipos do módulo Cronograma V1 — programação manual de fases de obra
// Implementa "Demanda na obra (cliente)" vs "Demanda na fábrica (empresa)"
//
// Cronograma é COMPROMISSO. Não suporta edição pós-aceite em V1.

export type ModoContagem = 'por_lote' | 'por_peca'

export type GatilhoTipo =
  | 'assinatura_contrato' // dispara quando cliente aceita o cronograma
  | 'fim_fase_anterior' // dispara quando outra fase conclui
  | 'liberacao_vao' // dispara quando cliente marca vão liberado
  | 'data_fixa' // dispara em data específica configurada

export type ResponsavelFase = 'empresa' | 'cliente'

export type FaseStatus =
  | 'aguardando_gatilho' // gatilho ainda não disparou
  | 'em_andamento' // gatilho disparou, fase em curso
  | 'concluida' // marcada como feita
  | 'atrasada' // prazo estourou sem conclusão

export type EventoTipo =
  | 'cronograma_criado'
  | 'cronograma_aceito'
  | 'vao_liberado'
  | 'fase_iniciada'
  | 'fase_concluida'
  | 'fase_atrasou'

export type AutorTipo = 'empresa' | 'cliente' | 'sistema'

/** Demanda atual do cronograma. "concluido" = todas as fases finalizadas. */
export type DemandaAtual = 'empresa' | 'cliente' | 'concluido' | 'aguardando_inicio'

// ============================================================
// Entidades principais
// ============================================================

export interface Cronograma {
  id: string
  obraId: string
  modoContagem: ModoContagem
  aceitoEm: string | null
  aceitoIp: string | null
  aceitoUserAgent: string | null
  vaoLiberadoEm: string | null
  vaoLiberadoIp: string | null
  vaoLiberadoUserAgent: string | null
  versao: number
  ativo: boolean
  createdAt: string
  atualizadoEm: string
  fases: CronogramaFase[]
}

export interface CronogramaFase {
  id: string
  cronogramaId: string
  ordem: number
  nome: string
  descricao: string | null
  gatilhoTipo: GatilhoTipo
  gatilhoFaseId: string | null
  gatilhoData: string | null
  prazoDias: number
  responsavel: ResponsavelFase
  status: FaseStatus
  iniciadaEm: string | null
  concluidaEm: string | null
  previsaoInicio: string | null
  previsaoFim: string | null
  observacoes: string | null
  createdAt: string
  atualizadoEm: string
}

export interface CronogramaEvento {
  id: string
  cronogramaId: string
  faseId: string | null
  tipo: EventoTipo
  autorTipo: AutorTipo
  autorNome: string | null
  texto: string | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

// ============================================================
// Linhas do banco (snake_case) — pra mapear de api
// ============================================================

export interface CronogramaRow {
  id: string
  obra_id: string
  modo_contagem: ModoContagem
  aceito_em: string | null
  aceito_ip: string | null
  aceito_user_agent: string | null
  vao_liberado_em: string | null
  vao_liberado_ip: string | null
  vao_liberado_user_agent: string | null
  versao: number
  ativo: boolean
  created_at: string
  atualizado_em: string
}

export interface CronogramaFaseRow {
  id: string
  cronograma_id: string
  ordem: number
  nome: string
  descricao: string | null
  gatilho_tipo: GatilhoTipo
  gatilho_fase_id: string | null
  gatilho_data: string | null
  prazo_dias: number
  responsavel: ResponsavelFase
  status: FaseStatus
  iniciada_em: string | null
  concluida_em: string | null
  previsao_inicio: string | null
  previsao_fim: string | null
  observacoes: string | null
  created_at: string
  atualizado_em: string
}

export interface CronogramaEventoRow {
  id: string
  cronograma_id: string
  fase_id: string | null
  tipo: EventoTipo
  autor_tipo: AutorTipo
  autor_nome: string | null
  texto: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

// ============================================================
// Helpers de UI
// ============================================================

export interface FaseUI extends CronogramaFase {
  /** Dias restantes até a previsão de fim (negativo se atrasou). */
  diasRestantes: number | null
  /** True se prazo estourou e fase não concluiu. */
  estaAtrasada: boolean
  /** True se essa é a fase com a "demanda atual". */
  demandaAtual: boolean
}

/** Templates simples pra empresa começar (V1 — só horizontal padrão). */
export const TEMPLATES_CRONOGRAMA = {
  HORIZONTAL_SIMPLES: {
    nome: 'Horizontal simples (sem contramarco)',
    fases: [
      { nome: 'Medição', gatilhoTipo: 'assinatura_contrato' as GatilhoTipo, prazoDias: 7, responsavel: 'empresa' as ResponsavelFase },
      { nome: 'Fabricação', gatilhoTipo: 'fim_fase_anterior' as GatilhoTipo, prazoDias: 30, responsavel: 'empresa' as ResponsavelFase },
      { nome: 'Instalação', gatilhoTipo: 'fim_fase_anterior' as GatilhoTipo, prazoDias: 7, responsavel: 'empresa' as ResponsavelFase },
    ],
  },
  HORIZONTAL_COM_CONTRAMARCO: {
    nome: 'Horizontal com contramarco',
    fases: [
      { nome: 'Medição (M1)', gatilhoTipo: 'assinatura_contrato' as GatilhoTipo, prazoDias: 7, responsavel: 'empresa' as ResponsavelFase },
      { nome: 'Entrega Contramarco', gatilhoTipo: 'fim_fase_anterior' as GatilhoTipo, prazoDias: 15, responsavel: 'empresa' as ResponsavelFase },
      { nome: 'Liberação do vão', gatilhoTipo: 'fim_fase_anterior' as GatilhoTipo, prazoDias: 0, responsavel: 'cliente' as ResponsavelFase },
      { nome: 'Fabricação', gatilhoTipo: 'liberacao_vao' as GatilhoTipo, prazoDias: 40, responsavel: 'empresa' as ResponsavelFase },
      { nome: 'Instalação', gatilhoTipo: 'fim_fase_anterior' as GatilhoTipo, prazoDias: 20, responsavel: 'empresa' as ResponsavelFase },
    ],
  },
} as const
