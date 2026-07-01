// Admin > Alertas — drilldown das 4 listas (trial vencendo, atrasados, inativos, sem obras).
// É a Tela 4. Reusa estilo do Dashboard mas sem limit de top 5.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  pegarAlertas,
  formatarData,
  formatarDataRelativa,
  type AdminAlertas,
} from '../../lib/admin'
import { AdminHeader } from './AdminDashboard'

export default function AdminAlertasPage() {
  const { user } = useAuth()
  const [alertas, setAlertas] = useState<AdminAlertas | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const data = await pegarAlertas()
        if (ativo) setAlertas(data)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar alertas')
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Clientes que precisam de atenção agora
          </p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-slate-500 py-12 text-center">Carregando...</div>
        ) : alertas ? (
          <div className="space-y-6">
            <Secao
              id="trial"
              titulo={`🟡 Trial vencendo em ≤3 dias (${alertas.trial_vencendo.length})`}
              vazio="Ninguém com trial vencendo nos próximos 3 dias."
            >
              <ul className="divide-y divide-slate-100">
                {alertas.trial_vencendo.map((a) => (
                  <li key={a.empresa_id}>
                    <Link
                      to={`/admin/clientes/${a.empresa_id}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{a.nome}</div>
                        <div className="text-xs text-slate-500 truncate">{a.owner_email ?? '—'}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-semibold text-orange-700">
                          {a.dias_restantes}d restantes
                        </div>
                        <div className="text-slate-500">{formatarData(a.trial_termina_em)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Secao>

            <Secao
              id="atrasados"
              titulo={`🔴 Atrasados há >7 dias (${alertas.atrasados.length})`}
              vazio="Nenhum cliente em atraso há mais de 7 dias."
            >
              <ul className="divide-y divide-slate-100">
                {alertas.atrasados.map((a) => (
                  <li key={a.empresa_id} className="p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <Link
                        to={`/admin/clientes/${a.empresa_id}`}
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <div className="font-medium text-slate-900 truncate">{a.nome}</div>
                        <div className="text-xs text-slate-500 truncate">{a.owner_email ?? '—'}</div>
                      </Link>
                      <div className="text-xs font-semibold text-red-700">
                        {a.dias_atrasado}d atraso
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Venceu em {formatarData(a.proximo_vencimento)}
                      {a.fatura_atual_url && (
                        <>
                          {' · '}
                          <a
                            href={a.fatura_atual_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-laranja-dark hover:underline"
                          >
                            Abrir fatura
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Secao>

            <Secao
              id="inativos"
              titulo={`⚠️ Inativos sem cards há 7+ dias (${alertas.inativos_7d.length})`}
              vazio="Todos os clientes ativos usaram nos últimos 7 dias."
            >
              <ul className="divide-y divide-slate-100">
                {alertas.inativos_7d.map((a) => (
                  <li key={a.empresa_id}>
                    <Link
                      to={`/admin/clientes/${a.empresa_id}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{a.nome}</div>
                        <div className="text-xs text-slate-500 truncate">{a.owner_email ?? '—'} · {a.assinatura_status}</div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        {a.ultimo_card_em
                          ? `último ${formatarDataRelativa(a.ultimo_card_em)}`
                          : 'nunca usou'}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Secao>

            <Secao
              id="sem-obras"
              titulo={`📭 Cadastrados há >2 dias sem nenhuma obra (${alertas.sem_obras.length})`}
              vazio="Todos os cadastrados criaram pelo menos 1 obra."
            >
              <ul className="divide-y divide-slate-100">
                {alertas.sem_obras.map((a) => (
                  <li key={a.empresa_id}>
                    <Link
                      to={`/admin/clientes/${a.empresa_id}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{a.nome}</div>
                        <div className="text-xs text-slate-500 truncate">{a.owner_email ?? '—'}</div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        cadastrado {formatarDataRelativa(a.created_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Secao>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function Secao({
  id,
  titulo,
  vazio,
  children,
}: {
  id: string
  titulo: string
  vazio: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-xl overflow-hidden scroll-mt-20">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="font-semibold text-sm">{titulo}</h2>
      </div>
      {children ? children : <div className="p-4 text-sm text-slate-400 italic">{vazio}</div>}
    </section>
  )
}
