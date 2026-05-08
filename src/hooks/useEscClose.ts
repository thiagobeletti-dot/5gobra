// Hook reutilizavel pra fechar modal com tecla ESC.
//
// Uso:
//   useEscClose(aberto, onFechar)
//
// Quando aberto=true e o usuario aperta ESC, dispara onFechar.
// Quando aberto=false, nao escuta nada (zero overhead).
//
// Integrar em todos os modais — A11y/UX importante (audit Sprint A item #10).

import { useEffect } from 'react'

export function useEscClose(aberto: boolean, onFechar: () => void) {
  useEffect(() => {
    if (!aberto) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [aberto, onFechar])
}
