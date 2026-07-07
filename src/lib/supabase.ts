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

// Cliente público ESCOPADO por token do link mágico.
// Envia o token no header `x-obra-token` em toda request — as policies RLS
// anon (ver supabase/2026-07-07-hardening-rls-anon.sql) exigem esse header
// pra devolver/aceitar só as linhas da obra daquele token. Sem header, anon
// não enxerga nada. O header viaja junto no `.select()` que roda depois de
// insert/update, então as escritas continuam funcionando. Cacheado por token
// pra não instanciar N clients GoTrue.
const _publicClientCache = new Map<string, SupabaseClient>()
export function clientePublicoComToken(token: string | null | undefined): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null
  const key = token ?? ''
  const existente = _publicClientCache.get(key)
  if (existente) return existente
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sb-5gobra-publico',
    },
    global: key ? { headers: { 'x-obra-token': key } } : undefined,
  })
  _publicClientCache.set(key, client)
  return client
}

export const supabaseConfigurado = Boolean(supabase)

// Tipo helper pra assinaturas das funções helpers que aceitam client opcional
export type DbClient = SupabaseClient
