import { useEffect, useState, useCallback } from 'react'
import type { Card, DadosObra, AbaId, TipoCard, AutorTipo } from '../types/obra'
import { SEED } from '../lib/seed'
import { supabaseConfigurado } from '../lib/supabase'
import {
  pegarObraPorId,
  listarCardsDaObra,
  criarCard,
  atualizarCard,
  adicionarHistorico,
  rowsParaDadosObra,
  type HistoricoRow,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { agora } from '../lib/helpers'

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
  carregando: boolean
  erro: string | null
  alterarStatus: (cardId: string, novoStatus: string) => Promise<void>
  registrar: (cardId: string, texto: string, perfil: 'empresa' | 'cliente', moveAba: boolean) => Promise<void>
  darAceite: (cardId: string) => Promise<void>
  reabrir: (cardId: string, texto: string, perfil: 'empresa' | 'cliente') => Promise<void>
  criarNovo: (input: NovoCardInput, perfil: 'empresa' | 'cliente') => Promise<AbaId>
  resetar: () => void
}

function ehDemo(obraId: string) {
  return obraId === 'demo' || !supabaseConfigurado
}

// =============== MODO DEMO (localStorage) ===============

function carregarDemo(obraId: string): DadosObra {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + obraId)
    if (raw) {
      const d = JSON.parse(raw)
      if (d?.obra && Array.isArray(d.cards)) return d
    }
  } catch {}
  return structuredClone(SEED)
}

function salvarDemo(obraId: string, dados: DadosObra) {
  try { localStorage.setItem(STORAGE_PREFIX + obraId, JSON.stringify(dados)) } catch {}
}

// =============== MODO BANCO (Supabase) ===============

async function carregarDoBanco(obraId: string): Promise<DadosObra | null> {
  const obra = await pegarObraPorId(obraId)
  if (!obra) return null
  const cardsRows = await listarCardsDaObra(obraId)
  const histPorCard: Record<string, HistoricoRow[]> = {}
  if (cardsRows.length > 0 && supabase) {
    const { data: hists } = await supabase
      .from('historico_card')
      .select('*')
      .in('card_id', cardsRows.map((c) => c.id))
      .order('created_at', { ascending: true })
    for (const h of (hists ?? []) as HistoricoRow[]) {
      ;(histPorCard[h.card_id] ??= []).push(h)
    }
  }
  return rowsParaDadosObra(obra, cardsRows, histPorCard)
}

// =============== HOOK ===============

