// Página Dashboard — visão consolidada das obras
//
// Cravado em 09/06/2026 após reunião Vilumi: Bruno levantou demanda crítica
// de gestão à vista (30+ obras simultâneas, precisa ver de uma vez o que
// está atrasado / precisa atenção / aguardando cliente).
//
// V1 estratégia:
//   - 4 cards de métrica no topo (Ativas / Atraso / Atenção / Aguardando cliente)
//   - 3 listas top 5: Atrasadas, Próximos prazos, Aguardando cliente
//   - Mobile-first, click-through pra obra específica
//   - Sem RBAC ainda (V2 — visão por papel via login multi-user)

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import { pegarDashboard, type DashboardData, type ObraDashboard } from '../lib/dashboard'
import { pegarMinhaEmpresa } from '../lib/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [empresaNome, setEmpresaNome] = useState<string>('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const [empresa, dashboard] = await Promise.all([
          pegarMinhaEmpresa(),
          pegarDashboard(),
        ])
        if (!ativo) return
        if (empresa) setEmpresaNome(empresa.nome)
        setData(dashboard)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar dashboard')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  async function logout() {
    await sair()
    navigate('/')
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/app/dashboard">
            <LogoFull />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/app/dashboard" className="font-semibold text-laranja-dark">
              Dashboard
            </Link>
            <Link to="/app/obras" className="text-slate-500 hover:text-slate-900">
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
            <button onClick={logout} className="btn-ghost text-xs">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {empresaNome && (
            <p className="text-sm text-slate-500 mt-1">{empresaNome}</p>
          )}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-slate-500 py-12 text-center">Carregando dashboard...</div>
        ) : !data ? (
          <div className="text-slate-500 py-12 text-center">Sem dados.</div>
        ) : data.totalObras === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* CARDS DE MÉTRICAS */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
              <CardMetrica
                titulo="Obras ativas"
                valor={data.metricas.totalAtivas}
                cor="neutro"
                href="/app/obras"
              />
              <CardMetrica
                titulo="Em atraso"
                valor={data.metricas.emAtraso}
                cor="vermelho"
                href="#atrasadas"
              />
              <CardMetrica
                titulo="Atenção (3 dias)"
                valor={data.metricas.atencaoHoje}
                cor="laranja"
                href="#proximas"
              />
              <CardMetrica
                titulo="Aguardando cliente"
                valor={data.metricas.aguardandoCliente}
                cor="amarelo"
                href="#aguardando"
              />
              <CardMetrica
                titulo="No prazo"
                valor={data.metricas.noPrazo}
                cor="verde"
                href="#noprazo"
              />
            </section>

            {/* AVISO — obras sem cronograma */}
            {data.metricas.semCronograma > 0 && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-lg text-sm mb-6 flex items-start gap-2">
                <span className="text-base">💡</span>
                <div>
                  <strong>{data.metricas.semCronograma}</strong> obra{data.metricas.semCronograma !== 1 ? 's' : ''} ainda
                  sem cronograma. Criar cronograma desbloqueia o acompanhamento de prazos automaticamente.
                </div>
              </div>
            )}

            {/* LISTA — ATRASADAS */}
            <SecaoLista
              id="atrasadas"
              titulo="🔴 Obras em atraso"
              vazia="Nenhuma obra em atraso. Tudo no prazo!"
              obras={data.atrasadas}
              tom="vermelho"
            />

            {/* LISTA — PRÓXIMAS */}
            <SecaoLista
              id="proximas"
              titulo="⏰ Próximos vencimentos (até 7 dias)"
              vazia="Nada vencendo nos próximos 7 dias."
              obras={data.proximas}
              tom="laranja"
            />

            {/* LISTA — AGUARDANDO CLIENTE (obras pausadas, prazo suprimido) */}
            <SecaoLista
              id="aguardando"
              titulo="🟡 Aguardando cliente"
              vazia="Nenhuma obra aguardando ação do cliente."
              obras={data.aguardandoCliente}
              tom="amarelo"
              pausada
            />

            {/* LISTA — NO PRAZO (cravada 12/06) */}
            <SecaoLista
              id="noprazo"
              titulo="🟢 No prazo"
              vazia="Nenhuma obra em produção no momento."
              obras={data.noPrazo}
              tom="verde"
            />
          </>
        )}
      </main>
    </div>
  )
}

