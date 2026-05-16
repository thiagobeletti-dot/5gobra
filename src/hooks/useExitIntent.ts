import { useEffect, useState } from 'react'

/**
 * Hook que detecta intencao de saida do visitante.
 *
 * Desktop: dispara quando o mouse sai da viewport pelo TOPO (movimento de
 * mira o X do navegador ou a aba).
 *
 * Mobile: nao tem "mouse leave" — dispara apos `timeoutMobileMs` ms na pagina
 * sem ter clicado em nenhum CTA. Fallback razoavel porque mobile nao tem
 * exit-intent confiavel.
 *
 * Importante: aguarda `minTempoMs` antes de habilitar QUALQUER trigger.
 * Sem isso, o desktop disparava no instante em que a pagina carregava —
 * quando o usuario digita URL na barra de enderecos, o cursor esta acima
 * da viewport, e o evento `mouseleave` (com clientY=0) era acionado falso-
 * positivo. 20s de cooldown elimina isso.
 *
 * `dispensadoStorageKey` evita reabrir o popup se o user ja viu e fechou
 * (na mesma sessao do navegador). Usar localStorage pra persistir.
 *
 * @returns true quando deve mostrar o popup
 */
export function useExitIntent(opts: {
  timeoutMobileMs?: number
  dispensadoStorageKey?: string
  minTempoMs?: number
} = {}): boolean {
  const timeoutMs = opts.timeoutMobileMs ?? 90000  // 90s default (era 45s — agressivo demais)
  const storageKey = opts.dispensadoStorageKey ?? 'gobra:popup-saida-dispensado'
  const minTempoMs = opts.minTempoMs ?? 20000  // 20s antes de QUALQUER trigger

  const [dispara, setDispara] = useState(false)

  useEffect(() => {
    // Se ja dispensou antes (mesma sessao), nao mostra
    try {
      if (localStorage.getItem(storageKey) === '1') return
    } catch {}

    const eMobile = typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)')?.matches || window.innerWidth < 768)

    // Flag que controla se ja passou o cooldown inicial
    let podeDisparar = false
    const habilitaTimer = window.setTimeout(() => {
      podeDisparar = true
    }, minTempoMs)

    // ============ Desktop: mouse leave top ============
    function handleMouseLeave(e: MouseEvent) {
      if (!podeDisparar) return  // Ignora se ainda dentro do cooldown
      // clientY < 0 significa que mouse saiu pelo topo da viewport
      if (e.clientY <= 0) {
        setDispara(true)
        // Apos disparar uma vez, para de escutar — evita re-trigger
        document.removeEventListener('mouseleave', handleMouseLeave)
      }
    }

    // ============ Mobile: timer fallback ============
    let timerId: number | null = null

    if (eMobile) {
      timerId = window.setTimeout(() => setDispara(true), timeoutMs)
    } else {
      document.addEventListener('mouseleave', handleMouseLeave)
    }

    return () => {
      window.clearTimeout(habilitaTimer)
      if (timerId !== null) window.clearTimeout(timerId)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [timeoutMs, storageKey, minTempoMs])

  return dispara
}

/** Marca como dispensado pra nao reabrir nessa sessao */
export function marcarPopupDispensado(storageKey = 'gobra:popup-saida-dispensado') {
  try {
    localStorage.setItem(storageKey, '1')
  } catch {}
}
