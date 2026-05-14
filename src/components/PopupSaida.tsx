// Pop-up de saída da landing — captura WhatsApp do visitante que tava saindo.
//
// Dispara quando:
//   - Desktop: mouse sai da viewport pelo topo (intent de fechar aba/janela)
//   - Mobile: 45s na página sem clicar em CTA (timer fallback)
//
// Salva na tabela `leads_quentes` (Supabase). Empresa atende manualmente via
// WhatsApp depois.
//
// Roda só 1x por sessão do navegador (localStorage).

import { useEffect, useState } from 'react'
import { useExitIntent, marcarPopupDispensado } from '../hooks/useExitIntent'
import { registrarLeadQuente } from '../lib/api'
import { useEscClose } from '../hooks/useEscClose'

type Motivo = 'quero_entender' | 'preco' | 'equipe' | 'ja_tentei' | 'pensar_calma' | 'outro'

interface Props {
  /** Se passado, sobrescreve a detecção automática (útil pra testes/desenvolvimento) */
  forcarAbrir?: boolean
}

export default function PopupSaida({ forcarAbrir }: Props) {
  const disparouNatural = useExitIntent({ timeoutMobileMs: 45000 })
  const [aberto, setAberto] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Form
  const [whatsapp, setWhatsapp] = useState('')
  const [motivo, setMotivo] = useState<Motivo | ''>('')
  const [motivoTexto, setMotivoTexto] = useState('')
  const [consentimento, setConsentimento] = useState(false)

  // Versao da Politica de Privacidade vigente. Atualizar quando bumpar.
  const POLITICA_VERSAO = '1.2'

  useEscClose(aberto, () => fechar())

  // Sincroniza dispara → aberto
  useEffect(() => {
    if ((disparouNatural || forcarAbrir) && !enviado) setAberto(true)
  }, [disparouNatural, forcarAbrir, enviado])

  function fechar() {
    setAberto(false)
    marcarPopupDispensado()
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10) {
      setErro('Coloca seu WhatsApp com DDD (ex: 11 99999-9999).')
      return
    }
    if (!motivo) {
      setErro('Escolhe o que mais te preocupa.')
      return
    }
    if (motivo === 'outro' && !motivoTexto.trim()) {
      setErro('Conta rápido o que te impede de fechar.')
      return
    }
    if (!consentimento) {
      setErro('Você precisa concordar com a Política de Privacidade pra continuar.')
      return
    }

    setEnviando(true)
    try {
      await registrarLeadQuente({
        whatsapp: whatsapp.replace(/\D/g, ''),
        motivo,
        motivo_texto: motivo === 'outro' ? motivoTexto.trim() : undefined,
        origem: 'landing-gobra',
        consentimento_versao: POLITICA_VERSAO,
      })
      setEnviado(true)
      marcarPopupDispensado()
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao enviar. Tenta de novo em uns segundos.')
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4 z-50"
      onClick={fechar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-saida-titulo"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {enviado ? (
          // ===== Confirmação após envio =====
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-2xl mx-auto mb-3">
              ✓
            </div>
            <h2 id="popup-saida-titulo" className="text-xl font-bold mb-2">
              Beleza, recebi!
            </h2>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Vou te chamar no WhatsApp em até <strong>1 dia útil</strong> pra tirar sua dúvida pessoalmente.
            </p>
            <div className="bg-laranja-soft border border-laranja-border rounded-lg p-4 mb-4">
              <p className="text-xs text-laranja-dark font-bold uppercase tracking-wide mb-1">Cupom estendido</p>
              <p className="text-sm text-slate-700">
                Usa <code className="bg-white px-2 py-0.5 rounded border border-laranja-border font-mono font-bold">OBRA20EXT</code> no checkout — vale por <strong>mais 24h</strong>.
              </p>
            </div>
            <button onClick={fechar} className="btn-primary w-full">
              Fechar
            </button>
          </div>
        ) : (
          // ===== Form de captura =====
          <form onSubmit={enviar}>
            <div className="px-6 pt-6 pb-3">
              <h2 id="popup-saida-titulo" className="text-xl font-bold mb-1.5">
                Espera aí — vai sair sem fechar?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Conta o que tá te segurando. Eu mesmo te respondo no WhatsApp. Como agradecimento, te mando o cupom estendido por mais 24h.
              </p>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Seu WhatsApp
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
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Qual sua maior dúvida?
                </label>
                <select
                  className="input"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as Motivo)}
                  disabled={enviando}
                >
                  <option value="">Escolha uma opção...</option>
                  <option value="quero_entender">Quero entender melhor antes de decidir</option>
                  <option value="preco">Achei caro pro que oferece</option>
                  <option value="equipe">Receio da equipe não usar</option>
                  <option value="ja_tentei">Já tentei outros sistemas e não deram certo</option>
                  <option value="pensar_calma">Preciso pensar com calma</option>
                  <option value="outro">Outro motivo</option>
                </select>
              </div>

              {motivo === 'outro' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    Conta rápido
                  </label>
                  <textarea
                    className="input min-h-[60px]"
                    placeholder="Em 1-2 frases, o que tá te impedindo..."
                    value={motivoTexto}
                    onChange={(e) => setMotivoTexto(e.target.value)}
                    disabled={enviando}
                  />
                </div>
              )}

              {erro && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {erro}
                </div>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  disabled={enviando}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Concordo em receber contato sobre o G Obra. Meus dados serão tratados conforme a{' '}
                  <a
                    href="/privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-laranja-dark"
                  >
                    Política de Privacidade
                  </a>
                  . Posso revogar a qualquer momento pelo e-mail{' '}
                  <strong>dpo@gerenciamento5g.com.br</strong>.
                </span>
              </label>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={fechar}
                disabled={enviando}
                className="btn-ghost text-sm"
              >
                Não, obrigado
              </button>
              <button
                type="submit"
                disabled={enviando || !consentimento}
                className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? 'Enviando…' : 'Enviar e receber cupom estendido'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
