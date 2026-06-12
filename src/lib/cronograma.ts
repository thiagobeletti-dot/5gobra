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
import { NOMES_FASES } from '../types/cronograma'
import type { Card } from '../types/obra'

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
 * Apaga cronograma (HARD DELETE — fases e eventos caem em cascata via FK).
 * Só permitido se NÃO foi aceito ainda — depois do aceite vira compromisso bilateral.
 *
 * Hard delete (e não soft via ativo=false) porque o schema tem `unique (obra_id)`
 * sem filtro, e soft delete deixava row ali bloqueando a criação de um cronograma
 * novo na mesma obra. Como pré-aceite não é compromisso firmado, deletar fisicamente
 * é seguro.
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
    .delete()
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

/**
 * NÃO MAIS CHAMADA PELA UI (V1.1).
 * Cliente libera o vão CARD A CARD via handler `marcarVaoPronto` (em useObraData).
 * O cronograma infere a fase "Liberação do vão" automaticamente quando todos
 * os cards saem de cliente/empresa.
 *
 * Função mantida pra reuso em V1.2 quando implementarmos auto-persistência
 * (gravar `vao_liberado_em` no banco no momento que a inferência detectar).
 */
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
// INFERÊNCIA AUTOMÁTICA — cronograma lê estado dos cards
// ============================================================

/**
 * Pega o cronograma cru do banco e CALCULA o status real de cada fase
 * baseado no estado atual dos cards da obra.
 *
 * Princípio: o cronograma é um REFLEXO do trabalho feito nos cards.
 * Empresa não marca fase como concluída manualmente — o sistema infere.
 *
 * Inferências V1.1:
 * - "Medição (M1)"      → concluída se TODOS os cards de peça têm checklist medicao1
 * - "Entrega Contramarco" → MANUAL por enquanto (sem sinal claro nos cards; V1.2 evolui)
 * - "Liberação do vão"  → concluída se TODOS os cards de peça avançaram pra
 *                         'tecnica' | 'emandamento' | 'conclusao' (saíram de cliente/empresa).
 *                         O sinal real é: cliente clicou "vão pronto" / "contramarco instalado"
 *                         em cada card → handler marcarVaoPronto move o card pra Técnica.
 * - "Medição (M2)"      → concluída se TODOS os cards de peça têm checklist medicao2
 * - "Conclusão"         → concluída se TODOS os cards de peça estão em aba 'conclusao' com aceiteFinal
 *
 * Fases não inferíveis pelo nome ficam com status original do banco.
 *
 * Nota: essa inferência roda apenas NA UI. O banco continua armazenando o último
 * status conhecido. Pra V1.2 considerar persistir a inferência pra disparar
 * eventos/notificações quando uma fase é concluída automaticamente.
 */
