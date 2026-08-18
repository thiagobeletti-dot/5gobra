// Painel gerencial (só admin) — quem entrou, em que pé está e se está usando.
//
// Fonte: RPC painel_admin_clientes() no Supabase, que já valida se o usuário
// está na tabela `admins` (cliente comum recebe "acesso negado"). Por isso a
// página não precisa de Edge Function nem de checagem extra aqui.
//
// Cravado 18/08/2026 (pedido Thiago): "quero identificar meus clientes, ver
// quem entrou, se está em trial, ter o contato pra oferecer ajuda e saber se
// está interagindo com o sistema".

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { supabase } from '../lib/supabase'

interface ClienteAdmin {
  empresa_id: string
  empresa_nome: string
  entrou_em: string
  contato_nome: string | null
  contato_email: string | null
  contato_whatsapp: string | null
  origem: string | null
  assinatura_status: string
  trial_termina_em: string | null
  dias_restantes: number | null
  cartao_cadastrado_em: string | null
  ultimo_login: string | null
  ultima_atividade: string | null
  qtd_obras: number
  qtd_pecas: number
  qtd_fotos: number
  cliente_interagiu: boolean
  ativado: boolean
}

type Filtro = 'todos' | 'trial' | 'ativos' | 'risco'

/** Dias inteiros desde uma data ISO. Null se não houver data. */
function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function textoDesde(iso: string | null): string {
  const d = diasDesde(iso)
  if (d === null) return 'nunca'
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  return `há ${d} dias`
}

function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * Semáforo de ativação — o coração do painel.
 *   vermelho = nunca ativou (não criou obra com peça)
 *   amarelo  = ativou mas parou (7+ dias sem mexer)
 *   verde    = ativou e está mexendo
 */
function semaforo(c: ClienteAdmin): { cor: 'verde' | 'amarelo' | 'vermelho'; texto: string } {
  if (!c.ativado) return { cor: 'vermelho', texto: 'Não ativou' }
  const d = diasDesde(c.ultima_atividade)
  if (d === null || d >= 7) return { cor: 'amarelo', texto: 'Parou de usar' }
  return { cor: 'verde', texto: 'Usando' }
}

const CLASSE_SEMAFORO: Record<'verde' | 'amarelo' | 'vermelho', string> = {
  verde: 'bg-green-50 text-green-700 border-green-200',
  amarelo: 'bg-amber-50 text-amber-700 border-amber-200',
  vermelho: 'bg-red-50 text-red-700 border-red-200',
}

