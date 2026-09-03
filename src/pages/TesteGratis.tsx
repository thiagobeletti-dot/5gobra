// Cadastro do teste grátis de 14 dias — SEM cartão, SEM pagamento.
//
// É o destino do botão "Testar 14 dias grátis" (página de diagnóstico e
// landing). Chama a Edge Function `iniciar-trial`, que cria o usuário e a
// empresa já em trial, e em seguida faz login e joga a pessoa direto no app.
//
// Cravado 31/08/2026 — estratégia rep-free: o comprador quer se servir
// sozinho, sem reunião. Ver Vault: "Estratégia — Página de venda self-service".

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { supabase } from '../lib/supabase'
import { mensagemDaFuncao } from '../lib/erro-funcao'
import { entrar } from '../lib/auth'

export default function TesteGratis() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function criarTeste(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!supabase) {
      setErro('Sistema indisponível no momento. Tenta de novo em instantes.')
      return
    }
    setCarregando(true)
    try {
      const { data, error } = await supabase.functions.invoke('iniciar-trial', {
        body: {
          nome_completo: nome.trim(),
          nome_empresa: nomeEmpresa.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          senha,
          origem: 'teste-gratis',
        },
      })

      // A Edge Function devolve { ok:false, error } com status 4xx. Nesse caso o
      // supabase-js deixa o `data` vazio e esconde o corpo no `error.context` —
      // por isso mensagemDaFuncao(). Sem ela, "já existe uma conta com esse
      // e-mail" virava "não consegui criar sua conta".
      const msgFuncao =
        (data as { ok?: boolean; error?: string } | null)?.error ?? (await mensagemDaFuncao(error))
      if (error || !data || (data as { ok?: boolean }).ok !== true) {
        setErro(msgFuncao ?? 'Não consegui criar sua conta. Tenta de novo em instantes.')
        setCarregando(false)
        return
      }

      // Conta criada — entra direto, sem pedir login de novo.
      // `entrar` lança exceção em caso de falha; se der ruim, a conta já existe,
      // então mandamos pro login em vez de mostrar erro genérico.
      try {
        await entrar(email.trim().toLowerCase(), senha)
      } catch {
        setCarregando(false)
        navigate('/login', { state: { aviso: 'Sua conta foi criada! Entre com seu e-mail e senha.' } })
        return
      }
      navigate('/app/obras')
    } catch {
      setErro('Não consegui criar sua conta. Tenta de novo em instantes.')
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-5xl mx-auto">
          <Link to="/">
            <LogoFull small />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <span className="inline-block bg-green-50 text-green-700 border border-green-200 text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
              14 dias grátis · sem cartão
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-3">Comece a usar agora</h1>
            <p className="text-sm text-slate-500 mt-1">
              Sem reunião, sem vendedor. Você cria a conta e já importa sua primeira obra.
            </p>
          </div>

          <form onSubmit={criarTeste} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Seu nome *</label>
              <input
                className="input mt-1"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome da empresa *</label>
              <input
                className="input mt-1"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Ex.: Esquadrias Silva"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">E-mail *</label>
              <input
                type="email"
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@suaempresa.com.br"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">WhatsApp</label>
              <input
                className="input mt-1"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Opcional — só usamos se você pedir ajuda.
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Senha *</label>
              <input
                type="password"
                className="input mt-1"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mínimo 6 caracteres"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">{erro}</div>
            )}

            <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={carregando}>
              {carregando ? 'Criando sua conta...' : 'Começar meus 14 dias grátis →'}
            </button>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Sem cartão de crédito. Sem fidelidade. Ao criar a conta você aceita os{' '}
              <Link to="/termos" className="underline">Termos</Link> e a{' '}
              <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
            </p>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Já tem conta?{' '}
            <Link to="/login" className="text-laranja font-semibold hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
