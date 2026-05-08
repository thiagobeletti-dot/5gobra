// Hook que centraliza onboarding status do usuario.
//
// Antes de existir, Obra.tsx e Obras.tsx tinham cada um seu state
// + useEffect pra carregar + chamadas pra marcarOnboardingFlag.
// Audit Sprint C item D4 — DRY.
//
// Uso:
//   const { status, marcar, atualizar } = useOnboarding()
//
//   if (status?.tour_visto) ...
//   await marcar('tour_visto')              // grava no banco + atualiza state
//   atualizar({ ...status!, foo: true })    // override manual (raro)
//
// Detalhes:
//   - Carrega 1 vez no mount; retorna null enquanto carrega
//   - marcar() faz update otimista do state local + persiste no banco
//   - Erros de banco silenciados com console.warn (status nao bloqueia UI)

import { useEffect, useState, useCallback } from 'react'
import {
  pegarOnboardingStatus,
  marcarOnboardingFlag,
  type OnboardingStatus,
} from '../lib/api'

export function useOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)

  useEffect(() => {
    let ativo = true
    pegarOnboardingStatus()
      .then((s) => { if (ativo) setStatus(s) })
      .catch((e) => console.warn('[useOnboarding] pegarOnboardingStatus falhou:', e))
    return () => { ativo = false }
  }, [])

  /** Marca uma flag como true no banco e atualiza o state local imediatamente. */
  const marcar = useCallback(async (flag: keyof OnboardingStatus) => {
    setStatus((s) => s ? { ...s, [flag]: true } : s)
    try {
      await marcarOnboardingFlag(flag)
    } catch (e) {
      console.warn('[useOnboarding] marcarOnboardingFlag(' + String(flag) + ') falhou:', e)
    }
  }, [])

  /** Override manual do status (raro — quando precisa mudar varios campos juntos). */
  const atualizar = useCallback((novo: OnboardingStatus | null) => {
    setStatus(novo)
  }, [])

  return { status, marcar, atualizar }
}
