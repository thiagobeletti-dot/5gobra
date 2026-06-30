// Gate de acesso ao painel /admin.
// Espelha RotaProtegida.tsx + camada extra: precisa estar logado E ser super-admin.
// Super-admin é definido pela tabela super_admins (criada em supabase/admin-console.sql).

import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { checarSuperAdmin } from '../lib/admin'

export default function RotaAdmin({ children }: { children: ReactNode }) {
  const { user, carregando: carregandoAuth, habilitado } = useAuth()
  const location = useLocation()
  const [carregandoAdmin, setCarregandoAdmin] = useState(true)
  const [ehAdmin, setEhAdmin] = useState(false)

  useEffect(() => {
    let ativo = true
    if (!user) {
      setCarregandoAdmin(false)
      return
    }
    ;(async () => {
      const resultado = await checarSuperAdmin()
      if (ativo) {
        setEhAdmin(resultado)
        setCarregandoAdmin(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [user])

  if (!habilitado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-slate-500">
          Supabase não configurado — Admin Console indisponível.
        </div>
      </div>
    )
  }

  if (carregandoAuth || carregandoAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Carregando painel...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!ehAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center">
          <div className="text-4xl mb-3 opacity-40">🔒</div>
          <h2 className="font-semibold text-lg mb-2">Acesso restrito</h2>
          <p className="text-sm text-slate-500 mb-4">
            Esta área é exclusiva pra administradores da 5G. Se você acha que deveria ter acesso, fala comigo.
          </p>
          <a href="/app/obras" className="text-sm text-laranja-dark hover:underline">
            ← Voltar pro app
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
