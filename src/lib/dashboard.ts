// Service do Dashboard — agrega obras + cronogramas + cards pra visão consolidada.
//
// Cravado em 09/06/2026 após reunião Vilumi (Bruno levantou demanda
// crítica: "tenho 30 obras, preciso ver de cara o que tá atrasado, o que
// precisa atenção, sem entrar obra a obra").
//
// Estratégia V1: client-side aggregation. Faz N queries paralelas e agrega
// no front. Performance OK pra 30-50 obras. V2 considera Supabase view
// materializada se passar de 100 obras.

import { listarObras, listarCardsDaObra, type ObraRow } from './api'
import { listarChecklistsDeVariosCards } from './checklist'
import {
  pegarCronogramaPorObra,
  inferirStatusFases,
  calcularDiasRestantes,
  estaFaseAtrasada,
  calcularDemandaAtual,
} from './cronograma'
import type { Card } from '../types/obra'
import type { Cronograma, CronogramaFase, DemandaAtual } from '../types/cronograma'

// ============================================================
// TIPOS
// ============================================================

export interface ObraDashboard {
  obra: ObraRow
  cronograma: Cronograma | null
  faseAtiva: CronogramaFase | null
  demanda: DemandaAtual
  diasRestantes: number | null
  atrasada: boolean
  totalCards: number
  cardsConcluidos: number
  // Flags cravadas 12/06 (regra Thiago):
  // - kanban é a verdade primária do estado da obra, não o cronograma
  // - obras com cards na aba Cliente estão PAUSADAS (não atrasam, não vencem)
  // - obras com todos os cards concluídos somem do Dashboard atual
  temCardsCliente: boolean              // tem ao menos 1 card de peça na aba Cliente
  obraPausadaPorCliente: boolean        // MAIORIA dos cards está em aba Cliente (>50%) — obra pausada
  temCardsEmAndamento: boolean          // tem ao menos 1 card de peça na aba Em Andamento
  todosCardsConcluidos: boolean         // todos os cards de peça em Conclusão com aceite final OU encerrados
}

export interface MetricasDashboard {
  totalAtivas: number              // obras não encerradas e não finalizadas (todos cards concluídos)
  emAtraso: number                 // com pelo menos 1 fase atrasada (excluindo aguardando cliente)
  atencaoHoje: number              // fases vencendo nos próximos 3 dias (excluindo aguardando cliente)
  aguardandoCliente: number        // tem cards na aba Cliente
  noPrazo: number                  // tem cards em Em Andamento + prazo > 7 dias + saudável
  semCronograma: number            // obras sem cronograma ainda
}

export interface DashboardData {
  metricas: MetricasDashboard
  atrasadas: ObraDashboard[]       // top 5 ordenadas por dias de atraso (desc)
  proximas: ObraDashboard[]        // top 5 com fase vencendo em até 7 dias
  aguardandoCliente: ObraDashboard[] // top 5 com cards na aba Cliente
  noPrazo: ObraDashboard[]         // top 5 saudáveis (em produção, prazo > 7d)
  totalObras: number               // total geral (pra UI saber se tem mais)
}

// ============================================================
// AGREGAÇÃO PRINCIPAL
// ============================================================

/**
 * Carrega todas as obras + cronogramas + cards em paralelo e agrega métricas.
 *
 * Performance:
 *   - 1 query pra listar obras
 *   - N queries paralelas pra cada obra: cronograma + cards + checklists
 *   - Pra 30 obras: ~90 queries em paralelo, ~500-800ms total na Supabase
 *
 * Se virar gargalo (passar de 50 obras), V2 pode:
 *   - Criar view `dashboard_obras` no banco com tudo pré-agregado
 *   - Ou função RPC `pegar_dashboard()` que faz tudo num round-trip
 */
