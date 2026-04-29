// Tipos do dominio G Obra
import type { Checklist } from './checklist'

export type Perfil = 'empresa' | 'cliente'

export type AbaId = 'cliente' | 'empresa' | 'emandamento' | 'conclusao'

export type TipoCard = 'peca' | 'acordo' | 'reclamacao'

export type AutorTipo = 'empresa' | 'cliente' | 'sistema'

export interface RegistroHistorico {
  autor: string
  tipo: AutorTipo
  data: string
  texto: string
}

export interface FotoCard {
  id: string
  url: string
  nome: string | null
  createdAt: string
}

export interface Card {
  id: string
  tipo: TipoCard
  sigla: string
  nome: string
  descricao: string
  aba: AbaId
  statusEmAndamento: string | null
  subStatus: string | null
  prazoContrato: string | null
  encerrado: boolean
  aceiteFinal: string | null
  historico: RegistroHistorico[]
  fotos: FotoCard[]
  checklists: Checklist[]
}

export interface ObraInfo {
  nome: string
  endereco: string
  cliente: string
  empresa: string
  inicio: string
}

export interface DadosObra {
  obra: ObraInfo
  cards: Card[]
}

export const STATUS_EM_ANDAMENTO = [
  'Aguardando fabricacao',
  'Fabricando',
  'Entregue em obra',
  'Aguardando instalacao',
  'Instalando',
  'Concluido',
] as const

export const ABAS: { id: AbaId; rotulo: string; descricao: string }[] = [
  { id: 'cliente', rotulo: 'Cliente', descricao: 'Acoes pendentes do lado do cliente. Pode aguardar dias, semanas ou meses - obra parada ate aqui ser resolvido.' },
  { id: 'empresa', rotulo: 'Empresa', descricao: 'Acoes pendentes do lado da empresa. Qualquer registro joga a bola pro campo oposto.' },
  { id: 'emandamento', rotulo: 'Em andamento', descricao: 'Pecas com processo ativo e prazo contratual. 15, 30, 60 ou 90 dias conforme o combinado.' },
  { id: 'conclusao', rotulo: 'Conclusao', descricao: 'Pecas instaladas aguardando aceite final. Aceite inicia a garantia.' },
]
