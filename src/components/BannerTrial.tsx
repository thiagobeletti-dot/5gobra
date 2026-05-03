// Banner que mostra status do trial / assinatura no topo do app.
// - Trial ativo: barra azul com contagem regressiva
// - Trial nos últimos 3 dias: barra âmbar (alerta visual)
// - Trial expirado: barra vermelha + bloqueio de novas ações
// - Suspenso: barra vermelha
// - Ativo (assinante): não renderiza nada
//
// Botão "Assinar agora" abre WhatsApp por enquanto. Quando Asaas estiver
// configurado, troca pro link de pagamento direto.

const WHATSAPP_LINK =
  'https://wa.me/5511995400050?text=' +
  encodeURIComponent('Olá! Quero assinar o G Obra (R$ 349/mês).')

type AssinaturaStatus = 'trial' | 'ativo' | 'suspenso' | 'cancelado'

interface Props {
  trialTerminaEm: string | null
  assinaturaStatus: AssinaturaStatus
}

export default function BannerTrial({ trialTerminaEm, assinaturaStatus }: Props) {
  // Assinante ativo — sem banner
  if (assinaturaStatus === 'ativo') return null

  const fim = trialTerminaEm ? new Date(trialTerminaEm) : null
  const agora = new Date()
  const ms = fim ? fim.getTime() - agora.getTime() : -1
  const dias = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  const expirado = !fim || ms <= 0

  // Estado bloqueado: trial expirado, suspenso ou cancelado
  if (expirado || assinaturaStatus === 'suspenso' || assinaturaStatus === 'cancelado') {
    const titulo =
      assinaturaStatus === 'suspenso'
        ? 'Sua assinatura foi suspensa.'
        : assinaturaStatus === 'cancelado'
        ? 'Sua assinatura foi cancelada.'
        : 'Seu período de teste acabou.'
    return (
      <div className="bg-red-600 text-white text-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold flex-shrink-0">⚠</span>
            <span className="font-semibold">{titulo}</span>
            <span className="opacity-90 hidden sm:inline">
              Assine pra continuar usando o G Obra sem perder seus dados.
            </span>
          </div>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-red-700 px-4 py-1.5 rounded-md text-xs font-bold hover:bg-red-50 flex-shrink-0"
          >
            Assinar agora
          </a>
        </div>
      </div>
    )
  }

  // Trial ativo: muda cor conforme proximidade do fim
  const cor =
    dias <= 3
      ? 'bg-amber-500 text-white'
      : 'bg-blue-600 text-white'

  return (
    <div className={cor + ' text-sm'}>
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0">⏱</span>
          <span className="font-bold">
            Faltam {dias} {dias === 1 ? 'dia' : 'dias'} do seu período de teste.
          </span>
          <span className="opacity-90 hidden sm:inline">
            Garanta seu acesso por R$ 349/mês.
          </span>
        </div>
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-md text-xs font-bold flex-shrink-0"
        >
          Assinar agora
        </a>
      </div>
    </div>
  )
}

// Helper exportado pra usar em outros lugares (ex: bloquear botões de criação)
export function calcularAcessoLiberado(
  trialTerminaEm: string | null,
  assinaturaStatus: AssinaturaStatus
): boolean {
  if (assinaturaStatus === 'ativo') return true
  if (assinaturaStatus === 'suspenso' || assinaturaStatus === 'cancelado') return false
  if (!trialTerminaEm) return false
  return new Date(trialTerminaEm).getTime() > Date.now()
}
