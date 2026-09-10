// Mede até onde a pessoa leu uma página de rolagem longa.
//
// Existe porque o quiz do /raio-x era o único instrumento que dizia ALGUMA
// coisa sobre quem entrava — e ele foi removido em 09/09/2026 (as pessoas
// não clicavam nas respostas: 26 aberturas, 0 quizzes completos). Sem ele a
// página nova converteria ou não converteria sem a gente entender por quê.
//
// O evento que importa é o de saída: um por visita, carregando a etapa mais
// funda que a pessoa alcançou e quantos segundos ficou. Os eventos por etapa
// servem pra montar o funil no Gerenciador de Eventos.
//
// Nota honesta pro futuro: com pouco tráfego isso é anedota, não dado. O
// instrumento só começa a dizer algo perto de 200 visitas. E o Pixel é
// bloqueado por bloqueador de anúncio e por iOS, então SEMPRE conta menos
// gente do que realmente entrou — divergir do número de cadastros do
// Supabase é o esperado, não bug.

import { useEffect, useRef } from 'react'
import { trackCustom } from '../lib/meta-pixel'

/** Tempo que um bloco precisa ficar na tela pra contar como "leu". Passar
    batido rolando rápido não pode virar número. */
const PERMANENCIA_MS = 700

/** Fração do bloco visível pra começar a contar a permanência. */
const VISIVEL = 0.35

export interface Profundidade {
  /** Etapa mais funda alcançada até agora (0 = nenhuma). */
  etapa: () => number
  /** Dispara um evento avulso da página já com origem e etapa atual juntas. */
  evento: (nome: string, extra?: Record<string, string | number>) => void
}

/**
 * Observa todo elemento com `data-passo` dentro da página.
 *   data-passo="3"      → etapa numerada (vira passo_e3 e entra na profundidade)
 *   data-passo="preco"  → marco nomeado (vira passo_preco)
 */
export function useProfundidade(origem: Record<string, string>): Profundidade {
  const maxRef = useRef(0)
  const segRef = useRef(0)
  const jaFoi = useRef<Record<string, boolean>>({})
  const enviadoAte = useRef(-1)

  // origem num ref pra não recriar os observers quando o objeto muda de
  // identidade entre renders.
  const origemRef = useRef(origem)
  origemRef.current = origem

  const disparar = (nome: string, extra?: Record<string, string | number>) => {
    trackCustom(nome, { ...origemRef.current, ...(extra ?? {}) })
  }

  const umaVez = (nome: string, extra?: Record<string, string | number>) => {
    if (jaFoi.current[nome]) return
    jaFoi.current[nome] = true
    disparar(nome, extra)
  }

  useEffect(() => {
    disparar('passo_abriu')

    const pendentes = new Map<Element, number>()
    const obs = new IntersectionObserver(
      (linhas) => {
        for (const l of linhas) {
          const el = l.target
          if (l.isIntersecting) {
            if (pendentes.has(el)) continue
            pendentes.set(
              el,
              window.setTimeout(() => {
                pendentes.delete(el)
                const marca = el.getAttribute('data-passo') ?? ''
                const n = Number(marca)
                if (Number.isFinite(n) && n > 0) {
                  maxRef.current = Math.max(maxRef.current, n)
                  umaVez('passo_e' + n)
                } else if (marca) {
                  umaVez('passo_' + marca)
                }
              }, PERMANENCIA_MS),
            )
          } else {
            const t = pendentes.get(el)
            if (t !== undefined) window.clearTimeout(t)
            pendentes.delete(el)
          }
        }
      },
      { threshold: VISIVEL },
    )

    document.querySelectorAll('[data-passo]').forEach((el) => obs.observe(el))

    // Leu de verdade ou passou o olho? Só conta com a aba na frente.
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      segRef.current += 5
      if (segRef.current >= 90) umaVez('passo_leu_90s')
    }, 5000)

    // Resumo da visita. Reenvia só se ela voltou e leu MAIS fundo — quem sai
    // na etapa 1, volta e lê tudo não pode ficar registrado como etapa 1.
    const saiu = () => {
      if (maxRef.current <= enviadoAte.current) return
      enviadoAte.current = maxRef.current
      disparar('passo_saiu', { etapa: maxRef.current, segundos: segRef.current })
    }
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden') saiu()
    }
    window.addEventListener('pagehide', saiu)
    document.addEventListener('visibilitychange', aoEsconder)

    return () => {
      obs.disconnect()
      pendentes.forEach((t) => window.clearTimeout(t))
      window.clearInterval(relogio)
      window.removeEventListener('pagehide', saiu)
      document.removeEventListener('visibilitychange', aoEsconder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    etapa: () => maxRef.current,
    evento: (nome, extra) => disparar(nome, { etapa: maxRef.current, ...(extra ?? {}) }),
  }
}
