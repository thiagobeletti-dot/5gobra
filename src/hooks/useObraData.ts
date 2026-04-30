import { useEffect, useState, useCallback } from 'react'
import type { Card, DadosObra, AbaId, TipoCard, AutorTipo } from '../types/obra'
import { SEED } from '../lib/seed'
import { supabaseConfigurado, supabase } from '../lib/supabase'
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
} from '../lib/checklist'
import type { Checklist, DadosMedicao1 } from '../types/checklist'

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
  erro: string | null
  alterarStatus: (cardId: string, novoStatus: string) => Promise<void>
  registrar: (cardId: string, texto: string, perfil: 'empresa' | 'cliente', moveAba: boolean) => Promise<void>
  confirmarItem: (cardId: string) => Promise<void>
  darAceite: (cardId: string) => Promise<void>
  reabrir: (cardId: string, texto: string, perfil: 'empresa' | 'cliente') => Promise<void>
  criarNovo: (input: NovoCardInput, perfil: 'empresa' | 'cliente') => Promise<AbaId>
  importarItens: (itens: ItemImportado[], perfil: 'empresa' | 'cliente') => Promise<number>
  adicionarFotos: (cardId: string, arquivos: File[]) => Promise<number>
  removerFoto: (cardId: string, fotoId: string) => Promise<void>
  salvarMedicao1Card: (cardId: string, dados: DadosMedicao1, autorNome: string) => Promise<Checklist>
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

async function carregarDoBanco(obraResolvida: ObraRow): Promise<DadosObra> {
  const cardsRows = await listarCardsDaObra(obraResolvida.id)
  const histPorCard: Record<string, HistoricoRow[]> = {}
  let anexosPorCard: Record<string, Anexo[]> = {}
  let checklistsPorCard: Record<string, Checklist[]> = {}
  if (cardsRows.length > 0 && supabase) {
    const ids = cardsRows.map((c) => c.id)
    const { data: hists } = await supabase
      .from('historico_card')
      .select('*')
      .in('card_id', ids)
      .order('created_at', { ascending: true })
    for (const h of (hists ?? []) as HistoricoRow[]) {
      ;(histPorCard[h.card_id] ??= []).push(h)
    }
    anexosPorCard = await listarAnexosDeVariosCards(ids)
    try {
      checklistsPorCard = await listarChecklistsDeVariosCards(ids)
    } catch (e) {
      // Tabela checklists pode nao existir ainda em ambientes antigos. Toleramos.
      console.warn('Falha ao carregar checklists:', e)
    }
  }
  return rowsParaDadosObra(obraResolvida, cardsRows, histPorCard, anexosPorCard, checklistsPorCard)
}

