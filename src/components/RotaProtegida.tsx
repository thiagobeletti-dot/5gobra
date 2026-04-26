import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { ReactNode } from 'react'

export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { user, carregando, habilitado } = useAuth()
  const location = useLocation()

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
  return <>{children}</>
}
