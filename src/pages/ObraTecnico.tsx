import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { ABAS } from '../types/obra'
import type { AbaId, Card } from '../types/obra'
import type { TecnicoObra } from '../types/tecnico'
import { diasAte, formataData, statusSemantico } from '../lib/helpers'
import { pegarTecnicoPorToken } from '../lib/tecnico'
import { pegarObraPorId, listarCardsDaObra, adicionarHistorico, atualizarCard, rowsParaDadosObra, type ObraRow, type HistoricoRow } from '../lib/api'
import { listarAnexosDeVariosCards, uploadFoto, type Anexo } from '../lib/anexos'
import { listarChecklistsDeVariosCards, salvarMedicao1, salvarMedicao2 } from '../lib/checklist'
import type { Checklist, DadosMedicao1, DadosMedicao2 } from '../types/checklist'
import { resumoMedicao1, resumoMedicao2, ROTULOS_TIPOLOGIA, VAZIO_MEDICAO1, VAZIO_MEDICAO2 } from '../types/checklist'
import { supabasePublico } from '../lib/supabase'
import GaleriaFotos from '../components/GaleriaFotos'
import FormMedicao1 from '../components/FormMedicao1'
import FormMedicao2 from '../components/FormMedicao2'
import type { DadosObra } from '../types/obra'

