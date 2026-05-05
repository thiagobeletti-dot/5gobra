// Tour guiado de onboarding via react-joyride.
//
// VERSAO 2 (05/05/2026 - tarde): tour reduzido a 3 passos pra evitar
// avancar fora de contexto. Os passos 3-5 antigos falavam de elementos
// que so existem DENTRO de uma obra (5 abas, tecnico, link cliente).
// Como o tour roda na lista de obras, virava ruido.
//
// Solucao: tour curto aqui (boas-vindas + onde clicar + onde encontrar
// ajuda). Conceitos avancados ficam pros videos tutoriais em /app/ajuda.
//
// FUTURO (proxima sessao de dev): criar segundo tour que dispara quando
// usuario entra numa obra pela primeira vez (componente TourObra) com
// os passos sobre as 5 abas, convidar tecnico, link cliente.
//
// O tour pode ser ativado:
//   - automaticamente quando empresa nova entra (banner -> Iniciar tour)
//   - manualmente pelo botao "Refazer tour" na rota /app/ajuda

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
      'Vou te dar um empurrao rapido pra comecar. Sao so 3 cliques. Pode pular se quiser.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nova-obra"]',
    title: 'Cria tua primeira obra',
    content:
      'Tudo comeca aqui. Cada obra que voce toca vira um espaco proprio com cards, fotos e historico. Quando voce abrir a obra, vai ver as 5 fases do fluxo, o convite de tecnico e o link do cliente — explico cada um na hora certa.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: 'body',
    placement: 'center',
    title: 'Precisa de ajuda?',
    content:
      'Se travar em algo, abre o menu "Ajuda" la em cima — tem videos curtos, perguntas frequentes e o botao pra falar comigo direto no WhatsApp. Bora la, clica em "+ Nova obra" pra comecar.',
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
        next: 'Proximo',
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
        tooltipTitle: {
          fontSize: '17px',
          fontWeight: 700,
        },
        tooltipContent: {
          fontSize: '14px',
          lineHeight: 1.5,
        },
        buttonNext: {
          backgroundColor: '#ea580c',
          borderRadius: '8px',
          fontSize: '14px',
          padding: '10px 18px',
        },
        buttonBack: {
          color: '#475569',
          fontSize: '14px',
        },
        buttonSkip: {
          color: '#94a3b8',
          fontSize: '13px',
        },
      }}
    />
  )
}
