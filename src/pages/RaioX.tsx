// Raio-X da gestão — página de venda interativa (subdomínio raiox.5gobra.com.br → rota /raio-x).
//
// Formato cravado com o Thiago em 01–02/09/2026:
//   Quiz-first, SEM diagnóstico final. Cada resposta revela uma função do
//   sistema, demonstrada na hora. O clique é o que converte — na pesquisa,
//   quem interage converte a 24,35% contra 3,05% de quem só lê.
//
// Fluxo:
//   Tela 1 (3 perguntas numa tela) → painel de obras, com a frase montada
//     a partir das respostas dele
//   Tela 2 (bifurca)               → link do cliente + dossiê  |  link do técnico
//   Tela 3 (bifurca)               → cronograma por gatilho    |  metas
//   Tela 4 (2 perguntas)           → amarração + a conta + R$ 349
//   Fechamento                     → 3 saídas, nenhuma delas é "não"
//   Depois: como começar, antes/depois, objeções, CTA repetido
//
// Princípios que NÃO podem ser quebrados numa edição futura:
//   1. O fechamento vem IMEDIATAMENTE depois da última resposta. Nada de
//      leitura entre a última pergunta e a possibilidade de contratar.
//   2. Nome de concorrente aparece onde é ponte (importação do orçamento)
//      e nunca onde é comparação (objeção "já tenho sistema").
//   3. A página nunca diz que os bônus são exclusivos de quem compra agora —
//      quem contratar durante o teste também leva.
//   4. Nada de promessa sem data (o cálculo de custo por funcionário fica
//      fora da página até existir).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { supabase } from '../lib/supabase'
import { trackCustom, trackInitiateCheckout, trackContact } from '../lib/meta-pixel'
import ModalComprar from '../components/ModalComprar'
import {
  TelaAceite,
  TelaCliente,
  TelaCronograma,
  TelaHistorico,
  TelaMetas,
  TelaPainel,
  TelaTecnico,
} from '../components/TelasRaioX'

const PRECO = 349
const WHATS = '5511933969913'

type Chave = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7'
const ORDEM: Chave[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']

interface Opcao {
  v: string          // o texto que entra na frase montada ("30 obras")
  r: string          // o rótulo do botão ("11 a 30")
  extra?: string     // dispara um bloco adicional
}

const P1: Opcao[] = [
  { v: 'até 10 obras', r: 'Até 10' },
  { v: '30 obras', r: '11 a 30' },
  { v: '50 obras', r: '31 a 50' },
  { v: 'mais de 50 obras', r: 'Mais de 50' },
]
const P2: Opcao[] = [
  { v: 'planilha e papel', r: 'Planilha e papel' },
  { v: 'lousa, painel ou mural', r: 'Lousa, painel ou mural' },
  { v: 'WhatsApp', r: 'WhatsApp' },
  { v: 'outro sistema', r: 'Outro sistema', extra: 'sistema' },
]
const P3: Opcao[] = [
  { v: 'na hora, porque está tudo com você', r: 'Na hora — tá tudo comigo', extra: 'cabeca' },
  { v: 'alguns minutos procurando', r: 'Alguns minutos, procurando' },
  { v: 'você tem que ir atrás e retornar depois', r: 'Tenho que ir atrás e retornar depois' },
  { v: 'depende de quem está na fábrica', r: 'Depende de quem está na fábrica' },
]
const P6: Opcao[] = [
  { v: 'nenhuma', r: 'Nenhuma' },
  { v: '1 ou 2', r: '1 ou 2' },
  { v: 'mais de 3', r: 'Mais de 3' },
  { v: 'perdi a conta', r: 'Perdi a conta' },
]
const P7: Opcao[] = [
  { v: 'pouca coisa', r: 'Pouca coisa' },
  { v: 'algumas horas', r: 'Algumas horas' },
  { v: 'metade dos meus dias', r: 'Metade dos meus dias' },
  { v: 'não faz ideia, mas foi muito', r: 'Não faço ideia, mas foi muito' },
]

/* ============================ blocos visuais ============================ */

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11.5px] tracking-[.12em] uppercase text-laranja-dark bg-laranja-soft border border-laranja-border px-2.5 py-1 rounded-full">
      {children}
    </span>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400 mb-3">
      {children}
    </span>
  )
}

