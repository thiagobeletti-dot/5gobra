import type { Card } from '../types/obra'

export function agora(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formataData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Formata timestamp ISO completo (yyyy-mm-ddTHH:MM:SS.SSS+TZ) pra "DD/MM/YYYY HH:MM" pt-BR
export function formataDataHora(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '—'
  try {
    const d = new Date(isoTimestamp)
    if (isNaN(d.getTime())) return isoTimestamp
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return isoTimestamp
  }
}

export function diasAte(isoData: string | null): number | null {
  if (!isoData) return null
  const alvo = new Date(isoData + 'T23:59:59')
  return Math.floor((alvo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export type StatusSemantico = 'aguarda' | 'andamento' | 'instalado' | 'concluido' | 'erro'

export function statusSemantico(card: Card): StatusSemantico {
  if (card.aba === 'conclusao' && card.aceiteFinal) return 'concluido'
  if (card.aba === 'emandamento') {
    if (card.statusEmAndamento === 'Concluído' || card.statusEmAndamento === 'Concluido') return 'concluido'
    if (
      card.statusEmAndamento === 'Em Instalação' ||
      card.statusEmAndamento === 'Instalando' ||
      card.statusEmAndamento === 'Entregue' ||
      card.statusEmAndamento === 'Entregue em obra'
    ) return 'instalado'
    return 'andamento'
  }
  return 'aguarda'
}
