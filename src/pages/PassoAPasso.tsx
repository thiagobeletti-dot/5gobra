// Passo a passo do G Obra — página de venda de rolagem, sem quiz.
//
// Por que ela existe (decisão do Thiago em 09/09/2026):
//   O /raio-x era quiz-first. Em campo não funcionou: 26 aberturas vindas de
//   DM e de post impulsionado, ~3 chegaram a ver uma tela e ZERO completou o
//   quiz. O único cadastro real veio de quem pulou o quiz pela barra fixa.
//   O argumento que eu usei pra defender o quiz (24,35% de conversão de demo
//   interativa contra 3,05% de leitura) vem de gente que já chegou numa
//   página de produto querendo avaliar — não de tráfego frio de rede social.
//   Aplicar aquele número aqui foi erro meu. O Thiago tinha objetado ao quiz
//   desde o começo.
//
// O formato agora: tudo aberto, nada condicional, nada pra clicar antes de
// ver. A ordem segue a VIDA DA OBRA, não uma lista de recursos — importa o
// orçamento, mede, registra, o cliente acompanha, o prazo conta, o painel
// mostra, a equipe joga pelo placar, o aceite vira dossiê.
//
// A etapa 01 é a importação de propósito: "começar dá trabalho" é a objeção
// que mais trava a decisão, e ela é respondida na primeira tela da página.
//
// O quiz não foi apagado — vive em /raio-x-quiz. Ele é o único instrumento
// que já capturou a SITUAÇÃO de quem entra, e nunca rodou com volume.
//
// Princípios herdados do /raio-x que continuam valendo:
//   1. Nome de concorrente aparece onde é ponte (importação) e nunca onde é
//      comparação (objeção "já tenho sistema").
//   2. A página nunca diz que os bônus são exclusivos de quem compra agora.
//   3. Nada de promessa sem data.

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoHorizontal } from '../lib/logo'
import { trackCustom, trackInitiateCheckout, trackContact, type OrigemWhatsApp } from '../lib/meta-pixel'
import { useProfundidade } from '../hooks/useProfundidade'
import ModalComprar from '../components/ModalComprar'
import {
  TelaAceite,
  TelaCliente,
  TelaCronograma,
  TelaHistorico,
  TelaImportacao,
  TelaMetas,
  TelaPainel,
  TelaTecnico,
} from '../components/TelasRaioX'

const PRECO = 349
const WHATS = '5511933969913'

// A sessão do Supabase é por origem: quem se cadastrasse no raiox.5gobra.com.br
// voltaria ao app aparentando estar deslogado. Por isso o cadastro sai pro
// domínio principal, levando a query junto pra não perder a UTM no caminho.
const DOMINIO_APP = 'https://5gobra.com.br'

function linkTeste(): string {
  const query = typeof window !== 'undefined' ? window.location.search : ''
  const fora = typeof window !== 'undefined' && window.location.hostname.startsWith('raiox.')
  return (fora ? DOMINIO_APP : '') + '/teste-gratis' + query
}

function linkWhats(): string {
  return (
    'https://wa.me/' + WHATS + '?text=' +
    encodeURIComponent('Vim da página do G Obra. Quero entender melhor como funciona.')
  )
}

type Zoom = { titulo: string; tela: ReactNode }
type Pino = { n: number; estilo: React.CSSProperties }

interface Etapa {
  n: number
  titulo: string
  dor: ReactNode
  resolve: ReactNode
  rotulo: string
  tela: ReactNode
  pinos: Pino[]
  itens: { n: number; texto: ReactNode }[]
  larguraMax?: number
}

/* ============================ conteúdo ============================ */

