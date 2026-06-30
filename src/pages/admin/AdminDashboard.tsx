// Admin Dashboard — visão consolidada da base 5G pro Thiago.
// Topo: 6 cards de métrica. Meio: 4 listas top 5 de alertas. Fim: atalhos.
// Acesso restrito por <RotaAdmin> (checa tabela super_admins).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoFull } from '../../lib/logo'
import { sair, useAuth } from '../../lib/auth'
import {
  pegarMetricasDashboard,
  pegarAlertas,
  formatarReais,
  formatarDataRelativa,
  type AdminMetricas,
  type AdminAlertas,
} from '../../lib/admin'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [metricas, setMetricas] = useState<AdminMetricas | null>(null)
  const [alertas, setAlertas] = useState<AdminAlertas | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const [m, a] = await Promise.all([
          pegarMetricasDashboard(),
          pegarAlertas(),
        ])
        if (!ativo) return
        setMetricas(m)
        setAlertas(a)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar painel')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader user={user} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin Console</h1>
            <p className="text-sm text-slate-500 mt-1">Visão geral da base 5G</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/clientes" className="btn-ghost text-sm">Ver todos clientes</Link>
            <Link to="/admin/alertas" className="btn-ghost text-sm">Ver todos alertas</Link>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-slate-500 py-12 text-center">Carregando...</div>
        ) : metricas && alertas ? (
          <>
            {/* 6 cards de métrica */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              <CardMetrica titulo="MRR" valor={formatarReais(metricas.mrr_centavos)} cor="verde" />
              <CardMetrica titulo="Em trial" valor={metricas.clientes_trial} cor="azul" />
              <CardMetrica titulo="Pagantes" valor={metricas.clientes_ativos} cor="verde" />
              <CardMetrica titulo="Atrasados" valor={metricas.clientes_atrasados} cor="laranja" />
              <CardMetrica titulo="Cancelados" valor={metricas.clientes_cancelados} cor="vermelho" />
              <CardMetrica titulo="Total empresas" valor={metricas.total_empresas} cor="neutro" />
            </section>

            {/* Alertas */}
            <section className="grid md:grid-cols-2 gap-4">
              <CardAlerta
                titulo="🟡 Trial vencendo (≤3 dias)"
                vazio="Ninguém com trial vencendo nos próximos 3 dias."
                items={alertas.trial_vencendo.slice(0, 5).map((a) => ({
                  empresaId: a.empresa_id,
                  titulo: a.nome,
                  subtitulo: a.owner_email ?? '—',
                  badge: `${a.dias_restantes}d restantes`,
                }))}
                vejaTodos={alertas.trial_vencendo.length > 5 ? '/admin/alertas#trial' : null}
              />
              <CardAlerta
                titulo="🔴 Atrasados (>7 dias)"
                vazio="Nenhum cliente em atraso há mais de 7 dias."
                items={alertas.atrasados.slice(0, 5).map((a) => ({
                  empresaId: a.empresa_id,
                  titulo: a.nome,
                  subtitulo: a.owner_email ?? '—',
                  badge: `${a.dias_atrasado}d atraso`,
                }))}
                vejaTodos={alertas.atrasados.length > 5 ? '/admin/alertas#atrasados' : null}
              />
              <CardAlerta
                titulo="⚠️ Inativos (sem cards há 7+d)"
                vazio="Todos os clientes ativos usaram nos últimos 7 dias."
                items={alertas.inativos_7d.slice(0, 5).map((a) => ({
                  empresaId: a.empresa_id,
                  titulo: a.nome,
                  subtitulo: a.owner_email ?? '—',
                  badge: a.ultimo_card_em
                    ? formatarDataRelativa(a.ultimo_card_em)
                    : 'nunca usou',
                }))}
                vejaTodos={alertas.inativos_7d.length > 5 ? '/admin/alertas#inativos' : null}
              />
              <CardAlerta
                titulo="📭 Sem nenhuma obra"
                vazio="Todos cadastrados há mais de 2 dias já criaram obra."
                items={alertas.sem_obras.slice(0, 5).map((a) => ({
                  empresaId: a.empresa_id,
                  titulo: a.nome,
                  subtitulo: a.owner_email ?? '—',
                  badge: `${a.dias_desde_cadastro}d cadastrado`,
                }))}
                vejaTodos={alertas.sem_obras.length > 5 ? '/admin/alertas#sem-obras' : null}
              />
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

// ============================================================
// COMPONENTES INTERNOS
// ============================================================

export function AdminHeader({ user }: { user: { email?: string | null } | null }) {
  async function logout() {
    await sair()
    window.location.href = '/'
  }
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
        <Link to="/admin" className="flex items-center gap-3">
          <LogoFull />
          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-900 text-white rounded">
            ADMIN
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link to="/admin" className="text-slate-500 hover:text-slate-900">Dashboard</Link>
          <Link to="/admin/clientes" className="text-slate-500 hover:text-slate-900">Clientes</Link>
          <Link to="/admin/alertas" className="text-slate-500 hover:text-slate-900">Alertas</Link>
          <Link to="/app/obras" className="text-slate-500 hover:text-slate-900">← App</Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden lg:inline">{user?.email}</span>
          <button onClick={logout} className="btn-ghost text-xs">Sair</button>
        </div>
      </div>
    </header>
  )
}

type CorMetrica = 'neutro' | 'verde' | 'azul' | 'laranja' | 'vermelho'
const CLASSES_METRICA: Record<CorMetrica, { bg: string; texto: string; borda: string }> = {
  neutro: { bg: 'bg-white', texto: 'text-slate-900', borda: 'border-slate-200' },
  verde: { bg: 'bg-green-50', texto: 'text-green-700', borda: 'border-green-200' },
  azul: { bg: 'bg-blue-50', texto: 'text-blue-700', borda: 'border-blue-200' },
  laranja: { bg: 'bg-orange-50', texto: 'text-orange-700', borda: 'border-orange-200' },
  vermelho: { bg: 'bg-red-50', texto: 'text-red-700', borda: 'border-red-200' },
}

function CardMetrica({
  titulo,
  valor,
  cor,
}: {
  titulo: string
  valor: string | number
  cor: CorMetrica
}) {
  const cls = CLASSES_METRICA[cor]
  return (
    <div className={`${cls.bg} ${cls.borda} border rounded-xl p-4`}>
      <div className={`text-2xl font-bold ${cls.texto}`}>{valor}</div>
      <div className="text-xs text-slate-600 mt-1 font-medium">{titulo}</div>
    </div>
  )
}

function CardAlerta({
  titulo,
  vazio,
  items,
  vejaTodos,
}: {
  titulo: string
  vazio: string
  items: { empresaId: string; titulo: string; subtitulo: string; badge: string }[]
  vejaTodos: string | null
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <h2 className="text-sm font-semibold mb-3">{titulo}</h2>
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 italic py-2">{vazio}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.empresaId}>
              <Link
                to={`/admin/clientes/${item.empresaId}`}
                className="flex items-center justify-between gap-2 p-2 rounded hover:bg-slate-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">{item.titulo}</div>
                  <div className="text-xs text-slate-500 truncate">{item.subtitulo}</div>
                </div>
                <span className="text-xs text-slate-600 whitespace-nowrap">{item.badge}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {vejaTodos && (
        <Link to={vejaTodos} className="text-xs text-laranja-dark hover:underline mt-2 inline-block">
          Ver todos →
        </Link>
      )}
    </section>
  )
}
