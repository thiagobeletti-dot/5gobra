import { useEffect, useState, useCallback, useRef } from 'react'
import type { Card, DadosObra, AbaId, TipoCard, AutorTipo } from '../types/obra'
import { SEED } from '../lib/seed'
import { supabaseConfigurado, supabase, type DbClient } from '../lib/supabase'
import {
  pegarObraPorId,
  pegarObraPorToken,
  listarCardsDaObra,
  criarCard,
  criarVariosCards,
  atualizarCard,
  adicionarHistorico,
  rowsParaDadosObra,
  type HistoricoRow,
  type ObraRow,
} from '../lib/api'
import { agora } from '../lib/helpers'
import type { ItemImportado } from '../lib/alumisoft'
import {
  listarAnexosDeVariosCards,
  uploadFoto,
  removerAnexo,
  type Anexo,
} from '../lib/anexos'
import {
  listarChecklistsDeVariosCards,
  salvarMedicao1,
  salvarMedicao2,
} from '../lib/checklist'
import type { Checklist, DadosMedicao1, DadosMedicao2 } from '../types/checklist'

const STORAGE_PREFIX = '5gobra:'

interface NovoCardInput {
  tipo: TipoCard
  sigla: string
  nome: string
  descricao: string
  destino: AbaId
  prazoContrato: string
}

interface UseObraDataResult {
  dados: DadosObra | null
  modo: 'demo' | 'banco'
  obraReal: ObraRow | null
  carregando: boolean
  /** True enquanto uma mutação async está em curso. UI usa pra desabilitar
   * botões. Ref-based pra ser pego sincronamente em handlers. */
  ocupado: boolean
  erro: string | null
  alterarStatus: (cardId: string, novoStatus: string) => Promise<void>
  registrar: (cardId: string, texto: string, perfil: 'empresa' | 'cliente', moveAba: boolean) => Promise<void>
  confirmarItem: (cardId: string) => Promise<void>
  marcarContraMarcoEntregue: (cardId: string) => Promise<void>
  marcarVaoPronto: (cardId: string, perfil: 'empresa' | 'cliente') => Promise<void>
  marcarApontamentoResolvido: (cardId: string, resolucao: string) => Promise<void>
  marcarApontamentoCiente: (cardId: string) => Promise<void>
  encerrarCard: (cardId: string, motivo: string) => Promise<void>
  apagarCard: (cardId: string) => Promise<void>
  marcarCorrigido: (cardId: string) => Promise<void>
  darAceite: (cardId: string) => Promise<void>
  reabrir: (cardId: string, texto: string, perfil: 'empresa' | 'cliente') => Promise<void>
  criarNovo: (input: NovoCardInput, perfil: 'empresa' | 'cliente') => Promise<AbaId>
  importarItens: (itens: ItemImportado[], perfil: 'empresa' | 'cliente') => Promise<number>
  adicionarFotos: (cardId: string, arquivos: File[]) => Promise<number>
  removerFoto: (cardId: string, fotoId: string) => Promise<void>
  salvarMedicao1Card: (cardId: string, dados: DadosMedicao1, autorNome: string) => Promise<Checklist>
  salvarMedicao2Card: (cardId: string, dados: DadosMedicao2, autorNome: string) => Promise<Checklist>
  resetar: () => void
}

function ehDemo(idOrToken: string) {
  return idOrToken === 'demo' || !supabaseConfigurado
}

function carregarDemo(idOrToken: string): DadosObra {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + idOrToken)
    if (raw) {
      const d = JSON.parse(raw)
      if (d?.obra && Array.isArray(d.cards)) {
        // Garante fotos: [] mesmo em dados antigos sem o campo
        d.cards = d.cards.map((c: any) => ({ ...c, fotos: c.fotos ?? [] }))
        return d
      }
    }
  } catch {}
  return structuredClone(SEED)
}

function salvarDemo(idOrToken: string, dados: DadosObra) {
  try { localStorage.setItem(STORAGE_PREFIX + idOrToken, JSON.stringify(dados)) } catch {}
}

async function carregarDoBanco(obraResolvida: ObraRow, client: DbClient | null = supabase): Promise<DadosObra> {
  const cardsRows = await listarCardsDaObra(obraResolvida.id, client)
  const histPorCard: Record<string, HistoricoRow[]> = {}
  let anexosPorCard: Record<string, Anexo[]> = {}
  let checklistsPorCard: Record<string, Checklist[]> = {}
  if (cardsRows.length > 0 && client) {
    const ids = cardsRows.map((c) => c.id)
    const { data: hists } = await client
      .from('historico_card')
      .select('*')
      .in('card_id', ids)
      .order('created_at', { ascending: true })
    for (const h of (hists ?? []) as HistoricoRow[]) {
      ;(histPorCard[h.card_id] ??= []).push(h)
    }
    anexosPorCard = await listarAnexosDeVariosCards(ids, client)
    try {
      checklistsPorCard = await listarChecklistsDeVariosCards(ids, client)
    } catch (e) {
      // Tabela checklists pode nao existir ainda em ambientes antigos. Toleramos.
      console.warn('Falha ao carregar checklists:', e)
    }
  }
  return rowsParaDadosObra(obraResolvida, cardsRows, histPorCard, anexosPorCard, checklistsPorCard)
}