export function useObraData(obraId: string): UseObraDataResult {
  const modo: 'demo' | 'banco' = ehDemo(obraId) ? 'demo' : 'banco'
  const [dados, setDados] = useState<DadosObra | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Carga inicial
  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    if (modo === 'demo') {
      setDados(carregarDemo(obraId))
      setCarregando(false)
    } else {
      carregarDoBanco(obraId)
        .then((d) => {
          if (!ativo) return
          if (d) setDados(d)
          else setErro('Obra nao encontrada')
        })
        .catch((e: any) => { if (ativo) setErro(e?.message ?? 'Erro ao carregar obra') })
        .finally(() => { if (ativo) setCarregando(false) })
    }
    return () => { ativo = false }
  }, [obraId, modo])

  // Salvar localmente no demo (toda mudanca em dados)
  useEffect(() => {
    if (modo === 'demo' && dados) salvarDemo(obraId, dados)
  }, [obraId, modo, dados])

  // ============ Mutacoes ============

  const alterarStatus = useCallback(async (cardId: string, novoStatus: string) => {
    if (!dados) return
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [...c.historico, { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: `Status: "${c.statusEmAndamento ?? '-'}" -> "${novoStatus}".` }]
            if (novoStatus === 'Concluido') {
              hist.push({ autor: 'Sistema', tipo: 'sistema', data: agora(), texto: 'Peca concluida. Movida para aba Conclusao. Aguardando aceite do cliente.' })
              return { ...c, statusEmAndamento: novoStatus, aba: 'conclusao' as AbaId, historico: hist }
            }
            return { ...c, statusEmAndamento: novoStatus, historico: hist }
          }),
        }
      })
      return
    }
    // Banco
    const card = dados.cards.find((c) => c.id === cardId)
    if (!card) return
    const updates: any = { status_em_andamento: novoStatus }
    if (novoStatus === 'Concluido') updates.aba = 'conclusao'
    await atualizarCard(cardId, updates)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: `Status: "${card.statusEmAndamento ?? '-'}" -> "${novoStatus}".` })
    if (novoStatus === 'Concluido') {
      await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Peca concluida. Movida para aba Conclusao. Aguardando aceite do cliente.' })
    }
    const novo = await carregarDoBanco(obraId)
    if (novo) setDados(novo)
  }, [dados, modo, obraId])

  const registrar = useCallback(async (cardId: string, texto: string, perfil: 'empresa' | 'cliente', moveAba: boolean) => {
    if (!dados || !texto.trim()) return
    const autor = perfil === 'empresa' ? 'Empresa' : 'Cliente'
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [...c.historico, { autor, tipo: perfil as AutorTipo, data: agora(), texto }]
            let novaAba = c.aba
            if (moveAba) {
              if (c.aba === 'emandamento') novaAba = perfil === 'empresa' ? 'cliente' : 'empresa'
              else if (c.aba === 'cliente') novaAba = 'empresa'
              else if (c.aba === 'empresa') novaAba = 'cliente'
              hist.push({ autor: 'Sistema', tipo: 'sistema', data: agora(), texto: `Movido para aba ${novaAba === 'cliente' ? 'Cliente' : novaAba === 'empresa' ? 'Empresa' : novaAba}.` })
            }
            return { ...c, aba: novaAba, historico: hist }
          }),
        }
      })
      return
    }
    // Banco
    const card = dados.cards.find((c) => c.id === cardId)
    if (!card) return
    await adicionarHistorico({ card_id: cardId, autor, autor_tipo: perfil, texto })
    if (moveAba) {
      let novaAba: AbaId = card.aba
      if (card.aba === 'emandamento') novaAba = perfil === 'empresa' ? 'cliente' : 'empresa'
      else if (card.aba === 'cliente') novaAba = 'empresa'
      else if (card.aba === 'empresa') novaAba = 'cliente'
      if (novaAba !== card.aba) {
        await atualizarCard(cardId, { aba: novaAba })
        await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: `Movido para aba ${novaAba === 'cliente' ? 'Cliente' : 'Empresa'}.` })
      }
    }
    const novo = await carregarDoBanco(obraId)
    if (novo) setDados(novo)
  }, [dados, modo, obraId])

  const darAceite = useCallback(async (cardId: string) => {
    if (!dados) return
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
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: quando, texto: 'Aceite final confirmado. Peca oficialmente entregue e garantia iniciada.' },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: quando, texto: 'Card encerrado. Inicio de garantia registrado.' },
            ]
            return { ...c, aceiteFinal: quando, encerrado: true, historico: hist }
          }),
        }
      })
      return
    }
    // Banco - aceite com auditoria basica (timestamp + user agent)
    await atualizarCard(cardId, {
      aceite_final_at: new Date().toISOString(),
      aceite_final_user_agent: navigator.userAgent,
      encerrado: true,
    })
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto: 'Aceite final confirmado. Peca oficialmente entregue e garantia iniciada.' })
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card encerrado. Inicio de garantia registrado.' })
    const novo = await carregarDoBanco(obraId)
    if (novo) setDados(novo)
  }, [dados, modo, obraId])

  const reabrir = useCallback(async (cardId: string, texto: string, perfil: 'empresa' | 'cliente') => {
    if (!dados || !texto.trim()) return
    if (modo === 'demo') {
      setDados((d) => {
        if (!d) return d
        return {
          ...d,
          cards: d.cards.map((c) => {
            if (c.id !== cardId) return c
            const hist = [
              ...c.historico,
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: agora(), texto },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Cliente identificou problema. Card reaberto e enviado para Empresa.' },
            ]
            return { ...c, aba: 'empresa' as AbaId, historico: hist }
          }),
        }
      })
      return
    }
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: perfil, texto })
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Cliente identificou problema. Card reaberto e enviado para Empresa.' })
    await atualizarCard(cardId, { aba: 'empresa' })
    const novo = await carregarDoBanco(obraId)
    if (novo) setDados(novo)
  }, [dados, modo, obraId])

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
        statusEmAndamento: input.destino === 'emandamento' ? 'Aguardando fabricacao' : null,
        prazoContrato: input.destino === 'emandamento' ? input.prazoContrato : null,
        encerrado: false,
        aceiteFinal: null,
        historico: [{ autor, tipo: perfil as AutorTipo, data: agora(), texto: 'Registro criado.' }],
      }
      setDados((d) => d ? ({ ...d, cards: [...d.cards, novo] }) : d)
      return input.destino
    }
    // Banco
    const cardRow = await criarCard({
      obra_id: obraId,
      tipo: input.tipo,
      sigla: input.sigla.toUpperCase(),
      nome: input.nome,
      descricao: input.descricao,
      aba: input.destino,
      status_em_andamento: input.destino === 'emandamento' ? 'Aguardando fabricacao' : null,
      prazo_contrato: input.destino === 'emandamento' ? input.prazoContrato : null,
    })
    await adicionarHistorico({ card_id: cardRow.id, autor, autor_tipo: perfil, texto: 'Registro criado.' })
    const novo = await carregarDoBanco(obraId)
    if (novo) setDados(novo)
    return input.destino
  }, [modo, obraId])

  const resetar = useCallback(() => {
    if (modo !== 'demo') return
    localStorage.removeItem(STORAGE_PREFIX + obraId)
    setDados(structuredClone(SEED))
  }, [modo, obraId])

  return { dados, modo, carregando, erro, alterarStatus, registrar, darAceite, reabrir, criarNovo, resetar }
}
