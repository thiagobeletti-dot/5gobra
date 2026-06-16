import { Link } from 'react-router-dom'
import { useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { solicitarResetSenha } from '../lib/auth'
import { supabaseConfigurado } from '../lib/supabase'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!supabaseConfigurado) {
      setErro('Recuperação de senha indisponível no modo demo.')
      return
    }

    setCarregando(true)
    try {
      await solicitarResetSenha(email)
      // Mensagem neutra de propósito: não revela se o e-mail existe ou não.
      setEnviado(true)
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao enviar o e-mail de recuperação')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/"><LogoFull /></Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
          {enviado ? (
            <>
              <h1 className="text-xl font-bold mb-2">Verifique seu e-mail</h1>
              <p className="text-sm text-slate-600 mb-6">
                Se existir uma conta com <strong>{email}</strong>, enviamos um link pra você criar uma nova senha. O link vale por 1 hora. Se não aparecer, olhe a caixa de spam.
              </p>
              <Link to="/login" className="btn-primary w-full inline-block text-center">Voltar pro login</Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1">Esqueci minha senha</h1>
              <p className="text-sm text-slate-500 mb-6">Digite o e-mail da sua conta. Vamos te enviar um link pra criar uma senha nova.</p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-mail <span className="text-red-600" aria-hidden="true">*</span></label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoFocus
                    required
                    aria-required="true"
                    autoComplete="email"
                  />
                </div>

                {erro && <div className="text-sm text-red-600">{erro}</div>}

                <button type="submit" className="btn-primary w-full" disabled={carregando}>
                  {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-slate-200 text-sm">
                <Link to="/login" className="text-slate-500 hover:text-slate-900">Voltar pro login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
