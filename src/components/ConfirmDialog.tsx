// Modal de confirmacao reutilizavel.
//
// Substitui window.confirm() e window.prompt(), que sao feios, sem A11y, e
// nao se integram com o visual do app. Adicional: suporte a confirmacao
// por digitacao (typeToConfirm), pra acoes irreversiveis tipo apagar.
//
// Uso:
//   const [confirmar, setConfirmar] = useState(false)
//
//   <ConfirmDialog
//     aberto={confirmar}
//     titulo="Apagar este item?"
//     descricao="Essa acao e definitiva e nao pode ser desfeita."
//     labelConfirmar="Apagar"
//     destrutivo
//     digitacaoExigida="APAGAR"
//     onConfirmar={async (motivo) => { await apagar(); setConfirmar(false) }}
//     onCancelar={() => setConfirmar(false)}
//   />

import { useEffect, useState } from 'react'
import { useEscClose } from '../hooks/useEscClose'

interface Props {
  /** Se o dialog ta aberto. */
  aberto: boolean
  /** Titulo principal. */
  titulo: string
  /** Texto explicativo abaixo do titulo. */
  descricao?: string
  /** Texto do botao de confirmacao. Default: "Confirmar". */
  labelConfirmar?: string
  /** Texto do botao de cancelar. Default: "Cancelar". */
  labelCancelar?: string
  /** Se true, botao de confirmar fica vermelho (acao destrutiva). */
  destrutivo?: boolean
  /**
   * Se setado, exige que usuario digite essa palavra exatamente pra liberar
   * o botao de confirmar. Pra acoes muito perigosas (apagar permanentemente).
   */
  digitacaoExigida?: string
  /** Se true, mostra textarea pro usuario digitar um motivo. */
  pedirMotivo?: boolean
  /** Texto do placeholder do motivo. */
  placeholderMotivo?: string
  /** Callback quando confirma. Recebe o motivo (se pedirMotivo=true). */
  onConfirmar: (motivo?: string) => void | Promise<void>
  /** Callback quando cancela ou fecha. */
  onCancelar: () => void
}

export default function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  labelConfirmar = 'Confirmar',
  labelCancelar = 'Cancelar',
  destrutivo = false,
  digitacaoExigida,
  pedirMotivo = false,
  placeholderMotivo = 'Conte rapidamente o motivo (opcional)',
  onConfirmar,
  onCancelar,
}: Props) {
  const [textoDigitado, setTextoDigitado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEscClose(aberto, onCancelar)

  // Reseta os campos toda vez que abre
  useEffect(() => {
    if (aberto) {
      setTextoDigitado('')
      setMotivo('')
      setErro(null)
      setConfirmando(false)
    }
  }, [aberto])

  if (!aberto) return null

  const digitacaoOk = !digitacaoExigida || textoDigitado === digitacaoExigida
  const podeConfirmar = digitacaoOk && !confirmando

  async function executar() {
    if (!podeConfirmar) {
      if (!digitacaoOk) {
        setErro('Digite exatamente "' + digitacaoExigida + '" pra confirmar.')
      }
      return
    }
    setConfirmando(true)
    setErro(null)
    try {
      await onConfirmar(pedirMotivo ? motivo : undefined)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao confirmar.')
      setConfirmando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={() => !confirmando && onCancelar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-titulo"
    >
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <h2 id="confirm-titulo" className="text-lg font-bold mb-2">{titulo}</h2>
          {descricao && (
            <p className="text-sm text-slate-600 mb-4">{descricao}</p>
          )}

          {pedirMotivo && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Motivo
              </label>
              <textarea
                className="input min-h-[70px]"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={placeholderMotivo}
                autoFocus={!digitacaoExigida}
                disabled={confirmando}
              />
            </div>
          )}

          {digitacaoExigida && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Pra confirmar, digite a palavra <strong className="text-slate-900">{digitacaoExigida}</strong> (em maiusculo)
              </label>
              <input
                className="input font-mono"
                value={textoDigitado}
                onChange={(e) => { setTextoDigitado(e.target.value); setErro(null) }}
                placeholder={digitacaoExigida}
                autoFocus
                disabled={confirmando}
                aria-label={'Digite ' + digitacaoExigida + ' pra confirmar'}
              />
            </div>
          )}

          {erro && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
              {erro}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onCancelar}
            disabled={confirmando}
            className="btn-ghost"
          >
            {labelCancelar}
          </button>
          <button
            onClick={executar}
            disabled={!podeConfirmar}
            className={destrutivo ? 'bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed' : 'btn-primary'}
            aria-disabled={!podeConfirmar}
          >
            {confirmando ? 'Aguarde...' : labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
