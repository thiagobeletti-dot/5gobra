// Pagina de Configuracoes do G Obra — rota /app/configuracoes
//
// 3 blocos:
//   1. Dados da empresa (nome, CNPJ, telefone) — editaveis com botao Salvar
//   2. Trocar senha — Supabase Auth updateUser
//   3. Contratos aceitos — lista da tabela aceites com expandir pra ver texto

import { useEffect, useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import {
  pegarMinhaEmpresa,
  atualizarMinhaEmpresa,
  trocarSenha,
  listarMeusAceites,
  type AceiteRow,
} from '../lib/api'

export default function Configuracoes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const fromObra = (location.state as { fromObra?: string; fromObraNome?: string } | null)?.fromObra
  const fromObraNome = (location.state as { fromObra?: string; fromObraNome?: string } | null)?.fromObraNome

  // Bloco 1: Dados da empresa
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)
  const [msgEmpresa, setMsgEmpresa] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Bloco 2: Trocar senha
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Bloco 3: Contratos aceitos
  const [aceites, setAceites] = useState<AceiteRow[]>([])
  const [aceiteAberto, setAceiteAberto] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const e = await pegarMinhaEmpresa()
      if (ativo && e) {
        setNomeEmpresa(e.nome ?? '')
        setCnpj((e as { cnpj?: string }).cnpj ?? '')
        setTelefone((e as { telefone?: string }).telefone ?? '')
      }
      const lista = await listarMeusAceites()
      if (ativo) setAceites(lista)
    })()
    return () => { ativo = false }
  }, [])

  async function logout() {
    await sair()
    navigate('/')
  }

  async function salvarEmpresa(e: FormEvent) {
    e.preventDefault()
    setMsgEmpresa(null)
    if (!nomeEmpresa.trim()) {
      setMsgEmpresa({ tipo: 'erro', texto: 'O nome da empresa e obrigatorio.' })
      return
    }
    setSalvandoEmpresa(true)
    try {
      await atualizarMinhaEmpresa({
        nome: nomeEmpresa.trim(),
        cnpj: cnpj.trim() || undefined,
        telefone: telefone.trim() || undefined,
      })
      setMsgEmpresa({ tipo: 'ok', texto: 'Dados atualizados com sucesso.' })
    } catch (err: any) {
      setMsgEmpresa({ tipo: 'erro', texto: err?.message ?? 'Erro ao salvar.' })
    } finally {
      setSalvandoEmpresa(false)
    }
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault()
    setMsgSenha(null)
    if (senhaNova.length < 6) {
      setMsgSenha({ tipo: 'erro', texto: 'A senha precisa de pelo menos 6 caracteres.' })
      return
    }
    if (senhaNova !== senhaConfirma) {
      setMsgSenha({ tipo: 'erro', texto: 'As senhas nao conferem.' })
      return
    }
    setSalvandoSenha(true)
    try {
      await trocarSenha(senhaNova)
      setSenhaNova('')
      setSenhaConfirma('')
      setMsgSenha({ tipo: 'ok', texto: 'Senha trocada com sucesso.' })
    } catch (err: any) {
      setMsgSenha({ tipo: 'erro', texto: err?.message ?? 'Erro ao trocar senha.' })
    } finally {
      setSalvandoSenha(false)
    }
  }

  function tituloAceite(tipo: string): string {
    const mapa: Record<string, string> = {
      termos_uso: 'Termos de Uso',
      politica_privacidade: 'Politica de Privacidade',
      aceite_final_obra: 'Aceite final de obra',
      mudanca_tipologia: 'Mudanca de tipologia',
      acordo_card: 'Acordo de item',
      liberacao_obra: 'Liberacao da obra',
      outro: 'Outro',
    }
    return mapa[tipo] ?? tipo
  }

  function formatarData(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/app/obras"><LogoFull small /></Link>
          <div className="flex items-center gap-4">
            {fromObra && (
              <Link to={`/app/obra/${fromObra}`} className="text-sm text-laranja-dark hover:text-laranja font-semibold inline-flex items-center gap-1">
                ← Voltar pra obra{fromObraNome ? ` "${fromObraNome}"` : ''}
              </Link>
            )}
            <Link to="/app/obras" className="text-sm text-slate-500 hover:text-slate-900">Obras</Link>
            <Link to="/app/ajuda" className="text-sm text-slate-500 hover:text-slate-900">Ajuda</Link>
            <span className="text-sm text-slate-500 hidden md:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Configurações</h1>
        <p className="text-sm text-slate-500 mb-10">
          Dados da empresa, troca de senha e contratos que você aceitou.
        </p>

        {/* Bloco 1: Dados da empresa */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">1. Dados da empresa</h2>
          <form onSubmit={salvarEmpresa} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome da empresa</label>
              <input className="input" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">CNPJ</label>
                <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Telefone</label>
                <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            {msgEmpresa && (
              <div className={msgEmpresa.tipo === 'ok'
                ? 'text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2'
                : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'}>
                {msgEmpresa.texto}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={salvandoEmpresa}>
              {salvandoEmpresa ? 'Salvando...' : 'Salvar dados'}
            </button>
          </form>
        </section>

        {/* Bloco 2: Trocar senha */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">2. Trocar senha</h2>
          <form onSubmit={salvarSenha} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nova senha</label>
              <input type="password" className="input" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} placeholder="mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Confirme a nova senha</label>
              <input type="password" className="input" value={senhaConfirma} onChange={(e) => setSenhaConfirma(e.target.value)} placeholder="repita a senha" />
            </div>
            {msgSenha && (
              <div className={msgSenha.tipo === 'ok'
                ? 'text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2'
                : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'}>
                {msgSenha.texto}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={salvandoSenha || !senhaNova}>
              {salvandoSenha ? 'Trocando...' : 'Trocar senha'}
            </button>
          </form>
        </section>

        {/* Bloco 3: Contratos aceitos */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">3. Contratos aceitos</h2>
          <p className="text-sm text-slate-500 mb-4">
            Histórico de tudo que você aceitou no sistema. Cada aceite tem data, hora, IP e hash do documento — prova jurídica.
          </p>
          {aceites.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
              Nenhum aceite registrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {aceites.map((a) => {
                const aberto = aceiteAberto === a.id
                return (
                  <div key={a.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setAceiteAberto(aberto ? null : a.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{tituloAceite(a.tipo)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Aceito em {formatarData(a.created_at)} · v{a.documento_versao}
                          {a.ip ? ` · IP ${a.ip}` : ''}
                        </div>
                      </div>
                      <span className={'text-slate-400 transition-transform flex-shrink-0 ' + (aberto ? 'rotate-180' : '')}>▼</span>
                    </button>
                    {aberto && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-200 bg-slate-50">
                        <div className="text-[10px] font-mono text-slate-500 mb-3 break-all">
                          Hash: {a.documento_hash}
                        </div>
                        {a.documento_snapshot?.texto ? (
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded p-4 max-h-64 overflow-y-auto font-sans">
                            {a.documento_snapshot.texto}
                          </pre>
                        ) : (
                          <div className="text-xs text-slate-500 italic">Sem snapshot do texto disponível pra esse aceite.</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
