// Banner do trial no topo do app (só aparece enquanto a empresa NÃO é assinante).
// - Trial ativo: barra azul com contagem regressiva
// - Trial nos últimos 3 dias: barra âmbar
// - Assinante ativo: não renderiza
//
// Trial vencido / suspenso / cancelado NÃO passa por aqui: a RotaProtegida
// troca o app inteiro pela tela <Assinar bloqueado /> (paywall total).
//
// "Assinar agora" leva pra /app/assinar (checkout Asaas direto) — antes abria
// WhatsApp, o que contradizia a estratégia rep-free. Cravado 02/09/2026.

import { Link } from 'react-router-dom'
import type { StatusAssinatura } from '../lib/api'

interface Props {
  trialTerminaEm: string | null
  assinaturaStatus: StatusAssinatura
  diasRestantes?: number | null
}

export default function BannerTrial({ trialTerminaEm, assinaturaStatus, diasRestantes }: Props) {
  if (assinaturaStatus === 'ativo') return null

  // Dias vêm do banco (minha_situacao). Fallback calcula no front.
  let dias = diasRestantes ?? null
  if (dias === null) {
    const fim = trialTerminaEm ? new Date(trialTerminaEm).getTime() : null
    dias = fim ? Math.max(0, Math.ceil((fim - Date.now()) / 86400000)) : 0
  }

  const cor = dias <= 3 ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
  const texto =
    dias <= 0
      ? 'Seu período de teste termina hoje.'
      : `Faltam ${dias} ${dias === 1 ? 'dia' : 'dias'} do seu período de teste.`

  return (
    <div className={cor + ' text-sm'}>
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0">⏱</span>
          <span className="font-bold">{texto}</span>
          <span className="opacity-90 hidden sm:inline">
            Garanta seu acesso por R$ 349/mês, sem fidelidade.
          </span>
        </div>
        <Link
          to="/app/assinar"
          className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-md text-xs font-bold flex-shrink-0"
        >
          Assinar agora
        </Link>
      </div>
    </div>
  )
}

// Helper mantido por compatibilidade. A regra oficial vive no banco
// (empresa_tem_acesso) e chega ao front via pegarSituacao().acesso.
export function calcularAcessoLiberado(
  trialTerminaEm: string | null,
  assinaturaStatus: StatusAssinatura
): boolean {
  if (assinaturaStatus === 'ativo') return true
  if (assinaturaStatus === 'suspenso' || assinaturaStatus === 'cancelado') return false
  if (!trialTerminaEm) return false
  return new Date(trialTerminaEm).getTime() > Date.now()
}
