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
 * `dispensadoStorageKey` evita reabrir o popup se o user ja viu e fechou
 * (na mesma sessao do navegador). Usar localStorage pra persistir.
 *
 * @returns true quando deve mostrar o popup
 */
export function useExitIntent(opts: {
  timeoutMobileMs?: number
  dispensadoStorageKey?: string
} = {}): boolean {
  const timeoutMs = opts.timeoutMobileMs ?? 45000  // 45s default
  const storageKey = opts.dispensadoStorageKey ?? 'gobra:popup-saida-dispensado'

  const [dispara, setDispara] = useState(false)

  useEffect(() => {
    // Se ja dispensou antes (mesma sessao), nao mostra
    try {
      if (localStorage.getItem(storageKey) === '1') return
    } catch {}

    const eMobile = typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)')?.matches || window.innerWidth < 768)

    // ============ Desktop: mouse leave top ============
    function handleMouseLeave(e: MouseEvent) {
      // clientY < 0 significa que mouse saiu pelo topo da viewport
      if (e.clientY <= 0) {
        setDispara(true)
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
      if (timerId !== null) window.clearTimeout(timerId)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [timeoutMs, storageKey])

  return dispara
}

/** Marca como dispensado pra nao reabrir nessa sessao */
export function marcarPopupDispensado(storageKey = 'gobra:popup-saida-dispensado') {
  try {
    localStorage.setItem(storageKey, '1')
  } catch {}
}
