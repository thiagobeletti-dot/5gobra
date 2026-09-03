// Mensagem real de uma Edge Function que respondeu 4xx/5xx.
//
// O supabase-js empacota resposta não-2xx num FunctionsHttpError: deixa o
// `data` vazio e põe no `error.message` um texto genérico ("Edge Function
// returned a non-2xx status code"). O corpo — que é onde está o
// `{ ok: false, error: "..." }` que a própria função escreveu — fica em
// `error.context`, uma Response crua que ninguém lia.
//
// Sem isso, "Já existe uma conta com esse e-mail. Faça login, ou use Esqueci
// minha senha" chegava na tela como "Não consegui criar sua conta. Tenta de
// novo em instantes." A pessoa tentava de novo, dava o mesmo, e ia embora.
//
// Cravado 03/09/2026, depois de um cadastro real falhar sem explicação na
// primeira tela de quem vem do anúncio.

export async function mensagemDaFuncao(erro: unknown): Promise<string | undefined> {
  const contexto = (erro as { context?: unknown } | null)?.context
  if (!contexto || typeof (contexto as Response).json !== 'function') return undefined
  try {
    // clone() porque a Response pode já ter sido lida por outro caminho.
    const corpo = (await (contexto as Response).clone().json()) as { error?: unknown }
    const msg = corpo?.error
    return typeof msg === 'string' && msg.trim() ? msg : undefined
  } catch {
    // Corpo não era JSON (timeout, gateway, função fora do ar). Quem chamou
    // cai na mensagem genérica, que aí é honesta: não há motivo específico.
    return undefined
  }
}
