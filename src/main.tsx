import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMetaPixel, trackLead } from './lib/meta-pixel.ts'

// Inicializa Meta Pixel se VITE_META_PIXEL_ID estiver setado.
// Em dev sem ID, vira no-op com console.info.
initMetaPixel()

// Ponte Calendly -> Meta Pixel.
//
// O widget Calendly (carregado via index.html) emite postMessage no parent
// quando o usuário completa o agendamento. Capturamos esse evento e
// disparamos o evento "Lead" no Meta Pixel. Isso permite a Campanha 2
// otimizar por conversão real ("quem agendou demo") em vez de proxy
// fraco como "Ver conteúdo". Sem isso o pixel só vê o agendamento se
// estivesse no domínio do calendly.com — o que não rola.
//
// Validação de origem é crítica pra não disparar Lead em qualquer
// postMessage que algum script de terceiro mande (XSS-style defense).
// Lê um cookie do browser pelo nome (ex: _fbp, _fbc).
function lerCookie(nome: string): string | undefined {
  const esc = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = document.cookie.match(new RegExp('(?:^|; )' + esc + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : undefined
}

// Envia os cookies do Pixel (_fbp/_fbc) pra Edge Function, associados ao
// invitee do Calendly. O CAPI server-side (T4) busca esses cookies pelo
// invitee_uuid pra elevar o Event Match Quality. Best-effort, não bloqueia.
function salvarPixelCookies(inviteeUuid: string): void {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return
  fetch(`${url}/functions/v1/salvar-pixel-cookies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      invitee_uuid: inviteeUuid,
      fbp: lerCookie('_fbp') ?? null,
      fbc: lerCookie('_fbc') ?? null,
    }),
    keepalive: true,
  }).catch(() => {})
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    const origemValida =
      typeof e.origin === 'string' && e.origin.endsWith('calendly.com')
    const eventoCalendly =
      e.data && typeof e.data === 'object' && 'event' in e.data
        ? (e.data as { event: string }).event
        : null
    if (origemValida && eventoCalendly === 'calendly.event_scheduled') {
      // Extrai o UUID do invitee do payload do Calendly pra usar como event_id.
      // Esse MESMO id é usado pelo CAPI server-side (T4) → o Meta deduplica os
      // eventos client e server num só. // dedup com CAPI server-side (T4)
      let inviteeUuid: string | undefined
      try {
        const payload = (e.data as { payload?: { invitee?: { uri?: string } } }).payload
        inviteeUuid = payload?.invitee?.uri?.split('/').filter(Boolean).pop()
      } catch {
        // payload fora do formato esperado → dispara sem dedup (como antes)
      }
      const eventId = inviteeUuid ? `calendly_${inviteeUuid}` : undefined
      trackLead(eventId)
      console.info('[meta-pixel] Lead disparado (Calendly: demo agendada)', { eventId })

      // Grava _fbp/_fbc associados ao invitee pro CAPI server-side (T4) usar.
      if (inviteeUuid) salvarPixelCookies(inviteeUuid)
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