const ETAPAS: Etapa[] = [
  {
    n: 1,
    titulo: 'Você importa o orçamento e a obra vira card',
    dor: <>A obra fechou e alguém vai redigitar peça por peça numa planilha — ou pior, ninguém digita e a lista fica no PDF que só você abre.</>,
    resolve: <>Você joga o PDF do <b>Wvetro</b> ou do <b>CEM</b> lá dentro e, em segundos, cada peça já é um card com medida, vidro e cor. Sem digitar nada.</>,
    rotulo: 'Importação do orçamento',
    tela: <TelaImportacao />,
    pinos: [],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">Você continua orçando onde orça hoje.</b> O G Obra não faz cálculo e não quer fazer — ele pega o que saiu do seu sistema.</> },
      { n: 2, texto: <><b className="text-slate-900">Começar leva minutos, não semanas.</b> É o que mais trava a decisão, e é o que dá menos trabalho.</> },
    ],
  },
  {
    n: 2,
    titulo: 'O técnico mede na obra, pelo celular, com foto',
    dor: <>Você só sabe o que aconteceu na obra quando o funcionário volta — ou quando você liga pra perguntar. Até lá, você decide com a informação de ontem.</>,
    resolve: <>Ele abre um link no celular, segue o mesmo checklist de sempre e registra na hora. O registro é o trabalho dele, não uma tarefa a mais.</>,
    rotulo: 'Link do técnico no celular',
    tela: <TelaTecnico />,
    larguraMax: 230,
    pinos: [
      { n: 1, estilo: { left: 2, top: 78 } },
      { n: 2, estilo: { right: 2, top: 152 } },
      { n: 3, estilo: { left: 2, top: 214 } },
    ],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">O checklist é sempre o mesmo</b>, na mesma ordem. Não importa qual técnico foi — todo mundo mede do mesmo jeito.</> },
      { n: 2, texto: <><b className="text-slate-900">A foto é obrigatória.</b> Sem ela o passo não fecha. É isso que resolve a discussão depois.</> },
      { n: 3, texto: <><b className="text-slate-900">A medida entra na hora</b>, na obra, e já fica no card. Ninguém redigita nada quando volta.</> },
    ],
  },
  {
    n: 3,
    titulo: 'Cada peça guarda o histórico do que aconteceu',
    dor: <>A foto do vão está perdida no meio de 300 mensagens, e quem registrou já não lembra a data. Quando dá problema, é a sua palavra contra a dele.</>,
    resolve: <>Vão não liberado vira fato registrado, com foto, data, hora e autor. E enquanto não é corrigido, a contagem do prazo nem começa.</>,
    rotulo: 'Histórico da peça',
    tela: <TelaHistorico />,
    pinos: [
      { n: 1, estilo: { left: 6, top: 118 } },
      { n: 2, estilo: { right: 10, top: 118 } },
    ],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">Quem registrou e quando</b> fica na linha. Não é "acho que o Carlos avisou" — está escrito.</> },
      { n: 2, texto: <><b className="text-slate-900">O prazo só começa quando o vão está liberado de verdade.</b> Na hora da cobrança, a conta deixa de sobrar pra você.</> },
    ],
  },
  {
    n: 4,
    titulo: 'O cliente acompanha por um link só dele',
    dor: <>Ele liga pra saber como está, você não tem a resposta na mão, e a conversa vira discussão de prazo.</>,
    resolve: <>Ele abre um link no celular — sem app, sem senha — e vê a obra dele peça por peça. Os acordos ficam registrados e aprovados por escrito.</>,
    rotulo: 'O que o seu cliente vê',
    tela: <TelaCliente />,
    pinos: [
      { n: 1, estilo: { left: 6, top: 152 } },
      { n: 2, estilo: { right: 10, top: 152 } },
    ],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">Ele vê só o que é dele.</b> O que é conversa interna da fábrica fica na fábrica — você escolhe o que aparece.</> },
      { n: 2, texto: <><b className="text-slate-900">Acordo é acordo, com valor e aprovação.</b> Da próxima vez que ele jurar que combinou outra coisa, você não discute — você abre.</> },
    ],
  },
  {
    n: 5,
    titulo: 'O prazo conta sozinho, a partir do gatilho certo',
    dor: <>"Está atrasado" é uma sensação. Quando vira número, já é tarde e o cliente ligou primeiro.</>,
    resolve: <>Você define quantos dias cada etapa leva e a partir de que gatilho ela começa. O sistema conta e mostra o estouro antes de ele acontecer.</>,
    rotulo: 'Cronograma por gatilho',
    tela: <TelaCronograma />,
    pinos: [
      { n: 1, estilo: { left: 6, top: 120 } },
      { n: 2, estilo: { right: 10, top: 120 } },
      { n: 3, estilo: { left: 6, top: 176 } },
    ],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">Cada etapa tem o seu gatilho.</b> O prazo da produção não começa quando você vendeu — começa quando a medição foi aprovada.</> },
      { n: 2, texto: <><b className="text-slate-900">O atraso aparece em dias</b>, não em "está atrasado". É com esse número que você decide o que priorizar hoje.</> },
      { n: 3, texto: <><b className="text-slate-900">O que ainda não começou também aparece</b>, com o prazo que vai ter.</> },
    ],
  },
  {
    n: 6,
    titulo: 'Você abre uma tela e vê todas as obras',
    dor: <>A informação existe — só não está num lugar só. Está na planilha, na cabeça do técnico e no WhatsApp de ontem. Toda resposta exige juntar três pedaços.</>,
    resolve: <>De manhã você abre e vê qual obra está parada, qual está atrasada e qual está pronta pra instalar. Sem perguntar pra ninguém.</>,
    rotulo: 'Painel de obras',
    tela: <TelaPainel />,
    pinos: [
      { n: 1, estilo: { left: 8, top: 96 } },
      { n: 2, estilo: { right: 12, top: 96 } },
      { n: 3, estilo: { left: 8, top: 152 } },
    ],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">A faixa colorida é o estado da obra.</b> Vermelho é o que precisa de você hoje — e sobe pro topo sozinho.</> },
      { n: 2, texto: <><b className="text-slate-900">O atraso é contado pelo sistema</b>, a partir do gatilho que você definiu. Ninguém precisa marcar nada.</> },
      { n: 3, texto: <><b className="text-slate-900">A linha embaixo do nome</b> diz em que fase a obra parou e há quanto tempo. É a resposta que hoje você liga pra alguém pra ter.</> },
    ],
  },
  {
    n: 7,
    titulo: 'Produção e instalação viram placar da equipe',
    dor: <>Quanto a fábrica produziu e quanto foi instalado esse mês? A resposta honesta costuma ser "vou levantar" — e ninguém levanta.</>,
    resolve: <>São duas metas, e o sistema mostra as duas: o que saiu da fábrica e o que foi instalado na obra. Atualizadas a cada registro, sem ninguém preencher planilha.</>,
    rotulo: 'Tela de metas',
    tela: <TelaMetas />,
    pinos: [
      { n: 1, estilo: { left: 6, top: 62 } },
      { n: 2, estilo: { left: 6, top: 182 } },
    ],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">Produção é o que saiu da fábrica.</b> A barra é o mês inteiro e sobe a cada registro feito no card.</> },
      { n: 2, texto: <><b className="text-slate-900">Instalação é o que chegou na parede do cliente.</b> São contas diferentes de propósito: produzir 112 e instalar 65 no mesmo mês te diz onde está o gargalo — e não é na fábrica.</> },
      { n: 3, texto: <><b className="text-slate-900">O número é público na equipe.</b> Quem está atrás vê que está atrás, e é isso que muda o ritmo sem você precisar cobrar.</> },
    ],
  },
  {
    n: 8,
    titulo: 'No fim, o aceite vira um dossiê em PDF',
    dor: <>A obra acaba e a prova de que estava tudo certo é uma foto no celular de alguém que já saiu da empresa.</>,
    resolve: <>O cliente dá o aceite dentro do sistema, com data, hora e dispositivo. Tudo que aconteceu na obra vira um documento — o seu respaldo depois.</>,
    rotulo: 'Aceite final e dossiê',
    tela: <TelaAceite />,
    pinos: [],
    itens: [
      { n: 1, texto: <><b className="text-slate-900">O dossiê não é montado no fim às pressas.</b> Ele já existia — é a soma do que foi registrado desde a etapa 01.</> },
    ],
  },
]

