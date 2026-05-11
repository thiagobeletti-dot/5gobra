// Modal de Documentos da obra — sidebar Documentos abre essa tela.
//
// 2 abas:
//   - Medicao: gera PDF com M1/M2 das PEÇAS selecionadas (so peca, ja que
//     acordos/apontamentos nao tem M1/M2).
//   - Dossie: gera PDF com timeline de eventos publicos. Inclui pecas + acordos
//     + apontamentos (dossie e prova oficial da obra inteira — decisoes
//     contratuais e problemas resolvidos tambem entram).

import { useEffect, useMemo, useState } from 'react'
import type { Card, DadosObra } from '../types/obra'
import { listarHistoricoEmLote } from '../lib/api'
import { useEscClose } from '../hooks/useEscClose'
import { mensagemDeErro } from '../lib/erros'
import {
  gerarPdfMedicao,
  gerarPdfDossie,
  baixarPdf,
  nomeArquivoMedicao,
  nomeArquivoDossie,
  type EmpresaInfo,
} from '../lib/pdf-documentos'

type Aba = 'medicao' | 'dossie'

interface Props {
  obra: DadosObra
  empresa: EmpresaInfo
  aberto: boolean
  onFechar: () => void
}

export default function ModalDocumentos({ obra, empresa, aberto, onFechar }: Props) {
  const [aba, setAba] = useState<Aba>('medicao')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [incluirFotos, setIncluirFotos] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  useEscClose(aberto, onFechar)

  // Medicao: so pecas (M1/M2 nao se aplica a acordo/apontamento).
  // Dossie: todos os cards (a timeline tem valor pra qualquer tipo).
  // Ordena por sigla com natural sort (J1_1 < J1_3 < J1_10) pra UI bater com o PDF.
  const cardsParaListar = useMemo(
    () => {
      const filtrado = aba === 'medicao'
        ? obra.cards.filter((c) => c.tipo === 'peca')
        : obra.cards
      return [...filtrado].sort((a, b) =>
        a.sigla.localeCompare(b.sigla, 'pt-BR', { numeric: true })
      )
    },
    [obra.cards, aba],
  )

  useEffect(() => {
    // Reseta selecao quando troca de aba
    setSelecionados(new Set())
    setErro(null)
    setInfo(null)
  }, [aba])

  useEffect(() => {
    if (!aberto) {
      setSelecionados(new Set())
      setErro(null)
      setInfo(null)
    }
  }, [aberto])

  if (!aberto) return null

  function toggle(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function selecionarTodos() {
    if (selecionados.size === cardsParaListar.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(cardsParaListar.map((p) => p.id)))
    }
  }

  async function exportar() {
    setErro(null)
    setInfo(null)
    if (selecionados.size === 0) {
      setErro(aba === 'medicao'
        ? 'Selecione pelo menos uma peça pra exportar.'
        : 'Selecione pelo menos um item pra exportar.')
      return
    }
    setGerando(true)
    try {
      const cardsSelecionados = cardsParaListar.filter((p) => selecionados.has(p.id))
      let bytes: Uint8Array
      let filename: string

      if (aba === 'medicao') {
        bytes = await gerarPdfMedicao(obra.obra, empresa, cardsSelecionados, { incluirFotos })
        filename = nomeArquivoMedicao(obra.obra)
      } else {
        const ids = cardsSelecionados.map((c) => c.id)
        const historicoMap = await listarHistoricoEmLote(ids) // ja filtra interno=false
        bytes = await gerarPdfDossie(obra.obra, empresa, cardsSelecionados, historicoMap, { incluirFotos })
        filename = nomeArquivoDossie(obra.obra)
      }

      baixarPdf(bytes, filename)
      setInfo('PDF gerado: ' + filename)
    } catch (e) {
      console.error('[ModalDocumentos] erro ao gerar PDF:', e)
      setErro(mensagemDeErro(e))
    } finally {
      setGerando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold">Documentos da obra</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {aba === 'medicao'
                ? 'Ficha de Medição: dados de M1/M2 das peças selecionadas.'
                : 'Dossiê: linha do tempo de peças, acordos e apontamentos.'}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <TabBtn ativo={aba === 'medicao'} onClick={() => setAba('medicao')}>
            Medição
            <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
              M1 e M2 estruturadas
            </span>
          </TabBtn>
          <TabBtn ativo={aba === 'dossie'} onClick={() => setAba('dossie')}>
            Dossiê
            <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
              Linha do tempo da obra
            </span>
          </TabBtn>
        </div>

        {/* Conteudo */}
        <div className="flex-1 overflow-y-auto p-6">
          {cardsParaListar.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              {aba === 'medicao'
                ? 'Essa obra ainda não tem peças cadastradas.'
                : 'Essa obra ainda não tem cards.'}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={selecionarTodos}
                  className="text-xs text-laranja-dark hover:text-laranja font-semibold"
                >
                  {selecionados.size === cardsParaListar.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <span className="text-xs text-slate-500">
                  {selecionados.size} de {cardsParaListar.length} selecionado{cardsParaListar.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {cardsParaListar.map((c) => (
                  <ItemCard
                    key={c.id}
                    card={c}
                    aba={aba}
                    marcado={selecionados.has(c.id)}
                    onToggle={() => toggle(c.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          {erro && <div className="text-sm text-red-600 mb-3">{erro}</div>}
          {info && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 mb-3">{info}</div>}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={incluirFotos}
                onChange={(e) => setIncluirFotos(e.target.checked)}
                className="w-4 h-4 accent-orange-600"
                disabled={gerando}
              />
              Incluir fotos no PDF
              <span className="text-xs text-slate-400">(até 4 por peça)</span>
            </label>
            <div className="flex items-center gap-3">
              <button onClick={onFechar} className="btn-ghost text-sm" disabled={gerando}>
                Fechar
              </button>
              <button
                onClick={exportar}
                disabled={gerando || selecionados.size === 0}
                className="btn-primary text-sm"
              >
                {gerando ? 'Gerando PDF...' : 'Exportar PDF (' + selecionados.size + ')'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'flex-1 px-4 py-3 text-sm font-semibold transition border-b-2 ' +
        (ativo
          ? 'text-laranja-dark border-laranja bg-orange-50'
          : 'text-slate-600 border-transparent hover:bg-slate-50')
      }
    >
      {children}
    </button>
  )
}

function ItemCard({ card, aba, marcado, onToggle }: { card: Card; aba: Aba; marcado: boolean; onToggle: () => void }) {
  const m1 = card.checklists.find((c) => c.tipo === 'medicao1')
  const m2 = card.checklists.find((c) => c.tipo === 'medicao2')
  const eventosPublicos = card.historico.filter((h) => !h.interno).length
  const tipoLabel = { peca: 'Item', acordo: 'Acordo', reclamacao: 'Apontamento' }[card.tipo]
  const tipoClasses = {
    peca: 'bg-peca-soft text-peca-dark border-peca-border',
    acordo: 'bg-acordo-soft text-acordo-dark border-acordo-border',
    reclamacao: 'bg-amber-50 text-amber-700 border-amber-200',
  }[card.tipo]

  return (
    <label className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-laranja transition">
      <input
        type="checkbox"
        checked={marcado}
        onChange={onToggle}
        className="mt-1 w-4 h-4 accent-orange-600"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={'inline-block text-[10px] font-bold border rounded-full px-2 py-0.5 ' + tipoClasses}>
            {tipoLabel}
          </span>
          <span className="font-bold text-sm">{card.sigla}</span>
          <span className="text-sm text-slate-700 truncate">{card.nome}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {aba === 'medicao' ? (
            <>
              <Pill ok={!!m1}>M1 {m1 ? 'preenchida' : 'pendente'}</Pill>
              <Pill ok={!!m2} neutralIfFalse>
                M2 {m2 ? 'preenchida' : 'não realizada'}
              </Pill>
            </>
          ) : (
            <Pill ok={eventosPublicos > 0}>
              {eventosPublicos} evento{eventosPublicos === 1 ? '' : 's'} público{eventosPublicos === 1 ? '' : 's'}
            </Pill>
          )}
        </div>
      </div>
    </label>
  )
}

function Pill({ ok, neutralIfFalse, children }: { ok: boolean; neutralIfFalse?: boolean; children: React.ReactNode }) {
  const cls = ok
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : neutralIfFalse
      ? 'bg-slate-50 text-slate-500 border-slate-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
  return (
    <span className={'inline-block text-[10px] font-medium border rounded-full px-2 py-0.5 mr-1.5 ' + cls}>
      {children}
    </span>
  )
}
