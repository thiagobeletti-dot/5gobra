// Meta Pixel (Facebook/Instagram Ads)
//
// Carrega o pixel apenas em producao e quando o ID estiver configurado.
// Em dev, vira no-op com console.log pra ajudar a depurar.
//
// Pra configurar:
//   1. Em Meta Business Manager -> Eventos -> Pixels, cria um pixel novo
//      ou pega o ID do existente (16 digitos, ex: 1234567890123456)
//   2. No Vercel: Settings -> Environment Variables -> adicionar
//      VITE_META_PIXEL_ID = <pixel_id>
//   3. Redeploy
//
// Sem o ID configurado, todas as chamadas viram console.log inocuos.

/* eslint-disable @typescript-eslint/no-explicit-any */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined
const ENABLED = typeof window !== 'undefined' && !!PIXEL_ID

declare global {
  interface Window {
    // Uso `any` proposital — o snippet oficial do Meta usa funcao com
    // propriedades dinamicas (callMethod, queue, loaded, version, push),
    // o que conflita com tipagem estrita. Aceitavel pra um helper de
    // analytics encapsulado.
    fbq?: any
    _fbq?: any
  }
}

/**
 * Inicializa o Meta Pixel. Deve ser chamado uma vez, idealmente no main.tsx
 * antes de renderizar o App.
 */
export function initMetaPixel(): void {
  if (!ENABLED) {
    if (typeof window !== 'undefined') {
      console.info('[meta-pixel] desabilitado (VITE_META_PIXEL_ID nao definido)')
    }
    return
  }

  if (window.fbq) {
    // ja inicializado
    return
  }

  // Script oficial do Meta Pixel — inline pra carregar imediato
  ;(function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return
    const n: any = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args)
    }
    f.fbq = n
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode!.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

  window.fbq('init', PIXEL_ID)
  window.fbq('track', 'PageView')

  console.info('[meta-pixel] inicializado com ID', PIXEL_ID)
}

/**
 * Dispara um evento padrao do Meta Pixel.
 *
 * Eventos padrao mais usados:
 *   - 'PageView' (auto no init)
 *   - 'ViewContent' (visitou pagina de produto)
 *   - 'InitiateCheckout' (comecou checkout)
 *   - 'Purchase' (concluiu compra)
 *   - 'Lead' (gerou lead)
 *   - 'CompleteRegistration' (criou conta)
 */
export function trackEvent(
  event: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!ENABLED) {
    console.info('[meta-pixel] track (dry-run)', event, params ?? {})
    return
  }
  if (window.fbq) {
    window.fbq('track', event, params)
  }
}

/**
 * Dispara evento PageView. Chamar em mudancas de rota se a app for SPA.
 */
export function trackPageView(): void {
  trackEvent('PageView')
}

/**
 * Dispara evento InitiateCheckout. Chamar quando o lead clica "Comprar"
 * (antes de redirecionar pro Asaas).
 */
export function trackInitiateCheckout(value = 349, currency = 'BRL'): void {
  trackEvent('InitiateCheckout', {
    value,
    currency,
    content_name: 'G Obra - Mensalidade',
  })
}

/**
 * Dispara evento Purchase. Chamar quando confirmar a compra (cliente cai
 * em /cadastro?token=X — significa que pagou).
 */
export function trackPurchase(value = 349, currency = 'BRL'): void {
  trackEvent('Purchase', {
    value,
    currency,
    content_name: 'G Obra - Mensalidade',
  })
}

/**
 * Dispara evento CompleteRegistration. Chamar quando o usuario finaliza
 * o cadastro (criou senha, aceitou termos, entrou no app pela 1a vez).
 */
export function trackCompleteRegistration(): void {
  trackEvent('CompleteRegistration')
}

/**
 * Dispara evento Lead. Chamar quando o lead deixa contato (pop-up de saida,
 * formulario "tirar duvida no WhatsApp").
 */
export function trackLead(): void {
  trackEvent('Lead')
}
