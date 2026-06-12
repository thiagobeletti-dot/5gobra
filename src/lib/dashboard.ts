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
  calcularDemandaAtual,
  calcularDiasRestantes,
  estaFaseAtrasada,
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
  temCardsCliente: boolean
  obraPausadaPorCliente: boolean
  temCardsEmAndamento: boolean
  todosCardsConcluidos: boolean
}

export interface MetricasDashboard {
  totalAtivas: number
  emAtraso: number
  atencaoHoje: number
  aguardandoCliente: number
  noPrazo: number
  semCronograma: number
}

export interface DashboardData {
  metricas: MetricasDashboard
  atrasadas: ObraDashboard[]
  proximas: ObraDashboard[]
  aguardandoCliente: ObraDashboard[]
  noPrazo: ObraDashboard[]
  totalObras: number
}

export async function pegarDashboard(): Promise<DashboardData> {
  const obras = await listarObras()

  const obrasDashboard: ObraDashboard[] = await Promise.all(
    obras.map(async (obra) => {
      const [cronogramaRaw, cards] = await Promise.all([
        pegarCronogramaPorObra(obra.id),
        listarCardsDaObra(obra.id),
      ])

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
          prazoIniciadoEm: (c as any).prazo_iniciado_em ?? null,
          encerrado: c.encerrado,
          aceiteFinal: c.aceite_final_at,
          historico: [],
          fotos: [],
          checklists: checklistsPorCard[c.id] ?? [],
        }))
      }

      const cronograma = cronogramaRaw ? inferirStatusFases(cronogramaRaw, cardsCompletos) : null
      const { demanda, faseAtual } = calcularDemandaAtual(cronograma)

      const cardsDePeca = cardsCompletos.filter((c) => c.tipo === 'peca')
      const cardsDePecaAtivos = cardsDePeca.filter((c) => !c.encerrado)
      const totalEmAndamento = cardsDePecaAtivos.filter((c) => c.aba === 'emandamento').length

      // Regra cravada por Thiago 12/06: OBRA PAUSADA = qualquer card de peça
      // na aba Cliente. Confirmar item / instalar contramarco / regularizar vão
      // pausa o prazo da obra inteira.
      const temCardsCliente = cardsDePecaAtivos.some((c) => c.aba === 'cliente')
      const obraPausadaPorCliente = temCardsCliente
      const temCardsEmAndamento = totalEmAndamento > 0

      // Classifica obra pelos prazos INDIVIDUAIS dos cards (cravado 12/06):
      // só conta atraso de cards com prazo_iniciado_em preenchido.
      const hojeISO = new Date().toISOString().slice(0, 10)
      const cardsComPrazoAtivo = cardsDePecaAtivos.filter(
        (c) => !!c.prazoIniciadoEm && !!c.prazoContrato,
      )
      const diasAteFim = (dataISO: string) => {
        const fim = new Date(dataISO + 'T00:00:00').getTime()
        const hoje = new Date(hojeISO + 'T00:00:00').getTime()
        return Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
      }
      const cardsAtrasados = cardsComPrazoAtivo.filter(
        (c) => diasAteFim(c.prazoContrato!) < 0,
      )
      const piorPrazoDias =
        cardsComPrazoAtivo.length > 0
          ? Math.min(...cardsComPrazoAtivo.map((c) => diasAteFim(c.prazoContrato!)))
          : null

      const todosCardsConcluidos =
        cardsDePeca.length > 0 &&
        cardsDePeca.every((c) => (c.aba === 'conclusao' && !!c.aceiteFinal) || c.encerrado)

      const cardsConcluidos = cardsCompletos.filter(
        (c) => c.aba === 'conclusao' && !!c.aceiteFinal,
      ).length

      // Cravado 12/06 por Thiago: prazo da FASE do cronograma é a verdade base.
      // Se há cards com prazo individual ativo (popup SIM), usa o pior deles
      // como override (cards atrasados levam a obra pra Em Atraso).
      const diasFase = faseAtual ? calcularDiasRestantes(faseAtual) : null
      const faseAtrasada = faseAtual ? estaFaseAtrasada(faseAtual) : false
      const diasRestantes = piorPrazoDias !== null ? piorPrazoDias : diasFase
      const atrasada =
        !obraPausadaPorCliente && (cardsAtrasados.length > 0 || faseAtrasada)

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

  const ativas = obrasDashboard.filter(
    (o) => !o.obra.encerrada && !o.todosCardsConcluidos,
  )

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

  const atrasadas = naoPausadas
    .filter((o) => o.atrasada && o.diasRestantes !== null)
    .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0))
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
    .sort((a, b) => (b.diasRestantes ?? 0) - (a.diasRestantes ?? 0))
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
