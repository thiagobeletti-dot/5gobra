// Meta Pixel (Facebook/Instagram Ads) — v2, 03/08/2026
//
// MUDANCAS DESTA VERSAO (auditoria do funil de 03/08/2026):
//
//   1. ISOLAMENTO DE ROTA. O pixel so carrega em rotas de MARKETING (`/`,
//      `/cadastro`, `/termos`, `/privacidade`). Antes ele carregava no app
//      inteiro: cada tela que um cliente logado abria, e cada acesso de
//      cliente final a `/obra/:token`, virava um "PageView" no Gerenciador
//      de Eventos. Resultado: 4.600 PageViews no mes, dos quais so ~114
//      eram visitantes reais da landing. O painel mentia sobre o volume.
//
//   2. EVENT_ID EM TUDO. Todo evento de conversao carrega um `event_id`
//      unico, espelhado no CAPI server-side. Sem isso o Meta nao consegue
//      deduplicar browser x servidor.
//
//   3. ESPELHO CAPI. Eventos de conversao (nao PageView) sao enviados
//      tambem pela Edge Function `meta-capi`, com email/telefone hasheados
//      em SHA-256 no SERVIDOR. Isso eleva o Event Match Quality — estava
//      travado em 6,1/10, que e' o que deixa o algoritmo otimizando no
//      escuro.
//
//   4. EVENTOS QUE FALTAVAM. `Contact` (clique de WhatsApp, o canal
//      principal, que nao era medido) e `Schedule` (agendamento efetivado).
//
// Config: VITE_META_PIXEL_ID no Vercel. Sem ele, tudo vira console.info.

/* eslint-disable @typescript-eslint/no-explicit-any */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const CONFIGURADO = typeof window !== 'undefined' && !!PIXEL_ID

/** Vira true so depois que o pixel realmente carregou (rota permitida + ID). */
let ativo = false

declare global {
  interface Window {
    // `any` proposital — o snippet oficial do Meta usa funcao com propriedades
    // dinamicas (callMethod, queue, loaded, version, push).
    fbq?: any
    _fbq?: any
  }
}

// ============================================================================
// Isolamento de rota
// ============================================================================

/**
 * Prefixos onde o pixel NAO deve existir.
 *
 *   /app/*            — o produto. Cliente pagante usando o sistema nao e'
 *                       trafego de marketing.
 *   /obra/:token      — pagina publica que o cliente final da obra abre.
 *                       Era a maior fonte de PageView fantasma: cada obra
 *                       acompanhada por um cliente do Anderson gerava dezenas.
 *   /tec/:token       — pagina do tecnico em campo.
 *   /login, /recuperar-senha, /redefinir-senha — area de acesso.
 *
 * O que SOBRA (e onde o pixel roda): `/`, `/cadastro`, `/termos`,
 * `/privacidade`. Ou seja: landing + funil de compra.
 */
const PREFIXOS_SEM_PIXEL = [
  '/app',
  '/obra/',
  '/tec/',
  '/login',
  '/recuperar-senha',
  '/redefinir-senha',
]

export function ehRotaDeMarketing(pathname?: string): boolean {
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  return !PREFIXOS_SEM_PIXEL.some((prefixo) => p === prefixo || p.startsWith(prefixo))
}

// ============================================================================
// event_id (deduplicacao browser <-> servidor)
// ============================================================================

/**
 * Gera um id unico por evento. O MESMO id vai no pixel (client) e no CAPI
 * (server) — e' assim que o Meta entende que sao o mesmo acontecimento e
 * conta uma vez so.
 *
 * `crypto.randomUUID` nao existe em contexto inseguro / browser antigo, dai
 * o fallback.
 */