export function inferirStatusFases(cronograma: Cronograma, cards: Card[]): Cronograma {
  if (!cronograma.aceitoEm) return cronograma // antes do aceite, fases ficam no estado original

  const cardsDePeca = cards.filter((c) => c.tipo === 'peca' && !c.encerrado)
  const temCards = cardsDePeca.length > 0

  const todosComChecklistM1 = temCards && cardsDePeca.every((c) =>
    (c.checklists ?? []).some((ck) => ck.tipo === 'medicao1'),
  )
  const todosComChecklistM2 = temCards && cardsDePeca.every((c) =>
    (c.checklists ?? []).some((ck) => ck.tipo === 'medicao2'),
  )
  // "Liberação do vão": todos os cards saíram de cliente/empresa (já estão em
  // técnica, em andamento ou conclusão). Cliente clicou "vão pronto" / "contramarco
  // instalado" em cada um → o handler marcarVaoPronto move pra Técnica.
  const todosLiberaramVao = temCards && cardsDePeca.every(
    (c) => c.aba === 'tecnica' || c.aba === 'emandamento' || c.aba === 'conclusao',
  )
  const todosConcluidos = temCards && cardsDePeca.every((c) => c.aba === 'conclusao' && !!c.aceiteFinal)

  const fasesAtualizadas: CronogramaFase[] = cronograma.fases.map((fase) => {
    // Não rebaixa fase já concluída no banco
    if (fase.status === 'concluida') return fase

    let novoStatus: CronogramaFase['status'] = fase.status
    let novaConcluidaEm: string | null = fase.concluidaEm

    switch (fase.nome) {
      case NOMES_FASES.MEDICAO_M1:
        if (todosComChecklistM1) {
          novoStatus = 'concluida'
          novaConcluidaEm = novaConcluidaEm ?? new Date().toISOString().slice(0, 10)
        }
        break
      case NOMES_FASES.LIBERACAO_VAO:
        // Prioriza o timestamp explícito do banco se existir (V1.2 vai persistir
        // isso automaticamente); senão usa a inferência por estado dos cards.
        if (cronograma.vaoLiberadoEm) {
          novoStatus = 'concluida'
          novaConcluidaEm = novaConcluidaEm ?? cronograma.vaoLiberadoEm.slice(0, 10)
        } else if (todosLiberaramVao) {
          novoStatus = 'concluida'
          novaConcluidaEm = novaConcluidaEm ?? new Date().toISOString().slice(0, 10)
        }
        break
      case NOMES_FASES.MEDICAO_M2:
        if (todosComChecklistM2) {
          novoStatus = 'concluida'
          novaConcluidaEm = novaConcluidaEm ?? new Date().toISOString().slice(0, 10)
        }
        break
      case NOMES_FASES.CONCLUSAO:
        if (todosConcluidos) {
          novoStatus = 'concluida'
          novaConcluidaEm = novaConcluidaEm ?? new Date().toISOString().slice(0, 10)
        }
        break
      // ENTREGA_CONTRAMARCO continua manual (TODO V1.2)
    }

    return { ...fase, status: novoStatus, concluidaEm: novaConcluidaEm }
  })

  // PROPAGAÇÃO PRA TRÁS: se uma fase posterior está concluída, todas as anteriores
  // também devem estar (sequência lógica). Ex: se o cliente "liberou o vão", isso
  // implica que o contramarco já foi entregue e instalado — então a fase "Entrega
  // Contramarco" também conta como concluída, mesmo que não tenhamos sinal direto.
  let ultimaConcluidaIdx = -1
  for (let i = fasesAtualizadas.length - 1; i >= 0; i--) {
    if (fasesAtualizadas[i].status === 'concluida') {
      ultimaConcluidaIdx = i
      break
    }
  }
  if (ultimaConcluidaIdx > 0) {
    const dataFallback = fasesAtualizadas[ultimaConcluidaIdx].concluidaEm
    for (let i = 0; i < ultimaConcluidaIdx; i++) {
      if (fasesAtualizadas[i].status !== 'concluida') {
        fasesAtualizadas[i] = {
          ...fasesAtualizadas[i],
          status: 'concluida',
          concluidaEm: fasesAtualizadas[i].concluidaEm ?? dataFallback,
        }
      }
    }
  }

  // Propaga "em_andamento" pra primeira fase não-concluída — RESPEITANDO O GATILHO.
  //
  // Bug cravado pela Thiago 12/06/2026 (obra Esquadsystem): M2 estava marcada
  // como "vencida há 14 dias" no Dashboard mesmo com cards ainda na aba Cliente
  // esperando contramarco. Causa: propagação cega ignorava gatilho_tipo. Fase com
  // gatilho `liberacao_vao` (M2) era promovida em_andamento assim que a fase
  // anterior concluía → ganhava previsão_fim → "vencia" sem que o evento real
  // tivesse acontecido.
  //
  // Regra correta por gatilho:
  //   - fim_fase_anterior  → propaga SE fase anterior concluiu (cascata natural)
  //   - data_fixa          → propaga SE a data já passou ou é hoje
  //   - assinatura_contrato → NÃO propaga (disparado por aceitarCronograma)
  //   - liberacao_vao      → NÃO propaga (disparado por marcarVaoLiberado ou todos cards saírem de cliente/empresa)
  let proximaAtiva = -1
  for (let i = 0; i < fasesAtualizadas.length; i++) {
    if (fasesAtualizadas[i].status !== 'concluida') {
      proximaAtiva = i
      break
    }
  }
  const hojeData = new Date().toISOString().slice(0, 10)
  if (proximaAtiva !== -1) {
    const fase = fasesAtualizadas[proximaAtiva]
    if (fase.status === 'aguardando_gatilho') {
      let podePropagar = false
      if (fase.gatilhoTipo === 'fim_fase_anterior') {
        podePropagar = proximaAtiva === 0 || fasesAtualizadas[proximaAtiva - 1].status === 'concluida'
      } else if (fase.gatilhoTipo === 'data_fixa' && fase.gatilhoData) {
        podePropagar = fase.gatilhoData <= hojeData
      }
      // assinatura_contrato e liberacao_vao são disparados pelas funções
      // dedicadas (aceitarCronograma / marcarVaoLiberado / inferência de cards) —
      // não devem ser promovidos cegamente aqui.
      if (podePropagar) {
        fasesAtualizadas[proximaAtiva] = { ...fase, status: 'em_andamento' }
      }
    }
  }

  // ============================================================
  // INFERÊNCIA DE PRAZOS — `iniciada_em` e `previsao_fim`
  // ============================================================
  // Antes desta inferência, `previsao_fim` ficava SEMPRE NULL no banco (código
  // nunca populava). Resultado: `calcularDiasRestantes` retornava null → UI não
  // mostrava "Dentro do prazo" nem "Vencido". Bug detectado por Thiago em 09/06/2026
  // após reunião com Vilumi (Bruno levantou que cronograma não conta prazo).
  //
  // Fix arquitetural: mesma filosofia da inferência de status — cronograma é
  // REFLEXO do trabalho. Calculamos `iniciadaEm` efetiva (quando o gatilho da
  // fase realmente disparou) e derivamos `previsaoFim = iniciadaEm + prazoDias`
  // em runtime. Sem migration, sem tocar no banco.
  //
  // Regras de início efetivo por gatilho:
  //   - assinatura_contrato → cronograma.aceitoEm
  //   - liberacao_vao       → cronograma.vaoLiberadoEm (ou data da inferência todosLiberaramVao)
  //   - fim_fase_anterior   → fase_anterior.concluidaEm (cascata)
  //   - data_fixa           → fase.gatilhoData
  const aceitoEmData = cronograma.aceitoEm?.slice(0, 10) ?? null
  const vaoLiberadoEmData = cronograma.vaoLiberadoEm?.slice(0, 10) ?? null
  const hoje = new Date().toISOString().slice(0, 10)

  const fasesComPrazos: CronogramaFase[] = fasesAtualizadas.map((fase, idx) => {
    // Se já tem previsão_fim do banco (caso raro mas possível), respeita
    if (fase.previsaoFim) return fase

    // Determina data de início efetiva baseada no gatilho
    let iniciadaEmEfetiva: string | null = fase.iniciadaEm

    if (!iniciadaEmEfetiva) {
      switch (fase.gatilhoTipo) {
        case 'assinatura_contrato':
          iniciadaEmEfetiva = aceitoEmData
          break
        case 'liberacao_vao':
          iniciadaEmEfetiva = vaoLiberadoEmData
          break
        case 'data_fixa':
          iniciadaEmEfetiva = fase.gatilhoData ?? null
          break
        case 'fim_fase_anterior': {
          // Pega a fase anterior pela ordem (idx > 0) ou pelo gatilhoFaseId
          const anterior = fase.gatilhoFaseId
            ? fasesAtualizadas.find((f) => f.id === fase.gatilhoFaseId)
            : idx > 0 ? fasesAtualizadas[idx - 1] : null
          iniciadaEmEfetiva = anterior?.concluidaEm ?? null
          break
        }
      }
    }

    // Se a fase está em andamento e ainda não tem início, assume hoje (recém-disparada)
    if (!iniciadaEmEfetiva && fase.status === 'em_andamento') {
      iniciadaEmEfetiva = hoje
    }

    if (!iniciadaEmEfetiva) return fase

    // Calcula previsão de fim
    const previsaoFimEfetiva = somarDiasCorridos(iniciadaEmEfetiva, fase.prazoDias)

    return {
      ...fase,
      iniciadaEm: fase.iniciadaEm ?? iniciadaEmEfetiva,
      previsaoInicio: fase.previsaoInicio ?? iniciadaEmEfetiva,
      previsaoFim: previsaoFimEfetiva,
    }
  })

  return { ...cronograma, fases: fasesComPrazos }
}