const OBJECOES: { id: string; p: string; r: ReactNode }[] = [
  {
    id: 'sistema',
    p: 'Já tenho sistema, custa mudar',
    r: (
      <>
        <p><b className="text-slate-900">Existem muitos sistemas de cálculo, e são bons. Nenhum deles faz o gerenciamento da obra.</b></p>
        <p>O problema não acontece na fase do orçamento. Acontece depois que ela vira obra. Você não troca nada: continua orçando onde orça hoje, e o G Obra importa esse orçamento sem redigitar.</p>
        <p>Comece por uma obra — a mais simples. Em 14 dias você decide.</p>
      </>
    ),
  },
  {
    id: 'calculo',
    p: 'Vocês não fazem o cálculo',
    r: <p>Não fazemos, e é de propósito. <b className="text-slate-900">Cálculo já tem quem faça bem.</b> Gestão da obra depois que ela começa não tem ninguém fazendo — é por isso que o G Obra existe.</p>,
  },
  {
    id: 'link',
    p: 'Meu cliente não vai usar o link',
    r: (
      <>
        <p>E ele precisa usar? <b className="text-slate-900">O link é a sua prova, não a obrigação dele.</b> Se ele nunca abrir, você ainda tem foto, data, histórico e assinatura de quem registrou.</p>
        <p>Quando o cliente interage, fica mais fácil pra ele e vira prova pra você. Se você não quiser essa interação numa obra específica, é só desabilitar a função.</p>
      </>
    ),
  },
  {
    id: 'equipe',
    p: 'Minha equipe não vai usar',
    r: (
      <>
        <p>Quem gerencia é você. <b className="text-slate-900">O técnico entra por um link próprio, no celular, sem senha e sem treinamento</b> — vê só a obra dele e o que tem que fazer. O instalador entra pelo G Instalação e vê o fluxo dele na obra.</p>
        <p>O que a gente separa é outra coisa: o que é conversa interna da empresa e o que o cliente pode ver.</p>
      </>
    ),
  },
  {
    id: 'tempo',
    p: 'Vai demandar muito tempo pra implantar',
    r: (
      <>
        <p>Não precisa migrar nada de uma vez. <b className="text-slate-900">Comece pela obra mais simples</b>, rode ela por 14 dias em paralelo com o que você já faz, e compare.</p>
        <p>Se contratar direto, essa primeira obra a gente sobe junto com você numa call — você não começa sozinho.</p>
      </>
    ),
  },
  {
    id: 'sair',
    p: 'E se eu quiser sair depois',
    r: (
      <>
        <p><b className="text-slate-900">Sem fidelidade e sem multa.</b> Cancela quando quiser, do mesmo jeito que assinou.</p>
        <p>E se contratou e não serviu: em até 14 dias você pede e a gente devolve.</p>
      </>
    ),
  },
]