export default function Admin() {
  const [clientes, setClientes] = useState<ClienteAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      if (!supabase) {
        setErro('Supabase não configurado.')
        setCarregando(false)
        return
      }
      const { data, error } = await supabase.rpc('painel_admin_clientes')
      if (!ativo) return
      if (error) {
        setErro(
          error.message.includes('Acesso negado')
            ? 'Acesso negado — esta página é só para administradores.'
            : 'Não consegui carregar o painel: ' + error.message,
        )
      } else {
        setClientes((data ?? []) as ClienteAdmin[])
      }
      setCarregando(false)
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  const kpis = useMemo(() => {
    const emTrial = clientes.filter((c) => c.assinatura_status === 'trial')
    const ativos = clientes.filter((c) => c.assinatura_status === 'ativo')
    const ativados = clientes.filter((c) => c.ativado)
    // Quem mais precisa da sua ligação: trial acabando e nunca ativou.
    const risco = clientes.filter(
      (c) => c.assinatura_status === 'trial' && !c.ativado && (c.dias_restantes ?? 99) <= 5,
    )
    const pctAtivacao = clientes.length > 0 ? Math.round((ativados.length / clientes.length) * 100) : 0
    return { total: clientes.length, emTrial: emTrial.length, ativos: ativos.length, pctAtivacao, risco: risco.length }
  }, [clientes])

  const lista = useMemo(() => {
    let l = clientes
    if (filtro === 'trial') l = l.filter((c) => c.assinatura_status === 'trial')
    else if (filtro === 'ativos') l = l.filter((c) => c.assinatura_status === 'ativo')
    else if (filtro === 'risco')
      l = l.filter((c) => c.assinatura_status === 'trial' && !c.ativado && (c.dias_restantes ?? 99) <= 5)
    const q = busca.trim().toLowerCase()
    if (q) {
      l = l.filter(
        (c) =>
          c.empresa_nome.toLowerCase().includes(q) ||
          (c.contato_nome ?? '').toLowerCase().includes(q) ||
          (c.contato_email ?? '').toLowerCase().includes(q),
      )
    }
    return l
  }, [clientes, filtro, busca])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link to="/app/obras">
            <LogoFull small />
          </Link>
          <span className="text-sm font-bold text-slate-700">Painel gerencial</span>
          <Link to="/app/obras" className="ml-auto text-xs text-slate-500 hover:text-laranja">
            ← Voltar ao app
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-7 py-7">
        <h1 className="text-2xl font-bold text-slate-900">Meus clientes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quem entrou, em que pé está e se está realmente usando o sistema.
        </p>

        {erro && (
          <div className="mt-5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{erro}</div>
        )}

        {carregando ? (
          <p className="mt-6 text-slate-500 text-sm">Carregando...</p>
        ) : erro ? null : (
          <>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi titulo="Clientes" valor={kpis.total} cor="text-slate-900" />
              <Kpi titulo="Em teste" valor={kpis.emTrial} cor="text-amber-600" />
              <Kpi titulo="Pagantes" valor={kpis.ativos} cor="text-green-600" />
              <Kpi titulo="Ativação" valor={`${kpis.pctAtivacao}%`} cor="text-blue-600" />
              <Kpi titulo="Precisam de você" valor={kpis.risco} cor="text-red-600" />
            </div>

            {kpis.risco > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 flex items-center gap-3 flex-wrap">
                <span>
                  <strong>{kpis.risco}</strong>{' '}
                  {kpis.risco === 1 ? 'cliente está com o teste acabando e nunca ativou' : 'clientes estão com o teste acabando e nunca ativaram'}.
                  É a sua lista de ligação de hoje.
                </span>
                <button onClick={() => setFiltro('risco')} className="btn-primary text-xs py-1.5 px-3 ml-auto">
                  Ver quem são
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center gap-2 flex-wrap">
              {([
                ['todos', 'Todos'],
                ['trial', 'Em teste'],
                ['ativos', 'Pagantes'],
                ['risco', 'Precisam de você'],
              ] as [Filtro, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFiltro(id)}
                  className={
                    'text-xs px-3 py-1.5 rounded-lg border transition ' +
                    (filtro === id
                      ? 'border-laranja bg-laranja-soft text-laranja-dark font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')
                  }
                >
                  {label}
                </button>
              ))}
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por empresa, nome ou e-mail..."
                className="ml-auto text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-64 max-w-full focus:outline-none focus:ring-2 focus:ring-laranja/30"
              />
            </div>

            <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
                    <th className="px-4 py-3 font-bold">Cliente</th>
                    <th className="px-4 py-3 font-bold">Contato</th>
                    <th className="px-4 py-3 font-bold">Entrou</th>
                    <th className="px-4 py-3 font-bold">Situação</th>
                    <th className="px-4 py-3 font-bold">Último acesso</th>
                    <th className="px-4 py-3 font-bold">Uso</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        Nenhum cliente nesse filtro.
                      </td>
                    </tr>
                  ) : (
                    lista.map((c) => {
                      const s = semaforo(c)
                      const zap = (c.contato_whatsapp ?? '').replace(/\D/g, '')
                      return (
                        <tr key={c.empresa_id} className="hover:bg-slate-50 align-top">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{c.empresa_nome}</div>
                            {c.contato_nome && <div className="text-xs text-slate-500">{c.contato_nome}</div>}
                            {c.origem && <div className="text-[11px] text-slate-400">via {c.origem}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {c.contato_email && <div className="text-xs text-slate-600">{c.contato_email}</div>}
                            {zap ? (
                              <a
                                href={`https://wa.me/${zap.length <= 11 ? '55' + zap : zap}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-green-600 hover:underline"
                              >
                                WhatsApp →
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">sem telefone</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {dataCurta(c.entrou_em)}
                            <div className="text-[11px] text-slate-400">{textoDesde(c.entrou_em)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusAssinatura cliente={c} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {textoDesde(c.ultimo_login)}
                            <div className="text-[11px] text-slate-400">
                              atividade: {textoDesde(c.ultima_atividade)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {c.qtd_obras} obra{c.qtd_obras !== 1 ? 's' : ''} · {c.qtd_pecas} peça
                            {c.qtd_pecas !== 1 ? 's' : ''}
                            <div className="text-[11px] text-slate-400">
                              {c.qtd_fotos} foto{c.qtd_fotos !== 1 ? 's' : ''} ·{' '}
                              {c.cliente_interagiu ? (
                                <span className="text-green-600 font-semibold">cliente interagiu</span>
                              ) : (
                                'cliente não abriu'
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block text-[11px] font-bold uppercase tracking-wide border rounded-full px-2.5 py-1 whitespace-nowrap ${CLASSE_SEMAFORO[s.cor]}`}
                            >
                              {s.texto}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              "Ativação" = criou pelo menos uma obra com peças. É o melhor sinal de que o cliente
              entendeu o produto — quem não ativa nos primeiros dias raramente vira pagante.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function StatusAssinatura({ cliente }: { cliente: ClienteAdmin }) {
  const { assinatura_status, dias_restantes, cartao_cadastrado_em } = cliente
  if (assinatura_status === 'trial') {
    const d = dias_restantes ?? 0
    const urgente = d <= 3
    return (
      <div>
        <span
          className={
            'inline-block text-[11px] font-bold uppercase tracking-wide border rounded-full px-2.5 py-1 ' +
            (urgente ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200')
          }
        >
          Teste · {d} {d === 1 ? 'dia' : 'dias'}
        </span>
        <div className="text-[11px] mt-1">
          {cartao_cadastrado_em ? (
            <span className="text-green-600 font-semibold">cartão ok</span>
          ) : (
            <span className="text-slate-400">sem cartão</span>
          )}
        </div>
      </div>
    )
  }
  const mapa: Record<string, string> = {
    ativo: 'bg-green-50 text-green-700 border-green-200',
    suspenso: 'bg-red-50 text-red-700 border-red-200',
    cancelado: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <span
      className={`inline-block text-[11px] font-bold uppercase tracking-wide border rounded-full px-2.5 py-1 ${
        mapa[assinatura_status] ?? 'bg-slate-100 text-slate-500 border-slate-200'
      }`}
    >
      {assinatura_status}
    </span>
  )
}

function Kpi({ titulo, valor, cor }: { titulo: string; valor: number | string; cor: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
      <div className="text-xs text-slate-500 mt-0.5">{titulo}</div>
    </div>
  )
}
