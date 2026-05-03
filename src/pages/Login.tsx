import { Link, useNavigate } from 'react-router-dom'
import { useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { entrar } from '../lib/auth'
import { supabaseConfigurado } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!supabaseConfigurado) {
      // Modo demo: qualquer e-mail/senha entra na obra exemplo
      if (email && senha) {
        navigate('/app/demo')
        return
      }
      setErro('Preencha e-mail e senha pra entrar no modo demo.')
      return
    }

    setCarregando(true)
    try {
      await entrar(email, senha)
      navigate('/app/obras')
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao entrar')
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
          <h1 className="text-xl font-bold mb-1">Entrar</h1>
          <p className="text-sm text-slate-500 mb-6">Acesso da empresa. Clientes recebem o link direto da obra por WhatsApp.</p>

          {!supabaseConfigurado && (
            <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2">
              Modo demo ativo — Supabase ainda não conectado. Qualquer e-mail/senha entra na obra de exemplo.
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-mail</label>
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
                placeholder="senha"
                required
              />
            </div>

            {erro && <div className="text-sm text-red-600">{erro}</div>}

            <button type="submit" className="btn-primary w-full" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200 flex items-center justify-between text-sm">
            <Link to="/" className="text-slate-500 hover:text-slate-900">Voltar</Link>
            {supabaseConfigurado && (
              <Link to="/cadastro" className="text-laranja-dark font-semibold hover:underline">Criar conta</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
