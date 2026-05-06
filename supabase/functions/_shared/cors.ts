// CORS headers compartilhados pelas edge functions.
// Liberamos o origin do app (5gobra.com.br) e localhost pra dev.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
