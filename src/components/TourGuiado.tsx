// Tour guiado de onboarding via react-joyride.
//
// Sequencia de 6 passos definida em sessao de produto (05/05/2026):
//   1. Boas-vindas (centro)
//   2. Botao "+ Nova obra"
//   3. As 5 abas do fluxo (Cliente / Empresa / Tecnica / Em Andamento / Conclusao)
//   4. Botao "Convidar tecnico"
//   5. Botao "Link do cliente"
//   6. Encerramento (centro) — referencia o menu Ajuda do header
//
// O tour pode ser ativado:
//   - automaticamente quando empresa nova entra (banner -> Iniciar tour)
//   - manualmente pelo botao "Refazer tour" na rota /app/ajuda
//
// IMPORTANTE: alguns passos referenciam elementos que so existem na tela
// de Obras (passos 2-5). Se o tour for executado a partir de outra rota,
// joyride redireciona invisivelmente — mas o jeito mais limpo e abrir
// /app/obras antes de iniciar.

import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'

interface Props {
  ativo: boolean
  onTerminado: (dispensado: boolean) => void
}

// Passos do tour. Quando o elemento target nao existe na tela atual
// (caso dos passos 3-5, que mencionam elementos da pagina de uma obra
// especifica), usamos target='body' + placement='center' e o texto
// vira educativo. O tour completo roda na tela de Obras sem precisar
// navegar — quando o cliente criar a primeira obra, ele encontra os
// elementos descritos na pratica.
const passos: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Bem-vindo ao G Obra',
    content:
      'Vou te ajudar a criar tua primeira obra. Leva uns 5 minutos. Pode pular a qualquer momento.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nova-obra"]',
    title: 'Tudo comeca aqui',
    content:
      'Cada obra que voce toca vira um espaco proprio com cards, fotos e historico. Clica nesse botao pra criar a primeira.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: 'body',
    placement: 'center',
    title: 'As 5 fases do fluxo (dentro de cada obra)',
    content:
      'Quando voce abrir uma obra, vai ver 5 abas: Cliente -> Empresa -> Tecnica -> Em Andamento -> Conclusao. Cada item da obra (porta, janela, etc) passa por essas 5 fases. Voce nao precisa mover manualmente — o sistema decide com base nos checklists.',
    disableBeacon: true,
  },
  {
    target: 'body',
    placement: 'center',
    title: 'Quem mede e instala',
    content:
      'Dentro de uma obra voce cadastra tecnicos. Cada um recebe um link unico no celular pra apontar medicao e fotos, sem precisar criar conta nem decorar senha.',
    disableBeacon: true,
  },
  {
    target: 'body',
    placement: 'center',
    title: 'O cliente acompanha tudo',
    content:
      'Cada obra gera um link magico pro cliente final. Ele abre no celular e ve em tempo real em que fase esta cada esquadria — sem login, sem app pra baixar. Esse link voce copia direto na lista de obras.',
    disableBeacon: true,
  },
  {
    target: 'body',
    placement: 'center',
    title: 'Pronto!',
    content:
      'Quando precisar rever o tour, abre o menu Ajuda no topo. La voce tambem encontra videos curtos, perguntas frequentes e o canal direto comigo no WhatsApp. Bora comecar?',
    disableBeacon: true,
  },
]

export default function TourGuiado({ ativo, onTerminado }: Props) {
  function handleCallback(data: CallBackProps) {
    const { status, action } = data
    const finalizados: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
    if (finalizados.includes(status)) {
      // dispensado=true se usuario pulou; false se completou ate o fim
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
        last: 'Comecar',
        next: 'Proximo',
        skip: 'Pular',
      }}
      styles={{
        options: {
          primaryColor: '#ea580c', // laranja-dark do tailwind config
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
