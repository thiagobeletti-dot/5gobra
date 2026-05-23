// Página Cronograma — V1.1
// Empresa configura cronograma de fases pra obra. Template único com 5 fases.
// Fases M1 e Entrega Contramarco são opcionais (checkbox no preview).
// Status das fases é INFERIDO automaticamente dos cards (sem botão manual).
//
// Acessado via /app/obra/:id/cronograma (empresa logada).

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listarCardsDaObra, pegarObraPorId, rowsParaDadosObra } from '../lib/api'
import { listarChecklistsDeVariosCards } from '../lib/checklist'
import {
  pegarCronogramaPorObra,
  criarCronograma,
  apagarCronograma,
  calcularDemandaAtual,
  emojiDemanda,
  rotuloDemanda,
  rotuloGatilho,
  inferirStatusFases,
  type NovaFaseInput,
} from '../lib/cronograma'
import { useConfirm } from '../hooks/useConfirm'
import {
  TEMPLATES_CRONOGRAMA,
  NOMES_FASES,
  type Cronograma as CronogramaT,
} from '../types/cronograma'
import type { Card } from '../types/obra'

export default function Cronograma() {
  const { id: obraId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirmar, dialog: confirmDialog } = useConfirm()
  const [cronograma, setCronograma] = useState<CronogramaT | null>(null)
  const [obraNome, setObraNome] = useState<string>('')
  const [cards, setCards] = useState<Card[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [apagando, setApagando] = useState(false)

  // Preview editável (antes de salvar)
  const [fasesPreview, setFasesPreview] = useState<NovaFaseInput[]>([])
  const [incluirM1, setIncluirM1] = useState(true)
  const [incluirContramarco, setIncluirContramarco] = useState(true)

  // Carrega obra + cronograma + cards
  useEffect(() => {
    if (!obraId) return
    setCarregando(true)
    Promise.all([
      pegarObraPorId(obraId),
      pegarCronogramaPorObra(obraId),
      carregarCards(obraId),
    ])
      .then(([obra, crono, cardsList]) => {
        if (obra) setObraNome(obra.nome ?? '')
        setCronograma(crono)
        setCards(cardsList)
      })
      .finally(() => setCarregando(false))
  }, [obraId])

  // Carrega cards + checklists juntos pra inferência
  async function carregarCards(idObra: string): Promise<Card[]> {
    const obra = await pegarObraPorId(idObra)
    if (!obra) return []
    const cardsRows = await listarCardsDaObra(idObra)
    const ids = cardsRows.map((c) => c.id)
    let checklistsPorCard: Record<string, any[]> = {}
    if (ids.length > 0) {
      try {
        checklistsPorCard = await listarChecklistsDeVariosCards(ids)
      } catch {}
    }
    // Reaproveita o mapper pra montar Card[] direto
    const dados = rowsParaDadosObra(obra, cardsRows, {}, {}, checklistsPorCard as any)
    return dados.cards
  }

  // Carrega template no preview quando entra em "criar"
  useEffect(() => {
    if (!cronograma && !carregando) {
      const tpl = TEMPLATES_CRONOGRAMA.HORIZONTAL_COM_CONTRAMARCO
      const fases: NovaFaseInput[] = tpl.fases.map((f, idx) => ({
        ordem: idx + 1,
        nome: f.nome,
        gatilhoTipo: f.gatilhoTipo,
        prazoDias: f.prazoDias,
        responsavel: f.responsavel,
      }))
      setFasesPreview(fases)
    }
  }, [cronograma, carregando])

  function atualizarPrazoFase(idx: number, novoPrazo: number) {
    setFasesPreview((atual) =>
      atual.map((f, i) => (i === idx ? { ...f, prazoDias: Math.max(0, novoPrazo) } : f)),
    )
  }

  function fasesParaCriar(): NovaFaseInput[] {
    return fasesPreview
      .filter((f) => {
        if (f.nome === NOMES_FASES.MEDICAO_M1 && !incluirM1) return false
        if (f.nome === NOMES_FASES.ENTREGA_CONTRAMARCO && !incluirContramarco) return false
        return true
      })
      .map((f, idx) => ({ ...f, ordem: idx + 1 }))
  }

  async function confirmarCriacao() {
    if (!obraId) return
    const fases = fasesParaCriar()
    if (fases.length === 0) return

    setCriando(true)
    const novo = await criarCronograma({
      obraId,
      modoContagem: 'por_lote',
      fases,
    })
    setCriando(false)

    if (novo) {
      setCronograma(novo)
    } else {
      alert(
        'Não foi possível criar o cronograma. Pode haver um cronograma antigo travado no banco — me avise pra rodar a limpeza.',
      )
    }
  }

  async function handleApagarCronograma() {
    if (!cronograma) return
    const confirma = await confirmar({
      titulo: 'Apagar este cronograma e recomeçar?',
      descricao:
        'O cronograma atual será removido. Você poderá montar um novo do zero. Essa ação só é permitida porque o cliente ainda não aceitou.',
      labelConfirmar: 'Apagar e recomeçar',
    })
    if (confirma === null) return

    setApagando(true)
    const res = await apagarCronograma(cronograma.id)
    setApagando(false)

    if (!res.ok) {
      alert(res.motivo ?? 'Não foi possível apagar o cronograma.')
      return
    }
    setCronograma(null)
  }

  function voltarParaObra() {
    if (!obraId) return
    navigate(`/app/obra/${obraId}`)
  }

  // Aplica inferência automática às fases (lê cards)
  const cronogramaInferido = useMemo(() => {
    if (!cronograma) return null
    return inferirStatusFases(cronograma, cards)
  }, [cronograma, cards])

  if (carregando) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Carregando cronograma…</p>
      </div>
    )
  }

  // ============ Estado 1: SEM cronograma — preview editável direto ============
  if (!cronogramaInferido) {
    const prazoContratual = fasesParaCriar()
      .filter((f) => f.gatilhoTipo === 'liberacao_vao' || f.gatilhoTipo === 'fim_fase_anterior')
      .filter((_, idx, arr) => {
        // pega apenas as fases após "Liberação do vão"
        const idxLiberacao = arr.findIndex((x) => x.gatilhoTipo === 'liberacao_vao')
        return idxLiberacao >= 0 && idx >= idxLiberacao
      })
      .reduce((acc, f) => acc + f.prazoDias, 0)

    return (
      <div className="p-8 max-w-3xl mx-auto">
        {obraId && (
          <Link
            to={`/app/obra/${obraId}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition"
          >
            ← Voltar pra obra
          </Link>
        )}
        <h1 className="text-2xl font-bold mb-1">Cronograma da Obra</h1>
        <p className="text-slate-600 mb-1">{obraNome}</p>
        <p className="text-slate-500 text-sm mb-6">
          O cronograma vira um <strong>compromisso bilateral</strong> com peso jurídico depois
          que o cliente aceita. Defina os prazos abaixo e clique em "Criar cronograma".
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          {/* Toggles de fases opcionais */}
          <div className="mb-5 pb-5 border-b border-slate-200 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2">
              Configurações da obra
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={incluirM1}
                onChange={(e) => setIncluirM1(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span>
                <strong>Incluir Medição (M1)</strong> — visita técnica inicial antes do contramarco
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={incluirContramarco}
                onChange={(e) => setIncluirContramarco(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span>
                <strong>Incluir Entrega Contramarco</strong> — obra exige contramarco antes da medição final
              </span>
            </label>
          </div>

          <ol className="space-y-3">
            {fasesPreview.map((fase, idx) => {
              const desabilitada =
                (fase.nome === NOMES_FASES.MEDICAO_M1 && !incluirM1) ||
                (fase.nome === NOMES_FASES.ENTREGA_CONTRAMARCO && !incluirContramarco)
              const semPrazoEdit =
                fase.responsavel === 'cliente' && fase.gatilhoTipo === 'fim_fase_anterior'

              return (
                <li
                  key={idx}
                  className={`rounded-lg border p-4 transition ${
                    desabilitada
                      ? 'bg-slate-50 border-slate-200 opacity-50'
                      : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        <span>
                          {idx + 1}. {fase.nome}
                        </span>
                        {desabilitada && (
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                            desabilitada
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Gatilho: <strong>{rotuloGatilho(fase.gatilhoTipo)}</strong> ·{' '}
                        {fase.responsavel === 'empresa' ? '🟢 Fábrica' : '🟡 Obra (cliente)'}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                        Prazo (dias)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={fase.prazoDias}
                        onChange={(e) => atualizarPrazoFase(idx, parseInt(e.target.value) || 0)}
                        disabled={desabilitada || semPrazoEdit}
                        className="w-20 text-center border border-slate-300 rounded px-2 py-1.5 text-sm font-medium focus:border-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                  {semPrazoEdit && !desabilitada && (
                    <p className="text-[11px] text-slate-400 mt-2 italic">
                      Sem prazo fixo — depende do cliente liberar quando o vão estiver pronto.
                    </p>
                  )}
                </li>
              )
            })}
          </ol>

          {/* Prazo contratual (a partir da liberação do vão) */}
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
            ⏱ Prazo contratual a partir da <strong>liberação do vão</strong>:{' '}
            <strong className="text-slate-800">{prazoContratual} dias</strong>{' '}
            (M2 + Conclusão — o que vale no contrato)
          </div>

          <div className="mt-6 flex gap-3 justify-end flex-wrap">
            <button
              onClick={confirmarCriacao}
              disabled={criando || fasesParaCriar().length === 0}
              className="btn-primary"
            >
              {criando ? 'Criando…' : `Criar cronograma com ${fasesParaCriar().length} fases`}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          💡 Os prazos travam após criar. Pra ajustar, use "Apagar e recomeçar" — enquanto o
          cliente não aceitar.
        </p>

        {confirmDialog}
      </div>
    )
  }

  // ============ Estado 2: COM cronograma criado ============
  const { demanda, faseAtual } = calcularDemandaAtual(cronogramaInferido)
  const corDemanda =
    demanda === 'cliente'
      ? 'bg-yellow-50 border-yellow-300 text-yellow-900'
      : demanda === 'empresa'
      ? 'bg-green-50 border-green-300 text-green-900'
      : demanda === 'concluido'
      ? 'bg-slate-100 border-slate-300 text-slate-700'
      : 'bg-slate-50 border-slate-200 text-slate-600'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {obraId && (
        <button
          onClick={voltarParaObra}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4 transition"
        >
          ← Voltar pra obra
        </button>
      )}
      <h1 className="text-2xl font-bold mb-1">Cronograma da Obra</h1>
      <p className="text-slate-600 mb-6">{obraNome}</p>

      {/* Box de DEMANDA atual */}
      <div className={`rounded-lg border-2 ${corDemanda} p-4 mb-6`}>
        <div className="font-semibold text-lg">
          {emojiDemanda(demanda)} {rotuloDemanda(demanda)}
        </div>
        {faseAtual && (
          <div className="text-sm mt-1">
            Fase atual: <strong>{faseAtual.nome}</strong>
          </div>
        )}
        {!cronogramaInferido.aceitoEm && (
          <div className="text-sm mt-1 italic">Aguardando o cliente aceitar o cronograma.</div>
        )}
      </div>

      {/* Lista de fases — sem botão "Marcar concluída" (status é inferido dos cards) */}
      <h2 className="text-lg font-semibold mb-3">Fases:</h2>
      <ol className="space-y-2">
        {cronogramaInferido.fases.map((fase) => (
          <li
            key={fase.id}
            className={`rounded-lg border p-4 ${
              fase.status === 'concluida'
                ? 'bg-green-50 border-green-200'
                : fase.status === 'em_andamento'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="font-semibold flex items-center gap-2 flex-wrap">
              <span>
                {fase.ordem}. {fase.nome}
              </span>
              {fase.status === 'concluida' && (
                <span className="text-xs text-green-700">✅ {fase.concluidaEm}</span>
              )}
              {fase.status === 'em_andamento' && (
                <span className="text-[10px] uppercase font-bold text-yellow-800 bg-yellow-200 px-1.5 py-0.5 rounded">
                  em andamento
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Gatilho: {rotuloGatilho(fase.gatilhoTipo)} · {fase.prazoDias} dias ·{' '}
              {fase.responsavel === 'empresa' ? '🟢 Fábrica' : '🟡 Obra'}
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-slate-400 mt-8">
        💡 O status das fases é calculado automaticamente do estado dos cards (medições
        preenchidas, aceites finais). Não há botão "marcar concluída" — basta trabalhar
        normalmente nos cards.
      </p>

      {/* Rodapé — apagar (só se ainda não aceito) */}
      {!cronogramaInferido.aceitoEm && (
        <div className="mt-8 pt-4 border-t border-slate-200">
          <button
            onClick={handleApagarCronograma}
            disabled={apagando}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 hover:border-red-300 transition disabled:opacity-50"
          >
            🗑 {apagando ? 'Apagando…' : 'Apagar cronograma e recomeçar'}
          </button>
          <p className="text-xs text-slate-400 mt-2">
            Disponível só enquanto o cliente não aceitar.
          </p>
        </div>
      )}

      {confirmDialog}
    </div>
  )
}
