// Admin > Clientes — tabela de TODAS as empresas com métricas agregadas.
// Filtros: status, busca por nome/email, ordenação.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  listarClientes,
  formatarReais,
  formatarData,
  formatarDataRelativa,
  corStatusAssinatura,
  type AdminCliente,
} from '../../lib/admin'
import { AdminHeader } from './AdminDashboard'

type OrdenarPor = 'criado' | 'ultimo_card' | 'nome' | 'mrr'
type FiltroStatus = 'todos' | 'trial' | 'ativa' | 'atrasada' | 'cancelada' | 'sem_plano'

export default function AdminClientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<AdminCliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [ordem, setOrdem] = useState<OrdenarPor>('criado')

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const data = await listarClientes()
        if (ativo) setClientes(data)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar clientes')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  const visiveis = useMemo(() => {
    let arr = [...clientes]
    if (filtroStatus !== 'todos') {
      arr = arr.filter((c) => c.asaas_status === filtroStatus || (filtroStatus === 'trial' && c.assinatura_status === 'trial'))
    }
    if (busca.trim()) {
      const q = busca.toLowerCase()
      arr = arr.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (c.owner_email ?? '').toLowerCase().includes(q),
      )
    }
    arr.sort((a, b) => {
      switch (ordem) {
        case 'nome':
          return a.nome.localeCompare(b.nome)
        case 'ultimo_card': {
          const ta = a.ultimo_card_em ? new Date(a.ultimo_card_em).getTime() : 0
          const tb = b.ultimo_card_em ? new Date(b.ultimo_card_em).getTime() : 0
          return tb - ta
        }
        case 'mrr':
          return b.valor_centavos - a.valor_centavos
        case 'criado':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return arr
  }, [clientes, busca, filtroStatus, ordem])

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader user={user} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">
            {clientes.length} empresa{clientes.length !== 1 ? 's' : ''} cadastrada{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filtros */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input flex-1 min-w-[200px]"
          />
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="input"
          >
            <option value="todos">Todos status</option>
            <option value="trial">Trial</option>
            <option value="ativa">Ativos</option>
            <option value="atrasada">Atrasados</option>
            <option value="cancelada">Cancelados</option>
            <option value="sem_plano">Sem plano</option>
          </select>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as OrdenarPor)}
            className="input"
          >
            <option value="criado">Mais recentes</option>
            <option value="ultimo_card">Última atividade</option>
            <option value="nome">Nome (A-Z)</option>
            <option value="mrr">Valor (maior)</option>
          </select>
        </section>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-slate-500 py-12 text-center">Carregando...</div>
        ) : visiveis.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Nenhum cliente encontrado pros filtros.
          </div>
        ) : (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Obras</th>
                    <th className="px-4 py-3 text-left font-medium">Última atividade</th>
                    <th className="px-4 py-3 text-left font-medium">Cadastro</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiveis.map((c) => (
                    <tr key={c.empresa_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{c.nome}</div>
                        <div className="text-xs text-slate-500">{c.owner_email ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full border ${corStatusAssinatura(
                            c.asaas_status,
                          )}`}
                        >
                          {c.asaas_status}
                        </span>
                        {c.assinatura_status === 'trial' && c.trial_termina_em && (
                          <div className="text-xs text-slate-500 mt-1">
                            Trial até {formatarData(c.trial_termina_em)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{formatarReais(c.valor_centavos)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.obras_ativas}/{c.total_obras}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          {c.ultimo_card_em ? formatarDataRelativa(c.ultimo_card_em) : 'nunca'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatarData(c.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/clientes/${c.empresa_id}`}
                          className="text-laranja-dark hover:underline text-sm"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
