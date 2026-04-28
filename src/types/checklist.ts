// Tipos dos checklists tecnicos (Medicao 1, Medicao 2, Item)
// Sao formularios estruturados que vivem dentro do card, so visiveis pra empresa.

export type ChecklistTipo = 'medicao1' | 'medicao2' | 'item'
export type ChecklistAutorTipo = 'empresa' | 'tecnico'

// =============== Medicao 1 ===============
// Visita tecnica inicial: define se vai ter contra-marco, tira primeiras
// medidas, define tipologia (motor, abertura, ferragens).
export interface DadosMedicao1 {
  // Cabecalho
  numero_orcamento: string
  data: string // ISO yyyy-mm-dd
  tecnico: string
  responsavel_obra: string

  // Identificacao do item
  descricao: string
  linha: string
  cor: string
  vidro: string
  observacao: string

  // Especificacoes - Motor (so se motorizada)
  tem_motor: boolean
  motor_lado: 'esquerda' | 'direita' | ''
  motor_tensao: '110V' | '220V' | ''

  // Estrutura
  contra_marco: 'sim' | 'nao' | '' // ★ decisao critica do fluxo
  soleira: 'sim' | 'nao' | ''

  // Instalacao - orientacao do trilho
  instalacao: 'face_interna' | 'face_externa' | 'eixo' | ''

  // Acabamento
  arremate_interno: boolean
  arremate_externo: boolean
  meia_cana: boolean
  meia_cana_interna: boolean

  // Macaneta / Concha
  maçaneta_lado: 'esquerda' | 'direita' | ''
  maçaneta_posicao: 'externa' | 'interna_externa' | ''

  // Chave
  chave_posicao: 'interna' | 'externa' | ''
  chave_somente_puxador: boolean

  // Abertura
  abertura_lado: 'esquerda' | 'direita' | ''
  abertura_posicao: 'interna' | 'externa' | ''
  abertura_tipo: 'convencional' | 'embutido_u' | 'embutido_concavo' | 'na' | ''

  // Diagnostico do vao
  vao_trilho_ok: 'sim' | 'nao' | ''
  vao_trilho_obs: string
  vao_esquadro_ok: 'sim' | 'nao' | ''
  vao_esquadro_obs: string
  vao_nivel_ok: 'sim' | 'nao' | ''
  vao_nivel_obs: string
  precisa_correcao: string // observacao livre

  // Medidas
  contra_marco_largura: string
  contra_marco_altura: string
  producao_largura: string
  producao_altura: string
  medida_final_largura: string
  medida_final_altura: string
}

export const VAZIO_MEDICAO1: DadosMedicao1 = {
  numero_orcamento: '',
  data: new Date().toISOString().slice(0, 10),
  tecnico: '',
  responsavel_obra: '',
  descricao: '',
  linha: '',
  cor: '',
  vidro: '',
  observacao: '',
  tem_motor: false,
  motor_lado: '',
  motor_tensao: '',
  contra_marco: '',
  soleira: '',
  instalacao: '',
  arremate_interno: false,
  arremate_externo: false,
  meia_cana: false,
  meia_cana_interna: false,
  maçaneta_lado: '',
  maçaneta_posicao: '',
  chave_posicao: '',
  chave_somente_puxador: false,
  abertura_lado: '',
  abertura_posicao: '',
  abertura_tipo: '',
  vao_trilho_ok: '',
  vao_trilho_obs: '',
  vao_esquadro_ok: '',
  vao_esquadro_obs: '',
  vao_nivel_ok: '',
  vao_nivel_obs: '',
  precisa_correcao: '',
  contra_marco_largura: '',
  contra_marco_altura: '',
  producao_largura: '',
  producao_altura: '',
  medida_final_largura: '',
  medida_final_altura: '',
}

// =============== Checklist generico ===============
export interface Checklist {
  id: string
  cardId: string
  tipo: ChecklistTipo
  dados: DadosMedicao1 | Record<string, any> // M2 e Item virao depois
  autor: string
  autorTipo: ChecklistAutorTipo
  preenchidoEm: string
  atualizadoEm: string
}

// Resumo curto pra mostrar no card quando ja preenchido
export function resumoMedicao1(d: DadosMedicao1): string {
  const partes: string[] = []
  if (d.contra_marco === 'sim') partes.push('com contra-marco')
  else if (d.contra_marco === 'nao') partes.push('sem contra-marco')
  if (d.vao_esquadro_ok === 'nao') partes.push('vao fora de esquadro')
  if (d.vao_nivel_ok === 'nao') partes.push('vao fora de nivel')
  if (d.precisa_correcao && d.precisa_correcao.trim()) partes.push('precisa correcao')
  if (partes.length === 0) return 'Medicao realizada'
  return 'Medicao realizada — ' + partes.join(', ')
}
