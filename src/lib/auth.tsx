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

  // Boot: monta APENAS o listener onAuthStateChange.
  //
  // O listener dispara `INITIAL_SESSION` automaticamente no mount, populando
  // a sessão se houver. Não chamamos getSession() em paralelo — em
  // @supabase/supabase-js v2.x isso causa deadlock no mutex interno e
  // mutations posteriores (INSERT/UPDATE/signIn) ficam pendurada sem disparar
  // fetch. Diagnóstico cravado em 30/05/2026 no G Estoque, fix preventivo
  // aplicado aqui em 02/06/2026 antes que o bug aparecesse em prod do G Obra.
  // Vide: Obsidian Vault / Sessões / 2026-05-30 - Bug Supabase fechado +
  // 2 anti-patterns documentados.
  useEffect(() => {
    if (!supabase) {
      setCarregando(false)
      return
    }
    let ativo = true
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!ativo) return
      setSession(s)
      // INITIAL_SESSION é o primeiro evento que o listener dispara no mount.
      // Quando ele chega, o boot termina (carregando = false). Eventos
      // seguintes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) já têm seu próprio
      // ciclo via signIn/signOut/signUp.
      if (event === 'INITIAL_SESSION') {
        setCarregando(false)
      }
    })
    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
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
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return data
}

export async function cadastrar(email: string, senha: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.auth.signUp({ email, password: senha })
  if (error) throw error
  return data
}

export async function sair() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// Dispara o e-mail de redefinição de senha. O link do e-mail leva pra
// /redefinir-senha (no mesmo domínio em que o app está rodando — por isso
// window.location.origin, sem hardcode de URL).
export async function solicitarResetSenha(email: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  })
  if (error) throw error
}

// Define a nova senha. Só funciona com a sessão de recuperação ativa (criada
// pelo Supabase quando o usuário abre o link do e-mail).
export async function definirNovaSenha(novaSenha: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) throw error
}