export async function pegarDashboard(): Promise<DashboardData> {
  const obras = await listarObras()

  // Carrega tudo de cada obra em paralelo (limite implícito do JS event loop)
  const obrasDashboard: ObraDashboard[] = await Promise.all(
    obras.map(async (obra) => {
      const [cronogramaRaw, cards] = await Promise.all([
        pegarCronogramaPorObra(obra.id),
        listarCardsDaObra(obra.id),
      ])

      // Converte CardRow (snake_case do banco) → Card (camelCase) com os
      // campos mínimos que inferirStatusFases() consome: tipo, encerrado,
      // checklists, aba, aceiteFinal. Histórico/fotos/etc não importam aqui.
      let cardsCompletos: Card[] = []
      if (cards.length > 0) {
        const checklistsPorCard = await listarChecklistsDeVariosCards(cards.map((c) => c.id))
        cardsCompletos = cards.map<Card>((c) => ({
          id: c.id,
          tipo: c.tipo,
          sigla: c.sigla,
          nome: c.nome,
          descricao: c.descricao ?? '',
          aba: c.aba,
          statusEmAndamento: c.status_em_andamento,
          subStatus: c.sub_status ?? null,
          prazoContrato: c.prazo_contrato,
          encerrado: c.encerrado,
          aceiteFinal: c.aceite_final_at,
          historico: [],
          fotos: [],
          checklists: checklistsPorCard[c.id] ?? [],
        }))
      }

      // Aplica inferência no cronograma (status + previsões)
      const cronograma = cronogramaRaw ? inferirStatusFases(cronogramaRaw, cardsCompletos) : null

      const { demanda, faseAtual } = calcularDemandaAtual(cronograma)

      const diasRestantes = faseAtual ? calcularDiasRestantes(faseAtual) : null
      const atrasada = faseAtual ? estaFaseAtrasada(faseAtual) : false

      // Flags do kanban (verdade primária da obra — cravado 12/06 por Thiago).
      // Cards do tipo 'item' / 'acordo' / 'apontamento' não entram no cálculo de estado.
      const cardsDePeca = cardsCompletos.filter((c) => c.tipo === 'peca')
      const cardsDePecaAtivos = cardsDePeca.filter((c) => !c.encerrado)

      const totalAtivos = cardsDePecaAtivos.length
      const totalEmCliente = cardsDePecaAtivos.filter((c) => c.aba === 'cliente').length
      const totalEmAndamento = cardsDePecaAtivos.filter((c) => c.aba === 'emandamento').length

      // Refinamento cravado em 12/06 por Thiago após teste com "Criando a Primeira Obra":
      // a regra anterior "qualquer card em Cliente = obra pausada" era agressiva demais.
      // Cenário: 1 card aguardando contramarco + 3 cards em produção → obra NÃO está
      // pausada como um todo, está em produção com 1 pendência específica.
      //
      // Nova regra: obra está pausada (Aguardando Cliente) só se MAIORIA dos cards
      // ativos está em aba Cliente (> 50%). Senão, obra reflete fase predominante.
      const temCardsCliente = totalEmCliente > 0
      const obraPausadaPorCliente =
        totalAtivos > 0 && totalEmCliente / totalAtivos > 0.5
      const temCardsEmAndamento = totalEmAndamento > 0

      // "Obra finalizada" considera TODOS os cards de peça (incluindo encerrados):
      // bug 12/06 Vidrobras tinha 1 card com encerrado=true + aba=conclusao + aceite_final
      // que era ignorado pelo filtro de ativos, fazendo a obra continuar em "Em atraso".
      // Cada card pode estar "finalizado" de 2 jeitos: em conclusão com aceite OU encerrado.
      const todosCardsConcluidos =
        cardsDePeca.length > 0 &&
        cardsDePeca.every((c) => (c.aba === 'conclusao' && !!c.aceiteFinal) || c.encerrado)

      const cardsConcluidos = cardsCompletos.filter(
        (c) => c.aba === 'conclusao' && !!c.aceiteFinal,
      ).length

      return {
        obra,
        cronograma,
        faseAtiva: faseAtual,
        demanda,
        diasRestantes,
        atrasada,
        totalCards: cardsCompletos.length,
        cardsConcluidos,
        temCardsCliente,
        obraPausadaPorCliente,
        temCardsEmAndamento,
        todosCardsConcluidos,
      }
    }),
  )

  // Filtra encerradas E finalizadas (todos cards concluídos somem do Dashboard
  // atual — decisão Thiago 12/06: dashboard atual é só pra obras abertas em
  // produção. Obras finalizadas terão painéis dedicados no avião-cabine V2).
  const ativas = obrasDashboard.filter(
    (o) => !o.obra.encerrada && !o.todosCardsConcluidos,
  )

  // ============== Métricas ==============
  // Regra refinada 12/06: obra está pausada (Aguardando Cliente) só se >50% dos
  // cards de peça estão em aba Cliente. Senão, obra reflete fase predominante e
  // entra normalmente em "Em atraso" / "Próximos" / "No prazo".
  const naoPausadas = ativas.filter((o) => !o.obraPausadaPorCliente)
  const metricas: MetricasDashboard = {
    totalAtivas: ativas.length,
    emAtraso: naoPausadas.filter((o) => o.atrasada).length,
    atencaoHoje: naoPausadas.filter(
      (o) => o.diasRestantes !== null && o.diasRestantes >= 0 && o.diasRestantes <= 3,
    ).length,
    aguardandoCliente: ativas.filter((o) => o.obraPausadaPorCliente).length,
    noPrazo: naoPausadas.filter(
      (o) =>
        o.temCardsEmAndamento &&
        !o.atrasada &&
        (o.diasRestantes === null || o.diasRestantes > 7),
    ).length,
    semCronograma: ativas.filter((o) => !o.cronograma).length,
  }

  // ============== Listas ranqueadas (top 5) ==============
  const atrasadas = naoPausadas
    .filter((o) => o.atrasada && o.diasRestantes !== null)
    .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0)) // mais negativo (mais atrasado) primeiro
    .slice(0, 5)

  const proximas = naoPausadas
    .filter(
      (o) => !o.atrasada && o.diasRestantes !== null && o.diasRestantes >= 0 && o.diasRestantes <= 7,
    )
    .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0))
    .slice(0, 5)

  const aguardandoCliente = ativas
    .filter((o) => o.obraPausadaPorCliente)
    .slice(0, 5)

  const noPrazo = naoPausadas
    .filter(
      (o) =>
        o.temCardsEmAndamento &&
        !o.atrasada &&
        (o.diasRestantes === null || o.diasRestantes > 7),
    )
    .sort((a, b) => (b.diasRestantes ?? 0) - (a.diasRestantes ?? 0)) // mais folga primeiro
    .slice(0, 5)

  return {
    metricas,
    atrasadas,
    proximas,
    aguardandoCliente,
    noPrazo,
    totalObras: ativas.length,
  }
}