/**
 * Recarrega apenas 1 card e seus dados auxiliares (historico, anexos, checklists),
 * mantendo os outros cards do state inalterados. Usado em mutações single-card
 * pra reduzir round-trips quando obra tem muitos cards.
 *
 * Audit Sprint B item top fix #1 (versão conservadora). Ganho proporcional ao
 * tamanho da obra: em obra com 50 cards, antes 4 queries traziam todo o histórico
 * de todos os cards; agora 4 queries trazem só os do card afetado.
 *
 * Se o card foi apagado (cardRow null), remove do state local.
 */
async function recarregarCard(
  obraResolvida: ObraRow,
  cardId: string,
  atual: DadosObra,
  client: DbClient | null = supabase,
): Promise<DadosObra> {
  if (!client) return atual
  const { data: cardRow, error } = await client
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .maybeSingle()
  if (error) throw error
  if (!cardRow) {
    return { ...atual, cards: atual.cards.filter((c) => c.id !== cardId) }
  }

  const histPorCard: Record<string, HistoricoRow[]> = {}
  const { data: hists } = await client
    .from('historico_card')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true })
  histPorCard[cardId] = (hists ?? []) as HistoricoRow[]

  const anexosPorCard = await listarAnexosDeVariosCards([cardId], client)
  let checklistsPorCard: Record<string, Checklist[]> = {}
  try {
    checklistsPorCard = await listarChecklistsDeVariosCards([cardId], client)
  } catch (e) {
    console.warn('Falha ao carregar checklists do card:', e)
  }

  // Reaproveita rowsParaDadosObra pra montar o card. Passamos só esse card —
  // o resultado terá apenas 1 card; pegamos ele e mergeamos no state existente.
  const reconstruido = rowsParaDadosObra(
    obraResolvida,
    [cardRow as any],
    histPorCard,
    anexosPorCard,
    checklistsPorCard,
  )
  const cardNovo = reconstruido.cards[0]
  if (!cardNovo) return atual
  return {
    ...atual,
    cards: atual.cards.map((c) => c.id === cardId ? cardNovo : c),
  }
}

