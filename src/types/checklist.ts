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

  // Identificação do item (pré-populada do card; linha/cor/vidro vêm do contrato, não são responsabilidade do técnico)
  descricao: string
  observacao: string

  // Tipologia contratada é executável?
  tipologia_executavel: 'sim' | 'nao' | ''
  tipologia_problema: string

  // Tipologia escolhida
  tipologia: Tipologia

  // Específicos de Giro
  giro_abertura: 'interna' | 'externa' | '' // pra qual lado abre (vs vista externa)
  giro_fechadura_lado: 'esquerda' | 'direita' | '' // lado da fechadura (vista externa)
  giro_puxador: boolean // tem puxador adicional? (true=sim, false=não)

  // Específicos de Correr
  correr_abertura_lado: 'esquerda' | 'direita' | 'ambos' | ''
  correr_fecho: 'fechadura' | 'cremona' | 'concha' | ''
  correr_trilho: 'convencional' | 'embutido_u' | 'embutido_concavo' | 'na' | ''
  correr_somente_puxador: boolean // sem chave, só puxador

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

  // Diagnóstico do vão (M1 = triagem; detalhe fino fica no M2)
  vao_pronto: 'sim' | 'nao' | ''
  precisa_correcao: string // pendências/orientações pra obra (só usado quando vao_pronto=nao)

  // Medidas (1 par, label dinâmico baseado em contra-marco)
  medida_largura: string
  medida_altura: string
}

export const VAZIO_MEDICAO1: DadosMedicao1 = {
  data: new Date().toISOString().slice(0, 10),
  tecnico: '',
  responsavel_obra: '',
  descricao: '',
  observacao: '',
  tipologia_executavel: '',
  tipologia_problema: '',
  tipologia: '',
  giro_abertura: '',
  giro_fechadura_lado: '',
  giro_puxador: false,
  correr_abertura_lado: '',
  correr_fecho: '',
  correr_trilho: '',
  correr_somente_puxador: false,
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
  vao_pronto: '',
  precisa_correcao: '',
  medida_largura: '',
  medida_altura: '',
}

// =============== Medição 2 ===============
// Conferência fina pós contra-marco/vão acabado: avalia se vão tá pronto pra produção.
// Só acontece quando M1 disse contra-marco=SIM OU vão não pronto.
// IMPORTANTE: como o M1 nesses casos é minimal (não captura tipologia/specs), a M2
// também captura essas specs — esse é o momento certo (técnico em obra com vão pronto).
export interface DadosMedicao2 {
  // Cabeçalho
  data: string
  tecnico: string
  responsavel_obra: string

  // Estado do vão (5 campos)
  contra_marco_instalado: 'sim' | 'nao' | '' // só visível/preenchível se M1 contra-marco=SIM
  piso_acabado: 'sim' | 'nao' | ''
  vao_acabado: 'sim' | 'nao' | '' // paredes/teto
  nivel_ok: 'sim' | 'nao' | ''
  nivel_obs: string
  prumo_ok: 'sim' | 'nao' | ''
  prumo_obs: string

  // Especificações finais (captura sempre, pois M1 não captura quando CM=SIM nem quando vão=NÃO)
  tipologia: Tipologia
  giro_abertura: 'interna' | 'externa' | ''
  giro_fechadura_lado: 'esquerda' | 'direita' | ''
  giro_puxador: boolean
  correr_abertura_lado: 'esquerda' | 'direita' | 'ambos' | ''
  correr_fecho: 'fechadura' | 'cremona' | 'concha' | ''
  correr_trilho: 'convencional' | 'embutido_u' | 'embutido_concavo' | 'na' | ''
  correr_somente_puxador: boolean
  soleira: 'sim' | 'nao' | ''
  tem_motor: boolean
  motor_lado: 'esquerda' | 'direita' | ''
  motor_tensao: '110V' | '220V' | ''
  arremate_interno: boolean
  arremate_externo: boolean
  arremate_externo_tipo: 'cantoneira' | 'meia_cana' | ''

  // Resultado
  liberado_producao: 'sim' | 'nao' | ''
  pendencias: string // só usado se liberado=nao
  medida_largura: string
  medida_altura: string
}

export const VAZIO_MEDICAO2: DadosMedicao2 = {
  data: new Date().toISOString().slice(0, 10),
  tecnico: '',
  responsavel_obra: '',
  contra_marco_instalado: '',
  piso_acabado: '',
  vao_acabado: '',
  nivel_ok: '',
  nivel_obs: '',
  prumo_ok: '',
  prumo_obs: '',
  tipologia: '',
  giro_abertura: '',
  giro_fechadura_lado: '',
  giro_puxador: false,
  correr_abertura_lado: '',
  correr_fecho: '',
  correr_trilho: '',
  correr_somente_puxador: false,
  soleira: '',
  tem_motor: false,
  motor_lado: '',
  motor_tensao: '',
  arremate_interno: true,
  arremate_externo: false,
  arremate_externo_tipo: '',
  liberado_producao: '',
  pendencias: '',
  medida_largura: '',
  medida_altura: '',
}

// =============== Checklist genérico ===============
export interface Checklist {
  id: string
  cardId: string
  tipo: ChecklistTipo
  dados: DadosMedicao1 | DadosMedicao2 | Record<string, any> // Item virá depois
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
  if (d.vao_pronto === 'sim') partes.push('vão pronto')
  else if (d.vao_pronto === 'nao') partes.push('vão pendente de correções')
  if (partes.length === 0) return 'Medição realizada'
  return 'Medição realizada — ' + partes.join(', ')
}

export function resumoMedicao2(d: DadosMedicao2): string {
  if (d.liberado_producao === 'sim') {
    if (d.medida_largura && d.medida_altura) return 'Vão liberado. Medida final: ' + d.medida_largura + ' x ' + d.medida_altura
    return 'Vão liberado para produção'
  }
  if (d.liberado_producao === 'nao') return 'Vão reprovado — pendências para o cliente'
  return 'M2 em andamento'
}
