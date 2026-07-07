// CORS compartilhado pelas edge functions.
// Antes: Access-Control-Allow-Origin: '*' (qualquer site chamava as funcoes).
// Agora: allowlist dos origins da 5G + localhost pra dev. Origin fora da lista
// nao recebe header de CORS e o browser bloqueia a chamada cross-site.

const ORIGINS_PERMITIDOS = new Set([
  'https://5gobra.com.br',
  'https://www.5gobra.com.br',
  'https://5gobra.vercel.app',
  'https://gerenciamento5g.com.br',
  'https://www.gerenciamento5g.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
])

const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-obra-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

// Monta os headers de CORS pra uma request especifica, ecoando o Origin só se
// ele estiver na allowlist. Previews do Vercel (*.vercel.app) tambem passam.
export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const permitido =
    ORIGINS_PERMITIDOS.has(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
  return {
    ...BASE_HEADERS,
    'Access-Control-Allow-Origin': permitido ? origin : 'https://5gobra.com.br',
  }
}

// Mantido por compatibilidade com functions que ainda importam `corsHeaders`.
// Prefira `corsFor(req)` em endpoints publicos.
export const corsHeaders = {
  ...BASE_HEADERS,
  'Access-Control-Allow-Origin': 'https://5gobra.com.br',
}