/* ============================ peças visuais ============================ */

function Rotulo({ children }: { children: ReactNode }) {
  return <span className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400 mb-3">{children}</span>
}

/** Bloco de uma etapa: dor curta, a tela, e a frase do que resolve. */
function BlocoEtapa({ e, aoAmpliar }: { e: Etapa; aoAmpliar: (z: Zoom) => void }) {
  const abrir = () => aoAmpliar({ titulo: e.rotulo, tela: e.tela })
  return (
    <section id={'e' + e.n} data-passo={String(e.n)} className="mt-9 scroll-mt-[76px]">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="font-mono text-[11px] tracking-[.1em] uppercase text-slate-400 flex-none">
          Etapa {String(e.n).padStart(2, '0')}
        </span>
        <span className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="bg-white border border-slate-200 border-l-[3px] border-l-laranja rounded-r-2xl p-[18px] sm:p-5">
        <h2 className="font-display font-bold text-[23px] leading-tight text-slate-900">{e.titulo}</h2>
        <p className="text-[16px] text-slate-500 mt-2.5 leading-snug">
          <b className="text-slate-700 font-semibold">Hoje:</b> {e.dor}
        </p>
        <span className="block font-display font-bold text-[18.5px] leading-snug text-slate-900 mt-3.5">
          {e.resolve}
        </span>

        <figure className="mt-4 mb-0 mx-0">
          <div className="flex items-center justify-between gap-2.5 mb-2">
            <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400">{e.rotulo}</span>
            <button type="button" onClick={abrir} className="text-[12.5px] font-semibold text-laranja-dark">
              ampliar ⤢
            </button>
          </div>
          <div
            className="relative cursor-zoom-in mx-auto"
            style={e.larguraMax ? { maxWidth: e.larguraMax } : undefined}
            onClick={abrir}
          >
            {e.tela}
            {e.pinos.map((p) => (
              <span
                key={p.n}
                style={p.estilo}
                className="absolute w-[22px] h-[22px] rounded-full bg-slate-900 text-white font-mono text-[11px] grid place-items-center shadow-[0_0_0_3px_rgba(255,255,255,.9)] z-10 pointer-events-none"
              >
                {p.n}
              </span>
            ))}
          </div>
          <ol className="list-none mt-3 p-0 grid gap-2.5">
            {e.itens.map((i) => (
              <li key={i.n} className="grid grid-cols-[22px_1fr] gap-2.5 items-start text-[15px] text-slate-600 leading-snug">
                <span className="w-[22px] h-[22px] rounded-full bg-slate-900 text-white font-mono text-[11px] grid place-items-center mt-px">
                  {i.n}
                </span>
                <div>{i.texto}</div>
              </li>
            ))}
          </ol>
        </figure>
      </div>
    </section>
  )
}

