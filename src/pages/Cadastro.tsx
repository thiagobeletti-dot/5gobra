import { Link, useNavigate } from 'react-router-dom'
import { useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { cadastrar } from '../lib/auth'
import { criarEmpresa } from '../lib/api'

export default function Cadastro() {
  const navigate = useNavigate()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setInfo(null)

    if (!nomeEmpresa.trim() || !email.trim() || senha.length < 6) {
      setErro('Preencha tudo. Senha precisa de pelo menos 6 caracteres.')
      return
    }

    setCarregando(true)
    try {
      const r = await cadastrar(email, senha)
      if (!r.session) {
        setInfo('Cadastro criado. Verifique seu email pra confirmar a conta antes de entrar.')
        setCarregando(false)
        return
      }
      // Cria a empresa associada ao usuario logado
      await criarEmpresa(nomeEmpresa.trim())
      navigate('/app/obras')
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao cadastrar')
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
          <h1 className="text-xl font-bold mb-1">Criar conta da empresa</h1>
          <p className="text-sm text-slate-500 mb-6">A empresa cadastrada vai gerenciar todas as obras. Cada cliente acessa por link direto, sem cadastro.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome da empresa</label>
              <input
                className="input"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Esquadrias 5G"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Seu email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
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
                placeholder="minimo 6 caracteres"
                required
              />
            </div>

            {erro && <div className="text-sm text-red-600">{erro}</div>}
            {info && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{info}</div>}

            <button type="submit" className="btn-primary w-full" disabled={carregando}>
              {carregando ? 'Criando...' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200 text-center text-sm">
            <Link to="/login" className="text-slate-500 hover:text-slate-900">Ja tenho conta - entrar</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
