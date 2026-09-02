import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { pegarStatusAssinatura } from '../lib/api'
import BannerTrial from './BannerTrial'
import type { ReactNode } from 'react'

type StatusAssinatura = 'trial' | 'ativo' | 'suspenso' | 'cancelado'

export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { user, carregando, habilitado } = useAuth()
  const location = useLocation()
  // Status do trial pro banner do topo. O BannerTrial já existia pronto no
  // projeto mas nunca tinha sido ligado — quem estava em teste não via nada.
  // Plugado aqui porque RotaProtegida envolve TODAS as telas do app (os
  // cabeçalhos são duplicados por página, então este é o único ponto comum).
  const [status, setStatus] = useState<{
    assinaturaStatus: StatusAssinatura
    trialTerminaEm: string | null
  } | null>(null)

  useEffect(() => {
    let ativo = true
    if (!habilitado || !user) return
    void pegarStatusAssinatura().then((s) => {
      if (ativo) setStatus(s)
    })
    return () => {
      ativo = false
    }
  }, [habilitado, user])

  if (!habilitado) {
    // Supabase nao configurado - app roda em modo demo, deixa passar
    return <>{children}</>
  }
  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return (
    <>
      {status && (
        <BannerTrial
          trialTerminaEm={status.trialTerminaEm}
          assinaturaStatus={status.assinaturaStatus}
        />
      )}
      {children}
    </>
  )
}