/* ============================ página ============================ */

export default function PassoAPasso() {
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const [escala, setEscala] = useState(1.4)
  const [comprar, setComprar] = useState(false)
  const [barra, setBarra] = useState(false)

  // ?quem= rastreia envio individual (DM, link do perfil). 'ref' não serve:
  // já é do programa de afiliados.
  const [origem] = useState<Record<string, string>>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const o: Record<string, string> = {}
      const s = p.get('utm_source'); if (s) o.utm_source = s
      const c = p.get('utm_campaign'); if (c) o.utm_campaign = c
      const q = p.get('quem'); if (q) o.quem = q
      return o
    } catch {
      return {}
    }
  })

  const medida = useProfundidade(origem)

  // Título próprio + noindex: a página é distribuída por link (anúncio, DM,
  // WhatsApp), não pra ser indexada — e o <title> do index.html é o da landing.
  useEffect(() => {
    const anterior = document.title
    document.title = 'G Obra — o que o sistema faz, passo a passo'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.title = anterior
      meta.remove()
    }
  }, [])

  // A barra fixa entra depois da primeira dobra e sai quando o fechamento
  // aparece — dois botões de testar na tela ao mesmo tempo é ruído.
  useEffect(() => {
    const aoRolar = () => {
      const fim = document.getElementById('comecar')
      const perto = fim ? fim.getBoundingClientRect().top < window.innerHeight : false
      setBarra(window.scrollY > 420 && !perto)
    }
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  // Navegação de PÁGINA INTEIRA (sai pro domínio do app, porque a sessão do
  // Supabase é por origem). O browser cancela requisição em voo quando
  // descarta a página, então disparar o evento e deixar navegar perde o
  // registro — foi o que aconteceu com o clicou_trial em 03/09. Aqui o clique
  // é interceptado, o evento vai, e a navegação espera no máximo 400ms.
  async function irPraTeste(ev: MouseEvent<HTMLAnchorElement>, onde: string) {
    ev.preventDefault()
    const destino = linkTeste()
    medida.evento('passo_trial', { onde })
    await new Promise((r) => setTimeout(r, 400))
    window.location.href = destino
  }

  function abrirCheckout(onde: string) {
    medida.evento('passo_assinar', { onde })
    trackInitiateCheckout(PRECO)
    setComprar(true)
  }

  function aoAmpliar(z: Zoom) {
    medida.evento('passo_ampliou', { tela: z.titulo })
    setZoom(z)
  }

  // trackContact só aceita a lista fechada de origens do meta-pixel — mantida
  // igual à do /raio-x de propósito, pra o número no Meta continuar comparável.
  function aoWhats(onde: OrigemWhatsApp) {
    trackContact(onde)
    medida.evento('passo_whatsapp', { onde })
  }

  return (
    <div className="min-h-full bg-[#f4f6fa] text-slate-900">
      <header className="sticky top-0 z-40 bg-[#f4f6fa] border-b border-slate-200">
        <div className="max-w-[620px] mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <LogoHorizontal height={46} />
          <a href="#comecar" className="btn-primary text-[14px] px-3.5 py-2 flex-none">
            Testar 14 dias grátis
          </a>
        </div>
      </header>

      <div className="max-w-[620px] mx-auto px-4 pb-32">
        {/* ---------- abertura: os botões já visíveis, sem nada pra clicar antes ---------- */}
        <section className="pt-8 pb-1">
          <span className="inline-flex items-center gap-2 font-mono text-[11.5px] tracking-[.12em] uppercase text-laranja-dark bg-laranja-soft border border-laranja-border px-2.5 py-1 rounded-full">
            Esquadria de alumínio · da venda ao aceite
          </span>
          <h1 className="font-display font-extrabold text-[clamp(29px,7.4vw,40px)] leading-[1.06] tracking-tight mt-4 text-balance">
            Veja, tela por tela, <span className="text-laranja">o que o G Obra faz</span> na sua fábrica.
          </h1>
          <p className="text-[17.5px] text-slate-600 mt-3">
            Sem cadastro, sem reunião, sem vendedor. É a obra inteira, do orçamento importado
            até o aceite do cliente — do jeito que ela acontece de verdade.
          </p>

          <div className="grid gap-2.5 mt-5">
            <a href={linkTeste()} onClick={(e) => void irPraTeste(e, 'abertura')} className="btn-primary w-full">
              Testar 14 dias grátis — sem cartão
            </a>
            <a href="#comecar" className="btn-ghost w-full">Ver preço e como contratar</a>
          </div>
          <p className="text-[13.5px] text-slate-400 mt-3 text-center">
            Leitura de 3 minutos · role para ver o sistema funcionando
          </p>

          <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-[17px]">
            <Rotulo>o caminho de uma obra dentro do sistema</Rotulo>
            <ol className="list-none m-0 p-0 grid gap-2">
              {ETAPAS.map((e) => (
                <li key={e.n} className="grid grid-cols-[26px_1fr] gap-2.5 items-baseline text-[15.5px] text-slate-600">
                  <b className="font-mono text-[12px] font-medium text-laranja">{String(e.n).padStart(2, '0')}</b>
                  <a href={'#e' + e.n} className="hover:text-laranja-dark">{e.titulo}</a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {ETAPAS.map((e) => (
          <BlocoEtapa key={e.n} e={e} aoAmpliar={aoAmpliar} />
        ))}

        {/* ---------- a conta ---------- */}
        <section data-passo="conta" className="mt-9 bg-slate-900 text-slate-300 rounded-2xl p-5">
          <span className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400 mb-3">a conta que ninguém faz</span>
          <p className="text-[16.5px]">Uma ida à obra só pra rever um vão:</p>
          <div className="font-mono text-[15px] text-white bg-white/[.07] rounded-xl px-3.5 py-3 my-3 leading-loose">
            R$&nbsp;50 &nbsp;funcionário<br />
            R$&nbsp;50 &nbsp;combustível<br />
            <b className="text-laranja">R$&nbsp;100 &nbsp;uma ida</b>
          </div>
          <p className="text-[16.5px]">Sem contar o desperdício de vidro e alumínio, e o retrabalho de fabricação e instalação.</p>
          <p className="text-[16.5px] mt-2.5">Nada disso aparece na sua planilha de custo. Mas tudo saiu do seu bolso.</p>
          <span className="block font-display font-bold text-[21px] text-white leading-snug mt-3.5">
            O G Obra custa <span className="text-laranja">R$ {PRECO} por mês</span>. Menos que uma peça refeita.
          </span>
        </section>

        {/* ---------- fechamento ---------- */}
        <section id="comecar" data-passo="preco" className="mt-9 scroll-mt-[76px]">
          <h2 className="font-display font-extrabold text-[26px] leading-tight">Você viu o que ele faz. Como quer seguir?</h2>

          <div className="border border-slate-200 rounded-2xl bg-white p-[18px] mt-3">
            <h3 className="font-display font-bold text-[19px]">Testar 14 dias grátis</h3>
            <p className="text-[15.5px] text-slate-600 mt-1.5">Sem cartão. Você entra agora e sobe sua primeira obra hoje.</p>
            <a href={linkTeste()} onClick={(e) => void irPraTeste(e, 'fechamento')} className="btn-ghost w-full mt-3.5">
              Criar minha conta de teste
            </a>
          </div>

          <div className="relative border-2 border-laranja rounded-2xl bg-white p-[18px] mt-3 shadow-[0_8px_26px_rgba(255,106,0,.16)]">
            <span className="absolute -top-2.5 left-4 bg-laranja text-white font-mono text-[10px] tracking-[.1em] uppercase px-2.5 py-1 rounded-full">recomendado</span>
            <h3 className="font-display font-bold text-[19px]">Contratar agora</h3>
            <div className="font-display font-extrabold text-[30px] leading-none mt-2.5">
              R$ {PRECO}<small className="text-[15px] font-semibold text-slate-500"> /mês</small>
            </div>
            <p className="text-[15.5px] text-slate-600 mt-1.5">Usuários ilimitados, obras ilimitadas. Sem fidelidade.</p>
            <ul className="list-none my-3.5 p-0 grid gap-2.5">
              {[
                <><b className="text-slate-900">G Instalação vai junto, sem custo</b> — o módulo de instalação, mesmo login, já funcionando</>,
                <><b className="text-slate-900">Implementação com a gente</b> — call de onboarding e a sua primeira obra real subindo junto</>,
                <><b className="text-slate-900">14 dias de garantia</b> — não serviu, você pede e a gente devolve no Pix</>,
              ].map((t, i) => (
                <li key={i} className="grid grid-cols-[18px_1fr] gap-2.5 text-[15.5px] text-slate-600 leading-snug">
                  <span className="text-status-andamento font-bold">✓</span>
                  <div>{t}</div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => abrirCheckout('fechamento')} className="btn-primary w-full">
              Contratar e agendar a implementação
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl bg-white p-[18px] mt-3">
            <h3 className="font-display font-bold text-[19px]">Falar comigo antes de decidir</h3>
            <p className="text-[15.5px] text-slate-600 mt-1.5">Se você prefere tirar dúvida com uma pessoa antes, é só chamar. Sem compromisso.</p>
            <a href={linkWhats()} target="_blank" rel="noopener noreferrer" onClick={() => aoWhats('cta-final')} className="btn-ghost w-full mt-3.5">
              Chamar no WhatsApp
            </a>
          </div>
        </section>

        {/* ---------- objeções ---------- */}
        <section data-passo="objecoes" className="mt-9">
          <h2 className="font-display font-bold text-[23px]">O que costumam me perguntar</h2>
          <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden mt-3.5">
            {OBJECOES.map((o) => (
              <details key={o.id} className="border-b border-slate-200 last:border-b-0 group">
                <summary
                  onClick={() => trackCustom('passo_objecao', { ...origem, qual: o.id })}
                  className="px-4 py-3.5 cursor-pointer font-semibold text-[16px] list-none flex items-center justify-between gap-3 hover:bg-slate-50"
                >
                  {o.p}
                  <span className="font-mono text-laranja text-[19px] leading-none flex-none">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">–</span>
                  </span>
                </summary>
                <div className="px-4 pb-4 text-[16px] text-slate-600 grid gap-2.5">{o.r}</div>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- CTA final ---------- */}
        <section data-passo="fim" className="mt-9">
          <div className="relative border-2 border-laranja rounded-2xl bg-white p-[18px] shadow-[0_8px_26px_rgba(255,106,0,.16)]">
            <span className="absolute -top-2.5 left-4 bg-laranja text-white font-mono text-[10px] tracking-[.1em] uppercase px-2.5 py-1 rounded-full">R$ {PRECO} /mês</span>
            <h3 className="font-display font-bold text-[19px]">Pronto pra começar?</h3>
            <p className="text-[15.5px] text-slate-600 mt-1.5">G Instalação e implementação inclusos. 14 dias de garantia — não serviu, a gente devolve.</p>
            <button type="button" onClick={() => abrirCheckout('fim')} className="btn-primary w-full mt-3.5">Contratar agora</button>
            <a href={linkTeste()} onClick={(e) => void irPraTeste(e, 'fim')} className="btn-ghost w-full mt-2.5">Ou testar 14 dias grátis</a>
            <a href={linkWhats()} target="_blank" rel="noopener noreferrer" onClick={() => aoWhats('rodape')} className="btn-ghost w-full mt-2.5">Falar comigo no WhatsApp</a>
          </div>
        </section>

        <footer className="mt-9 pt-5 border-t border-slate-200 text-slate-500 text-[14.5px]">
          <p><b className="text-slate-700">G Obra</b> — feito dentro de uma fábrica de esquadrias, antes de rodar na sua.</p>
          <p className="mt-2">
            <Link to="/termos" className="text-laranja-dark font-semibold">Termos</Link>
            {' · '}
            <Link to="/privacidade" className="text-laranja-dark font-semibold">Privacidade</Link>
          </p>
        </footer>
      </div>

      {barra && (
        <div className="fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-slate-200 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          <div className="max-w-[620px] mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0 text-[13px] text-slate-500 leading-tight">
              <b className="block text-slate-900 text-[14.5px]">14 dias grátis</b>
              sem cartão, sem compromisso
            </div>
            <a href={linkTeste()} onClick={(e) => void irPraTeste(e, 'barra')} className="btn-primary">Testar</a>
          </div>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[80] bg-slate-900/95 flex flex-col" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 text-slate-200 text-[13.5px]">
            <span>{zoom.titulo}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEscala((e) => Math.max(0.8, e - 0.35))} className="bg-white/10 text-white rounded-lg px-3.5 py-2 font-semibold">−</button>
              <button type="button" onClick={() => setEscala((e) => Math.min(3.2, e + 0.35))} className="bg-white/10 text-white rounded-lg px-3.5 py-2 font-semibold">+</button>
              <button type="button" onClick={() => { setZoom(null); setEscala(1.4) }} className="bg-white/10 text-white rounded-lg px-3.5 py-2 font-semibold">Fechar</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 pb-5">
            <div style={{ transform: 'scale(' + escala + ')', transformOrigin: 'top left', transition: 'transform .2s ease' }}>
              {zoom.tela}
            </div>
          </div>
          <p className="text-center text-slate-400 text-[12px] px-4 pb-3.5">Use + e − para ampliar. Arraste para navegar.</p>
        </div>
      )}

      <ModalComprar aberto={comprar} onFechar={() => setComprar(false)} semCupom origem="passo-a-passo" />
    </div>
  )
}
