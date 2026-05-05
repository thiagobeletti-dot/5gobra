// Banner de onboarding na tela de Obras.
//
// Aparece quando a empresa ainda nao criou nenhuma obra (estado inicial).
// CTA principal: "Iniciar tour" — dispara o react-joyride.
// Botao secundario: "Fechar" — marca tour_dispensado=true (nao volta a aparecer).
//
// Banner some quando:
//   - empresa cria a primeira obra (onboarding_status.primeira_obra_criada=true), ou
//   - usuario clica "Fechar" (onboarding_status.tour_dispensado=true).
//
// Eh leve por design — uma faixa com texto curto e dois botoes.

interface Props {
  onIniciarTour: () => void
  onDispensar: () => void
}

export default function BannerOnboarding({ onIniciarTour, onDispensar }: Props) {
  return (
    <div className="bg-gradient-to-r from-laranja to-laranja-dark text-white rounded-xl p-5 mb-6 shadow-md">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-lg leading-tight mb-1">
            Vamos criar sua primeira obra juntos?
          </h3>
          <p className="text-sm opacity-95">
            Em 5 minutos te mostro como tudo funciona — cadastro de obras,
            convite do tecnico, link do cliente e a tela do historico.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onIniciarTour}
            className="bg-white text-laranja-dark font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            Iniciar tour
          </button>
          <button
            onClick={onDispensar}
            className="text-white/80 hover:text-white text-sm px-3 py-2 transition"
            title="Nao mostrar mais"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
