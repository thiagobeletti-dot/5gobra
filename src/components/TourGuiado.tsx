// Tour 1 — onboarding inicial na lista de obras (rota /app/obras).
//
// 2 passos:
//   1. Boas-vindas
//   2. Highlight no botao "+ Nova obra"
//
// Quando o usuario clica em "+ Nova obra" no banner ou no header,
// preenche e cria a primeira obra, eh redirecionado pra /app/obra/{id}?tour=1
// onde o Tour 2 (TourObra) dispara automaticamente.

import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'

interface Props {
  ativo: boolean
  onTerminado: (dispensado: boolean) => void
}

const passos: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Bem-vindo ao G Obra',
    content:
      'Vou te mostrar como criar tua primeira obra. São só 2 passos rápidos.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nova-obra"]',
    title: 'Cria sua primeira obra',
    content:
      'Tudo começa aqui. Cada obra que você toca vira um espaço próprio com cards, fotos e histórico. Quando você abrir a obra, vou explicar as 5 fases do fluxo, o convite de técnico e o link do cliente.',
    placement: 'bottom',
    disableBeacon: true,
  },
]

export default function TourGuiado({ ativo, onTerminado }: Props) {
  function handleCallback(data: CallBackProps) {
    const { status, action } = data
    const finalizados: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
    if (finalizados.includes(status)) {
      const dispensado = action === 'skip' || status === STATUS.SKIPPED
      onTerminado(dispensado)
    }
  }

  if (!ativo) return null

  return (
    <Joyride
      run={ativo}
      steps={passos}
      continuous
      showProgress
      showSkipButton
      disableScrolling={false}
      callback={handleCallback}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Entendi',
        next: 'Próximo',
        skip: 'Pular',
      }}
      styles={{
        options: {
          primaryColor: '#ea580c',
          textColor: '#0f172a',
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
          overlayColor: 'rgba(15, 23, 42, 0.55)',
          zIndex: 9999,
        },
        tooltipTitle: { fontSize: '17px', fontWeight: 700 },
        tooltipContent: { fontSize: '14px', lineHeight: 1.5 },
        buttonNext: {
          backgroundColor: '#ea580c',
          borderRadius: '8px',
          fontSize: '14px',
          padding: '10px 18px',
        },
        buttonBack: { color: '#475569', fontSize: '14px' },
        buttonSkip: { color: '#94a3b8', fontSize: '13px' },
      }}
    />
  )
}