/** Pergunta com opções. Destaca-se sozinha quando é a vez dela. */
function Pergunta({
  id,
  titulo,
  apoio,
  opcoes,
  valor,
  aoEscolher,
  vez,
  colunas = 2,
}: {
  id: string
  titulo: string
  apoio?: string
  opcoes: Opcao[]
  valor?: string
  aoEscolher: (o: Opcao) => void
  vez: boolean
  colunas?: 1 | 2
}) {
  const feito = !!valor
  return (
    <div
      id={id}
      className={
        'relative bg-white border rounded-2xl p-5 transition ' +
        (vez
          ? 'border-laranja shadow-[0_0_0_3px_rgba(255,106,0,.12),0_6px_18px_rgba(255,106,0,.10)]'
          : 'border-slate-200 shadow-sm ') +
        (feito && !vez ? ' opacity-75' : '')
      }
    >
      {vez && (
        <span className="absolute -top-2.5 left-4 bg-laranja text-white font-mono text-[10px] tracking-[.1em] uppercase px-2.5 py-1 rounded-full">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1.5 align-[1px] animate-pulse" />
          sua vez
        </span>
      )}
      {feito && (
        <span className="absolute -top-2.5 right-4 bg-status-andamento text-white text-[11px] font-bold w-[22px] h-[22px] rounded-full grid place-items-center px-1.5 py-1 leading-none">
          ✓
        </span>
      )}
      <p className="font-display font-bold text-[19.5px] leading-tight text-slate-900">{titulo}</p>
      {apoio && <p className="text-[14.5px] text-slate-500 mt-1.5">{apoio}</p>}
      <div className={'grid gap-2.5 mt-3.5 ' + (colunas === 2 ? 'sm:grid-cols-2' : '')}>
        {opcoes.map((o) => (
          <button
            key={o.r}
            type="button"
            aria-pressed={valor === o.v}
            onClick={() => aoEscolher(o)}
            className={
              'text-left rounded-xl px-3.5 py-3 text-[15.5px] font-medium leading-snug transition border-[1.5px] ' +
              (valor === o.v
                ? 'border-laranja bg-laranja-soft text-slate-900 shadow-[inset_0_0_0_1px_#ff6a00]'
                : 'border-slate-200 bg-white text-slate-900 hover:border-laranja-border hover:bg-laranja-soft')
            }
          >
            {o.r}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Resposta do sistema: o bloco que aparece depois do clique. */
function Resposta({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 border-l-[3px] border-l-laranja rounded-r-2xl p-[18px] sm:p-5 animate-fade-slide">
      {children}
    </div>
  )
}

function Titulo3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-bold text-[21px] leading-tight text-slate-900 mb-2.5">{children}</h3>
}

function Frase({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-display font-bold text-[19px] leading-snug text-slate-900 mt-3">
      {children}
    </span>
  )
}

/** "E o sistema te ajuda também com..." — o outro lado da bifurcação. */
function Tambem({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3.5">
      <Rotulo>e o sistema te ajuda também com</Rotulo>
      <p className="text-[15.5px] text-slate-600 leading-snug">{children}</p>
    </div>
  )
}

/** Figura com vista explodida: balões numerados na tela + legenda embaixo. */
function Explodida({
  rotulo,
  tela,
  pinos,
  itens,
  aoAmpliar,
}: {
  rotulo: string
  tela: React.ReactNode
  pinos: { n: number; estilo: React.CSSProperties }[]
  itens: { n: number; texto: React.ReactNode }[]
  aoAmpliar: () => void
}) {
  return (
    <figure className="mt-4 mb-0 mx-0">
      <div className="flex items-center justify-between gap-2.5 mb-2">
        <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400">{rotulo}</span>
        <button type="button" onClick={aoAmpliar} className="text-[12.5px] font-semibold text-laranja-dark">
          ampliar ⤢
        </button>
      </div>
      <div className="relative cursor-zoom-in" onClick={aoAmpliar}>
        {tela}
        {pinos.map((p) => (
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
        {itens.map((i) => (
          <li key={i.n} className="grid grid-cols-[22px_1fr] gap-2.5 items-start text-[15px] text-slate-600 leading-snug">
            <span className="w-[22px] h-[22px] rounded-full bg-slate-900 text-white font-mono text-[11px] grid place-items-center mt-px">
              {i.n}
            </span>
            <div>{i.texto}</div>
          </li>
        ))}
      </ol>
    </figure>
  )
}

/** Aviso quando ele pulou uma pergunta: a página não pode ficar muda. */
function Falta({ quantas, aoIr }: { quantas: number; aoIr: () => void }) {
  return (
    <div className="mt-4 bg-laranja-soft border border-laranja-border rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center">
      <p className="text-[15.5px] text-slate-700">
        {quantas === 1
          ? 'Falta responder 1 pergunta pra eu te mostrar a tela.'
          : 'Faltam ' + quantas + ' perguntas pra eu te mostrar a tela.'}
      </p>
      <button type="button" onClick={aoIr} className="btn-primary w-full">
        Ir pra pergunta que falta ↑
      </button>
    </div>
  )
}

/** Botão que leva pra próxima pergunta — ele nunca fica sem saber onde ir. */
function Proxima({ texto, alvo, aoIr }: { texto: string; alvo: string; aoIr: (id: string) => void }) {
  return (
    <div className="mt-4 pt-[18px] border-t border-dashed border-slate-300 flex flex-col items-center gap-2.5">
      <span className="text-[14px] text-slate-500">{texto}</span>
      <button type="button" onClick={() => aoIr(alvo)} className="btn-primary w-full">
        Próxima pergunta ↓
      </button>
    </div>
  )
}

/* ============================ página ============================ */

export default function RaioX() {
  const [resp, setResp] = useState<Partial<Record<Chave, string>>>({})
  const [extras, setExtras] = useState<Record<string, boolean>>({})
  const [ramo2, setRamo2] = useState<'cliente' | 'equipe' | null>(null)
  const [ramo3, setRamo3] = useState<'prazo' | 'metas' | null>(null)
  const [simPasso, setSimPasso] = useState(1)
  const [zoom, setZoom] = useState<{ titulo: string; tela: React.ReactNode } | null>(null)
  const [escala, setEscala] = useState(1.4)
  const [comprar, setComprar] = useState(false)
  const [registroId, setRegistroId] = useState<string | null>(null)
  const gravou = useRef(false)

  const tela1Pronta = !!(resp.q1 && resp.q2 && resp.q3)
  const tela4Pronta = !!(resp.q6 && resp.q7)
  const respondidas = ORDEM.filter((k) => !!resp[k]).length

  // origem do link (?utm_source=direct&quem=vilumi) — 'ref' já é do programa
  // de afiliados, por isso 'quem' pra rastrear envio individual.
  const origem = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return {
        utm_source: p.get('utm_source') ?? undefined,
        utm_campaign: p.get('utm_campaign') ?? undefined,
        quem: p.get('quem') ?? undefined,
      }
    } catch {
      return {}
    }
  }, [])

  useEffect(() => {
    const dados: Record<string, string> = {}
    if (origem.utm_source) dados.utm_source = origem.utm_source
    if (origem.utm_campaign) dados.utm_campaign = origem.utm_campaign
    if (origem.quem) dados.quem = origem.quem
    trackCustom('raiox_abriu', dados)
  }, [origem])

  /** Qual pergunta está esperando resposta agora. */
  const vez: Chave | null = useMemo(() => {
    const visivel = (k: Chave) =>
      k === 'q1' || k === 'q2' || k === 'q3'
        ? true
        : k === 'q4'
          ? tela1Pronta
          : k === 'q5'
            ? !!ramo2
            : !!ramo3
    return ORDEM.find((k) => !resp[k] && visivel(k)) ?? null
  }, [resp, tela1Pronta, ramo2, ramo3])

  function responder(k: Chave, o: Opcao) {
    setResp((r) => ({ ...r, [k]: o.v }))
    if (o.extra) setExtras((e) => ({ ...e, [o.extra as string]: true }))
    trackCustom('raiox_' + k, { resposta: o.v })
  }

  function rolarAte(id: string) {
    window.setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) return
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' })
    }, 90)
  }

  // revela e rola UMA vez por bloco
  const revelado = useRef<Record<string, boolean>>({})
  useEffect(() => {
    if (tela1Pronta && !revelado.current.t1) {
      revelado.current.t1 = true
      trackCustom('raiox_solucao_vista', { bloco: 'painel' })
      rolarAte('rv1')
    }
  }, [tela1Pronta])

  useEffect(() => {
    if (tela4Pronta && !revelado.current.t4) {
      revelado.current.t4 = true
      trackCustom('raiox_viu_preco')
      rolarAte('rv4')
    }
  }, [tela4Pronta])

  // grava o diagnóstico (best-effort — se falhar, a página continua)
  useEffect(() => {
    if (!tela4Pronta || !supabase || gravou.current) return
    gravou.current = true
    void supabase
      .from('diagnosticos')
      .insert({
        respostas: { ...resp, ramo2, ramo3 },
        origem: origem.utm_source ?? 'raio-x',
        utm_campaign: origem.utm_campaign ?? null,
        quem: origem.quem ?? null,
        chegou_ao_fim: true,
        user_agent: navigator.userAgent.slice(0, 300),
      })
      .select('id')
      .single()
      .then(({ data }) => { if (data?.id) setRegistroId(data.id) })
  }, [tela4Pronta, resp, ramo2, ramo3, origem])

  function marcar(campo: 'clicou_trial' | 'clicou_assinar') {
    if (!supabase || !registroId) return
    void supabase.from('diagnosticos').update({ [campo]: true }).eq('id', registroId)
  }

  function abrirCheckout() {
    marcar('clicou_assinar')
    trackInitiateCheckout(PRECO)
    setComprar(true)
  }

  function linkWhats() {
    const dor =
      ramo2 === 'cliente' ? 'discutir prazo com o cliente'
      : ramo2 === 'equipe' ? 'ter que revisar o que a equipe faz'
      : 'gestão das obras'
    return (
      'https://wa.me/' + WHATS + '?text=' +
      encodeURIComponent('Vim do raio-x. Minha maior dor é ' + dor + '. Quero entender melhor o G Obra.')
    )
  }

  const redondo = resp.q6 === 'nenhuma' && resp.q7 === 'pouca coisa'

  return (
    <div className="min-h-full bg-[#f4f6fa] text-slate-900">
      {/* ---------- topo ---------- */}
      <header className="sticky top-0 z-40 bg-[#f4f6fa]/92 backdrop-blur border-b border-slate-200">
        <div className="max-w-[620px] mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <LogoFull height={34} />
          <button type="button" onClick={() => rolarAte(tela4Pronta ? 'fechamento' : 'fim')} className="btn-primary text-[14px] px-3.5 py-2 flex-none">
            Testar 14 dias grátis
          </button>
        </div>
      </header>

      <div className="max-w-[620px] mx-auto px-4 pb-32">
        {/* ---------- abertura ---------- */}
        <section className="pt-8 pb-1">
          <Selo>Raio-X · 2 minutos</Selo>
          <h1 className="font-display font-extrabold text-[clamp(29px,7.4vw,40px)] leading-[1.06] tracking-tight mt-4 text-balance">
            O G Obra foi feito pra ajudar empresas como a sua.
            <br />
            <span className="text-laranja">Responda as perguntas e veja como.</span>
          </h1>
          <p className="text-[17.5px] text-slate-600 mt-3">
            A cada resposta, o sistema aparece resolvendo aquilo. Sem cadastro, sem reunião, sem vendedor.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <span
                className="block h-full bg-laranja rounded-full transition-all duration-300"
                style={{ width: Math.max(12, (respondidas / 7) * 100) + '%' }}
              />
            </div>
            <span className="font-mono text-[11px] tracking-wider uppercase text-slate-400 whitespace-nowrap">
              {respondidas >= 7 ? 'Raio-x completo' : 'Pergunta ' + (respondidas + 1) + ' de 7'}
            </span>
          </div>
        </section>

        {/* ---------- tela 1 ---------- */}
        <section className="mt-7 grid gap-3.5">
          <Pergunta
            id="card-q1"
            titulo="Quantas obras você administra hoje?"
            apoio="Contando as que estão rodando e os contratos fechados esperando."
            opcoes={P1}
            valor={resp.q1}
            vez={vez === 'q1'}
            aoEscolher={(o) => responder('q1', o)}
          />
          <Pergunta
            id="card-q2"
            titulo="Como você controla isso hoje?"
            opcoes={P2}
            valor={resp.q2}
            vez={vez === 'q2'}
            aoEscolher={(o) => responder('q2', o)}
          />
          <Pergunta
            id="card-q3"
            titulo="Quanto tempo você leva pra saber, com certeza, em que fase está uma obra?"
            opcoes={P3}
            valor={resp.q3}
            vez={vez === 'q3'}
            colunas={1}
            aoEscolher={(o) => responder('q3', o)}
          />
        </section>

        {!tela1Pronta && (resp.q1 || resp.q2 || resp.q3) && (
          <Falta
            quantas={3 - [resp.q1, resp.q2, resp.q3].filter(Boolean).length}
            aoIr={() => vez && rolarAte('card-' + vez)}
          />
        )}

        {tela1Pronta && (
          <section id="rv1" className="mt-4">
            <Resposta>
              <Titulo3>
                {resp.q1}, controladas em {resp.q2}.
              </Titulo3>
              <p className="text-slate-500 text-[16.5px]">
                E pra saber em que fase está uma delas, {resp.q3}.
              </p>
              <p className="text-slate-600 text-[16.5px] mt-2.5">
                A informação existe — ela só não está num lugar só. Está na planilha, na cabeça do
                técnico e no WhatsApp de ontem. Cada resposta sua exige juntar três pedaços, e é por
                isso que demora.
              </p>
              <Frase>
                No G Obra ela está numa tela só. Você abre de manhã e vê qual obra está parada, qual
                está atrasada e qual está pronta pra instalar. Sem perguntar pra ninguém.
              </Frase>

              <Explodida
                rotulo="Painel de obras — vista explodida"
                tela={<TelaPainel />}
                aoAmpliar={() => setZoom({ titulo: 'Painel de obras', tela: <TelaPainel /> })}
                pinos={[
                  { n: 1, estilo: { left: 10, top: 96 } },
                  { n: 2, estilo: { right: 14, top: 96 } },
                  { n: 3, estilo: { left: 10, top: 150 } },
                ]}
                itens={[
                  { n: 1, texto: <><b className="text-slate-900">A faixa colorida</b> é o estado da obra. Vermelho é o que precisa de você hoje — e ele sobe pro topo sozinho.</> },
                  { n: 2, texto: <><b className="text-slate-900">O atraso é contado pelo sistema</b>, a partir do gatilho que você definiu. Ninguém precisa marcar nada.</> },
                  { n: 3, texto: <><b className="text-slate-900">A linha embaixo do nome</b> diz em que fase a obra parou e há quanto tempo. É a resposta que hoje você liga pra alguém pra ter.</> },
                ]}
              />
            </Resposta>

            {extras.sistema && (
              <div className="mt-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3.5">
                <Rotulo>e sobre o sistema que você já usa</Rotulo>
                <p className="text-[15.5px] text-slate-600 leading-snug">
                  <b className="text-slate-900">Existem muitos sistemas de cálculo, e são bons.</b>{' '}
                  Nenhum deles faz o gerenciamento da obra. O problema não acontece na fase do
                  orçamento — acontece depois que ela vira obra. Você não troca nada: continua
                  orçando onde orça hoje.
                </p>
              </div>
            )}

            {extras.cabeca && (
              <div className="mt-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3.5">
                <Rotulo>um detalhe do que você respondeu</Rotulo>
                <p className="text-[15.5px] text-slate-600 leading-snug">
                  <b className="text-slate-900">
                    Se está tudo com você, a fábrica anda no seu ritmo — e para quando você para.
                  </b>{' '}
                  Uma semana fora e ninguém consegue tocar as obras no seu lugar. Isso não é
                  organização, é dependência.
                </p>
              </div>
            )}

            <Proxima texto="Falta pouco — mais 4 perguntas." alvo="p4" aoIr={rolarAte} />
          </section>
        )}

        {/* ---------- tela 2 ---------- */}
        {tela1Pronta && (
          <section id="p4" className="mt-7">
            <Pergunta
              id="card-q4"
              titulo="O que mais te desgasta ao longo do tempo?"
              opcoes={[
                { v: 'discutir prazo e status com o cliente', r: 'Discutir prazo e status com o cliente' },
                { v: 'ter que revisar tudo que a equipe já fez', r: 'Ter que revisar tudo que a equipe já fez' },
              ]}
              valor={resp.q4}
              vez={vez === 'q4'}
              colunas={1}
              aoEscolher={(o) => {
                responder('q4', o)
                const lado = o.r.startsWith('Discutir') ? 'cliente' : 'equipe'
                setRamo2(lado)
                trackCustom('raiox_solucao_vista', { bloco: lado })
                rolarAte('rv2')
              }}
            />

            {ramo2 === 'cliente' && (
              <div id="rv2" className="mt-4">
                <Resposta>
                  <Titulo3>O prazo só começa quando o vão está liberado de verdade</Titulo3>
                  <p className="text-slate-600 text-[16.5px]">
                    Seu cliente acha que liberou. Mas quem libera é o responsável da obra — e se o
                    requadro, o contramarco ou a soleira não estão prontos, o vão não está liberado e
                    a contagem não começa. Na hora da cobrança, a conta sobra pra você.
                  </p>
                  <p className="text-slate-900 text-[16.5px] font-semibold mt-2.5">
                    No G Obra isso fica registrado, com foto e data. Vão liberado vira fato, não versão.
                  </p>

                  {/* simulação leve: ele clica e vê acontecer */}
                  <div className="mt-3.5 border border-slate-200 rounded-2xl bg-white overflow-hidden">
                    <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 border-b border-slate-200 bg-slate-50">
                      <span className="text-[13.5px] font-semibold text-slate-600">O que o seu cliente vê</span>
                      <div className="flex gap-1.5">
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={'w-[7px] h-[7px] rounded-full ' + (n === simPasso ? 'bg-laranja' : 'bg-slate-300')} />
                        ))}
                      </div>
                    </div>
                    <div className="p-3.5">
                      {simPasso === 1 && (
                        <>
                          <p className="text-[15.5px] text-slate-600 mb-3">
                            <b className="text-slate-900">1. Ele abre o link no celular</b> — sem baixar app, sem criar senha — e vê a obra dele peça por peça.
                          </p>
                          <TelaCliente />
                        </>
                      )}
                      {simPasso === 2 && (
                        <>
                          <p className="text-[15.5px] text-slate-600 mb-3">
                            <b className="text-slate-900">2. Apareceu problema no vão.</b> O técnico registra com foto, e a bola passa pro cliente — com data e hora.
                          </p>
                          <TelaHistorico />
                        </>
                      )}
                      {simPasso === 3 && (
                        <>
                          <p className="text-[15.5px] text-slate-600 mb-3">
                            <b className="text-slate-900">3. No fim, o aceite é dado dentro do sistema</b> — e tudo isso vira um dossiê em PDF.
                          </p>
                          <TelaAceite />
                        </>
                      )}
                    </div>
                    <div className="px-3.5 pb-3.5 flex gap-2.5">
                      <button type="button" disabled={simPasso === 1} onClick={() => setSimPasso((p) => Math.max(1, p - 1))} className="btn-ghost disabled:opacity-40">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimPasso((p) => (p === 3 ? 1 : p + 1))}
                        className="btn-primary flex-1"
                      >
                        {simPasso === 3 ? 'Ver de novo' : 'Próximo passo'}
                      </button>
                    </div>
                  </div>

                  <Frase>
                    Da próxima vez que ele jurar que combinou outra coisa, você não discute. Você abre.
                  </Frase>
                </Resposta>
                <Tambem>
                  <b className="text-slate-900">O outro lado disso:</b> o técnico entra por um link no
                  celular e registra a medição na hora, com foto. Você não recebe relatório no fim do
                  dia — você vê o movimento aparecendo na sua tela enquanto acontece.
                </Tambem>
                <Proxima texto="Mais 3 perguntas." alvo="p5" aoIr={rolarAte} />
              </div>
            )}

            {ramo2 === 'equipe' && (
              <div id="rv2" className="mt-4">
                <Resposta>
                  <Titulo3>Hoje você só sabe o que aconteceu na obra quando o funcionário volta</Titulo3>
                  <p className="text-slate-600 text-[16.5px]">
                    Ou quando você liga pra perguntar. Até lá, você decide com a informação de ontem.
                  </p>
                  <p className="text-slate-900 text-[16.5px] font-semibold mt-2.5">
                    No G Obra o técnico registra no card, na hora, com foto. E o registro é o trabalho
                    dele, não uma tarefa a mais.
                  </p>
                  <Explodida
                    rotulo="Link do técnico no celular — vista explodida"
                    tela={<TelaTecnico />}
                    aoAmpliar={() => setZoom({ titulo: 'Link do técnico', tela: <TelaTecnico /> })}
                    pinos={[
                      { n: 1, estilo: { left: 6, top: 78 } },
                      { n: 2, estilo: { right: 6, top: 150 } },
                      { n: 3, estilo: { left: 6, top: 212 } },
                    ]}
                    itens={[
                      { n: 1, texto: <><b className="text-slate-900">O checklist é sempre o mesmo</b>, na mesma ordem. Não importa qual técnico foi — todo mundo mede do mesmo jeito.</> },
                      { n: 2, texto: <><b className="text-slate-900">A foto é obrigatória.</b> Sem ela o passo não fecha. É isso que resolve a discussão depois.</> },
                      { n: 3, texto: <><b className="text-slate-900">A medida entra na hora</b>, na obra, e já fica no card. Ninguém redigita nada quando volta.</> },
                    ]}
                  />
                  <Frase>Você não revisa depois. Você acompanha.</Frase>
                </Resposta>
                <Tambem>
                  <b className="text-slate-900">O outro lado disso:</b> cada obra tem um link só dela
                  pro seu cliente. Ele acompanha o estágio de cada peça sem te ligar, os problemas do
                  vão ficam registrados com foto e data, e o aceite final é dado ali dentro — virando
                  um dossiê em PDF.
                </Tambem>
                <Proxima texto="Mais 3 perguntas." alvo="p5" aoIr={rolarAte} />
              </div>
            )}
          </section>
        )}

        {/* ---------- tela 3 ---------- */}
        {ramo2 && (
          <section id="p5" className="mt-7">
            <Pergunta
              id="card-q5"
              titulo="E hoje, o que você não consegue enxergar?"
              opcoes={[
                { v: 'quais obras vão estourar o prazo', r: 'Quais obras vão estourar o prazo' },
                { v: 'quanto a equipe já produziu no mês', r: 'Quanto a equipe já produziu no mês' },
              ]}
              valor={resp.q5}
              vez={vez === 'q5'}
              colunas={1}
              aoEscolher={(o) => {
                responder('q5', o)
                const lado = o.r.startsWith('Quais') ? 'prazo' : 'metas'
                setRamo3(lado)
                trackCustom('raiox_solucao_vista', { bloco: lado })
                rolarAte('rv3')
              }}
            />

            {ramo3 === 'prazo' && (
              <div id="rv3" className="mt-4">
                <Resposta>
                  <Titulo3>O prazo deixa de ser promessa e vira conta</Titulo3>
                  <p className="text-slate-600 text-[16.5px]">
                    Você define quantos dias cada etapa leva, contando a partir do gatilho que
                    importa: a liberação do vão, o contramarco, a medição aprovada.
                  </p>
                  <p className="text-slate-600 text-[16.5px] mt-2.5">
                    Daí o sistema conta sozinho. Cada obra mostra em que fase está e quantos dias
                    faltam — e quando o prazo aperta, aparece na tela{' '}
                    <b className="text-slate-900">antes</b> de apertar de verdade.
                  </p>
                  <Explodida
                    rotulo="Cronograma por gatilho — vista explodida"
                    tela={<TelaCronograma />}
                    aoAmpliar={() => setZoom({ titulo: 'Cronograma', tela: <TelaCronograma /> })}
                    pinos={[
                      { n: 1, estilo: { left: 8, top: 118 } },
                      { n: 2, estilo: { right: 12, top: 118 } },
                      { n: 3, estilo: { left: 8, top: 170 } },
                    ]}
                    itens={[
                      { n: 1, texto: <><b className="text-slate-900">Cada etapa tem o seu gatilho.</b> O prazo da produção não começa quando você vendeu — começa quando a medição foi aprovada.</> },
                      { n: 2, texto: <><b className="text-slate-900">O atraso aparece em dias</b>, não em "está atrasado". É com esse número que você decide o que priorizar hoje.</> },
                      { n: 3, texto: <><b className="text-slate-900">O que ainda não começou também aparece</b>, com o prazo que vai ter. Você enxerga o estouro antes dele acontecer.</> },
                    ]}
                  />
                </Resposta>
                <Tambem>
                  <b className="text-slate-900">O outro lado disso:</b> a tela de metas mostra quanto a
                  equipe já produziu no mês, sempre atualizada. Cada um vê onde está e quanto falta —
                  deixa de ser você cobrando, passa a ser o placar.
                </Tambem>
                <Proxima texto="Últimas 2 perguntas — e são as que mais doem." alvo="p6" aoIr={rolarAte} />
              </div>
            )}

            {ramo3 === 'metas' && (
              <div id="rv3" className="mt-4">
                <Resposta>
                  <Titulo3>Deixa de ser você cobrando. Passa a ser o placar.</Titulo3>
                  <p className="text-slate-600 text-[16.5px]">
                    A meta fica na tela, sempre atualizada. Cada um vê onde está e quanto falta.
                  </p>
                  <p className="text-slate-600 text-[16.5px] mt-2.5">
                    Vira um jogo que a fábrica joga junto: quanto já foi feito no mês, o que falta pra
                    bater, quem está na frente.
                  </p>
                  <Explodida
                    rotulo="Tela de metas — vista explodida"
                    tela={<TelaMetas />}
                    aoAmpliar={() => setZoom({ titulo: 'Metas', tela: <TelaMetas /> })}
                    pinos={[
                      { n: 1, estilo: { left: 8, top: 104 } },
                      { n: 2, estilo: { right: 12, top: 104 } },
                    ]}
                    itens={[
                      { n: 1, texto: <><b className="text-slate-900">A barra é o mês inteiro</b>, atualizada a cada registro feito na obra. Ninguém preenche planilha pra isso existir.</> },
                      { n: 2, texto: <><b className="text-slate-900">O número é público na equipe.</b> Quem está atrás vê que está atrás — e é isso que muda o ritmo sem você precisar cobrar.</> },
                    ]}
                  />
                </Resposta>
                <Tambem>
                  <b className="text-slate-900">O outro lado disso:</b> o cronograma conta o prazo de
                  cada etapa a partir do gatilho certo — a liberação do vão, a medição aprovada — e
                  mostra o atraso em dias, antes do cliente cobrar.
                </Tambem>
                <Proxima texto="Últimas 2 perguntas — e são as que mais doem." alvo="p6" aoIr={rolarAte} />
              </div>
            )}
          </section>
        )}

        {/* ---------- tela 4: o custo ---------- */}
        {ramo3 && (
          <section id="p6" className="mt-7 grid gap-3.5">
            <Pergunta
              id="card-q6"
              titulo="Mês passado, quantas peças você refez — por erro de medida ou por vão que não estava pronto?"
              opcoes={P6}
              valor={resp.q6}
              vez={vez === 'q6'}
              aoEscolher={(o) => responder('q6', o)}
            />
            <Pergunta
              id="card-q7"
              titulo="E quanto tempo você gastou explicando de novo a mesma coisa — pro funcionário, pro cliente, pro técnico?"
              opcoes={P7}
              valor={resp.q7}
              vez={vez === 'q7'}
              aoEscolher={(o) => responder('q7', o)}
            />
          </section>
        )}

        {ramo3 && !tela4Pronta && (resp.q6 || resp.q7) && (
          <Falta quantas={1} aoIr={() => vez && rolarAte('card-' + vez)} />
        )}

        {tela4Pronta && (
          <section id="rv4" className="mt-4">
            {/* amarração: as respostas dele de volta, com as palavras dele */}
            <div className="bg-white border border-slate-200 border-l-[3px] border-l-laranja rounded-r-2xl p-[18px]">
              <Rotulo>o que você me contou</Rotulo>
              <ul className="list-none m-0 p-0 grid gap-2.5">
                {[
                  <>{resp.q1}, controladas em <b className="text-slate-900">{resp.q2}</b></>,
                  <>Pra saber em que fase está uma delas: <b className="text-slate-900">{resp.q3}</b></>,
                  resp.q6 === 'nenhuma'
                    ? <>Mês passado você <b className="text-slate-900">não refez nenhuma peça</b></>
                    : <>Mês passado você refez <b className="text-slate-900">{resp.q6}</b> peças</>,
                  <>Explicando de novo a mesma coisa: <b className="text-slate-900">{resp.q7}</b></>,
                ].map((t, i) => (
                  <li key={i} className="grid grid-cols-[18px_1fr] gap-2.5 text-[16.5px] text-slate-600 leading-snug">
                    <span className="text-laranja font-bold">›</span>
                    <div>{t}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* a conta */}
            {!redondo ? (
              <div className="mt-3.5 bg-slate-900 text-slate-300 rounded-2xl p-5">
                <span className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400 mb-3">
                  a conta que ninguém faz
                </span>
                <p className="text-[16.5px]">Uma ida à obra só pra rever um vão:</p>
                <div className="font-mono text-[15px] text-white bg-white/[.07] rounded-xl px-3.5 py-3 my-3 leading-loose">
                  R$&nbsp;50 &nbsp;funcionário
                  <br />
                  R$&nbsp;50 &nbsp;combustível
                  <br />
                  <b className="text-laranja">R$&nbsp;100 &nbsp;uma ida</b>
                </div>
                <p className="text-[16.5px]">
                  Sem contar o desperdício de vidro e alumínio, e o retrabalho de fabricação e instalação.
                </p>
                <p className="text-[16.5px] mt-2.5">
                  Nada disso aparece na sua planilha de custo. Mas tudo saiu do seu bolso.
                </p>
                <span className="block font-display font-bold text-[21px] text-white leading-snug mt-3.5">
                  O G Obra custa <span className="text-laranja">R$ {PRECO} por mês</span>. Menos que
                  uma peça refeita.
                </span>
              </div>
            ) : (
              <div className="mt-3.5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <span className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400 mb-3">
                  então tá redondo aí
                </span>
                <p className="text-[16.5px] text-slate-600">
                  Se você não refez peça e não perdeu tempo explicando de novo, sua gestão está
                  funcionando. Sério.
                </p>
                <p className="text-[16.5px] text-slate-600 mt-2.5">
                  A pergunta é outra: ela continua funcionando quando você dobrar de obra? O teste é
                  grátis por 14 dias e não pede cartão — dá pra descobrir sem apostar nada.
                </p>
                <span className="block font-display font-bold text-[21px] text-slate-900 leading-snug mt-3.5">
                  R$ {PRECO} por mês. Menos que uma peça refeita.
                </span>
              </div>
            )}
          </section>
        )}

        {/* ---------- fechamento: vem IMEDIATAMENTE depois da última resposta ---------- */}
        {tela4Pronta && (
          <section id="fechamento" className="mt-8">
            <h2 className="font-display font-extrabold text-[26px] leading-tight">
              Você viu o que o G Obra faz. Como quer seguir?
            </h2>

            <div className="border border-slate-200 rounded-2xl bg-white p-[18px] mt-3">
              <h3 className="font-display font-bold text-[19px]">Testar 14 dias grátis</h3>
              <p className="text-[15.5px] text-slate-600 mt-1.5">
                Sem cartão. Você entra agora e sobe sua primeira obra hoje.
              </p>
              <Link to="/teste-gratis" onClick={() => { marcar('clicou_trial'); trackCustom('raiox_clicou_trial') }} className="btn-ghost w-full mt-3.5">
                Criar minha conta de teste
              </Link>
            </div>

            <div className="relative border-2 border-laranja rounded-2xl bg-white p-[18px] mt-3 shadow-[0_8px_26px_rgba(255,106,0,.16)]">
              <span className="absolute -top-2.5 left-4 bg-laranja text-white font-mono text-[10px] tracking-[.1em] uppercase px-2.5 py-1 rounded-full">
                recomendado
              </span>
              <h3 className="font-display font-bold text-[19px]">Contratar agora</h3>
              <div className="font-display font-extrabold text-[30px] leading-none mt-2.5">
                R$ {PRECO}
                <small className="text-[15px] font-semibold text-slate-500"> /mês</small>
              </div>
              <p className="text-[15.5px] text-slate-600 mt-1.5">
                Usuários ilimitados, obras ilimitadas. Sem fidelidade.
              </p>
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
              <button type="button" onClick={abrirCheckout} className="btn-primary w-full">
                Contratar e agendar a implementação
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-[18px] mt-3">
              <h3 className="font-display font-bold text-[19px]">Falar comigo antes de decidir</h3>
              <p className="text-[15.5px] text-slate-600 mt-1.5">
                Se você prefere tirar dúvida com uma pessoa antes, é só chamar. Sem compromisso.
              </p>
              <a
                href={linkWhats()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { trackContact('cta-final'); trackCustom('raiox_whatsapp') }}
                className="btn-ghost w-full mt-3.5"
              >
                Chamar no WhatsApp
              </a>
            </div>
          </section>
        )}

        {/* ---------- reasseguro, prova e objeções (abaixo do fechamento) ---------- */}
        {tela4Pronta && (
          <>
            <section id="reasseguro" className="mt-9">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="font-display font-bold text-[21px]">Começar não dá trabalho</h2>
                <p className="text-[16.5px] text-slate-600 mt-2">
                  Você importa o PDF do orçamento do <b className="text-slate-900">Wvetro</b> ou do{' '}
                  <b className="text-slate-900">CEM</b> e, em segundos, a obra inteira vira card —
                  peça por peça, com medida, vidro e cor. Sem digitar nada.
                </p>
                <p className="text-[16.5px] text-slate-600 mt-2">
                  O resto do sistema é assim também: quem abre pela primeira vez consegue navegar sem manual.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-3.5">
                <div className="rounded-2xl p-4 border border-slate-200 bg-slate-100">
                  <h4 className="font-mono text-[10.5px] tracking-[.12em] uppercase text-slate-400 font-medium m-0 mb-2.5">
                    Como é hoje aí
                  </h4>
                  <ul className="list-none m-0 p-0 grid gap-2">
                    {[
                      <>Tudo controlado em <b className="text-slate-900">{resp.q2}</b></>,
                      <>Pra ter certeza da fase de uma obra: {resp.q3}</>,
                      <>Foto perdida no meio de 300 mensagens</>,
                      <>O que aconteceu na obra você só sabe depois</>,
                    ].map((t, i) => (
                      <li key={i} className="grid grid-cols-[16px_1fr] gap-2 text-[14.5px] text-slate-600 leading-snug">
                        <span className="text-slate-400">—</span>
                        <div>{t}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl p-4 border border-laranja-border bg-laranja-soft">
                  <h4 className="font-mono text-[10.5px] tracking-[.12em] uppercase text-laranja-dark font-medium m-0 mb-2.5">
                    Como fica
                  </h4>
                  <ul className="list-none m-0 p-0 grid gap-2">
                    {[
                      'Uma tela com todas as obras, ordenadas por criticidade',
                      'Cada peça com histórico, foto, data e autor',
                      'Cliente e técnico registrando direto na obra',
                      'Dossiê em PDF no fim, com peso de prova',
                    ].map((t) => (
                      <li key={t} className="grid grid-cols-[16px_1fr] gap-2 text-[14.5px] text-slate-600 leading-snug">
                        <span className="text-status-andamento">✓</span>
                        <div>{t}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="mt-9">
              <h2 className="font-display font-bold text-[23px]">O que costumam me perguntar</h2>
              <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden mt-3.5">
                {OBJECOES.map((o) => (
                  <details key={o.p} className="border-b border-slate-200 last:border-b-0 group">
                    <summary
                      onClick={() => trackCustom('raiox_objecao', { qual: o.id })}
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

            {/* CTA repetido no fim */}
            <section id="fim" className="mt-9">
              <div className="relative border-2 border-laranja rounded-2xl bg-white p-[18px] shadow-[0_8px_26px_rgba(255,106,0,.16)]">
                <span className="absolute -top-2.5 left-4 bg-laranja text-white font-mono text-[10px] tracking-[.1em] uppercase px-2.5 py-1 rounded-full">
                  R$ {PRECO} /mês
                </span>
                <h3 className="font-display font-bold text-[19px]">Pronto pra começar?</h3>
                <p className="text-[15.5px] text-slate-600 mt-1.5">
                  G Instalação e implementação inclusos. 14 dias de garantia — não serviu, a gente devolve.
                </p>
                <button type="button" onClick={abrirCheckout} className="btn-primary w-full mt-3.5">
                  Contratar agora
                </button>
                <Link to="/teste-gratis" onClick={() => { marcar('clicou_trial'); trackCustom('raiox_clicou_trial') }} className="btn-ghost w-full mt-2.5">
                  Ou testar 14 dias grátis
                </Link>
                <a href={linkWhats()} target="_blank" rel="noopener noreferrer" onClick={() => trackContact('rodape')} className="btn-ghost w-full mt-2.5">
                  Falar comigo no WhatsApp
                </a>
              </div>
            </section>
          </>
        )}

        <footer className="mt-9 pt-5 border-t border-slate-200 text-slate-500 text-[14.5px]">
          <p>
            <b className="text-slate-700">G Obra</b> — feito dentro de uma fábrica de esquadrias,
            antes de rodar na sua.
          </p>
          <p className="mt-2">
            <Link to="/termos" className="text-laranja-dark font-semibold">Termos</Link>
            {' · '}
            <Link to="/privacidade" className="text-laranja-dark font-semibold">Privacidade</Link>
          </p>
        </footer>
      </div>

      {/* ---------- barra fixa ---------- */}
      {!tela4Pronta && (
        <div className="fixed left-0 right-0 bottom-0 z-50 bg-white/96 backdrop-blur border-t border-slate-200 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          <div className="max-w-[620px] mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0 text-[13px] text-slate-500 leading-tight">
              <b className="block text-slate-900 text-[14.5px]">14 dias grátis</b>
              sem cartão, sem compromisso
            </div>
            <Link to="/teste-gratis" onClick={() => trackCustom('raiox_clicou_trial', { onde: 'barra' })} className="btn-primary">
              Testar
            </Link>
          </div>
        </div>
      )}

      {/* ---------- zoom da tela ---------- */}
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
          <p className="text-center text-slate-400 text-[12px] px-4 pb-3.5">
            Use + e − para ampliar. Arraste para navegar.
          </p>
        </div>
      )}

      <ModalComprar aberto={comprar} onFechar={() => setComprar(false)} />
    </div>
  )
}

/* ============================ objeções ============================ */

const OBJECOES: { id: string; p: string; r: React.ReactNode }[] = [
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
    id: 'equipe',
    p: 'Minha equipe não vai usar',
    r: (
      <>
        <p>Quem gerencia é você. <b className="text-slate-900">O técnico entra por um link próprio, no celular, sem senha e sem treinamento</b> — vê só a obra dele e o que tem que fazer. O instalador entra pelo G Instalação e vê o fluxo dele na obra.</p>
        <p>O que a gente separa é outra coisa: o que é conversa interna da empresa e o que o cliente pode ver. Porque tem informação de peça que a fabricação, a instalação e você precisam saber — e é isso que faz sair como foi combinado.</p>
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
]
