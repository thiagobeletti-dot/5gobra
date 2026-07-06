import { useEffect, useMemo, useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import {
  criarObra,
  listarObras,
  pegarMinhaEmpresa,
  type ObraRow,
} from '../lib/api'
import BannerOnboarding from '../components/BannerOnboarding'
import TourGuiado from '../components/TourGuiado'
import { useOnboarding } from '../hooks/useOnboarding'

export default function Obras() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [obras, setObras] = useState<ObraRow[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [novoAberto, setNovoAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const { status: onboarding, marcar: marcarOnb } = useOnboarding()
  const [tourAtivo, setTourAtivo] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  // Ordenação da lista. Cravado em 08/06 após reunião com Bruno (Vilumi Esquadrias):
  // gestor de fábrica com 30+ obras quer atender as MAIS ANTIGAS primeiro (ficaram
  // mais tempo paradas). Default continua 'recente' pra novos usuários — preferência
  // persiste em localStorage por empresa.
  const [ordenacao, setOrdenacao] = useState<'recente' | 'antiga'>(() => {
    if (typeof window === 'undefined') return 'recente'
    const v = window.localStorage.getItem('gobra:obras-ordenacao')
    return v === 'antiga' ? 'antiga' : 'recente'
  })
  // Filtro "encerradas". Cravado 11/06 (Denilson + Thiago): após obra concluída,
  // gestor quer que ela "saia da lista" pra não poluir. Default: só ativas.
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false)
  // Busca por nome da obra ou cliente. Cravado 12/06 (Thiago): com 30+ obras na
  // lista (cenário Anderson/Vilumi/Denilson), bater olho não basta — precisa lupa.
  // Filtro local (in-memory), case-insensitive, sem persistir.
  const [busca, setBusca] = useState('')

  // Aplica sort local (created_at) + filtro encerrada + busca. Sem refazer query.
  const obrasOrdenadas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const arr = obras
      .filter((o) => mostrarEncerradas ? o.encerrada : !o.encerrada)
      .filter((o) => {
        if (!q) return true
        return (
          o.nome.toLowerCase().includes(q) ||
          (o.cliente_nome ?? '').toLowerCase().includes(q)
        )
      })
    arr.sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime()
      const tb = new Date(b.created_at ?? 0).getTime()
      return ordenacao === 'antiga' ? ta - tb : tb - ta
    })
    return arr
  }, [obras, ordenacao, mostrarEncerradas, busca])

  const totalAtivas = useMemo(() => obras.filter((o) => !o.encerrada).length, [obras])
  const totalEncerradas = useMemo(() => obras.filter((o) => o.encerrada).length, [obras])

  function trocarOrdenacao(nova: 'recente' | 'antiga') {
    setOrdenacao(nova)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gobra:obras-ordenacao', nova)
    }
  }

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const empresa = await pegarMinhaEmpresa()
        if (!ativo) return
        if (empresa) {
          setEmpresaId(empresa.id)
          setEmpresaNome(empresa.nome)
        }
        const lista = await listarObras()
        if (!ativo) return
        setObras(lista)
        if (searchParams.get('tour') === '1') {
          setTourAtivo(true)
          searchParams.delete('tour')
          setSearchParams(searchParams, { replace: true })
        }
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar obras')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (obras.length > 0 && onboarding && !onboarding.primeira_obra_criada) {
      marcarOnb('primeira_obra_criada')
    }
  }, [obras.length, onboarding, marcarOnb])

  function iniciarTour() {
    setTourAtivo(true)
  }

  async function tourTerminado(dispensado: boolean) {
    setTourAtivo(false)
    await marcarOnb('tour_visto')
    if (dispensado) await marcarOnb('tour_dispensado')
  }

  async function dispensarBanner() {
    await marcarOnb('tour_dispensado')
  }

  const mostrarBanner =
    !!empresaId &&
    obras.length === 0 &&
    onboarding !== null &&
    !onboarding.tour_dispensado

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
      // Fallback: alerta com o link pra copiar manualmente.
      // Só roda em browsers muito antigos ou contextos sem HTTPS.
      console.warn('[Obras] navigator.clipboard indisponivel, fallback pra alert')
      alert('Copie esse link manualmente:\n\n' + url)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/app/dashboard"><LogoFull /></Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/app/dashboard" className="text-slate-500 hover:text-slate-900">
              Dashboard
            </Link>
            <Link to="/app/obras" className="font-semibold text-laranja-dark">
              Obras
            </Link>
            <Link to="/app/ajuda" className="text-slate-500 hover:text-slate-900">
              Ajuda
            </Link>
            <Link to="/app/configuracoes" className="text-slate-500 hover:text-slate-900">
              Configurações
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden lg:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      {mostrarBanner && (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <BannerOnboarding
            onIniciarTour={iniciarTour}
            onCriarObra={() => setNovoAberto(true)}
            onDispensar={dispensarBanner}
          />
        </div>
      )}

      <TourGuiado ativo={tourAtivo} onTerminado={tourTerminado} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Suas obras</h1>
            {empresaNome && <p className="text-sm text-slate-500 mt-1">{empresaNome}</p>}
          </div>
          {empresaId && (
            <div className="flex items-center gap-2">
              <Link
                to="/app/importar-orcamento"
                className="inline-flex items-center text-sm font-semibold text-laranja-dark border-2 border-laranja-dark px-3 py-1.5 rounded-md hover:bg-laranja-dark hover:text-white transition"
                title="Suba um PDF de orçamento e crie a obra com todas as peças automaticamente"
              >
                Importar Orçamento
              </Link>
              <button data-tour="nova-obra" className="btn-primary" onClick={() => setNovoAberto(true)}>+ Nova obra</button>
            </div>
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
            <p className="text-sm text-slate-500 mb-5">Crie a primeira obra pra começar a registrar itens, acordos e o histórico.</p>
            <button className="btn-primary" onClick={() => setNovoAberto(true)}>+ Criar primeira obra</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMostrarEncerradas(false)}
                  className={'px-3 py-1.5 rounded-md text-xs font-semibold transition ' + (
                    !mostrarEncerradas
                      ? 'bg-laranja-dark text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  Ativas ({totalAtivas})
                </button>
                <button
                  onClick={() => setMostrarEncerradas(true)}
                  disabled={totalEncerradas === 0}
                  className={'px-3 py-1.5 rounded-md text-xs font-semibold transition ' + (
                    mostrarEncerradas
                      ? 'bg-slate-700 text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Encerradas ({totalEncerradas})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 font-medium" htmlFor="ordenar-obras">
                  Ordenar por:
                </label>
                <select
                  id="ordenar-obras"
                  value={ordenacao}
                  onChange={(e) => trocarOrdenacao(e.target.value as 'recente' | 'antiga')}
                  className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-laranja-dark"
                >
                  <option value="recente">Mais recentes primeiro</option>
                  <option value="antiga">Mais antigas primeiro</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome da obra ou cliente..."
                  className="w-full pl-9 pr-9 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-laranja-dark"
                  aria-label="Buscar obras"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                    aria-label="Limpar busca"
                    title="Limpar busca"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {busca && (
                <div className="mt-1.5 text-xs text-slate-500">
                  {obrasOrdenadas.length === 0
                    ? 'Nenhuma obra encontrada pra essa busca.'
                    : `${obrasOrdenadas.length} ${obrasOrdenadas.length === 1 ? 'obra encontrada' : 'obras encontradas'}`}
                </div>
              )}
            </div>
            {obrasOrdenadas.length === 0 && !busca ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                {mostrarEncerradas ? 'Nenhuma obra encerrada ainda.' : 'Nenhuma obra ativa no momento.'}
              </div>
            ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {obrasOrdenadas.map((o) => (
              <div key={o.id} className={'bg-white border rounded-xl p-5 hover:shadow-md transition flex flex-col ' + (
                o.encerrada ? 'border-slate-300 opacity-75' : 'border-slate-200 hover:border-slate-300'
              )}>
                <Link to={`/app/obra/${o.id}`} className="block flex-1">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <div className="font-semibold text-base">{o.nome}</div>
                    {o.encerrada && (
                      <span className="inline-block bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        Encerrada
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mb-2">{o.endereco || 'Sem endereço'}</div>
                  <div className="text-xs text-slate-400">Cliente: {o.cliente_nome || '-'}</div>
                  <div className="text-xs text-slate-400 mt-2">Início: {o.inicio || '-'}</div>
                </Link>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                  {o.interacao_cliente === false ? (
                    <span
                      className="text-xs text-slate-400 font-medium inline-flex items-center gap-1.5"
                      title="Obra em modo gerencial — o cliente não tem portal nem aceites. Mude em Editar dados da obra."
                    >
                      <span aria-hidden>🔒</span>
                      Modo gerencial (sem portal do cliente)
                    </span>
                  ) : (
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
                  )}
                </div>
              </div>
              ))}
            </div>
            )}
          </>
        )}

        {empresaId && obras.length > 0 && (
          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
            <div className="font-semibold text-slate-700 mb-1">Como funciona o link do cliente</div>
            Cada obra tem um link único. Quando você manda esse link pro cliente (por WhatsApp, e-mail, etc), ele acessa direto a própria obra dele — sem precisar criar conta nem senha.
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
            // Sempre navega pra dentro da obra criada. O Tour 2 dispara la
            // automaticamente se a empresa nunca viu (flag tour_obra_visto).
            navigate(`/app/obra/${o.id}`)
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
      <p className="text-sm text-slate-500 mb-5">Falta um passo: dar nome à sua empresa. Você vai gerenciar todas as obras dentro dela.</p>
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose} role="dialog" aria-modal="true">
      <form className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="px-6 py-5 border-b border-slate-200">
          <h2 className="text-lg font-bold">Nova obra</h2>
          <p className="text-sm text-slate-500">Cadastra a obra. Os itens (janelas, portas, etc) você adiciona depois dentro dela.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Campo label="Nome da obra" value={nome} setValue={setNome} placeholder="Residencial Vila Bela" obrigatorio />
          <Campo label="Endereço" value={endereco} setValue={setEndereco} placeholder="Rua das Palmeiras, 450 - Jundiaí/SP" />
          <Campo label="Nome do cliente" value={clienteNome} setValue={setClienteNome} placeholder="João da Silva" />
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
