// Tipos dos checklists técnicos (Medição 1, Medição 2, Item)
// São formulários estruturados que vivem dentro do card, só visíveis pra empresa.

export type ChecklistTipo = 'medicao1' | 'medicao2' | 'item'
export type ChecklistAutorTipo = 'empresa' | 'tecnico'

export type Tipologia = 'fixo' | 'correr' | 'giro' | 'maxim_ar' | ''

export const ROTULOS_TIPOLOGIA: Record<Exclude<Tipologia, ''>, string> = {
  fixo: 'Fixo',
  correr: 'Correr',
  giro: 'Giro',
  maxim_ar: 'Maxim-ar / Basculante',
}

// =============== Medição 1 ===============
// Visita técnica inicial: define se vai ter contra-marco, tira primeiras
// medidas, define tipologia e especificações.
export interface DadosMedicao1 {
  // Cabeçalho
  data: string // ISO yyyy-mm-dd
  tecnico: string
  responsavel_obra: string

  // Identificação do item (pré-populada do card)
  descricao: string
  linha: string
  cor: string
  vidro: string
  observacao: string

  // Tipologia contratada é executável?
  tipologia_executavel: 'sim' | 'nao' | ''
  tipologia_problema: string

  // Tipologia escolhida
  tipologia: Tipologia

  // Específicos de Giro
  giro_macaneta_lado: 'esquerda' | 'direita' | ''
  giro_chave_posicao: 'interna' | 'externa' | ''
  giro_somente_puxador: boolean
  giro_abertura_lado: 'esquerda' | 'direita' | ''
  giro_abertura_posicao: 'interna' | 'externa' | ''

  // Específicos de Correr
  correr_abertura_lado: 'esquerda' | 'direita' | 'ambos' | ''
  correr_fecho: 'fechadura' | 'cremona' | 'concha' | ''
  correr_trilho: 'convencional' | 'embutido_u' | 'embutido_concavo' | 'na' | ''

  // Estrutura
  contra_marco: 'sim' | 'nao' | '' // ★ decisão crítica do fluxo
  soleira: 'sim' | 'nao' | ''

  // Motor (só se motorizada)
  tem_motor: boolean
  motor_lado: 'esquerda' | 'direita' | ''
  motor_tensao: '110V' | '220V' | ''

  // Instalação - orientação do trilho (só se contra-marco NÃO)
  instalacao: 'face_interna' | 'face_externa' | 'eixo' | ''

  // Acabamento
  arremate_interno: boolean
  arremate_externo: boolean
  arremate_externo_tipo: 'cantoneira' | 'meia_cana' | ''
  meia_cana_interna: boolean // só se contra-marco=nao + instalacao=eixo

  // Diagnóstico do vão
  vao_chao_ok: 'sim' | 'nao' | ''
  vao_chao_obs: string
  vao_esquadro_ok: 'sim' | 'nao' | ''
  vao_esquadro_obs: string
  vao_nivel_ok: 'sim' | 'nao' | ''
  vao_nivel_obs: string
  precisa_correcao: string

  // Medidas (1 par, label dinâmico baseado em contra-marco)
  medida_largura: string
  medida_altura: string
}

export const VAZIO_MEDICAO1: DadosMedicao1 = {
  data: new Date().toISOString().slice(0, 10),
  tecnico: '',
  responsavel_obra: '',
  descricao: '',
  linha: '',
  cor: '',
  vidro: '',
  observacao: '',
  tipologia_executavel: '',
  tipologia_problema: '',
  tipologia: '',
  giro_macaneta_lado: '',
  giro_chave_posicao: '',
  giro_somente_puxador: false,
  giro_abertura_lado: '',
  giro_abertura_posicao: '',
  correr_abertura_lado: '',
  correr_fecho: '',
  correr_trilho: '',
  contra_marco: '',
  soleira: '',
  tem_motor: false,
  motor_lado: '',
  motor_tensao: '',
  instalacao: '',
  arremate_interno: true,
  arremate_externo: false,
  arremate_externo_tipo: '',
  meia_cana_interna: false,
  vao_chao_ok: '',
  vao_chao_obs: '',
  vao_esquadro_ok: '',
  vao_esquadro_obs: '',
  vao_nivel_ok: '',
  vao_nivel_obs: '',
  precisa_correcao: '',
  medida_largura: '',
  medida_altura: '',
}

// =============== Checklist genérico ===============
export interface Checklist {
  id: string
  cardId: string
  tipo: ChecklistTipo
  dados: DadosMedicao1 | Record<string, any> // M2 e Item virão depois
  autor: string
  autorTipo: ChecklistAutorTipo
  preenchidoEm: string
  atualizadoEm: string
}

// Resumo curto pra mostrar no card quando já preenchido
export function resumoMedicao1(d: DadosMedicao1): string {
  const partes: string[] = []
  if (d.tipologia_executavel === 'nao') partes.push('TIPOLOGIA NÃO EXECUTÁVEL')
  if (d.contra_marco === 'sim') partes.push('com contra-marco')
  else if (d.contra_marco === 'nao') partes.push('sem contra-marco')
  if (d.vao_esquadro_ok === 'nao') partes.push('vão fora de esquadro')
  if (d.vao_nivel_ok === 'nao') partes.push('vão fora de nível')
  if (d.precisa_correcao && d.precisa_correcao.trim()) partes.push('precisa correção')
  if (partes.length === 0) return 'Medição realizada'
  return 'Medição realizada — ' + partes.join(', ')
}