export function novoEventId(prefixo: string): string {
  let aleatorio: string
  try {
    aleatorio = crypto.randomUUID()
  } catch {
    aleatorio = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
  return `${prefixo}_${aleatorio}`
}

// ============================================================================
// Espelho server-side (Edge Function meta-capi)
// ============================================================================

/** Dados pessoais crus. Sao hasheados NO SERVIDOR, nunca aqui. */
export type DadosPessoa = {
  email?: string
  telefone?: string
  nome?: string
  cpfCnpj?: string
}

/**
 * Manda o evento tambem pelo servidor. Best-effort: falha de rede nunca
 * pode quebrar a navegacao nem segurar um redirect de checkout, por isso
 * o `keepalive` e o `.catch` silencioso.
 */
function enviarCapi(
  evento: string,
  opts: {
    eventId: string
    pessoa?: DadosPessoa
    custom?: Record<string, string | number | boolean>
  },
): void {
  if (!CONFIGURADO || !SUPABASE_URL || !SUPABASE_ANON) return

  try {
    fetch(`${SUPABASE_URL}/functions/v1/meta-capi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({
        evento,
        event_id: opts.eventId,
        url: window.location.href,
        fbp: lerCookie('_fbp') ?? null,
        fbc: lerCookie('_fbc') ?? lerFbclidComoFbc(),
        pessoa: opts.pessoa ?? null,
        custom: opts.custom ?? null,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // nunca propaga
  }
}

function lerCookie(nome: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const esc = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = document.cookie.match(new RegExp('(?:^|; )' + esc + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : undefined
}

/**
 * Se o visitante acabou de chegar por um anuncio, o `_fbc` pode ainda nao
 * ter sido gravado pelo pixel. Nesse caso montamos o valor a partir do
 * `fbclid` da URL, no formato que o Meta espera: fb.1.<timestamp>.<fbclid>.
 * Isso recupera atribuicao que hoje se perde no primeiro clique.
 */
function lerFbclidComoFbc(): string | null {
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid')
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : null
  } catch {
    return null
  }
}

// ============================================================================
// Init
// ============================================================================

/**
 * Inicializa o Meta Pixel. Chamar uma vez no main.tsx.
 *
 * Nao faz nada em rota de produto — nem carrega o script. Alem de limpar a
 * medicao, tira um request de terceiro do caminho critico do app.
 */
export function initMetaPixel(): void {
  if (!CONFIGURADO) {
    if (typeof window !== 'undefined') {
      console.info('[meta-pixel] desabilitado (VITE_META_PIXEL_ID nao definido)')
    }
    return
  }

  if (!ehRotaDeMarketing()) {
    console.info(
      '[meta-pixel] rota de produto (%s) — pixel NAO carregado, de proposito',
      window.location.pathname,
    )
    return
  }

  if (window.fbq) {
    ativo = true
    return
  }

  // Snippet oficial do Meta
  ;(function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return
    const n: any = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args)
    }
    f.fbq = n
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode!.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

  window.fbq('init', PIXEL_ID)
  ativo = true

  // PageView so no client. De proposito: mandar PageView tambem pelo CAPI
  // dobraria o volume sem ganho de otimizacao — o que ja acontece hoje pela
  // integracao automatica do painel (ver RUNBOOK, passo manual 2).
  window.fbq('track', 'PageView')

  console.info('[meta-pixel] inicializado', { pixel: PIXEL_ID, rota: window.location.pathname })
}

/**
 * Advanced Matching: reinforma quem e' a pessoa depois que ela se identifica
 * num formulario. O proprio fbevents.js hasheia esses valores antes de
 * enviar — passamos texto normalizado, nunca hash pronto.
 *
 * Sozinho, isso ja costuma tirar o EMQ da faixa de 6 pra faixa de 8.
 */
export function definirDadosPessoa(pessoa: DadosPessoa): void {
  if (!ativo || !window.fbq) return
  const am: Record<string, string> = {}
  if (pessoa.email) am.em = pessoa.email.trim().toLowerCase()
  if (pessoa.telefone) am.ph = normalizarTelefone(pessoa.telefone)
  if (pessoa.nome) {
    const partes = pessoa.nome.trim().toLowerCase().split(/\s+/)
    if (partes[0]) am.fn = partes[0]
    if (partes.length > 1) am.ln = partes[partes.length - 1]
  }
  if (Object.keys(am).length === 0) return
  window.fbq('init', PIXEL_ID, am)
}

function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  return digitos.startsWith('55') ? digitos : `55${digitos}`
}

// ============================================================================
// Disparo generico
// ============================================================================

function dispararPadrao(
  evento: string,
  opts: {
    eventId: string
    params?: Record<string, string | number | boolean>
    pessoa?: DadosPessoa
    comCapi?: boolean
  },
): void {
  const { eventId, params, pessoa, comCapi = true } = opts

  if (!ativo) {
    console.info('[meta-pixel] %s (dry-run)', evento, { eventId, ...params })
    return
  }

  window.fbq!('track', evento, params ?? {}, { eventID: eventId })
  if (comCapi) enviarCapi(evento, { eventId, pessoa, custom: params })
}

/** Evento custom (nao-padrao), ex: `headline_variant_shown`. */
export function trackCustom(
  event: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!ativo) {
    console.info('[meta-pixel] trackCustom (dry-run)', event, params ?? {})
    return
  }
  window.fbq!('trackCustom', event, params)
}

// ============================================================================
// Eventos do funil
// ============================================================================

/** Origem do clique de WhatsApp — pra saber QUAL botao carrega o peso. */
export type OrigemWhatsApp =
  | 'header'
  | 'hero'
  | 'secao-duvidas'
  | 'cta-final'
  | 'rodape'
  | 'flutuante'

/**
 * Clique em qualquer botao de WhatsApp.
 *
 * Este e' o buraco maior que a auditoria de 03/08 achou: o WhatsApp e' o
 * canal principal de conversao do G Obra e nao disparava evento nenhum. Zero
 * ocorrencias de `Contact` no bundle de producao. Pro Meta, ninguem nunca
 * tinha entrado em contato.
 *
 * `Contact` e' evento padrao — da' pra otimizar campanha por ele, criar
 * publico e alimentar lookalike. O custom `whatsapp_click` vai junto so pelo
 * detalhe da origem.
 */
export function trackContact(origem: OrigemWhatsApp): void {
  const eventId = novoEventId('contact')
  dispararPadrao('Contact', {
    eventId,
    params: { content_name: 'WhatsApp', origem },
  })
  trackCustom('whatsapp_click', { origem })
}

/**
 * Agendamento de demo efetivado no Calendly (nao o clique — o agendamento
 * concluido, via postMessage do widget).
 *
 * O `Lead` do Calendly continua sendo disparado em main.tsx com o id
 * `calendly_<uuid>`, o MESMO que o webhook `calendly-capi` usa. Este evento
 * aqui e' o `Schedule`, semanticamente correto e otimizavel, com id proprio.
 * Mantemos os dois porque trocar o evento de otimizacao da campanha zeraria
 * o historico de aprendizado do algoritmo.
 */
export function trackSchedule(inviteeUuid?: string): void {
  const idSchedule = inviteeUuid ? `calendly_sched_${inviteeUuid}` : novoEventId('schedule')
  dispararPadrao('Schedule', {
    eventId: idSchedule,
    params: { content_name: 'Demo G Obra 30min' },
  })
}

/**
 * Lead generico (pop-up de saida, e o agendamento do Calendly).
 *
 * Do pop-up de saida agora mandamos tambem o telefone que a pessoa digitou —
 * e' um dado de match forte que estava sendo jogado fora.
 *
 * `comCapi: false` quando outro caminho server-side ja envia o mesmo evento
 * (caso do Calendly, coberto pelo webhook `calendly-capi`) — senao o mesmo
 * fato sairia duas vezes pelo servidor.
 */
export function trackLead(
  opts?:
    | string // forma antiga: trackLead('calendly_<uuid>'). Mantida de proposito
    | {
        eventId?: string
        pessoa?: DadosPessoa
        origem?: string
        comCapi?: boolean
      },
): void {
  // Aceitar a string evita quebrar qualquer chamada antiga que ainda exista
  // fora dos arquivos tocados nesta rodada.
  if (typeof opts === 'string') opts = { eventId: opts }

  const eventId = opts?.eventId ?? novoEventId('lead')
  dispararPadrao('Lead', {
    eventId,
    params: opts?.origem ? { origem: opts.origem } : undefined,
    pessoa: opts?.pessoa,
    comCapi: opts?.comCapi ?? true,
  })
}

/**
 * Abriu o modal de contratacao.
 *
 * Antes o `InitiateCheckout` so saia DEPOIS da cobranca criada no Asaas, um
 * passo antes do redirect. Isso escondia todo o abandono de formulario — que
 * e' exatamente onde 2 tentativas viraram 0 compras no ultimo mes. Agora:
 * abriu o modal = iniciou checkout.
 */
export function trackInitiateCheckout(valor = 349, moeda = 'BRL'): string {
  const eventId = novoEventId('checkout')
  dispararPadrao('InitiateCheckout', {
    eventId,
    params: { value: valor, currency: moeda, content_name: 'G Obra - Mensalidade' },
  })
  return eventId
}

/**
 * Preencheu o formulario e esta indo pro Asaas pagar. Evento padrao do Meta
 * pro passo entre iniciar o checkout e comprar.
 *
 * A diferenca entre `InitiateCheckout` e este numero e' a taxa de abandono
 * do formulario — a metrica que vai dizer se pedir CPF/CNPJ antes do
 * pagamento esta custando venda.
 */
export function trackAddPaymentInfo(pessoa: DadosPessoa, valor = 349, moeda = 'BRL'): void {
  definirDadosPessoa(pessoa)
  dispararPadrao('AddPaymentInfo', {
    eventId: novoEventId('payinfo'),
    params: { value: valor, currency: moeda, content_name: 'G Obra - Mensalidade' },
    pessoa,
  })
}

/**
 * Compra confirmada (cliente caiu em /cadastro?token=X).
 *
 * Passe o valor REAL pago (use `valorPorCupom`). Valor fixo derruba a
 * otimizacao — o Meta trata valor estatico como sinal quebrado.
 */
export function trackPurchase(valor = 349, moeda = 'BRL', pessoa?: DadosPessoa): void {
  if (pessoa) definirDadosPessoa(pessoa)
  dispararPadrao('Purchase', {
    eventId: novoEventId('purchase'),
    params: { value: valor, currency: moeda, content_name: 'G Obra - Mensalidade' },
    pessoa,
  })
}

/** Cadastro finalizado (senha criada, termos aceitos, entrou no app). */
export function trackCompleteRegistration(pessoa?: DadosPessoa): void {
  dispararPadrao('CompleteRegistration', {
    eventId: novoEventId('signup'),
    pessoa,
  })
}

/**
 * Valor real pago em BRL conforme o cupom.
 *
 * Base R$ 349:
 *   OBRA10 / OBRA10EXT -> 10% off no 1o mes -> R$ 314,10
 *   OBRA20 / OBRA20EXT -> 20% off no 1o mes -> R$ 279,20
 */
export function valorPorCupom(cupom?: string | null): number {
  const c = (cupom ?? '').trim().toUpperCase()
  switch (c) {
    case 'OBRA10':
    case 'OBRA10EXT':
      return 314.1
    case 'OBRA20':
    case 'OBRA20EXT':
      return 279.2
    default:
      return 349
  }
}

/** PageView manual. Hoje nao usado — o init ja dispara no carregamento. */
export function trackPageView(): void {
  if (!ativo) return
  window.fbq!('track', 'PageView')
}
