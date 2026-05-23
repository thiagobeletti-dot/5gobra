// Página Cronograma — V1
// Empresa configura cronograma de fases pra obra
// Cliente vê via link mágico (componente compartilhado, com modos diferentes)
//
// Acessado via /obra/:id?aba=cronograma (empresa logada)
//          ou /obra/:token (cliente) — aba "Cronograma"

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { pegarObraPorId } from '../lib/api'
import {
  pegarCronogramaPorObra,
  criarCronograma,
  marcarFaseConcluida,
  apagarCronograma,
  calcularDemandaAtual,
  emojiDemanda,
  rotuloDemanda,
  rotuloGatilho,
  type NovaFaseInput,
} from '../lib/cronograma'
import { useConfirm } from '../hooks/useConfirm'
import { TEMPLATES_CRONOGRAMA, type Cronograma as CronogramaT } from '../types/cronograma'

export default function Cronograma() {
  const { id: obraId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirmar, dialog: confirmDialog } = useConfirm()
  const [cronograma, setCronograma] = useState<CronogramaT | null>(null)
  const [obraNome, setObraNome] = useState<string>('')
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [apagando, setApagando] = useState(false)

  // Carrega obra + cronograma
  useEffect(() => {
    if (!obraId) return
    setCarregando(true)
    Promise.all([pegarObraPorId(obraId), pegarCronogramaPorObra(obraId)])
      .then(([obra, crono]) => {
        if (obra) setObraNome(obra.nome ?? '')
        setCronograma(crono)
      })
      .finally(() => setCarregando(false))
  }, [obraId])

  // Cria cronograma usando template
  async function handleCriarTemplate(templateKey: keyof typeof TEMPLATES_CRONOGRAMA) {
    if (!obraId) return
    setCriando(true)

    const tpl = TEMPLATES_CRONOGRAMA[templateKey]
    const fases: NovaFaseInput[] = tpl.fases.map((f, idx) => ({
      ordem: idx + 1,
      nome: f.nome,
      gatilhoTipo: f.gatilhoTipo,
      prazoDias: f.prazoDias,
      responsavel: f.responsavel,
    }))

    const novo = await criarCronograma({
      obraId,
      modoContagem: 'por_lote',
      fases,
    })

    if (novo) setCronograma(novo)
    setCriando(false)
  }

  async function handleConcluirFase(faseId: string) {
    if (!cronograma) return
    const ok = await marcarFaseConcluida(faseId, cronograma.id, 'Empresa')
    if (ok) {
      // Recarrega
      const atualizado = await pegarCronogramaPorObra(cronograma.obraId)
      setCronograma(atualizado)
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
    setCronograma(null) // volta pro estado "sem cronograma" (escolher template)
  }

  function voltarParaObra() {
    if (!obraId) return
    navigate(`/app/obra/${obraId}`)
  }

  if (carregando) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Carregando cronograma…</p>
      </div>
    )
  }

  // ============ Estado 1: SEM cronograma ainda ============
  if (!cronograma) {
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
        <h1 className="text-2xl font-bold mb-2">Cronograma da Obra</h1>
        <p className="text-slate-600 mb-1">{obraNome}</p>
        <p className="text-slate-500 text-sm mb-8">
          O cronograma vira um <strong>compromisso bilateral</strong> entre você e o cliente.
          Define os prazos, ele aceita, e tudo fica registrado com peso jurídico.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Escolha um modelo pra começar:</h2>

          <div className="space-y-3">
            <button
              onClick={() => handleCriarTemplate('HORIZONTAL_SIMPLES')}
              disabled={criando}
              className="w-full text-left rounded-lg border border-slate-300 p-4 hover:border-orange-500 hover:bg-orange-50 transition disabled:opacity-50"
            >
              <div className="font-semibold">📋 Simples</div>
              <div className="text-sm text-slate-500">Medição → Fabricação → Instalação. Sem contramarco.</div>
            </button>

            <button
              onClick={() => handleCriarTemplate('HORIZONTAL_COM_CONTRAMARCO')}
              disabled={criando}
              className="w-full text-left rounded-lg border border-slate-300 p-4 hover:border-orange-500 hover:bg-orange-50 transition disabled:opacity-50"
            >
              <div className="font-semibold">🏗️ Com contramarco</div>
              <div className="text-sm text-slate-500">
                M1 → Contramarco → Liberação do vão → Fabricação → Instalação. Prazo só conta da liberação.
              </div>
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            💡 Você pode apagar e recomeçar enquanto o cliente não aceitar.
          </p>
        </div>
      </div>
    )
  }

  // ============ Estado 2: COM cronograma ============
  const { demanda, faseAtual } = calcularDemandaAtual(cronograma)
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
        {!cronograma.aceitoEm && (
          <div className="text-sm mt-1 italic">Aguardando o cliente aceitar o cronograma.</div>
        )}
      </div>

      {/* Lista de fases */}
      <h2 className="text-lg font-semibold mb-3">Fases:</h2>
      <ol className="space-y-2">
        {cronograma.fases.map((fase) => (
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold">
                  {fase.ordem}. {fase.nome}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Gatilho: {rotuloGatilho(fase.gatilhoTipo)} · {fase.prazoDias} dias ·{' '}
                  {fase.responsavel === 'empresa' ? '🟢 Fábrica' : '🟡 Obra'}
                </div>
                {fase.previsaoFim && (
                  <div className="text-xs text-slate-500 mt-1">Previsão: {fase.previsaoFim}</div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {fase.status === 'em_andamento' && fase.responsavel === 'empresa' && (
                  <button
                    onClick={() => handleConcluirFase(fase.id)}
                    className="px-3 py-1.5 text-sm rounded bg-orange-500 text-white hover:bg-orange-600 transition"
                  >
                    Marcar concluída
                  </button>
                )}
                {fase.status === 'concluida' && (
                  <span className="text-xs text-green-700">✅ {fase.concluidaEm}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-slate-400 mt-8">
        💡 V1 não permite editar prazos após criar o cronograma. Se algo desencaixar, converse
        com o cliente fora do sistema.
      </p>

      {/* Rodapé — apagar (só se ainda não aceito) */}
      {!cronograma.aceitoEm && (
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
