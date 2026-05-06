// Tour 2 — onboarding dentro da primeira obra criada (rota /app/obra/{id}?tour=1).
//
// 6 passos cobrindo o fluxo end-to-end de uma esquadria:
//   1. Boas-vindas dentro da obra
//   2. Botao de adicionar/importar item
//   3. Aba CLIENTE (aceite inicial)
//   4. Aba TECNICA (visita pra medir o vao)
//   5. Aba EMPRESA + EM ANDAMENTO (caso contra-marco vs producao direta)
//   6. Aba CONCLUSAO (aceite final com peso juridico)
//
// Dispara quando:
//   - URL tem ?tour=1 (vindo do redirect apos criar primeira obra), OU
//   - Usuario clicou em "Refazer tour" no /app/ajuda
//
// Apos terminar (concluir ou pular), marca a flag tour_obra_visto no banco
// pra nao disparar de novo automatico.

import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'

interface Props {
  ativo: boolean
  onTerminado: (dispensado: boolean) => void
}

const passos: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Pronto, sua primeira obra está criada',
    content:
      'Agora deixa eu te mostrar o fluxo de uma esquadria do começo ao fim. São 6 passos rápidos.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="adicionar-item"]',
    title: 'Adicionar itens à obra',
    content:
      'Aqui você adiciona os itens da obra (portas, janelas, vidros). Pode importar direto do Alumisoft ou criar um a um. Cada item vira um card com histórico próprio.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-aba="cliente"]',
    title: 'Aba Cliente — aceite inicial',
    content:
      'Todo item novo cai aqui. O cliente final dá o aceite inicial confirmando que é isso mesmo que vai ser produzido — sigla, tipologia, quantidade.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-aba="tecnica"]',
    title: 'Aba Técnica — visita e medição',
    content:
      'Depois do aceite, o item vai pra Técnica. Aqui acontece a visita pra medir o vão. Quem mede é seu técnico, que recebe um link mágico no celular sem precisar criar conta nem decorar senha.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-aba="empresa"]',
    title: 'Aba Empresa + Em Andamento',
    content:
      'Se o vão precisa de contra-marco, o item vai pra aba Empresa pra você fabricar. Senão, vai direto pra Em Andamento (em produção → entregue → em instalação).',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour-aba="conclusao"]',
    title: 'Aba Conclusão — aceite final',
    content:
      'Quando a instalação termina, o item entra em Conclusão pro cliente dar o aceite final. Esse aceite tem peso jurídico — IP, data/hora e hash do que foi aceito ficam registrados pra sempre.',
    placement: 'bottom',
    disableBeacon: true,
  },
]

export default function TourObra({ ativo, onTerminado }: Props) {
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
