import { useEffect, useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import { criarObra, listarObras, pegarMinhaEmpresa, type ObraRow } from '../lib/api'
import BannerTrial, { calcularAcessoLiberado } from '../components/BannerTrial'

export default function Obras() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [obras, setObras] = useState<ObraRow[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [trialTerminaEm, setTrialTerminaEm] = useState<string | null>(null)
  const [assinaturaStatus, setAssinaturaStatus] = useState<'trial' | 'ativo' | 'suspenso' | 'cancelado'>('trial')
  const [carregando, setCarregando] = useState(true)
  const [novoAberto, setNovoAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)

  const acessoLiberado = calcularAcessoLiberado(trialTerminaEm, assinaturaStatus)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const empresa = await pegarMinhaEmpresa()
        if (!ativo) return
        if (empresa) {
          setEmpresaId(empresa.id)
          setEmpresaNome(empresa.nome)
          setTrialTerminaEm(empresa.trial_termina_em ?? null)
          setAssinaturaStatus(empresa.assinatura_status ?? 'trial')
        }
        const lista = await listarObras()
        if (!ativo) return
        setObras(lista)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar obras')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [])

  async function logout() {
    await sair()
    navigate('/')
  }

  async function copiarLink(obra: ObraRow) {
    const url = `${window.location.origin}/obra/${obra.token_cliente}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopiado(obra.id)
      window.setTimeout(() => setLinkCopiado(null), 2400)
    } catch {
      // Fallback: abre prompt pra copiar manualmente
      window.prompt('Link do cliente (copie):', url)
    }
  }

  return (
    <div className="min-h-screen">
      <BannerTrial
        trialTerminaEm={trialTerminaEm}
        assinaturaStatus={assinaturaStatus}
      />
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/"><LogoFull small /></Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden md:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Suas obras</h1>
            {empresaNome && <p className="text-sm text-slate-500 mt-1">{empresaNome}</p>}
          </div>
          {empresaId && (
            <button className="btn-primary" onClick={() => setNovoAberto(true)}>+ Nova obra</button>
          )}
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">{erro}</div>}

        {carregando ? (
          <div className="text-slate-500">Carregando...</div>
        ) : !empresaId ? (
          <SemEmpresa onCriar={async (nome) => {
            try {
              const { criarEmpresa } = await import('../lib/api')
              const e = await criarEmpresa(nome)
              setEmpresaId(e.id)
              setEmpresaNome(e.nome)
            } catch (err: any) {
              setErro(err?.message ?? 'Erro ao criar empresa')
            }
          }} />
        ) : obras.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3 opacity-40">+</div>
            <h2 className="font-semibold mb-1">Nenhuma obra ainda</h2>
            <p className="text-sm text-slate-500 mb-5">Crie a primeira obra pra comecar a registrar itens, acordos e o historico.</p>
            <button className="btn-primary" onClick={() => setNovoAberto(true)}>+ Criar primeira obra</button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {obras.map((o) => (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition flex flex-col">
                <Link to={`/app/obra/${o.id}`} className="block flex-1">
                  <div className="font-semibold text-base mb-1">{o.nome}</div>
                  <div className="text-sm text-slate-500 mb-2">{o.endereco || 'Sem endereco'}</div>
                  <div className="text-xs text-slate-400">Cliente: {o.cliente_nome || '-'}</div>
                  <div className="text-xs text-slate-400 mt-2">Inicio: {o.inicio || '-'}</div>
                </Link>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                  <button
                    onClick={() => copiarLink(o)}
                    className="text-xs text-slate-500 hover:text-laranja-dark font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    {linkCopiado === o.id ? (
                      <>
                        <span className="text-status-andamento">OK</span>
                        Link copiado!
                      </>
                    ) : (
                      <>
                        <span>@</span>
                        Copiar link do cliente
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {empresaId && obras.length > 0 && (
          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
            <div className="font-semibold text-slate-700 mb-1">Como funciona o link do cliente</div>
            Cada obra tem um link unico. Quando voce manda esse link pro cliente (por WhatsApp, email, etc), ele acessa direto a propria obra dele - sem precisar criar conta nem senha.
          </div>
        )}
      </main>

      {novoAberto && empresaId && (
        <ModalNovaObra
          empresaId={empresaId}
          onClose={() => setNovoAberto(false)}
          onCriou={(o) => {
            setObras((cur) => [o, ...cur])
            setNovoAberto(false)
            navigate(`/app/obra/${o.id}`)
          }}
        />
      )}
    </div>
  )
}

function SemEmpresa({ onCriar }: { onCriar: (nome: string) => Promise<void> }) {
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md">
      <h2 className="font-semibold text-lg mb-2">Cadastre sua empresa</h2>
      <p className="text-sm text-slate-500 mb-5">Falta um passo: dar nome a sua empresa. Voce vai gerenciar todas as obras dentro dela.</p>
      <input
        className="input mb-3"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da empresa"
        autoFocus
      />
      <button
        className="btn-primary w-full"
        onClick={async () => {
          if (!nome.trim()) return
          setSalvando(true)
          try { await onCriar(nome.trim()) } finally { setSalvando(false) }
        }}
        disabled={salvando}
      >
        {salvando ? 'Criando...' : 'Criar empresa'}
      </button>
    </div>
  )
}

function ModalNovaObra({ empresaId, onClose, onCriou }: { empresaId: string; onClose: () => void; onCriou: (o: ObraRow) => void }) {
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSalvando(true)
    setErro(null)
    try {
      const o = await criarObra({
        empresa_id: empresaId,
        nome: nome.trim(),
        endereco: endereco.trim() || undefined,
        cliente_nome: clienteNome.trim() || undefined,
        cliente_telefone: clienteTelefone.trim() || undefined,
      })
      onCriou(o)
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao criar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose}>
      <form className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="px-6 py-5 border-b border-slate-200">
          <h2 className="text-lg font-bold">Nova obra</h2>
          <p className="text-sm text-slate-500">Cadastra a obra. Os itens (janelas, portas, etc) voce adiciona depois dentro dela.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Campo label="Nome da obra" value={nome} setValue={setNome} placeholder="Residencial Vila Bela" obrigatorio />
          <Campo label="Endereco" value={endereco} setValue={setEndereco} placeholder="Rua das Palmeiras, 450 - Jundiai/SP" />
          <Campo label="Nome do cliente" value={clienteNome} setValue={setClienteNome} placeholder="Joao da Silva" />
          <Campo label="Telefone do cliente (com DDD)" value={clienteTelefone} setValue={setClienteTelefone} placeholder="11 99999-9999" />
          {erro && <div className="text-sm text-red-600">{erro}</div>}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? 'Criando...' : 'Criar obra'}</button>
        </div>
      </form>
    </div>
  )
}

function Campo({ label, value, setValue, placeholder, obrigatorio }: { label: string; value: string; setValue: (v: string) => void; placeholder?: string; obrigatorio?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        required={obrigatorio}
      />
    </div>
  )
}