/**
 * Soma N dias corridos a uma data no formato YYYY-MM-DD.
 * V1 usa dias corridos pra alinhar com o que o usuário cadastra em `prazo_dias`.
 * V2 considerar opção de dias úteis se Thiago pedir.
 */
function somarDiasCorridos(dataISO: string, dias: number): string {
  const d = new Date(dataISO + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// ============================================================
// HELPERS DE UI — DEMANDA / PRAZOS
// ============================================================

/**
 * Quem tem a DEMANDA atual do cronograma?
 *   - 'cliente': precisa aceitar OU tem fase em andamento com responsavel=cliente
 *                OU tem fase aguardando_gatilho que depende de ação do cliente
 *   - 'empresa': tem fase em andamento com responsavel=empresa
 *   - 'concluido': todas fases concluídas
 *   - 'aguardando_inicio': cronograma criado mas não tem fase ativa ainda
 *
 * Após o fix do bug Esquadsystem (12/06/2026), fases aguardando_gatilho são
 * tratadas como fase ATUAL da obra (sem prazo, mas a obra ESTÁ nessa fase).
 * Isso garante que obra parada esperando cliente instalar contramarco apareça
 * em "Aguardando cliente" no Dashboard — não em "Em atraso".
 */
export function calcularDemandaAtual(cronograma: Cronograma | null): {
  demanda: DemandaAtual
  faseAtual: CronogramaFase | null
} {
  if (!cronograma) return { demanda: 'aguardando_inicio', faseAtual: null }
  if (!cronograma.aceitoEm) return { demanda: 'cliente', faseAtual: null }

  // Prioridade 1: fase em andamento explícita
  const faseEmAndamento = cronograma.fases.find((f) => f.status === 'em_andamento')
  if (faseEmAndamento) {
    return { demanda: faseEmAndamento.responsavel, faseAtual: faseEmAndamento }
  }

  // Prioridade 2: todas concluídas?
  const todasConcluidas =
    cronograma.fases.length > 0 && cronograma.fases.every((f) => f.status === 'concluida')
  if (todasConcluidas) return { demanda: 'concluido', faseAtual: null }

  // Prioridade 3: próxima fase aguardando gatilho — a obra está PARADA nela.
  // Determina a demanda pelo tipo do gatilho:
  //   - liberacao_vao → cliente (cliente que precisa liberar)
  //   - data_fixa → empresa (aguardando uma data, não ação do cliente)
  //   - fim_fase_anterior → não deveria estar aqui (anterior deveria ter concluído)
  //   - assinatura_contrato → cliente (mas isso já foi tratado pelo aceitoEm null)
  const proximaPendente = cronograma.fases.find((f) => f.status === 'aguardando_gatilho')
  if (proximaPendente) {
    if (proximaPendente.gatilhoTipo === 'liberacao_vao') {
      return { demanda: 'cliente', faseAtual: proximaPendente }
    }
    // Default: usa o responsável declarado da fase
    return { demanda: proximaPendente.responsavel, faseAtual: proximaPendente }
  }

  return { demanda: 'aguardando_inicio', faseAtual: null }
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
