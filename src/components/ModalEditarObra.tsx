// Modal de edição dos dados básicos da obra.
//
// Cravado 11/06/2026 após Anderson (primeiro cliente) reportar que errou
// no nome ao criar e não tinha como editar (CRUD sem U).
//
// Campos editáveis: Nome, Cliente nome, Endereço, Telefone, Email.
// NÃO editáveis (intencional): id, empresa_id, token_cliente, created_at,
// inicio — esses são imutáveis pra preservar histórico/aceite jurídico.

import { useState } from 'react'
import { atualizarObra, aplicarModoGerencialNaObra } from '../lib/api'
import { useEscClose } from '../hooks/useEscClose'
import { mensagemDeErro } from '../lib/erros'
import type { ObraRow } from '../lib/api'

interface ModalEditarObraProps {
  obra: ObraRow
  onClose: () => void
  onSalvo: () => void  // chamado depois de salvar pra recarregar dados
}

export default function ModalEditarObra({ obra, onClose, onSalvo }: ModalEditarObraProps) {
  const [nome, setNome] = useState(obra.nome ?? '')
  const [clienteNome, setClienteNome] = useState(obra.cliente_nome ?? '')
  const [endereco, setEndereco] = useState(obra.endereco ?? '')
  const [clienteTelefone, setClienteTelefone] = useState(obra.cliente_telefone ?? '')
  const [clienteEmail, setClienteEmail] = useState(obra.cliente_email ?? '')
  const [interacaoCliente, setInteracaoCliente] = useState(obra.interacao_cliente ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEscClose(true, onClose)

  async function salvar() {
    setErro(null)
    if (!nome.trim()) {
      setErro('O nome da obra não pode ficar vazio.')
      return
    }
    setSalvando(true)
    try {
      await atualizarObra(obra.id, {
        nome: nome.trim(),
        cliente_nome: clienteNome.trim() || null,
        endereco: endereco.trim() || null,
        cliente_telefone: clienteTelefone.trim() || null,
        cliente_email: clienteEmail.trim() || null,
        interacao_cliente: interacaoCliente,
      })
      // Arrastão: se acabou de DESLIGAR a interação, resolve as pendências que
      // dependiam do cliente (cliente→Técnica; conclusão sem aceite→encerrado).
      if ((obra.interacao_cliente ?? true) && !interacaoCliente) {
        await aplicarModoGerencialNaObra(obra.id)
      }
      onSalvo()
    } catch (e) {
      setErro(mensagemDeErro(e))
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40"
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
            <div className="text-lg font-bold mb-1">Editar dados da obra</div>
            <div className="text-sm text-slate-500">
              Corrija o nome, cliente, endereço e contato. Outros campos (histórico, peças, cronograma) ficam intactos.
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
              Nome da obra *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input"
              placeholder="Nome da obra"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Nome do cliente
            </label>
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              className="input"
              placeholder="Ex: HÉRCULES BARBIERI"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Endereço da obra
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="input"
              placeholder="Rua, número, bairro, cidade"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Telefone do cliente
              </label>
              <input
                type="tel"
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                className="input"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                E-mail do cliente
              </label>
              <input
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                className="input"
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={interacaoCliente}
                onChange={(e) => setInteracaoCliente(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-laranja focus:ring-laranja"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Interação do cliente</span>
                <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                  <strong>Ligado:</strong> o cliente recebe o link, acompanha a obra e dá os aceites.{' '}
                  <strong>Desligado:</strong> obra em modo gerencial (só empresa) — sem portal do cliente.
                  Itens novos já entram em Técnica (pulam o aceite inicial) e a peça é finalizada ao
                  concluir, sem esperar o aceite do cliente. A prova continua na foto do técnico.
                </span>
              </span>
            </label>
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
