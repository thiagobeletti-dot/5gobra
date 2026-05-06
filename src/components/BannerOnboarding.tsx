// Banner de onboarding na tela de Obras.
//
// Aparece quando a empresa ainda nao criou nenhuma obra (estado inicial).
// Dois CTAs:
//   - "Iniciar tour" (principal) — dispara o tour guiado (TourGuiado, 2 passos)
//   - "Criar primeira obra" (secundario) — abre o modal Nova Obra direto, pula o tour
//
// Banner some quando:
//   - empresa cria a primeira obra (onboarding_status.primeira_obra_criada=true), ou
//   - usuario clica "Fechar" (onboarding_status.tour_dispensado=true).

interface Props {
  onIniciarTour: () => void
  onCriarObra: () => void
  onDispensar: () => void
}

export default function BannerOnboarding({ onIniciarTour, onCriarObra, onDispensar }: Props) {
  return (
    <div className="bg-gradient-to-r from-laranja to-laranja-dark text-white rounded-xl p-5 mb-6 shadow-md">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-lg leading-tight mb-1">
            Bem-vindo ao G Obra
          </h3>
          <p className="text-sm opacity-95">
            Faça um tour rápido pra conhecer o sistema, ou crie sua primeira obra direto. Cada obra vira um espaço próprio com cards, fotos, histórico e link mágico pro cliente.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={onIniciarTour}
            className="bg-white text-laranja-dark font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            Iniciar tour
          </button>
          <button
            onClick={onCriarObra}
            className="text-white/90 hover:text-white text-sm px-3 py-2 underline transition"
          >
            Pular e criar obra
          </button>
          <button
            onClick={onDispensar}
            className="text-white/70 hover:text-white text-sm px-2 py-2 transition"
            title="Não mostrar mais"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
