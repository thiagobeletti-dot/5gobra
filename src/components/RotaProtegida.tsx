import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { pegarSituacao, type Situacao } from '../lib/api'
import BannerTrial from './BannerTrial'
import Assinar from '../pages/Assinar'
import type { ReactNode } from 'react'

// RotaProtegida envolve TODAS as telas do app (os cabeçalhos são duplicados
// por página, então este é o único ponto comum). Faz duas coisas:
//   1. Sem sessão → /login.
//   2. Com sessão, pergunta ao banco (RPC minha_situacao) se a empresa tem
//      acesso. Sem acesso (trial vencido no dia 15, suspensa, cancelada) →
//      renderiza a tela <Assinar bloqueado /> NO LUGAR do app. Paywall total:
//      a pessoa não vê obra nenhuma até pagar. Admin nunca é bloqueado.
//
// O bloqueio de verdade é no banco (triggers + RLS em
// supabase/2026-09-02-trial-bloqueio.sql); aqui é só a interface obedecendo.
// Se a consulta falhar (rede), deixa passar — o banco recusa escrita mesmo assim.
//
// Cravado 02/09/2026 — trial de 14 dias sem cartão, bloqueio no 15º.

export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { user, carregando, habilitado } = useAuth()
  const location = useLocation()
  // undefined = ainda consultando; null = consulta falhou (deixa passar)
  const [situacao, setSituacao] = useState<Situacao | null | undefined>(undefined)

  useEffect(() => {
    let ativo = true
    if (!habilitado || !user) return
    // Não zera a situação anterior: na troca de rota a tela não pisca
    // "Carregando", só atualiza quando a resposta nova chega.
    void pegarSituacao()
      .then((s) => {
        if (ativo) setSituacao(s)
      })
      .catch(() => {
        if (ativo) setSituacao(null)
      })
    return () => {
      ativo = false
    }
    // Reconsulta a cada troca de rota: quem pagou e voltou pro app libera na hora,
    // e quem venceu no meio da sessão é bloqueado na próxima navegação.
  }, [habilitado, user, location.pathname])

  if (!habilitado) {
    // Supabase nao configurado - app roda em modo demo, deixa passar
    return <>{children}</>
  }
  if (carregando || (user && situacao === undefined)) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (situacao && !situacao.acesso && !situacao.admin) {
    return <Assinar situacao={situacao} bloqueado />
  }
  return (
    <>
      {situacao && situacao.status !== 'ativo' && (
        <BannerTrial
          trialTerminaEm={situacao.trialTerminaEm}
          assinaturaStatus={situacao.status}
          diasRestantes={situacao.diasRestantes}
        />
      )}
      {children}
    </>
  )
}
