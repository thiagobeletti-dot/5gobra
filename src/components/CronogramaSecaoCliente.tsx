// CronogramaSecaoCliente — exibe o cronograma da obra no link mágico do cliente
// e oferece os botões de Aceitar (se não aceito) e Marcar vão liberado (quando aplicável).
//
// V1.1: status das fases é INFERIDO automaticamente do estado dos cards.
// Cliente não vê botão "Marcar fase concluída" — só "Aceitar" e "Marcar vão liberado".

import { useEffect, useMemo, useState } from 'react'
import type { DbClient } from '../lib/supabase'
import {
  pegarCronogramaPorObra,
  aceitarCronograma,
  calcularDemandaAtual,
  emojiDemanda,
  rotuloDemanda,
  rotuloGatilho,
  inferirStatusFases,
} from '../lib/cronograma'
import type { Cronograma as CronogramaT } from '../types/cronograma'
import type { Card } from '../types/obra'

interface Props {
  obraId: string
  client: DbClient | null
  cards: Card[]
  onToast?: (msg: string) => void
}

export default function CronogramaSecaoCliente({ obraId, client, cards, onToast }: Props) {
  const [cronograma, setCronograma] = useState<CronogramaT | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [expandido, setExpandido] = useState(false)

  async function recarregar() {
    const c = await pegarCronogramaPorObra(obraId, client)
    setCronograma(c)
  }

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    pegarCronogramaPorObra(obraId, client)
      .then((c) => {
        if (!cancelado) setCronograma(c)
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [obraId, client])

  // Aplica inferência automática
  const cronogramaInferido = useMemo(() => {
    if (!cronograma) return null
    return inferirStatusFases(cronograma, cards)
  }, [cronograma, cards])

  async function handleAceitar() {
    if (!cronograma) return
    setSalvando(true)
    const ok = await aceitarCronograma({
      cronogramaId: cronograma.id,
      userAgent: navigator.userAgent,
      client,
    })
    setSalvando(false)
    if (ok) {
      await recarregar()
      onToast?.('Cronograma aceito — registrado oficialmente')
    } else {
      onToast?.('Não foi possível aceitar. Tente recarregar a página.')
    }
  }

  if (carregando || !cronogramaInferido) return null

  const { demanda, faseAtual } = calcularDemandaAtual(cronogramaInferido)
  const aceito = !!cronogramaInferido.aceitoEm

  const corBox = !aceito
    ? 'bg-laranja-soft border-laranja-border'
    : demanda === 'cliente'
    ? 'bg-yellow-50 border-yellow-300'
    : demanda === 'empresa'
    ? 'bg-emerald-50 border-emerald-200'
    : demanda === 'concluido'
    ? 'bg-slate-100 border-slate-300'
    : 'bg-slate-50 border-slate-200'

  return (
    <div className={`rounded-lg border-2 ${corBox} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base" aria-hidden>📅</span>
        <h2 className="font-bold text-sm md:text-base">Cronograma da obra</h2>
      </div>

      {aceito ? (
        <>
          <div className="text-sm font-semibold mb-1">
            {emojiDemanda(demanda)} {rotuloDemanda(demanda)}
          </div>
          {faseAtual && (
            <div className="text-xs text-slate-600 mb-2">
              Fase atual: <strong>{faseAtual.nome}</strong>
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-slate-700 mb-3">
          A empresa montou um cronograma de fases pra essa obra. Quando você aceitar,
          ele vira um compromisso bilateral com peso jurídico.
        </div>
      )}

      {/* Ações principais — apenas Aceitar (único ato direto no cronograma) + Ver fases */}
      <div className="flex gap-2 flex-wrap">
        {!aceito && (
          <button
            className="btn-primary"
            disabled={salvando}
            onClick={handleAceitar}
          >
            {salvando ? 'Aceitando…' : 'Aceitar cronograma'}
          </button>
        )}

        <button
          onClick={() => setExpandido((v) => !v)}
          className="btn-ghost"
        >
          {expandido ? 'Ocultar fases' : `Ver fases (${cronogramaInferido.fases.length})`}
        </button>
      </div>

      {/* Texto explicando que o avanço acontece nos cards */}
      {aceito && (
        <p className="text-[11px] text-slate-600 mt-3 italic">
          O cronograma avança automaticamente conforme você confirma cada item nos cards
          abaixo.
        </p>
      )}

      {expandido && (
        <ol className="mt-4 space-y-2">
          {cronogramaInferido.fases.map((fase) => (
            <li
              key={fase.id}
              className={`rounded-md border px-3 py-2 text-xs ${
                fase.status === 'concluida'
                  ? 'bg-green-50 border-green-200'
                  : fase.status === 'em_andamento'
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="font-semibold text-slate-800">
                {fase.ordem}. {fase.nome}
              </div>
              <div className="text-slate-600 mt-0.5">
                Gatilho: {rotuloGatilho(fase.gatilhoTipo)} · {fase.prazoDias} dias ·{' '}
                {fase.responsavel === 'empresa' ? '🟢 Fábrica' : '🟡 Obra'}
              </div>
              {fase.concluidaEm && (
                <div className="text-[11px] text-green-700 mt-0.5">✅ Concluída em {fase.concluidaEm}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