export function useObraData(idOrToken: string, modoCarregamento: 'id' | 'token' = 'id'): UseObraDataResult {
  const modo: 'demo' | 'banco' = ehDemo(idOrToken) ? 'demo' : 'banco'
  const [dados, setDados] = useState<DadosObra | null>(null)
  const [obraReal, setObraReal] = useState<ObraRow | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

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
          ? await pegarObraPorToken(idOrToken)
          : await pegarObraPorId(idOrToken)
        if (!ativo) return
        if (!obra) {
          setErro('Obra nao encontrada')
          return
        }
        setObraReal(obra)
        const d = await carregarDoBanco(obra)
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
              hist.push({ autor: 'Sistema', tipo: 'sistema', data: agora(), texto: 'Peça concluída. Movida para aba Conclusão. Aguardando aceite do cliente.', interno: false })
              return { ...c, statusEmAndamento: novoStatus, aba: 'conclusao' as AbaId, historico: hist }
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
    if (novoStatus === 'Concluido' || novoStatus === 'Concluído') updates.aba = 'conclusao'
    await atualizarCard(cardId, updates)
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Status: "' + (card.statusEmAndamento ?? '-') + '" -> "' + novoStatus + '".', interno: true })
    if (novoStatus === 'Concluido' || novoStatus === 'Concluído') {
      await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Peça concluída. Movida para aba Conclusão. Aguardando aceite do cliente.' })
    }
    const novo = await carregarDoBanco(obraReal)
    setDados(novo)
  }, [dados, modo, obraReal])

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
            const hist = [...c.historico, { autor, tipo: perfil as AutorTipo, data: agora(), texto, interno: false }]
            let novaAba = c.aba
            if (moveAba) {
              if (c.aba === 'emandamento') novaAba = perfil === 'empresa' ? 'cliente' : 'empresa'
              else if (c.aba === 'cliente') novaAba = 'empresa'
              else if (c.aba === 'empresa') novaAba = 'cliente'
              hist.push({ autor: 'Sistema', tipo: 'sistema', data: agora(), texto: 'Movido para aba ' + (novaAba === 'cliente' ? 'Cliente' : novaAba === 'empresa' ? 'Empresa' : novaAba) + '.', interno: true })
            }
            return { ...c, aba: novaAba, historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
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
        await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Movido para aba ' + (novaAba === 'cliente' ? 'Cliente' : 'Empresa') + '.', interno: true })
      }
    }
    const novo = await carregarDoBanco(obraReal)
    setDados(novo)
  }, [dados, modo, obraReal])

  // Cliente confirma item — manda card pra aba "Técnica" (aguardando visita técnica),
  // diferente de uma mensagem normal que vai pra Empresa.
  const confirmarItem = useCallback(async (cardId: string) => {
    if (!dados) return
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
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto })
    await atualizarCard(cardId, { aba: 'tecnica', sub_status: 'Aguardando visita técnica' })
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card movido para aba Técnica. Empresa precisa agendar visita técnica para Medição 1.', interno: true })
    const novo = await carregarDoBanco(obraReal)
    setDados(novo)
  }, [dados, modo, obraReal])

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
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: quando, texto: 'Aceite final confirmado. Peca oficialmente entregue e garantia iniciada.', interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: quando, texto: 'Card encerrado. Inicio de garantia registrado.', interno: false },
            ]
            return { ...c, aceiteFinal: quando, encerrado: true, historico: hist }
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
    })
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: 'cliente', texto: 'Aceite final confirmado. Peca oficialmente entregue e garantia iniciada.' })
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Card encerrado. Inicio de garantia registrado.' })
    const novo = await carregarDoBanco(obraReal)
    setDados(novo)
  }, [dados, modo, obraReal])

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
              { autor: 'Cliente', tipo: 'cliente' as AutorTipo, data: agora(), texto, interno: false },
              { autor: 'Sistema', tipo: 'sistema' as AutorTipo, data: agora(), texto: 'Cliente identificou problema. Card reaberto e enviado para Empresa.', interno: true },
            ]
            return { ...c, aba: 'empresa' as AbaId, historico: hist }
          }),
        }
      })
      return
    }
    if (!obraReal) return
    await adicionarHistorico({ card_id: cardId, autor: 'Cliente', autor_tipo: perfil, texto })
    await adicionarHistorico({ card_id: cardId, autor: 'Sistema', autor_tipo: 'sistema', texto: 'Cliente identificou problema. Card reaberto e enviado para Empresa.', interno: true })
    await atualizarCard(cardId, { aba: 'empresa' })
    const novo = await carregarDoBanco(obraReal)
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
        statusEmAndamento: input.destino === 'emandamento' ? 'Em Produção' : null,
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
      status_em_andamento: input.destino === 'emandamento' ? 'Em Produção' : null,
      prazo_contrato: input.destino === 'emandamento' ? input.prazoContrato : null,
    })
    await adicionarHistorico({ card_id: cardRow.id, autor, autor_tipo: perfil, texto: 'Registro criado.' })
    const novo = await carregarDoBanco(obraReal)
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
    const criados = await criarVariosCards(linhas)
    await Promise.all(criados.map((c, idx) =>
      adicionarHistorico({
        card_id: c.id,
        autor,
        autor_tipo: perfil,
        texto: 'Item importado do Alumisoft (origem: ' + itens[idx].origemTipologia + ').',
      })
    ))
    const novo = await carregarDoBanco(obraReal)
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
      await uploadFoto({ arquivo, obraId: obraReal.id, cardId })
      count++
    }
    const novo = await carregarDoBanco(obraReal)
    setDados(novo)
    return count
  }, [modo, obraReal])

  const removerFoto = useCallback(async (cardId: string, fotoId: string): Promise<void> => {
    if (modo === 'demo' || !obraReal || !supabase) {
      throw new Error('Operacao disponivel so com Supabase conectado')
    }
    const { data, error } = await supabase
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
    await removerAnexo(anexo)
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
    const novo = await salvarMedicao1({
      cardId,
      dados: dadosForm,
      autor: autorNome || 'Empresa',
      autorTipo: 'empresa',
    })

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
      const vaoTudoOk =
        dadosForm.vao_chao_ok === 'sim' &&
        dadosForm.vao_esquadro_ok === 'sim' &&
        dadosForm.vao_nivel_ok === 'sim' &&
        !dadosForm.precisa_correcao.trim()
      if (vaoTudoOk) {
        // Regra 4: vão pronto → vai produzir
        novaAba = 'emandamento'
        novoSubStatus = 'Em Produção'
        mensagemHistorico = 'Medição 1 preenchida. Decisão: SEM contra-marco, vão pronto. Card movido para Em Andamento (produção).'
      } else {
        // Regra 3: vão precisa correção → volta pro cliente
        novaAba = 'cliente'
        novoSubStatus = 'Aguardando finalizar vão'
        mensagemHistorico = 'Medição 1 preenchida. Decisão: SEM contra-marco. Vão precisa de correção pelo cliente antes da próxima visita.'
      }
    }

    // Aplica a movimentação no banco
    if (novaAba !== null) {
      try {
        const updates: any = { aba: novaAba, sub_status: novoSubStatus }
        if (novaAba === 'emandamento') {
          updates.status_em_andamento = 'Em Produção'
        }
        await atualizarCard(cardId, updates)
      } catch (e) {
        console.warn('Falha ao mover card pós-M1:', e)
      }
    }

    try {
      // Marca como interno — registro técnico não deve aparecer pro cliente.
      // Empresa decide o que publicar pro cliente via mensagem regular.
      await adicionarHistorico({
        card_id: cardId,
        autor: autorNome || 'Empresa',
        autor_tipo: 'empresa',
        texto: mensagemHistorico,
        interno: true,
      })
    } catch {}

    const dd = await carregarDoBanco(obraReal)
    setDados(dd)
    return novo
  }, [modo, obraReal])

  const resetar = useCallback(() => {
    if (modo !== 'demo') return
    localStorage.removeItem(STORAGE_PREFIX + idOrToken)
    setDados(structuredClone(SEED))
  }, [modo, idOrToken])

  return { dados, modo, obraReal, carregando, erro, alterarStatus, registrar, confirmarItem, darAceite, reabrir, criarNovo, importarItens, adicionarFotos, removerFoto, salvarMedicao1Card, resetar }
}
