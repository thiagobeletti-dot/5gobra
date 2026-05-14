// Modal de compra pública — captura dados do visitante na landing,
// chama Edge Function `comprar-publico` (que cria customer + subscription no Asaas)
// e redireciona pra invoiceUrl do Asaas.
//
// Fluxo end-to-end:
//   1. Visitante clica "Comprar" na landing
//   2. Modal abre com form (nome, email, whatsapp, cpf/cnpj, cupom)
//   3. Submit → Edge Function → invoiceUrl
//   4. Frontend redireciona pra invoiceUrl (página do Asaas pra pagamento)
//   5. Cliente paga
//   6. Webhook Asaas → cria empresa + dispara /cadastro?token=X
//
// Captura ?ref=parceiro_xpto da URL (programa de afiliados).

import { useEffect, useState, FormEvent } from 'react'
import { comprarPublico } from '../lib/asaas'
import { useEscClose } from '../hooks/useEscClose'

interface Props {
  aberto: boolean
  onFechar: () => void
  /** Cupom pré-preenchido (vindo do pop-up de saída, por ex.) */
  cupomInicial?: string
}

export default function ModalComprar({ aberto, onFechar, cupomInicial }: Props) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [cupom, setCupom] = useState(cupomInicial ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEscClose(aberto, onFechar)

  useEffect(() => {
    if (cupomInicial) setCupom(cupomInicial)
  }, [cupomInicial])

  // Captura ?ref= da URL pra programa de afiliados
  function pegarRefParceiro(): string | undefined {
    try {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      return ref?.trim() || undefined
    } catch {
      return undefined
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    // Validação
    if (!nome.trim()) return setErro('Preencha seu nome.')
    if (!email.includes('@')) return setErro('Email inválido.')
    if (whatsapp.replace(/\D/g, '').length < 10) return setErro('WhatsApp inválido (com DDD).')
    if (cpfCnpj.replace(/\D/g, '').length < 11) return setErro('CPF ou CNPJ inválido.')

    setEnviando(true)
    try {
      const r = await comprarPublico({
        nome_completo: nome.trim(),
        email: email.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        cupom: cupom.trim() || undefined,
        ref_parceiro: pegarRefParceiro(),
        origem: 'landing',
      })

      if (!r.ok || !r.invoiceUrl) {
        setErro(r.error ?? 'Não foi possível criar a cobrança. Tenta de novo em alguns segundos.')
        setEnviando(false)
        return
      }

      // Redireciona pro Asaas pra pagar (mesma aba pra preservar fluxo)
      window.location.href = r.invoiceUrl
    } catch (err: any) {
      setErro(err?.message ?? 'Erro inesperado.')
      setEnviando(false)
    }
  }

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4 z-50"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-comprar-titulo"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={enviar}>
          <div className="px-6 pt-6 pb-3">
            <h2 id="modal-comprar-titulo" className="text-xl font-bold mb-1.5">
              Comprar G Obra · R$ 349/mês
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sem fidelidade. 14 dias de garantia. Preenche os dados pra eu gerar seu link de pagamento.
            </p>
          </div>

          <div className="px-6 pb-4 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Nome completo
              </label>
              <input
                className="input"
                placeholder="Como aparece no CPF ou CNPJ"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={enviando}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                className="input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="input"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={enviando}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  CPF ou CNPJ
                </label>
                <input
                  className="input"
                  placeholder="00.000.000/0000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  disabled={enviando}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Cupom (opcional)
              </label>
              <input
                className="input uppercase"
                placeholder="Tem um código? Digite aqui"
                value={cupom}
                onChange={(e) => setCupom(e.target.value.toUpperCase())}
                disabled={enviando}
              />
            </div>

            {erro && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {erro}
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              Ao continuar, você aceita que seus dados sejam tratados conforme a{' '}
              <a
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-700"
              >
                Política de Privacidade
              </a>
              {' '}pra processar sua compra. Os Termos de Uso completos são aceitos no passo seguinte, depois do pagamento.
            </p>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-end gap-2 flex-wrap">
            <button type="button" onClick={onFechar} disabled={enviando} className="btn-ghost text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={enviando} className="btn-primary text-sm">
              {enviando ? 'Gerando link de pagamento...' : 'Continuar pro pagamento →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
