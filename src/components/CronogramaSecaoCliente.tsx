// CronogramaSecaoCliente — exibe o cronograma da obra no link mágico do cliente
// e oferece os botões de Aceitar (se não aceito) e Marcar vão liberado (quando aplicável).
//
// V1 sem renegociação: cliente só pode aceitar OU marcar vão liberado.

import { useEffect, useState } from 'react'
import type { DbClient } from '../lib/supabase'
import {
  pegarCronogramaPorObra,
  aceitarCronograma,
  marcarVaoLiberado,
  calcularDemandaAtual,
  emojiDemanda,
  rotuloDemanda,
  rotuloGatilho,
} from '../lib/cronograma'
import type { Cronograma as CronogramaT } from '../types/cronograma'

interface Props {
  obraId: string
  client: DbClient | null
  onToast?: (msg: string) => void
}

export default function CronogramaSecaoCliente({ obraId, client, onToast }: Props) {
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

  async function handleMarcarVaoLiberado() {
    if (!cronograma) return
    setSalvando(true)
    const ok = await marcarVaoLiberado({
      cronogramaId: cronograma.id,
      userAgent: navigator.userAgent,
      client,
    })
    setSalvando(false)
    if (ok) {
      await recarregar()
      onToast?.('Vão marcado como liberado — empresa pode prosseguir')
    } else {
      onToast?.('Não foi possível registrar. Tente recarregar a página.')
    }
  }

  // Sem cronograma — não renderiza nada (silencioso)
  if (carregando || !cronograma) return null

  const { demanda, faseAtual } = calcularDemandaAtual(cronograma)
  const aceito = !!cronograma.aceitoEm
  const temGatilhoVao = cronograma.fases.some((f) => f.gatilhoTipo === 'liberacao_vao')
  const faseVaoAguardando = cronograma.fases.find(
    (f) => f.gatilhoTipo === 'liberacao_vao' && f.status === 'aguardando_gatilho',
  )
  const podeMarcarVao = aceito && !cronograma.vaoLiberadoEm && temGatilhoVao && !!faseVaoAguardando

  // Cor do box conforme estado
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

      {/* Box de DEMANDA */}
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

      {/* Botão Aceitar */}
      {!aceito && (
        <button
          className="btn-primary w-full md:w-auto"
          disabled={salvando}
          onClick={handleAceitar}
        >
          {salvando ? 'Aceitando...' : 'Aceitar cronograma'}
        </button>
      )}

      {/* Botão Marcar vão liberado */}
      {podeMarcarVao && (
        <div className="mt-3 pt-3 border-t border-yellow-200">
          <div className="text-xs text-slate-700 mb-2">
            Quando o vão estiver pronto (paredes acabadas, contramarco instalado), avise
            pra empresa começar a fabricação:
          </div>
          <button
            className="btn-primary w-full md:w-auto"
            disabled={salvando}
            onClick={handleMarcarVaoLiberado}
          >
            {salvando ? 'Registrando...' : 'Marcar vão liberado'}
          </button>
        </div>
      )}

      {/* Toggle expandir lista de fases */}
      <button
        onClick={() => setExpandido((v) => !v)}
        className="text-xs text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline mt-3 transition"
      >
        {expandido ? 'Ocultar fases' : `Ver todas as fases (${cronograma.fases.length})`}
      </button>

      {expandido && (
        <ol className="mt-3 space-y-2">
          {cronograma.fases.map((fase) => (
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
