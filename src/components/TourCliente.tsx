// Tour do PORTAL DO CLIENTE — onboarding pro cliente final que abre o link mágico
// pela primeira vez e fica perdido ("onde eu clico?").
//
// Passos (4–5, curtos):
//   1. Boas-vindas
//   2. Confirmar os itens (dá início à fabricação)
//   3. Atalho "Confirmar todos" (só aparece se houver 2+ itens pendentes)
//   4. As abas (acompanhar cada etapa)
//   5. Aba Conclusão (aceite final com data/hora)
//
// Dispara automático na primeira visita (flag no localStorage do navegador, já que
// o cliente é anônimo via token) ou pelo botão "Como funciona". Espelha o TourObra.

import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'

interface Props {
  ativo: boolean
  /** Inclui o passo do atalho "Confirmar todos" (só faz sentido com 2+ pendentes). */
  mostrarAtalho: boolean
  onTerminado: () => void
}

function construirPassos(mostrarAtalho: boolean): Step[] {
  const passos: Step[] = [
    {
      target: 'body',
      placement: 'center',
      disableBeacon: true,
      title: 'Bem-vindo(a) ao acompanhamento da sua obra',
      content:
        'Aqui você acompanha tudo em tempo real, do começo ao fim. Deixa eu te mostrar em passos rápidos como usar.',
    },
    {
      target: '[data-tour-cliente="itens"]',
      placement: 'top',
      disableBeacon: true,
      title: 'Confirme os itens da sua obra',
      content:
        'Estes são os itens que serão fabricados e instalados. Toque em cada um pra revisar e tocar em Confirmar — é isso que dá início à fabricação.',
    },
  ]
  if (mostrarAtalho) {
    passos.push({
      target: '[data-tour-cliente="atalho"]',
      placement: 'bottom',
      disableBeacon: true,
      title: 'Confirme todos de uma vez',
      content: 'Com pressa? Este atalho confirma todos os itens pendentes num clique só.',
    })
  }
  passos.push(
    {
      target: '[data-tour-cliente="abas"]',
      placement: 'bottom',
      disableBeacon: true,
      title: 'Acompanhe cada etapa',
      content:
        'Conforme a obra anda, seus itens caminham por estas etapas. Você acompanha tudo por aqui, sem precisar ligar pra ninguém.',
    },
    {
      target: '[data-tour-cliente-aba="conclusao"]',
      placement: 'bottom',
      disableBeacon: true,
      title: 'Aceite final',
      content:
        'No fim, cada peça instalada entra em Conclusão pra você dar o aceite final — sua garantia registrada com data e hora.',
    },
  )
  return passos
}

export default function TourCliente({ ativo, mostrarAtalho, onTerminado }: Props) {
  function handleCallback(data: CallBackProps) {
    const { status } = data
    const finalizados: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
    if (finalizados.includes(status)) onTerminado()
  }

  if (!ativo) return null

  return (
    <Joyride
      run={ativo}
      steps={construirPassos(mostrarAtalho)}
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
