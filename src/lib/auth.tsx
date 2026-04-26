import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from './supabase'

interface AuthCtx {
  user: User | null
  session: Session | null
  carregando: boolean
  habilitado: boolean
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, carregando: true, habilitado: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setCarregando(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        carregando,
        habilitado: supabaseConfigurado,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}

export async function entrar(email: string, senha: string) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return data
}

export async function cadastrar(email: string, senha: string) {
  if (!supabase) throw new Error('Supabase nao configurado')
  const { data, error } = await supabase.auth.signUp({ email, password: senha })
  if (error) throw error
  return data
}

export async function sair() {
  if (!supabase) return
  await supabase.auth.signOut()
}
