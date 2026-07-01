// Admin > Cliente individual — drilldown de uma empresa específica.
// Mostra dados da empresa, assinatura Asaas, métricas de uso, timeline simples.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  pegarDetalheCliente,
  formatarReais,
  formatarData,
  formatarDataRelativa,
  corStatusAssinatura,
  type AdminClienteDetalhe,
} from '../../lib/admin'
import { AdminHeader } from './AdminDashboard'

export default function AdminCliente() {
  const { user } = useAuth()
  const { empresaId } = useParams<{ empresaId: string }>()
  const [detalhe, setDetalhe] = useState<AdminClienteDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!empresaId) return
    let ativo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const data = await pegarDetalheCliente(empresaId)
        if (ativo) setDetalhe(data)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar cliente')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [empresaId])

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader user={user} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-4">
          <Link to="/admin/clientes" className="text-sm text-slate-500 hover:text-slate-900">
            ← Voltar pra lista
          </Link>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-slate-500 py-12 text-center">Carregando...</div>
        ) : !detalhe ? (
          <div className="text-slate-500 py-12 text-center">Cliente não encontrado.</div>
        ) : (
          <>
            {/* Header */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
              <h1 className="text-2xl font-bold">{detalhe.empresa.nome}</h1>
              <div className="text-sm text-slate-500 mt-2 space-y-1">
                <div><strong>Dono:</strong> {detalhe.dono_email ?? '—'}</div>
                {detalhe.empresa.cnpj && <div><strong>CNPJ:</strong> {detalhe.empresa.cnpj}</div>}
                {detalhe.empresa.telefone && <div><strong>Telefone:</strong> {detalhe.empresa.telefone}</div>}
                <div><strong>Cadastrada em:</strong> {formatarData(detalhe.empresa.created_at)} ({formatarDataRelativa(detalhe.empresa.created_at)})</div>
              </div>
            </section>

            {/* Assinatura */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
              <h2 className="font-semibold mb-3">Assinatura</h2>
              {detalhe.assinatura ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status Asaas:</span>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full border ${corStatusAssinatura(
                        detalhe.assinatura.status,
                      )}`}
                    >
                      {detalhe.assinatura.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status trial:</span>
                    <span className="text-slate-900">{detalhe.empresa.assinatura_status}</span>
                  </div>
                  {detalhe.empresa.trial_termina_em && detalhe.empresa.assinatura_status === 'trial' && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Trial termina em:</span>
                      <span className="text-slate-900">
                        {formatarData(detalhe.empresa.trial_termina_em)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Valor mensal:</span>
                    <span className="font-semibold text-slate-900">
                      {formatarReais(detalhe.assinatura.valor_centavos)}
                    </span>
                  </div>
                  {detalhe.assinatura.proximo_vencimento && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Próximo vencimento:</span>
                      <span className="text-slate-900">
                        {formatarData(detalhe.assinatura.proximo_vencimento)}
                      </span>
                    </div>
                  )}
                  {detalhe.assinatura.ultimo_pagamento_em && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Último pagamento:</span>
                      <span className="text-slate-900">
                        {formatarData(detalhe.assinatura.ultimo_pagamento_em)}
                      </span>
                    </div>
                  )}
                  {detalhe.assinatura.fatura_atual_url && detalhe.assinatura.status === 'atrasada' && (
                    <div className="pt-2">
                      <a
                        href={detalhe.assinatura.fatura_atual_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-laranja-dark hover:underline text-sm"
                      >
                        Abrir fatura em atraso →
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">
                  Sem assinatura registrada (cliente em trial puro ou ainda não ativou plano).
                </div>
              )}
            </section>

            {/* Métricas de uso */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
              <h2 className="font-semibold mb-3">Uso</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Metrica titulo="Obras totais" valor={detalhe.metricas.obras_total} />
                <Metrica titulo="Obras ativas" valor={detalhe.metricas.obras_ativas} />
                <Metrica titulo="Cards criados" valor={detalhe.metricas.cards_total} />
                <Metrica titulo="Históricos" valor={detalhe.metricas.historicos_total} />
                <Metrica
                  titulo="Último card"
                  valor={
                    detalhe.metricas.ultimo_card_em
                      ? formatarDataRelativa(detalhe.metricas.ultimo_card_em)
                      : 'nunca'
                  }
                />
                <Metrica
                  titulo="Último histórico"
                  valor={
                    detalhe.metricas.ultimo_historico_em
                      ? formatarDataRelativa(detalhe.metricas.ultimo_historico_em)
                      : 'nunca'
                  }
                />
              </div>
            </section>

            {/* Heads up — V2 */}
            <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
              <strong>V2 (não V1):</strong> botão "Entrar como esse cliente" pra suporte
              vai entrar numa próxima onda. Acesso via impersonation tem risco maior e
              precisa de auditoria. Por enquanto, debug via SQL Editor.
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Metrica({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-slate-900">{valor}</div>
      <div className="text-xs text-slate-500 mt-0.5">{titulo}</div>
    </div>
  )
}
