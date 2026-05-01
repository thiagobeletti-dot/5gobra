// Tipos do dominio G Obra
import type { Checklist } from './checklist'

export type Perfil = 'empresa' | 'cliente'

export type AbaId = 'cliente' | 'empresa' | 'tecnica' | 'emandamento' | 'conclusao'

export type TipoCard = 'peca' | 'acordo' | 'reclamacao'

export type AutorTipo = 'empresa' | 'cliente' | 'sistema'

export interface RegistroHistorico {
  autor: string
  tipo: AutorTipo
  data: string
  texto: string
  interno: boolean
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

// Em Andamento — fases do ciclo de produção, com "Aguardando lote" como início (empresa precisa fechar o lote pra produção realmente começar).
// (Valores antigos como 'Aguardando fabricacao' / 'Fabricando' / 'Entregue em obra' /
// 'Aguardando instalacao' / 'Instalando' continuam funcionando se já estiverem no banco —
// só não aparecem no dropdown novo.)
export const STATUS_EM_ANDAMENTO = [
  'Aguardando lote',
  'Em Produção',
  'Entregue',
  'Em Instalação',
  'Concluído',
] as const

export const ABAS: { id: AbaId; rotulo: string; descricao: string }[] = [
  { id: 'cliente', rotulo: 'Cliente', descricao: 'Acoes pendentes do lado do cliente. Pode aguardar dias, semanas ou meses - obra parada ate aqui ser resolvido.' },
  { id: 'empresa', rotulo: 'Empresa', descricao: 'Acoes pendentes do lado da empresa. Qualquer registro joga a bola pro campo oposto.' },
  { id: 'tecnica', rotulo: 'Técnica', descricao: 'Itens aguardando visita técnica. Empresa precisa ir na obra preencher a Medição 1.' },
  { id: 'emandamento', rotulo: 'Em andamento', descricao: 'Itens com processo ativo e prazo contratual. 15, 30, 60 ou 90 dias conforme o combinado.' },
  { id: 'conclusao', rotulo: 'Conclusao', descricao: 'Itens instalados aguardando aceite final. Aceite inicia a garantia.' },
]
