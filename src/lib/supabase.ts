import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente Supabase principal — usado nas páginas autenticadas (Empresa logada).
// Persiste sessão em localStorage padrão.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { storageKey: 'sb-5gobra-app' },
    })
  : null

// Cliente Supabase paralelo SEM sessão persistida — usar nas rotas públicas
// /tec/[token] e /obra/[token]. Garante que as queries vão como anon mesmo
// quando o usuário está logado no app na mesma origem (evita conflito de RLS:
// JWT authenticated entrava na policy `obras_authenticated_all` em vez de
// `obras_anon_select`, causando "Obra não encontrada").
export const supabasePublico = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-5gobra-publico',
      },
    })
  : null

export const supabaseConfigurado = Boolean(supabase)

// Tipo helper pra assinaturas das funções helpers que aceitam client opcional
export type DbClient = SupabaseClient
