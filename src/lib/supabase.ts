import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente Supabase. Quando o Thiago me mandar URL + anon key,
// elas viram variaveis de ambiente no Vercel (prefixo VITE_ pra ficarem expostas no client).
// Enquanto nao houver chaves, o app roda em modo "demo" usando localStorage.

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const supabaseConfigurado = Boolean(supabase)