// ============================================================
// COMPONENTES INTERNOS
// ============================================================

type Tom = 'neutro' | 'vermelho' | 'laranja' | 'amarelo' | 'verde'

const TOM_CLASSES: Record<Tom, { bg: string; texto: string; borda: string }> = {
  neutro: { bg: 'bg-white', texto: 'text-slate-900', borda: 'border-slate-200' },
  vermelho: { bg: 'bg-red-50', texto: 'text-red-700', borda: 'border-red-200' },
  laranja: { bg: 'bg-orange-50', texto: 'text-orange-700', borda: 'border-orange-200' },
  amarelo: { bg: 'bg-yellow-50', texto: 'text-yellow-800', borda: 'border-yellow-200' },
  verde: { bg: 'bg-green-50', texto: 'text-green-700', borda: 'border-green-200' },
}

function CardMetrica({
  titulo,
  valor,
  cor,
  href,
}: {
  titulo: string
  valor: number
  cor: Tom
  href: string
}) {
  const cls = TOM_CLASSES[cor]
  return (
    <a
      href={href}
      className={`${cls.bg} ${cls.borda} border rounded-xl p-4 transition hover:shadow-md`}
    >
      <div className={`text-3xl font-bold ${cls.texto}`}>{valor}</div>
      <div className="text-xs text-slate-600 mt-1 font-medium">{titulo}</div>
    </a>
  )
}

function SecaoLista({
  id,
  titulo,
  vazia,
  obras,
  tom,
  pausada,
}: {
  id: string
  titulo: string
  vazia: string
  obras: ObraDashboard[]
  tom: Tom
  /** Quando true, oculta prazo/dias da fase (obras pausadas — cards em aba Cliente). */
  pausada?: boolean
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-20">
      <h2 className="text-lg font-semibold mb-3">{titulo}</h2>
      {obras.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-500 italic">
          {vazia}
        </div>
      ) : (
        <ul className="space-y-2">
          {obras.map((o) => (
            <ItemObra key={o.obra.id} item={o} tom={tom} pausada={pausada} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ItemObra({ item, tom, pausada }: { item: ObraDashboard; tom: Tom; pausada?: boolean }) {
  const cls = TOM_CLASSES[tom]
  const dias = item.diasRestantes
  const atrasada = item.atrasada
  return (
    <li>
      <Link
        to={`/app/obra/${item.obra.id}`}
        className={`block ${cls.bg} ${cls.borda} border rounded-xl p-4 hover:shadow-md transition`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 truncate">{item.obra.nome}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {item.obra.cliente_nome || 'Sem cliente'}
              {item.obra.endereco ? ` · ${item.obra.endereco}` : ''}
            </div>
            {pausada ? (
              <div className={`text-sm mt-2 ${cls.texto} italic`}>
                Aguardando ação do cliente
              </div>
            ) : dias !== null && (
              <div className={`text-sm mt-2 ${cls.texto}`}>
                {atrasada ? (
                  <>Vencida há {Math.abs(dias)} dia{Math.abs(dias) !== 1 ? 's' : ''}</>
                ) : dias === 0 ? (
                  <>Vence hoje</>
                ) : (
                  <>Restam {dias} dia{dias !== 1 ? 's' : ''}</>
                )}
              </div>
            )}
            {!item.faseAtiva && item.demanda === 'cliente' && (
              <div className="text-sm mt-2 text-yellow-800">
                Aguardando aceite do cronograma pelo cliente
              </div>
            )}
            {item.totalCards > 0 && (
              <div className="text-xs text-slate-400 mt-2">
                {item.cardsConcluidos}/{item.totalCards} item{item.totalCards !== 1 ? 's' : ''} concluído
                {item.cardsConcluidos !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div className="text-slate-400 text-sm">→</div>
        </div>
      </Link>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
      <div className="text-4xl mb-3 opacity-40">📋</div>
      <h2 className="font-semibold text-lg mb-1">Nenhuma obra cadastrada ainda</h2>
      <p className="text-sm text-slate-500 mb-5">
        Crie a primeira obra pra começar a acompanhar prazos, equipe e clientes aqui no dashboard.
      </p>
      <Link to="/app/obras" className="btn-primary">
        + Criar primeira obra
      </Link>
    </div>
  )
}