export default function ObraTecnico() {
  const { token = '' } = useParams<{ token: string }>()
  const [tecnico, setTecnico] = useState<TecnicoObra | null>(null)
  const [obraReal, setObraReal] = useState<ObraRow | null>(null)
  const [dados, setDados] = useState<DadosObra | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [abaAtiva, setAbaAtiva] = useState<AbaId>('tecnica')
  const [cardAbertoId, setCardAbertoId] = useState<string | null>(null)
  const [formM1, setFormM1] = useState<string | null>(null)
  const [formM2, setFormM2] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function toast(msg: string) {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 4000)
  }

  async function recarregar(obraId: string) {
    if (!supabasePublico) return
    const obra = await pegarObraPorId(obraId, supabasePublico)
    if (!obra) { setErro('Obra não encontrada'); return }
    setObraReal(obra)
    const cardsRows = await listarCardsDaObra(obra.id, supabasePublico)
    const histPorCard: Record<string, HistoricoRow[]> = {}
    let anexosPorCard: Record<string, Anexo[]> = {}
    let checklistsPorCard: Record<string, Checklist[]> = {}
    if (cardsRows.length > 0) {
      const ids = cardsRows.map((c) => c.id)
      const { data: hists } = await supabasePublico
        .from('historico_card')
        .select('*')
        .in('card_id', ids)
        .order('created_at', { ascending: true })
      for (const h of (hists ?? []) as HistoricoRow[]) {
        ;(histPorCard[h.card_id] ??= []).push(h)
      }
      anexosPorCard = await listarAnexosDeVariosCards(ids, supabasePublico)
      try {
        checklistsPorCard = await listarChecklistsDeVariosCards(ids, supabasePublico)
      } catch {}
    }
    setDados(rowsParaDadosObra(obra, cardsRows, histPorCard, anexosPorCard, checklistsPorCard))
  }

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    ;(async () => {
      try {
        const r = await pegarTecnicoPorToken(token, supabasePublico)
        if (!ativo) return
        if (!r) { setErro('Link inválido ou revogado'); return }
        setTecnico(r.tecnico)
        await recarregar(r.obraId)
      } catch (e: any) {
        if (ativo) setErro(e?.message ?? 'Erro ao carregar')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [token])

  const cardAberto = useMemo(
    () => dados?.cards.find((c) => c.id === cardAbertoId) ?? null,
    [dados, cardAbertoId]
  )

  const autorTecnico = tecnico ? (tecnico.papel ? tecnico.nome + ' (' + tecnico.papel + ')' : tecnico.nome) : 'Técnico'

  async function salvarM1Tecnico(cardId: string, dadosForm: DadosMedicao1) {
    if (!obraReal) return
    await salvarMedicao1({
      cardId,
      dados: dadosForm,
      autor: autorTecnico,
      autorTipo: 'tecnico',
    }, supabasePublico)

    // Auto-move pós-M1 (mesma lógica da empresa)
    let novaAba: AbaId | null = null
    let novoSubStatus: string | null = null
    let mensagemHistorico = 'Medição 1 preenchida pelo técnico.'

    if (dadosForm.tipologia_executavel === 'nao') {
      const motivo = dadosForm.tipologia_problema.trim() || '(sem detalhes)'
      novaAba = 'empresa'
      novoSubStatus = 'Tipologia não executável'
      mensagemHistorico = '⚠ TIPOLOGIA NÃO EXECUTÁVEL (técnico ' + autorTecnico + '). Motivo: ' + motivo + '.'
    } else if (dadosForm.contra_marco === 'sim') {
      novaAba = 'empresa'
      novoSubStatus = 'Fabricando contra-marco'
      mensagemHistorico = 'Medição 1 (técnico ' + autorTecnico + '). Decisão: COM contra-marco.'
    } else if (dadosForm.contra_marco === 'nao') {
      if (dadosForm.vao_pronto === 'sim') {
        novaAba = 'emandamento'
        novoSubStatus = 'Aguardando lote'
        mensagemHistorico = 'Medição 1 (técnico ' + autorTecnico + '). SEM contra-marco, vão pronto.'
      } else if (dadosForm.vao_pronto === 'nao') {
        // Vão não pronto sem contra-marco → cliente precisa ajustar o vão.
        // Vai direto pra Cliente; o registro técnico vai como público pra
        // cliente ler as pendências apontadas pelo técnico.
        novaAba = 'cliente'
        novoSubStatus = 'Aguardando ajustar o vão'
        const pendencias = dadosForm.precisa_correcao.trim() || '(sem detalhes)'
        mensagemHistorico = 'Medição 1 (técnico ' + autorTecnico + '). SEM contra-marco, vão NÃO pronto. Pendências: ' + pendencias
      }
    }

    if (novaAba !== null) {
      try {
        const updates: any = { aba: novaAba, sub_status: novoSubStatus }
        if (novaAba === 'emandamento') updates.status_em_andamento = 'Aguardando lote'
        await atualizarCard(cardId, updates, supabasePublico)
      } catch {}
    }

    // Quando card vai pra Cliente (vão não pronto), o registro técnico vai como
    // público pra cliente ler as pendências cruas. Em outros cenários (M1 OK,
    // contra-marco SIM, tipologia não executável) fica interno como antes.
    const registroPublico = novaAba === 'cliente'
    try {
      await adicionarHistorico({
        card_id: cardId,
        autor: autorTecnico,
        autor_tipo: 'tecnico',
        texto: mensagemHistorico,
        interno: !registroPublico,
      }, supabasePublico)
      if (novaAba === 'emandamento') {
        await adicionarHistorico({
          card_id: cardId,
          autor: 'Sistema',
          autor_tipo: 'sistema',
          texto: 'Visita técnica realizada. Vão está pronto. Item aprovado para produção.',
          interno: false,
        }, supabasePublico)
      }
    } catch {}

    await recarregar(obraReal.id)
  }

  async function salvarM2Tecnico(cardId: string, dadosForm: DadosMedicao2) {
    if (!obraReal) return
    await salvarMedicao2({
      cardId,
      dados: dadosForm,
      autor: autorTecnico,
      autorTipo: 'tecnico',
    }, supabasePublico)

    let novaAba: AbaId | null = null
    let novoSubStatus: string | null = null
    let mensagemInterno = 'Medição 2 preenchida pelo técnico ' + autorTecnico + '.'
    let mensagemPublico: string | null = null

    if (dadosForm.liberado_producao === 'sim') {
      novaAba = 'emandamento'
      novoSubStatus = 'Aguardando lote'
      mensagemInterno = 'Medição 2 (técnico ' + autorTecnico + '). Vão liberado. Medida final: ' + dadosForm.medida_largura + ' x ' + dadosForm.medida_altura
      mensagemPublico = '2ª medição realizada. Vão está pronto. Item aprovado e aguardando lote de produção.'
    } else if (dadosForm.liberado_producao === 'nao') {
      novaAba = 'empresa'
      novoSubStatus = 'Vão M2 reprovado — comunicar cliente'
      const pendencias = dadosForm.pendencias.trim() || '(sem detalhes)'
      mensagemInterno = 'Medição 2 (técnico ' + autorTecnico + '). Vão NÃO liberado. Pendências: ' + pendencias
    }

    if (novaAba !== null) {
      try {
        const updates: any = { aba: novaAba, sub_status: novoSubStatus }
        if (novaAba === 'emandamento') updates.status_em_andamento = 'Aguardando lote'
        await atualizarCard(cardId, updates, supabasePublico)
      } catch {}
    }

    try {
      await adicionarHistorico({
        card_id: cardId,
        autor: autorTecnico,
        autor_tipo: 'tecnico',
        texto: mensagemInterno,
        interno: true,
      }, supabasePublico)
      if (mensagemPublico) {
        await adicionarHistorico({
          card_id: cardId,
          autor: 'Sistema',
          autor_tipo: 'sistema',
          texto: mensagemPublico,
          interno: false,
        }, supabasePublico)
      }
    } catch {}

    await recarregar(obraReal.id)
  }

  async function adicionarFotoTecnico(cardId: string, arquivos: File[]) {
    if (!obraReal) return
    for (const a of arquivos) await uploadFoto({ arquivo: a, obraId: obraReal.id, cardId }, supabasePublico)
    try {
      await adicionarHistorico({
        card_id: cardId,
        autor: autorTecnico,
        autor_tipo: 'tecnico',
        texto: 'Foto adicionada pelo técnico (' + arquivos.length + ').',
        interno: true,
      }, supabasePublico)
    } catch {}
    await recarregar(obraReal.id)
  }

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>

  if (erro || !tecnico || !dados || !obraReal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600 px-6 text-center">
        <LogoFull />
        <p className="mt-6">{erro ?? 'Link inválido'}</p>
        <p className="text-sm text-slate-400">Se você acredita que isso é um erro, fale com a empresa.</p>
      </div>
    )
  }

  const cardsDaAba = dados.cards.filter((c) => c.aba === abaAtiva)
  const contagem = (a: AbaId) => dados.cards.filter((c) => c.aba === a).length
  const tecnicaPendente = dados.cards.filter((c) => c.aba === 'tecnica' && !c.encerrado).length

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/"><LogoFull small /></Link>
          <div className="flex-1 text-right">
            <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Técnico</span>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-4 md:px-7 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-xs text-slate-500 mb-0.5">Olá, {tecnico.nome}{tecnico.papel ? ' (' + tecnico.papel + ')' : ''}</div>
          <h1 className="text-lg md:text-xl font-bold">{dados.obra.nome}</h1>
          <div className="text-xs md:text-sm text-slate-500">{dados.obra.endereco}</div>
          {tecnicaPendente > 0 && (
            <div className="mt-3 bg-laranja-soft border border-laranja-border rounded-lg px-3 py-2 text-xs md:text-sm text-laranja-dark font-semibold">
              {tecnicaPendente} {tecnicaPendente === 1 ? 'item aguardando' : 'itens aguardando'} sua visita técnica.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 px-4 md:px-7 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAbaAtiva(a.id)}
              className={'py-3 px-3 md:px-4 text-xs md:text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap inline-flex items-center gap-2 transition ' + (abaAtiva === a.id ? 'text-laranja border-laranja' : 'text-slate-500 border-transparent hover:text-slate-900')}
            >
              {a.rotulo}
              <span className={'px-1.5 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center ' + (abaAtiva === a.id ? 'bg-laranja-soft text-laranja-dark' : 'bg-slate-100 text-slate-500')}>
                {contagem(a.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 md:px-7 py-5">
          {cardsDaAba.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Nada nesta aba.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {cardsDaAba.map((c) => (
                <CardTecView key={c.id} card={c} onClick={() => setCardAbertoId(c.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-4 md:px-7 py-4 text-[11px] text-slate-400 text-center">
        Tudo que você registra aqui fica documentado, com data, hora e seu nome.
        <br />Acesso seguro pelo seu link único.
      </footer>

      {cardAberto && (
        <ModalCardTecnico
          card={cardAberto}
          onClose={() => setCardAbertoId(null)}
          onAbrirM1={() => setFormM1(cardAberto.id)}
          onAbrirM2={() => setFormM2(cardAberto.id)}
          onAdicionarFotos={async (arquivos) => {
            const n = arquivos.length
            await adicionarFotoTecnico(cardAberto.id, arquivos)
            toast(n + (n === 1 ? ' foto adicionada' : ' fotos adicionadas'))
          }}
        />
      )}

      {formM1 && (() => {
        const cardId = formM1
        const card = dados.cards.find((c) => c.id === cardId)
        const m1 = card?.checklists.find((c) => c.tipo === 'medicao1')
        const inicial: DadosMedicao1 | null = m1
          ? (m1.dados as DadosMedicao1)
          : card
            ? { ...VAZIO_MEDICAO1, descricao: card.descricao || card.nome, tecnico: tecnico.nome }
            : null
        return (
          <FormMedicao1
            inicial={inicial}
            onCancelar={() => setFormM1(null)}
            onSalvar={async (dadosForm) => {
              await salvarM1Tecnico(cardId, dadosForm)
              setFormM1(null)
              setCardAbertoId(null)
              toast('Medição 1 salva')
            }}
          />
        )
      })()}

      {formM2 && (() => {
        const cardId = formM2
        const card = dados.cards.find((c) => c.id === cardId)
        const m1 = card?.checklists.find((c) => c.tipo === 'medicao1')
        const m2 = card?.checklists.find((c) => c.tipo === 'medicao2')
        const m1Dados = (m1?.dados as DadosMedicao1) ?? null
        const inicial: DadosMedicao2 = m2
          ? (m2.dados as DadosMedicao2)
          : { ...VAZIO_MEDICAO2, tecnico: tecnico.nome }
        return (
          <FormMedicao2
            inicial={inicial}
            m1={m1Dados}
            onCancelar={() => setFormM2(null)}
            onSalvar={async (dadosForm) => {
              await salvarM2Tecnico(cardId, dadosForm)
              setFormM2(null)
              setCardAbertoId(null)
              toast('Medição 2 salva')
            }}
          />
        )
      })()}

      {toastMsg && (
        <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-white border border-slate-300 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2.5 text-sm z-50" role="status" aria-live="polite">
          <span className="text-status-andamento font-bold">OK</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}

function CardTecView({ card, onClick }: { card: Card; onClick: () => void }) {
  const s = statusSemantico(card)
  const tipoLabel = { peca: 'Item', acordo: 'Acordo', reclamacao: 'Apontamento' }[card.tipo]
  const labelStatus = card.subStatus
    ? card.subStatus
    : s === 'aguarda' ? (card.aba === 'cliente' ? 'Aguardando cliente' : card.aba === 'empresa' ? 'Aguardando empresa' : card.aba === 'tecnica' ? 'Aguardando visita técnica' : 'Aguardando')
    : s === 'andamento' ? 'Em andamento'
    : s === 'instalado' ? 'Instalado'
    : s === 'concluido' ? (card.aceiteFinal ? 'Aceite concluído' : 'Aguardando aceite')
    : 'Atenção'
  const statusTxt = card.aba === 'emandamento' && card.statusEmAndamento ? card.statusEmAndamento : labelStatus

  let prazoNode: React.ReactNode = null
  if (card.aba === 'emandamento' && card.prazoContrato) {
    const dias = diasAte(card.prazoContrato)
    if (dias !== null) {
      let cls = 'text-[11px] font-medium text-slate-400'
      let txt = 'Prazo ' + formataData(card.prazoContrato)
      if (dias < 0) { cls = 'text-[11px] font-semibold text-red-600'; txt = 'Atrasado ' + Math.abs(dias) + 'd' }
      else if (dias <= 7) { cls = 'text-[11px] font-semibold text-red-600'; txt = 'Em ' + dias + 'd' }
      prazoNode = <span className={cls}>{txt}</span>
    }
  }

  const corLado = card.tipo === 'peca' ? 'bg-peca' : 'bg-acordo'
  const siglaCls = card.tipo === 'peca'
    ? 'bg-peca-soft text-peca-dark border-peca-border'
    : 'bg-acordo-soft text-acordo-dark border-acordo-border'
  const dotCls = {
    aguarda: 'bg-status-aguarda',
    andamento: 'bg-status-andamento',
    instalado: 'bg-status-instalado',
    concluido: 'bg-status-concluido',
    erro: 'bg-status-erro',
  }[s]

  return (
    <div onClick={onClick} className={'card-base ' + (card.encerrado ? 'opacity-60' : '')}>
      <span className={'absolute left-0 top-0 bottom-0 w-1 ' + corLado} />
      <div className="flex items-center justify-between gap-2.5 mb-2">
        <span className={'px-2 py-0.5 rounded-md text-[11px] font-bold border ' + siglaCls}>{card.sigla}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{tipoLabel}</span>
      </div>
      <div className={'text-sm font-semibold mb-1 leading-snug ' + (card.encerrado ? 'line-through' : '')}>{card.nome}</div>
      <div className="text-xs text-slate-500 leading-snug mb-2.5 line-clamp-2">{card.descricao}</div>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2.5 border-t border-slate-200">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <span className={'w-2 h-2 rounded-full ' + dotCls} />
          {statusTxt}
        </span>
        {prazoNode}
      </div>
    </div>
  )
}

function ModalCardTecnico({ card, onClose, onAbrirM1, onAbrirM2, onAdicionarFotos }: {
  card: Card
  onClose: () => void
  onAbrirM1: () => void
  onAbrirM2: () => void
  onAdicionarFotos: (arquivos: File[]) => Promise<void>
}) {
  const tipoLabel = { peca: 'Item', acordo: 'Acordo', reclamacao: 'Apontamento' }[card.tipo]
  const m1 = card.checklists.find((c) => c.tipo === 'medicao1')
  const m2 = card.checklists.find((c) => c.tipo === 'medicao2')
  const dadosM1 = m1?.dados as DadosMedicao1 | undefined
  const dadosM2 = m2?.dados as DadosMedicao2 | undefined

  // M2 só faz sentido se M1 existe + executável + (CM=SIM ou vão=NÃO)
  const m2Aplicavel = !!dadosM1
    && dadosM1.tipologia_executavel !== 'nao'
    && (dadosM1.contra_marco === 'sim' || dadosM1.vao_pronto === 'nao')

  // Só permite preencher M1/M2 se card está nas abas relevantes
  const podePreencherM1 = card.aba === 'tecnica' && card.tipo === 'peca' && !card.encerrado
  const podePreencherM2 = card.aba === 'tecnica' && card.tipo === 'peca' && !card.encerrado && m2Aplicavel

  const tipologiaLabel = dadosM1?.tipologia ? ROTULOS_TIPOLOGIA[dadosM1.tipologia] : null

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm grid place-items-end md:place-items-center p-0 md:p-5 z-40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white border border-slate-200 rounded-t-2xl md:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 md:px-6 py-4 md:py-5 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-peca-soft text-peca-dark border-peca-border">{card.sigla}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{tipoLabel}</span>
            </div>
            <div className="text-base md:text-lg font-bold mb-1">{card.nome}</div>
            <div className="text-sm text-slate-500">{card.descricao}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 md:py-5 space-y-4">
          {/* Status atual */}
          <div className="bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-md">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Situação</div>
            <div className="text-sm text-slate-900 font-medium">{card.subStatus ?? (card.aba === 'tecnica' ? 'Aguardando visita técnica' : card.aba)}</div>
          </div>

          {/* Checklists */}
          {card.tipo === 'peca' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Checklists técnicos</div>
              {/* M1 */}
              {m1 && dadosM1 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Medição 1</span>
                      {tipologiaLabel && <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{tipologiaLabel}</span>}
                    </div>
                    <div className="text-sm text-slate-800 font-medium">{resumoMedicao1(dadosM1)}</div>
                  </div>
                  {podePreencherM1 && <button onClick={onAbrirM1} className="btn-ghost text-xs px-3 py-1.5">Editar</button>}
                </div>
              ) : podePreencherM1 ? (
                <button onClick={onAbrirM1} className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-sm text-slate-600 hover:border-laranja hover:text-laranja-dark hover:bg-laranja-soft transition">
                  + Preencher Medição 1
                </button>
              ) : null}

              {/* M2 */}
              {podePreencherM2 && (
                m2 && dadosM2 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1">
                        <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Medição 2</span>
                      </div>
                      <div className="text-sm text-slate-800 font-medium">{resumoMedicao2(dadosM2)}</div>
                    </div>
                    <button onClick={onAbrirM2} className="btn-ghost text-xs px-3 py-1.5">Editar</button>
                  </div>
                ) : (
                  <button onClick={onAbrirM2} className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-sm text-slate-600 hover:border-laranja hover:text-laranja-dark hover:bg-laranja-soft transition">
                    + Preencher Medição 2
                  </button>
                )
              )}
            </div>
          )}

          {/* Fotos */}
          <GaleriaFotos
            fotos={card.fotos}
            podeEditar={!card.encerrado}
            onAdicionar={onAdicionarFotos}
            onRemover={async () => { /* técnico não remove fotos por enquanto */ }}
          />

          {/* Histórico (técnico vê tudo, exceto interno por padrão; vê interno também por contexto) */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Histórico</div>
            <div className="space-y-2.5">
              {(card.historico ?? []).slice().reverse().map((h, i) => (
                <div
                  key={i}
                  className={'border px-3 py-2.5 rounded-md text-xs ' + (
                    h.interno ? 'bg-slate-100 border-slate-300 border-dashed' : 'bg-slate-50 border-slate-200'
                  ) + ' ' + (
                    h.tipo === 'empresa' ? 'border-l-2 border-l-laranja' :
                    h.tipo === 'cliente' ? 'border-l-2 border-l-peca' :
                    h.tipo === 'tecnico' ? 'border-l-2 border-l-blue-500' :
                    'border-l-2 border-l-slate-300 opacity-90'
                  )}
                >
                  <div className="flex justify-between items-center mb-1 gap-2.5">
                    <span className={'font-bold text-[11px] uppercase tracking-wider ' + (
                      h.tipo === 'empresa' ? 'text-laranja-dark' :
                      h.tipo === 'cliente' ? 'text-peca-dark' :
                      h.tipo === 'tecnico' ? 'text-blue-700' :
                      'text-slate-400'
                    )}>{h.autor}</span>
                    <span className="text-[11px] text-slate-400">{h.data}</span>
                  </div>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{h.texto}</div>
                </div>
              ))}
              {(card.historico ?? []).length === 0 && (
                <div className="bg-slate-50 px-3 py-2.5 rounded-md text-xs text-slate-400">Nenhum registro ainda.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