export function useObraData(
  idOrToken: string,
  modoCarregamento: 'id' | 'token' = 'id',
  clientPublico: DbClient | null = null,
): UseObraDataResult {
  // Quando passado um client público (rotas /tec, /obra), usa ele em todas as
  // queries pra forçar contexto anon mesmo se o usuário tem sessão authenticated
  // ativa em outra aba do mesmo navegador.
  const client: DbClient | null = clientPublico ?? supabase
  const modo: 'demo' | 'banco' = ehDemo(idOrToken) ? 'demo' : 'banco'
  const [dados, setDados] = useState<DadosObra | null>(null)
  const [obraReal, setObraReal] = useState<ObraRow | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Ref espelha o ocupado pra detectar concorrencia em handlers sincronos.
  const ocupadoRef = useRef(false)

  /**
   * Wrap pra mutações: bloqueia chamadas concorrentes (anti duplo-clique) e
   * mantém o flag `ocupado` em sync. Cada mutação async passa pelo wrap.
   * Audit Sprint B item top fix #8.
   */
  const mutar = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (ocupadoRef.current) {
      console.warn('[useObraData] mutação ignorada — outra em curso')
      return undefined
    }
    ocupadoRef.current = true
    setOcupado(true)
    try {
      return await fn()
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    if (modo === 'demo') {
      setDados(carregarDemo(idOrToken))
      setObraReal(null)
      setCarregando(false)
      return
    }
    ;(async () => {
      try {
        const obra = modoCarregamento === 'token'
          ? await pegarObraPorToken(idOrToken, client)
          : await pegarObraPorId(idOrToken, client)
        if (!ativo) return
        if (!obra) {
          setErro('Obra nao encontrada')
          return
        }
        setObraReal(obra)
        const d = await carregarDoBanco(obra, client)
        if (!ativo) return
        setDados(d)
      } catch (e: any) {
        if (ativo) setErro(e?.message ?? 'Erro ao carregar obra')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [idOrToken, modo, modoCarregamento])

  useEffect(() => {
    if (modo === 'demo' && dados) salvarDemo(idOrToken, dados)
  }, [idOrToken, modo, dados])

  const alterarStatus = useCallback(async (cardId: string, novoStatus: string) => {
    if (!dados) return
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [...c.historico, { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Status: "' + (c.statusEmAndamento ?? '-') + '" -> "' + novoStatus + '".', interno: true }]
            if (novoStatus === 'Concluido' || novoStatus === 'Concluído') {
              hist.push({ autor: 'Sistema', tipo: 'sistema', data: agora(), texto: 'Item concluído. Movido para aba Conclusão. Aguardando aceite do cliente.', interno: false })
              return { ...c, statusEmAndamento: novoStatus, aba: 'conclusao' as AbaId, subStatus: 'Aguardando aceite final', historico: hist }
            }
            return { ...c, statusEmAndamento: novoStatus, historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    const card = dados.cards.find((c) => c.id === cardId)
    if (!card) return
    const updates: any = { status_em_andamento: novoStatus }
    if (novoStatus === 'Concluido' || novoStatus === 'Concluído') {
      updates.aba = 'conclusao'
      updates.sub_status = 'Aguardando aceite final'
    }
    await atualizarCard(cardId, updates, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Status: "' + (card.statusEmAndamento ?? '-') + '" -> "' + novoStatus + '".', interno: true }, client)
    if (novoStatus === 'Concluido' || novoStatus === 'Concluído') {
      await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Item concluído. Movido para aba Conclusão. Aguardando aceite do cliente.' }, client)
    }
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Quando empresa move card pra cliente, traduz sub-status interno em algo amigável.
  // Mantém nulo se a empresa só quer comunicar e não tem ação esperada do cliente.
  function traduzirSubStatusParaCliente(atual: string | null): string | null {
    if (!atual) return null
    if (atual.includes('Vão não pronto') && atual.includes('comunicar')) return 'Aguardando finalizar vão'
    if (atual.includes('Vão M2 reprovado') && atual.includes('comunicar')) return 'Aguardando finalizar vão'
    if (atual === 'Tipologia não executável') return null
    return atual // sub-status já amigável, mantém
  }

  const registrar = useCallback(async (cardId: string, texto: string, perfil: 'empresa' | 'cliente', moveAba: boolean) => {
    if (!dados || !texto.trim()) return
    // Anti duplo-clique: se outra mutação está rodando, ignora.
    if (ocupadoRef.current) { console.warn('[registrar] ignorada — outra mutação em curso'); return }
    ocupadoRef.current = true
    setOcupado(true)
    const autor = perfil === 'empresa' ? 'Empresa' : 'Cliente'
    try {
      if (modo === 'demo') {
        setDados((d) => {
          if (!d) return d
          return {
            ...d,
            cards: d.cards.map((c) => {
              if (c.id !== cardId) return c
              const hist = [...c.historico, { autor, tipo: perfil as AutorTipo, data: agora(), texto, interno: false }]
              let novaAba = c.aba
              let novoSubStatus = c.subStatus
              if (moveAba) {
                if (c.aba === 'emandamento') novaAba = perfil === 'empresa' ? 'cliente' : 'empresa'
                else if (c.aba === 'cliente') novaAba = 'empresa'
                else if (c.aba === 'empresa') novaAba = 'cliente'
                hist.push({ autor: 'Sistema', tipo: 'sistema', data: agora(), texto: 'Movido para aba ' + (novaAba === 'cliente' ? 'Cliente' : novaAba === 'empresa' ? 'Empresa' : novaAba) + '.', interno: true })
                // Se empresa move pra cliente e tem sub-status interno, traduz
                if (perfil === 'empresa' && novaAba === 'cliente') {
                  novoSubStatus = traduzirSubStatusParaCliente(c.subStatus)
                }
              }
              return { ...c, aba: novaAba, subStatus: novoSubStatus, historico: hist }
            }),
          }
        })
        return
      }
      if (!obraReal) return
      const card = dados.cards.find((c) => c.id === cardId)
      if (!card) return
      await adicionarHistorico({ card_id: cardId, autor, autor_tipo: perfil, texto }, client)
      if (moveAba) {
        let novaAba: AbaId = card.aba
        if (card.aba === 'emandamento') novaAba = perfil === 'empresa' ? 'cliente' : 'empresa'
        else if (card.aba === 'cliente') novaAba = 'empresa'
        else if (card.aba === 'empresa') novaAba = 'cliente'
        if (novaAba !== card.aba) {
          const updates: any = { aba: novaAba }
          // Quando empresa empurra pro cliente, traduz sub-status interno em algo amigável
          if (perfil === 'empresa' && novaAba === 'cliente') {
            updates.sub_status = traduzirSubStatusParaCliente(card.subStatus)
          }
          await atualizarCard(cardId, updates, client)
          await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Movido para aba ' + (novaAba === 'cliente' ? 'Cliente' : 'Empresa') + '.', interno: true }, client)
        }
      }
      // Patch otimista: recarregar só o card afetado, em vez de a obra inteira.
      const novo = dados
        ? await recarregarCard(obraReal, cardId, dados)
        : await carregarDoBanco(obraReal)
      setDados(novo)
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }, [dados, modo, obraReal])

  // Cliente confirma item — fluxo varia por tipo:
  //  - peca: vai pra aba Técnica esperando visita técnica (M1)
  //  - acordo: vai direto pra Conclusão como encerrado (acordo aceito = fim)
  //  - reclamacao (apontamento): não usa esse fluxo (cliente não "confirma" apontamento)
  const confirmarItem = useCallback(async (cardId: string) => {
    if (!dados) return
    const card = dados.cards.find((c) => c.id === cardId)
    if (!card) return

    if (card.tipo === 'acordo') {
      // Acordo aceito → vai pra Conclusão encerrado
      const texto = 'Acordo aceito pelo cliente. Registrado oficialmente.'
      if (modo === 'demo') {
        setDados((d) => {
          if (!d) return d
          return {
            ...d,
            cards: d.cards.map((c) => {
              if (c.id !== cardId) return c
              const hist = [
                ...c.historico,
                { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: agora(), texto, interno: false },
                { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Acordo encerrado. Registro permanente na obra.', interno: false },
              ]
              return { ...c, aba: 'conclusao' as AbaId, encerrado: true, subStatus: 'Acordo aceito', historico: hist }
            }),
          }
        })
        return
      }
      if (!obraReal) return
      await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto }, client)
      await atualizarCard(cardId, { aba: 'conclusao', encerrado: true, sub_status: 'Acordo aceito' }, client)
      await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Acordo encerrado. Registro permanente na obra.', interno: false }, client)
      const novo = dados
        ? await recarregarCard(obraReal, cardId, dados)
        : await carregarDoBanco(obraReal)
      setDados(novo)
      return
    }

    // Default: peça vai pra Técnica
    const texto = 'Cliente confirmou o item. Aguardando visita técnica para medição.'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: agora(), texto, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Card movido para aba Técnica. Empresa precisa agendar visita técnica para Medição 1.', interno: true },
            ]
            return { ...c, aba: 'tecnica' as AbaId, subStatus: 'Aguardando visita técnica', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto }, client)
    await atualizarCard(cardId, { aba: 'tecnica', sub_status: 'Aguardando visita técnica' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card movido para aba Técnica. Empresa precisa agendar visita técnica para Medição 1.', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Empresa marca contra-marco entregue em obra — card vai pro Cliente esperando ele instalar.
  const marcarContraMarcoEntregue = useCallback(async (cardId: string) => {
    if (!dados) return
    const textoMsg = 'Contra-marco entregue em obra. Aguardamos você instalar e deixar o vão pronto pra próxima visita técnica.'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Empresa', tipo: 'empresa' as AutorTipo, data: agora(), texto: textoMsg, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Contra-marco entregue. Card movido para o Cliente.', interno: true },
            ]
            return { ...c, aba: 'cliente' as AbaId, subStatus: 'Aguardando instalação do contra-marco e vão pronto', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Empresa', autor_tipo: 'empresa', texto: textoMsg }, client)
    await atualizarCard(cardId, { aba: 'cliente', sub_status: 'Aguardando instalação do contra-marco e vão pronto' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Contra-marco entregue. Card movido para o Cliente.', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Cliente (ou empresa em nome do cliente) marca vão como pronto — card vai pra Técnica esperando M2.
  const marcarVaoPronto = useCallback(async (cardId: string, perfil: 'empresa' | 'cliente') => {
    if (!dados) return
    const card = dados.cards.find((c) => c.id === cardId)
    if (!card) return
    // Texto adapta ao contexto: contra-marco instalado vs vão finalizado
    const tinhaContraMarco = card.subStatus?.toLowerCase().includes('contra-marco')
    const textoMsg = tinhaContraMarco
      ? 'Contra-marco instalado e vão pronto. Aguardando 2ª medição (M2).'
      : 'Vão finalizado, pronto pra 2ª medição (M2).'
    const autor = perfil === 'empresa' ? 'Empresa' : 'Cliente'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor, tipo: perfil as AutorTipo, data: agora(), texto: textoMsg, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Card movido para aba Técnica. Empresa precisa agendar visita para Medição 2.', interno: true },
            ]
            return { ...c, aba: 'tecnica' as AbaId, subStatus: 'Aguardando 2ª medição (M2)', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor, autor_tipo: perfil, texto: textoMsg }, client)
    await atualizarCard(cardId, { aba: 'tecnica', sub_status: 'Aguardando 2ª medição (M2)' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card movido para aba Técnica. Empresa precisa agendar visita para Medição 2.', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Empresa marca apontamento como resolvido — vai pra Conclusão encerrado.
  // Diferente de encerrarCard porque o "espírito" é positivo (problema atendido), não cancelamento.
  const marcarApontamentoResolvido = useCallback(async (cardId: string, resolucao: string) => {
    if (!dados) return
    const detalhe = resolucao.trim() || '(sem detalhes da resolução)'
    const textoCliente = 'Apontamento resolvido pela empresa. Detalhe: ' + detalhe
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Empresa', tipo: 'empresa' as AutorTipo, data: agora(), texto: textoCliente, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Apontamento resolvido. Card encerrado.', interno: true },
            ]
            return { ...c, aba: 'conclusao' as AbaId, encerrado: true, subStatus: 'Apontamento resolvido', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Empresa', autor_tipo: 'empresa', texto: textoCliente }, client)
    await atualizarCard(cardId, { aba: 'conclusao', encerrado: true, sub_status: 'Apontamento resolvido' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Apontamento resolvido. Card encerrado.', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Cliente fica ciente do apontamento — encerra como informativo (sem necessidade de empresa resolver).
  // Útil quando apontamento foi feito pela empresa (ex: "fui à obra e estava trancada") e cliente só precisa confirmar leitura.
  const marcarApontamentoCiente = useCallback(async (cardId: string) => {
    if (!dados) return
    const textoCliente = 'Cliente ficou ciente do apontamento.'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: agora(), texto: textoCliente, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Apontamento encerrado pelo cliente (ciente).', interno: true },
            ]
            return { ...c, aba: 'conclusao' as AbaId, encerrado: true, subStatus: 'Apontamento encerrado', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto: textoCliente }, client)
    await atualizarCard(cardId, { aba: 'conclusao', encerrado: true, sub_status: 'Apontamento encerrado' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Apontamento encerrado pelo cliente (ciente).', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Empresa apaga card de verdade (delete no banco). Use só pra cards criados por engano.
  // Cascade no banco apaga histórico/anexos/checklists junto.
  // Diferente de encerrarCard: apagar NÃO deixa rastro pro cliente; é destrutivo.
  const apagarCard = useCallback(async (cardId: string) => {
    if (!dados) return
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return { ...d, cards: d.cards.filter((c) => c.id !== cardId) }
      })
      return
    }
    if (!obraReal || !client) return
    const { error } = await client.from('cards').delete().eq('id', cardId)
    if (error) throw error
    // recarregarCard detecta cardRow null (card apagado) e remove do state local.
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Empresa encerra/cancela card (ex: tipologia mudou, item descontinuado, divergência grande).
  // Card vai pra Conclusão com encerrado=true. Registro do motivo aparece pro cliente.
  const encerrarCard = useCallback(async (cardId: string, motivo: string) => {
    if (!dados) return
    const motivoLimpo = motivo.trim() || '(sem motivo informado)'
    const textoCliente = 'Item encerrado pela empresa. Motivo: ' + motivoLimpo
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Empresa', tipo: 'empresa' as AutorTipo, data: agora(), texto: textoCliente, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Card encerrado pela empresa. Removido do fluxo ativo.', interno: true },
            ]
            return { ...c, encerrado: true, aba: 'conclusao' as AbaId, subStatus: 'Encerrado pela empresa', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Empresa', autor_tipo: 'empresa', texto: textoCliente }, client)
    await atualizarCard(cardId, { encerrado: true, aba: 'conclusao', sub_status: 'Encerrado pela empresa' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card encerrado pela empresa. Removido do fluxo ativo.', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  const darAceite = useCallback(async (cardId: string) => {
    if (!dados) return
    // Guard: se ja deu aceite antes, nao gera duplicata. Audit Sprint A item L1.
    const cardAtual = dados.cards.find((c) => c.id === cardId)
    if (cardAtual?.aceiteFinal) {
      console.warn('[darAceite] aceite ja registrado em', cardAtual.aceiteFinal, '— ignorando duplo clique')
      return
    }
    const quando = agora()
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: quando, texto: 'Aceite final confirmado. Item oficialmente entregue e garantia iniciada.', interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: quando, texto: 'Card encerrado. Inicio de garantia registrado.', interno: false },
            ]
            return { ...c, aceiteFinal: quando, encerrado: true, subStatus: 'Aceite confirmado — garantia iniciada', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await atualizarCard(cardId, {
      aceite_final_at: new Date().toISOString(),
      aceite_final_user_agent: navigator.userAgent,
      encerrado: true,
      sub_status: 'Aceite confirmado — garantia iniciada',
    }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto: 'Aceite final confirmado. Item oficialmente entregue e garantia iniciada.' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card encerrado. Inicio de garantia registrado.' }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  const reabrir = useCallback(async (cardId: string, texto: string, perfil: 'empresa' | 'cliente') => {
    if (!dados || !texto.trim()) return
    // Guard: card encerrado nao pode ser reaberto pelo fluxo normal — precisa
    // passar por desencerramento explicito. Audit Sprint A item L4.
    const cardAtual = dados.cards.find((c) => c.id === cardId)
    if (cardAtual?.encerrado) {
      console.warn('[reabrir] card encerrado, reabertura bloqueada')
      return
    }
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: agora(), texto, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Cliente identificou problema. Card reaberto e enviado para Empresa.', interno: true },
            ]
            return { ...c, aba: 'empresa' as AbaId, subStatus: 'Reaberto pelo cliente — aguardando correção', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: perfil, texto }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Cliente identificou problema. Card reaberto e enviado para Empresa.', interno: true }, client)
    await atualizarCard(cardId, { aba: 'empresa', sub_status: 'Reaberto pelo cliente — aguardando correção' }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Empresa marca corrigido depois de receber card reaberto pelo cliente.
  // Volta pra Conclusão esperando aceite final.
  const marcarCorrigido = useCallback(async (cardId: string) => {
    if (!dados) return
    const textoMsg = 'Empresa corrigiu o problema apontado. Item disponível para novo aceite.'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Empresa', tipo: 'empresa' as AutorTipo, data: agora(), texto: textoMsg, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Card devolvido pra Conclusão. Aguardando aceite do cliente.', interno: true },
            ]
            return { ...c, aba: 'conclusao' as AbaId, subStatus: 'Aguardando aceite final', historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Empresa', autor_tipo: 'empresa', texto: textoMsg }, client)
    await atualizarCard(cardId, { aba: 'conclusao', sub_status: 'Aguardando aceite final' }, client)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card devolvido pra Conclusão. Aguardando aceite do cliente.', interno: true }, client)
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
  }, [dados, modo, obraReal])

  const criarNovo = useCallback(async (input: NovoCardInput, perfil: 'empresa' | 'cliente'): Promise<AbaId> => {
    const autor = perfil === 'empresa' ? 'Empresa' : 'Cliente'
    if (modo === 'demo') {
      const novo: Card = {
        id: 'c_' + Date.now(),
        tipo: input.tipo,
        sigla: input.sigla.toUpperCase(),
        nome: input.nome,
        descricao: input.descricao,
        aba: input.destino,
        statusEmAndamento: input.destino === 'emandamento' ? 'Aguardando lote' : null,
        subStatus: null,
        prazoContrato: input.destino === 'emandamento' ? input.prazoContrato : null,
        encerrado: false,
        aceiteFinal: null,
        historico: [{ autor, tipo: perfil as AutorTipo, data: agora(), texto: 'Registro criado.', interno: false }],
        fotos: [],
        checklists: [],
      }
      setDados((d) => d ? ({ ...d, cards: [...d.cards, novo] }) : d)
      return input.destino
    }
    if (!obraReal) throw new Error('Obra nao carregada')
    const cardRow = await criarCard({
      obra_id: obraReal.id,
      tipo: input.tipo,
      sigla: input.sigla.toUpperCase(),
      nome: input.nome,
      descricao: input.descricao,
      aba: input.destino,
      status_em_andamento: input.destino === 'emandamento' ? 'Aguardando lote' : null,
      prazo_contrato: input.destino === 'emandamento' ? input.prazoContrato : null,
    }, client)
    await adicionarHistorico({ card_id: cardRow.id, autor, autor_tipo: perfil, texto: 'Registro criado.' }, client)
    const novo = await carregarDoBanco(obraReal, client)
    setDados(novo)
    return input.destino
  }, [modo, obraReal])

  const importarItens = useCallback(async (itens: ItemImportado[], perfil: 'empresa' | 'cliente'): Promise<number> => {
    if (itens.length === 0) return 0
    const autor = perfil === 'empresa' ? 'Empresa' : 'Cliente'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        const novosCards: Card[] = itens.map((it, i) => ({
          id: 'c_' + Date.now() + '_' + i,
          tipo: it.tipo,
          sigla: it.sigla.toUpperCase(),
          nome: it.nome,
          descricao: it.descricao,
          aba: 'cliente' as AbaId,
          statusEmAndamento: null,
          subStatus: null,
          prazoContrato: null,
          encerrado: false,
          aceiteFinal: null,
          historico: [{ autor, tipo: perfil as AutorTipo, data: agora(), texto: 'Item importado do Alumisoft (origem: ' + it.origemTipologia + ').', interno: false }],
          fotos: [],
          checklists: [],
        }))
        return { ...d, cards: [...d.cards, ...novosCards] }
      })
      return itens.length
    }
    if (!obraReal) throw new Error('Obra nao carregada')
    const linhas = itens.map((it) => ({
      obra_id: obraReal.id,
      tipo: it.tipo,
      sigla: it.sigla.toUpperCase(),
      nome: it.nome,
      descricao: it.descricao,
      aba: 'cliente' as AbaId,
      status_em_andamento: null,
      prazo_contrato: null,
    }))
    const criados = await criarVariosCards(linhas, client)
    await Promise.all(criados.map((c, idx) =>
      adicionarHistorico({
        card_id: c.id,
        autor,
        autor_tipo: perfil,
        texto: 'Item importado do Alumisoft (origem: ' + itens[idx].origemTipologia + ').',
      }, client)
    ))
    const novo = await carregarDoBanco(obraReal, client)
    setDados(novo)
    return criados.length
  }, [modo, obraReal])

  const adicionarFotos = useCallback(async (cardId: string, arquivos: File[]): Promise<number> => {
    if (arquivos.length === 0) return 0
    if (modo === 'demo' || !obraReal) {
      throw new Error('Upload de fotos disponivel so com Supabase conectado')
    }
    let count = 0
    for (const arquivo of arquivos) {
      await uploadFoto({ arquivo, obraId: obraReal.id, cardId }, client)
      count++
    }
    const novo = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(novo)
    return count
  }, [dados, modo, obraReal])

  const removerFoto = useCallback(async (cardId: string, fotoId: string): Promise<void> => {
    if (modo === 'demo' || !obraReal || !client) {
      throw new Error('Operacao disponivel so com Supabase conectado')
    }
    const { data, error } = await client
      .from('anexos')
      .select('*')
      .eq('id', fotoId)
      .single()
    if (error) throw error
    if (!data) return
    const anexo: Anexo = {
      id: data.id,
      card_id: data.card_id,
      historico_id: data.historico_id ?? null,
      storage_path: data.storage_path,
      url: '',
      nome_arquivo: data.nome_arquivo ?? null,
      tamanho_bytes: data.tamanho_bytes ?? null,
      content_type: data.content_type ?? null,
      created_at: data.created_at,
    }
    await removerAnexo(anexo, client)
    setDados((d) => {
      if (!d) return d
      return {
        ...d,
        cards: d.cards.map((c) => c.id === cardId ? { ...c, fotos: c.fotos.filter((f) => f.id !== fotoId) } : c),
      }
    })
  }, [modo, obraReal])

  const salvarMedicao1Card = useCallback(async (cardId: string, dadosForm: DadosMedicao1, autorNome: string): Promise<Checklist> => {
    if (modo === 'demo' || !obraReal) {
      throw new Error('Checklist técnico disponível só com Supabase conectado')
    }
    // Guard: cards finalizados (com aceite ou em Conclusão) não devem ser
    // movidos automaticamente. Apenas grava o checklist sem mexer na aba.
    // Audit Sprint A item L3.
    const cardAtual = dados?.cards.find((c) => c.id === cardId)
    const cardJaFinalizado = !!cardAtual && (!!cardAtual.aceiteFinal || cardAtual.aba === 'conclusao' || cardAtual.encerrado)

    const novo = await salvarMedicao1({
      cardId,
      dados: dadosForm,
      autor: autorNome || 'Empresa',
      autorTipo: 'empresa',
    }, client)

    // Auto-move pós-M1 — decide pra qual aba o card vai e qual sub-status setar
    let novaAba: AbaId | null = null
    let novoSubStatus: string | null = null
    let mensagemHistorico = 'Medição 1 preenchida.'

    if (dadosForm.tipologia_executavel === 'nao') {
      // Regra 1: tipologia não executável → volta pra empresa decidir
      const motivo = dadosForm.tipologia_problema.trim() || '(sem detalhes)'
      novaAba = 'empresa'
      novoSubStatus = 'Tipologia não executável'
      mensagemHistorico = '⚠ TIPOLOGIA NÃO EXECUTÁVEL. Motivo: ' + motivo + '. Card devolvido pra empresa avaliar.'
    } else if (dadosForm.contra_marco === 'sim') {
      // Regra 2: com contra-marco → fica na empresa fabricar contra-marco
      novaAba = 'empresa'
      novoSubStatus = 'Fabricando contra-marco'
      mensagemHistorico = 'Medição 1 preenchida. Decisão: COM contra-marco. Empresa vai fabricar e entregar contra-marco em obra.'
    } else if (dadosForm.contra_marco === 'nao') {
      // Regra 3 ou 4: sem contra-marco — depende do estado do vão
      if (dadosForm.vao_pronto === 'sim') {
        // Regra 4: vão pronto → vai produzir
        novaAba = 'emandamento'
        novoSubStatus = 'Aguardando lote'
        mensagemHistorico = 'Medição 1 preenchida. Decisão: SEM contra-marco, vão pronto. Card movido para Em Andamento aguardando lote de produção.'
      } else if (dadosForm.vao_pronto === 'nao') {
        // Regra 3: vão precisa correção → vai DIRETO pro cliente ajustar.
        // Decisão de produto (10/05/2026): cliente vê o registro técnico cru,
        // sem etapa intermediária da empresa redigir orientação. Sub-status
        // amigável + registro como público (interno: false).
        novaAba = 'cliente'
        novoSubStatus = 'Aguardando ajustar o vão'
        const pendencias = dadosForm.precisa_correcao.trim() || '(sem detalhes)'
        mensagemHistorico = 'Medição 1 preenchida. Decisão: SEM contra-marco, vão NÃO está pronto. Pendências apontadas pelo técnico: ' + pendencias
      }
    }

    // Aplica a movimentação no banco — exceto se o card ja estava finalizado.
    // Cards com aceite/encerrados nao devem voltar pro fluxo ativo via M1.
    if (novaAba !== null && !cardJaFinalizado) {
      try {
        const updates: any = { aba: novaAba, sub_status: novoSubStatus }
        if (novaAba === 'emandamento') {
          updates.status_em_andamento = 'Aguardando lote'
        }
        await atualizarCard(cardId, updates, client)
      } catch (e) {
        console.warn('Falha ao mover card pós-M1:', e)
      }
    } else if (cardJaFinalizado) {
      console.warn('[salvarMedicao1Card] card ja finalizado, M1 gravada mas sem mover de aba')
    }

    // Quando card vai pra Cliente (vão não pronto), o registro técnico vai como
    // público pra cliente ler as pendências cruas. Em outros cenários
    // (M1 OK, contra-marco SIM, tipologia não executável) fica interno.
    const registroPublicoM1 = novaAba === 'cliente'
    try {
      await adicionarHistorico({
        card_id: cardId,
        autor: autorNome || 'Empresa',
        autor_tipo: 'empresa',
        texto: mensagemHistorico,
        interno: !registroPublicoM1,
      }, client)
      // Registro público amigável quando card vai pra Em Andamento (cliente entende o pulo)
      if (novaAba === 'emandamento') {
        await adicionarHistorico({
          card_id: cardId,
          autor: autorNome || 'Empresa',
          autor_tipo: 'empresa',
          texto: 'Visita técnica realizada. Vão está pronto. Item aprovado para produção.',
          interno: false,
        }, client)
      }
    } catch {}

    const dd = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(dd)
    return novo
  }, [dados, modo, obraReal])

  const salvarMedicao2Card = useCallback(async (cardId: string, dadosForm: DadosMedicao2, autorNome: string): Promise<Checklist> => {
    if (modo === 'demo' || !obraReal) {
      throw new Error('Checklist técnico disponível só com Supabase conectado')
    }
    const novo = await salvarMedicao2({
      cardId,
      dados: dadosForm,
      autor: autorNome || 'Empresa',
      autorTipo: 'empresa',
    }, client)

    // Auto-move pós-M2
    let novaAba: AbaId | null = null
    let novoSubStatus: string | null = null
    let mensagemHistoricoInterno = 'Medição 2 preenchida.'
    let mensagemHistoricoPublico: string | null = null

    if (dadosForm.liberado_producao === 'sim') {
      novaAba = 'emandamento'
      novoSubStatus = 'Aguardando lote'
      mensagemHistoricoInterno = 'Medição 2 preenchida. Vão liberado. Card movido para Em Andamento aguardando lote. Medida final: ' + dadosForm.medida_largura + ' x ' + dadosForm.medida_altura
      mensagemHistoricoPublico = '2ª medição realizada. Vão está pronto. Item aprovado e aguardando lote de produção.'
    } else if (dadosForm.liberado_producao === 'nao') {
      novaAba = 'empresa'
      novoSubStatus = 'Vão M2 reprovado — comunicar cliente'
      const pendencias = dadosForm.pendencias.trim() || '(sem detalhes)'
      mensagemHistoricoInterno = 'Medição 2 preenchida. Vão NÃO liberado. Pendências para empresa orientar cliente: ' + pendencias
    }

    if (novaAba !== null) {
      try {
        const updates: any = { aba: novaAba, sub_status: novoSubStatus }
        if (novaAba === 'emandamento') {
          updates.status_em_andamento = 'Aguardando lote'
        }
        await atualizarCard(cardId, updates, client)
      } catch (e) {
        console.warn('Falha ao mover card pós-M2:', e)
      }
    }

    try {
      // Registro técnico interno (cliente não vê o detalhe cru)
      await adicionarHistorico({
        card_id: cardId,
        autor: autorNome || 'Empresa',
        autor_tipo: 'empresa',
        texto: mensagemHistoricoInterno,
        interno: true,
      }, client)
      // Registro público quando vai pra produção
      if (mensagemHistoricoPublico) {
        await adicionarHistorico({
          card_id: cardId,
          autor: autorNome || 'Empresa',
          autor_tipo: 'empresa',
          texto: mensagemHistoricoPublico,
          interno: false,
        }, client)
      }
    } catch {}

    const dd = dados
      ? await recarregarCard(obraReal, cardId, dados, client)
      : await carregarDoBanco(obraReal, client)
    setDados(dd)
    return novo
  }, [dados, modo, obraReal])

  const resetar = useCallback(() => {
    if (modo !== 'demo') return
    localStorage.removeItem(STORAGE_PREFIX + idOrToken)
    setDados(structuredClone(SEED))
  }, [modo, idOrToken])

  return { dados, modo, obraReal, carregando, ocupado, erro, alterarStatus, registrar, confirmarItem, marcarContraMarcoEntregue, marcarVaoPronto, marcarApontamentoResolvido, marcarApontamentoCiente, encerrarCard, apagarCard, marcarCorrigido, darAceite, reabrir, criarNovo, importarItens, adicionarFotos, removerFoto, salvarMedicao1Card, salvarMedicao2Card, resetar }
}
