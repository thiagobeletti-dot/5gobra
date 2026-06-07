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
if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    // DEBUG TEMPORÁRIO (07/06/2026) — investigação do Pixel Lead que não dispara.
    // Loga TODO postMessage que venha de qualquer subdomínio calendly. Remover
    // depois de identificar formato real do evento de agendamento.
    if (typeof e.origin === 'string' && e.origin.includes('calendly')) {
      console.info('[debug-calendly] postMessage:', {
        origin: e.origin,
        data: e.data,
      })
    }

    const origemValida =
      typeof e.origin === 'string' && e.origin.endsWith('calendly.com')
    const eventoCalendly =
      e.data && typeof e.data === 'object' && 'event' in e.data
        ? (e.data as { event: string }).event
        : null
    if (origemValida && eventoCalendly === 'calendly.event_scheduled') {
      trackLead()
      console.info('[meta-pixel] Lead disparado (Calendly: demo agendada)')
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
