// Wrapper que invoca a Edge Function enviar-pdfs-aceite.
//
// Uso:
//   - Pos-cadastro (Cadastro.tsx): fire-and-forget, nao bloqueia UI
//     enviarPdfsDeAceite(empresaId).catch(() => {})  // erros silenciosos
//
//   - Reenvio manual (Configuracoes.tsx): aguarda resposta pra mostrar feedback
//     const r = await enviarPdfsDeAceite(empresaId, true)
//     if (r.dryRun) showWarning('Envio em modo de testes — Resend nao configurado')
//
// Modos:
//   - force=false (padrao): so envia aceites com email_enviado=false
//   - force=true: pega os 2 mais recentes (termos + privacidade) e reenvia
//
// Erros nao quebram o app: a edge function valida auth, gera PDF e envia.
// Se algo falhar (Resend offline, sem API key), retornamos o erro ou modo dryRun.

import { supabase } from './supabase'

export interface ResultadoEnvioAceite {
  ok: boolean
  dryRun?: boolean
  message?: string
  destinatario?: string
  enviados?: string[]
  pdfs?: Array<{ filename: string; sizeBytes: number }>
  error?: string
}

export async function enviarPdfsDeAceite(empresaId: string, force = false): Promise<ResultadoEnvioAceite> {
  if (!supabase) return { ok: false, error: 'Supabase nao configurado' }

  try {
    const { data, error } = await supabase.functions.invoke('enviar-pdfs-aceite', {
      body: { empresaId, force },
    })
    if (error) {
      return { ok: false, error: error.message }
    }
    return data as ResultadoEnvioAceite
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Erro desconhecido' }
  }
}
