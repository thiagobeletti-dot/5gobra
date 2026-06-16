import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { definirNovaSenha } from '../lib/auth'
import { supabase, supabaseConfigurado } from '../lib/supabase'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [pronto, setPronto] = useState(false)        // sessão de recuperação detectada
  const [linkInvalido, setLinkInvalido] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [ok, setOk] = useState(false)

  // Detecta a sessão de recuperação criada pelo link do e-mail.
  // O cliente principal tem detectSessionInUrl=true, então ao cair aqui com o
  // token no hash ele processa e dispara PASSWORD_RECOVERY. NÃO chamamos
  // getSession() em paralelo — é o anti-pattern de deadlock documentado no auth.tsx.
  useEffect(() => {
    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session) setPronto(true)
      }
      if (event === 'INITIAL_SESSION') {
        if (session) {
          setPronto(true)
        } else if (!window.location.hash.includes('access_token')) {
          // Caiu na página sem token no link = acesso direto ou link já consumido.
          setLinkInvalido(true)
        }
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirma) {
      setErro('As senhas não conferem.')
      return
    }
    setCarregando(true)
    try {
      await definirNovaSenha(senha)
      setOk(true)
      // A sessão de recuperação já está ativa → entra direto no app.
      setTimeout(() => navigate('/app/obras'), 1800)
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao salvar a nova senha')
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
          {!supabaseConfigurado ? (
            <p className="text-sm text-slate-600">Redefinição de senha indisponível no modo demo.</p>
          ) : ok ? (
            <>
              <h1 className="text-xl font-bold mb-2">Senha alterada!</h1>
              <p className="text-sm text-slate-600 mb-6">Tudo certo. Já vamos te levar pro app...</p>
              <Link to="/app/obras" className="btn-primary w-full inline-block text-center">Entrar no app</Link>
            </>
          ) : linkInvalido ? (
            <>
              <h1 className="text-xl font-bold mb-2">Link inválido ou expirado</h1>
              <p className="text-sm text-slate-600 mb-6">Esse link de redefinição não é mais válido — ele vale por 1 hora e só pode ser usado uma vez. Peça um novo.</p>
              <Link to="/recuperar-senha" className="btn-primary w-full inline-block text-center">Pedir novo link</Link>
            </>
          ) : !pronto ? (
            <p className="text-sm text-slate-500">Validando o link de recuperação...</p>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1">Criar nova senha</h1>
              <p className="text-sm text-slate-500 mb-6">Escolha uma senha nova pra sua conta.</p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nova senha <span className="text-red-600" aria-hidden="true">*</span></label>
                  <input
                    type="password"
                    className="input"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    autoFocus
                    required
                    aria-required="true"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Confirmar nova senha <span className="text-red-600" aria-hidden="true">*</span></label>
                  <input
                    type="password"
                    className="input"
                    value={confirma}
                    onChange={(e) => setConfirma(e.target.value)}
                    placeholder="repita a senha"
                    required
                    aria-required="true"
                    autoComplete="new-password"
                  />
                </div>

                {erro && <div className="text-sm text-red-600">{erro}</div>}

                <button type="submit" className="btn-primary w-full" disabled={carregando}>
                  {carregando ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
