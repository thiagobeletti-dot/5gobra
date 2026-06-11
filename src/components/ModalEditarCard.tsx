// Modal de edição dos dados básicos de um card (item da obra).
//
// Cravado 11/06/2026 após Anderson (primeiro cliente) reportar que importou
// PDF e os dados ficaram errados — pediu pra editar dentro do card.
// CRUD sem U no card. Corrigido aqui.
//
// Campos editáveis: Sigla, Nome, Descrição.
// NÃO editáveis (intencional):
//   - id, obra_id, tipo, aba (geridos pelo fluxo de estados)
//   - encerrado, aceite_final, created_at (preservam histórico/aceite jurídico)
//
// Localização vai sair da descrição e virar campo dedicado no V2 (#183) — por
// enquanto fica embutido na string `descricao`.

import { useState } from 'react'
import { atualizarCard } from '../lib/api'
import { useEscClose } from '../hooks/useEscClose'
import { mensagemDeErro } from '../lib/erros'
import type { Card } from '../types/obra'

interface ModalEditarCardProps {
  card: Card
  onClose: () => void
  onSalvo: () => void  // chamado depois de salvar pra recarregar dados
}

export default function ModalEditarCard({ card, onClose, onSalvo }: ModalEditarCardProps) {
  const [sigla, setSigla] = useState(card.sigla ?? '')
  const [nome, setNome] = useState(card.nome ?? '')
  const [descricao, setDescricao] = useState(card.descricao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEscClose(true, onClose)

  async function salvar() {
    setErro(null)
    if (!sigla.trim()) {
      setErro('A sigla não pode ficar vazia.')
      return
    }
    if (!nome.trim()) {
      setErro('O nome do item não pode ficar vazio.')
      return
    }
    setSalvando(true)
    try {
      await atualizarCard(card.id, {
        sigla: sigla.trim(),
        nome: nome.trim(),
        descricao: descricao.trim(),
      })
      onSalvo()
    } catch (e) {
      setErro(mensagemDeErro(e))
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold mb-1">Editar dados do item</div>
            <div className="text-sm text-slate-500">
              Corrige sigla, nome e descrição. Histórico, fotos e medições continuam intactos.
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Sigla *
            </label>
            <input
              type="text"
              value={sigla}
              onChange={(e) => setSigla(e.target.value.toUpperCase())}
              className="input"
              placeholder="Ex: IT1, PA2, JA3"
              autoFocus
              maxLength={20}
            />
            <p className="text-xs text-slate-500 mt-1">
              Curta e identificável. Aparece no card e no dossiê.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Nome do item *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input"
              placeholder="Ex: Janela de Correr 02 Folhas"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input min-h-[100px] resize-y"
              placeholder="Descrição completa do item (linha, local, dimensões, vidro, cor...)"
            />
            <p className="text-xs text-slate-500 mt-1">
              Detalhes técnicos. Cliente vê no link de acompanhamento.
            </p>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-2 justify-end bg-slate-50">
          <button className="btn-ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
