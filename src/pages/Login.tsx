import { Link, useNavigate } from 'react-router-dom'
import { useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { supabase, supabaseConfigurado } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!supabaseConfigurado || !supabase) {
      // Modo demo enquanto Supabase nao esta configurado
      if (email && senha) {
        navigate('/app/demo')
        return
      }
      setErro('Preencha email e senha pra entrar no modo demo.')
      return
    }

    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)

    if (error) {
      setErro(error.message)
      return
    }
    navigate('/app/demo')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/"><LogoFull /></Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
          <h1 className="text-xl font-bold mb-1">Entrar</h1>
          <p className="text-sm text-slate-500 mb-6">Acesso da empresa. Clientes recebem o link direto da obra por WhatsApp.</p>

          {!supabaseConfigurado && (
            <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2">
              Modo demo ativo — Supabase ainda nao conectado. Qualquer email/senha entra na obra de exemplo.
            </div>
          )}

          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Senha</label>
              <input
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {erro && <div className="text-sm text-red-600">{erro}</div>}

            <button type="submit" className="btn-primary w-full" disabled={carregando}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200 text-center">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">← Voltar pra home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
