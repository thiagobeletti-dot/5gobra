import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import CarrosselSistema from '../components/CarrosselSistema'
import PopupSaida from '../components/PopupSaida'
import ModalComprar from '../components/ModalComprar'

const WA_DUVIDA =
  'https://wa.me/5511995400050?text=' +
  encodeURIComponent('Olá! Tô olhando o G Obra e tenho algumas dúvidas.')

// Link do Calendly do fundador (30min, qualificação prévia nos campos do form).
const CALENDLY_URL = 'https://calendly.com/thiagobeletti/30min'

// Abre o Calendly como popup IN-PAGE (em vez de redirecionar pro calendly.com).
// O widget é carregado via index.html. Quando o usuário completa o agendamento,
// o widget emite postMessage `calendly.event_scheduled` que o listener em
// main.tsx captura e dispara `trackLead` no Meta Pixel — essencial pra
// otimização de conversão da Campanha 2.
//
// Se o widget não tiver carregado (rede lenta / bloqueador), o link externo
// (target=_blank) segue funcionando como fallback.
function abrirCalendlyPopup(e: MouseEvent<HTMLAnchorElement>) {
  const Calendly = (window as unknown as { Calendly?: { initPopupWidget: (opts: { url: string }) => void } }).Calendly
  if (Calendly) {
    e.preventDefault()
    Calendly.initPopupWidget({ url: CALENDLY_URL })
  }
  // sem else: deixa o href original abrir em nova aba como fallback
}

export default function Landing() {
  const [comprarAberto, setComprarAberto] = useState(false)

  // URL param `?comprar=1` abre o modal de contratação automaticamente.
  // Permite mandar link direto pós-reunião: "5gobra.com.br?comprar=1".
  // Cravado em 09/06/2026 após Thiago não achar o botão na reunião do Carlos.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('comprar') === '1') {
      setComprarAberto(true)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <LogoFull />
          <nav className="hidden md:flex items-center gap-7">
            <a href="#problemas" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">Problemas</a>
            <a href="#como-funciona" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">Como funciona</a>
            <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-2.5">
            {/* WhatsApp como link discreto — só em telas largas */}
            <a
              href={WA_DUVIDA}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition"
            >
              WhatsApp
            </a>
            <Link to="/login" className="btn-ghost text-sm">Entrar</Link>
            <Link to="/app/demo" className="hidden md:inline-flex btn-ghost text-sm">
              Ver sistema
            </Link>
            {/* Botão "Contratar" cravado em 09/06/2026 após Thiago não achar o
                link discreto na reunião do Carlos. Estilo destacado (borda laranja)
                mas secundário ao "Agendar demo" — não compete pela ação primária. */}
            <button
              type="button"
              onClick={() => setComprarAberto(true)}
              className="hidden sm:inline-flex items-center text-sm font-semibold text-laranja-dark border-2 border-laranja-dark px-3 py-1.5 rounded-md hover:bg-laranja-dark hover:text-white transition"
            >
              Contratar
            </button>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={abrirCalendlyPopup}
              className="btn-primary text-sm"
            >
              Agendar demo →
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            {/* Headline: categorial + ICP — cravada com Thiago em 02/06/2026 pós Campanha 2.
                Versão anterior era agitadora de dor (boa pra audiência fria/topo de funil).
                Esta é técnica/categorial — melhor pra fundo de funil onde a audiência já
                sabe que precisa e quer entender RAPIDAMENTE o que é o produto.
                Ganho de dobra mobile: era 6 linhas no celular, agora cabe em 2-3. */}
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
              Diário de obra digital pra <span className="text-laranja">fábricas de esquadria</span>.
            </h1>
            <p className="text-base md:text-lg text-slate-600 mb-7 max-w-lg leading-relaxed">
              Cada combinado registrado, cada aprovação preservada. Comunicação clara entre
              você e o cliente. Em um lugar só.
            </p>

            {/* CTAs simplificados — Fix #2 cravado em 02/06/2026 pós Campanha 2.
                Hero tem APENAS 2 caminhos:
                  1. Primário: Agendar demonstração (botão laranja, máximo destaque)
                  2. Secundário: Mensagem direto pro fundador (link discreto, mesma linha)
                Removidos do hero (continuam disponíveis na seção CTA final e no header):
                  - "Ver o sistema sozinho" -> caminho de auto-serviço pra audiência fria
                  - "Comprar direto R$ 349/mês" -> caminho pra quem já decidiu sem demo
                Razão: a Campanha 1 trouxe 4.819 visitantes com 0 conversões. Hipótese
                principal foi paralisia de escolha — audiência quente vê 4 CTAs e congela.
                A Campanha 2 (fundo de funil) chega justamente pra quente — não pode repetir
                o erro. Lista "ACABE COM:" também saiu do hero (já temos seção "VOCÊ
                RECONHECE ISSO?" mais abaixo cobrindo as dores). */}
            <div className="flex gap-4 flex-wrap items-center">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={abrirCalendlyPopup}
                className="btn-primary text-base px-6 py-3"
              >
                Agendar demonstração · 30min →
              </a>
              <a
                href={WA_DUVIDA}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
              >
                Falar direto com o fundador
              </a>
            </div>

            {/* Selo de garantia VISUAL (era texto fino antes) */}
            <div className="mt-5 inline-flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg px-3.5 py-2">
              <span className="text-lg" aria-hidden>🛡️</span>
              <div>
                <span className="font-bold text-sm">14 dias de garantia.</span>{' '}
                <span className="text-sm">Se não gostar, devolvemos seu dinheiro. Sem perguntas.</span>
              </div>
            </div>

            {/* Prova social — usa sua história e validação real do setor */}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                Construído por uma fábrica com <strong className="text-slate-700">16 anos de mercado</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                Validado por fábricas-referência
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                Sem fidelidade, cancela quando quiser
              </span>
            </div>

          </div>

          {/* Carrossel das telas do sistema */}
          <div className="min-w-0">
            <CarrosselSistema />
          </div>
        </section>

        {/* VOCÊ RECONHECE ISSO? — PROBLEMAS */}
        <section id="problemas" className="bg-slate-50 border-y border-slate-200 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-laranja-dark mb-3">
                Você reconhece isso?
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
                Toda obra de esquadria tem os mesmos problemas.
              </h2>
              <p className="text-slate-600 mt-4 max-w-2xl mx-auto">
                Se você já passou por um desses, esse sistema foi feito pra você.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              <Dor
                titulo="Cliente liga toda hora perguntando o status"
                texto="“E aí, quando vai instalar?” no WhatsApp, no telefone, na obra. Você perde tempo respondendo o mesmo pra cada cliente, todo dia."
              />
              <Dor
                titulo='"Mas eu tinha aprovado preto, não branco"'
                texto="Combinado de cor, medida, prazo, valor — tudo passou por WhatsApp e e-mail. Sem prova oficial, é a sua palavra contra a do cliente."
              />
              <Dor
                titulo="Aceite verbal não vale nada na garantia"
                texto="Cliente reclama 8 meses depois que “a janela sempre teve esse problema”. Sem aceite formal com data registrada, a garantia vira uma novela."
              />
              <Dor
                titulo="Equipe em obra registra de qualquer jeito"
                texto="Foto no celular do instalador, anotação no caderno do montador, mensagem no grupo. Você só descobre o problema quando o cliente reclama."
              />
              <Dor
                titulo="Apontamento perdido no meio de 80 mensagens"
                texto="Cliente apontou um defeito 3 semanas atrás. Você jurou que ia resolver. Esqueceu. Agora ele tá nervoso e vai falar mal pra todo mundo."
                fullWidth
              />
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="como-funciona" className="bg-white scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-laranja-dark mb-3">
                Como o Diário de Obra resolve
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
                Cada peça com histórico oficial. Cada movimento registrado.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Feature
                titulo="Tudo em um lugar"
                texto="Cada item da obra vira um card. Itens, acordos, apontamentos — todo o histórico salvo, com fotos, datas e responsáveis."
              />
              <Feature
                titulo="Quem deve fazer o que"
                texto="A bola fica visível: do lado da empresa ou do cliente. Quando alguém registra algo, a bola passa pro outro automaticamente."
              />
              <Feature
                titulo="Aceite com peso jurídico"
                texto="No fim de cada peça, o cliente dá o aceite com timestamp, IP e dispositivo registrados. Inicia a garantia e protege os dois lados."
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-slate-50 border-y border-slate-200 scroll-mt-20">
          <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-laranja-dark mb-3">
                Perguntas frequentes
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Antes de começar, talvez você queira saber
              </h2>
            </div>

            <div className="space-y-3">
              <Pergunta titulo="Quanto custa?">
                R$ 349 por mês, por empresa. Sem limite de obras, sem custo extra por cliente. Você tem <strong>14 dias de garantia</strong>: se em qualquer momento dentro desse prazo você não estiver satisfeito, devolvemos 100% do que pagou. Sem perguntas, sem letra miúda.
              </Pergunta>

              <Pergunta titulo="O cliente precisa baixar algum aplicativo?">
                Não. O cliente acessa a obra dele pelo navegador, por um link único que você compartilha por WhatsApp ou e-mail. Sem cadastro, sem senha, sem app. Funciona em qualquer celular, tablet ou computador.
              </Pergunta>

              <Pergunta titulo="Funciona no celular?">
                Sim, é mobile-first. A equipe em obra preenche checklists e tira fotos direto do celular. O gestor acompanha do escritório no computador. Cada um na ferramenta certa pro seu papel.
              </Pergunta>

              <Pergunta titulo="Tem fidelidade ou multa de cancelamento?">
                Não. Assinatura mensal, cancela quando quiser. Os primeiros 14 dias são de garantia: se decidir cancelar nesse prazo, devolvemos o valor pago. Depois disso, você só paga os meses em que usou. Ao cancelar, exporta seu histórico em PDF e seus dados ficam disponíveis por mais 30 dias caso queira voltar.
              </Pergunta>

              <Pergunta titulo="E se eu tiver várias obras ao mesmo tempo?">
                Sem problema. O Diário de Obra foi feito pra fábricas que tocam várias obras em paralelo. Cada obra tem seu próprio painel, seu próprio link de cliente, e seu próprio histórico isolado. Você navega entre elas com 1 clique.
              </Pergunta>

              <Pergunta titulo="Quanto tempo até começar a usar?">
                Depois do pagamento confirmado, você recebe o link de acesso por e-mail na hora. Cadastro de senha leva 1 minuto. Importação de itens da obra (a partir de Alumisoft ou planilha) leva mais 5. Em 10 minutos você tá com a primeira obra ativa e o link pronto pra mandar pro cliente.
              </Pergunta>

              <Pergunta titulo="Preciso treinar minha equipe pra usar?">
                Não. O técnico que vai à obra recebe um link próprio (link mágico) e abre direto no checklist do dia. Sem login, sem senha, sem manual. Foi pensado pra que quem nunca usou um sistema na vida consiga preencher de primeira.
              </Pergunta>

              <Pergunta titulo="O aceite do cliente tem peso jurídico mesmo?">
                Sim. Cada aceite registra data, hora, IP, dispositivo e geolocalização (quando disponível). O histórico completo do card pode ser exportado em PDF com hash de integridade — válido como prova em ação judicial ou em PROCON.
              </Pergunta>
            </div>

            <div className="mt-10 text-center text-sm text-slate-500">
              Outra dúvida? Fala direto comigo no{' '}
              <a
                href={WA_DUVIDA}
                target="_blank"
                rel="noopener noreferrer"
                className="text-laranja-dark font-semibold hover:underline"
              >
                WhatsApp (11) 99540-0050
              </a>
              .
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="max-w-6xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Pronto pra acabar com o ruído na obra?
          </h2>
          <p className="text-slate-600 mb-2 max-w-xl mx-auto">
            <strong className="text-slate-900">30 minutos</strong> comigo, sem compromisso. A gente vê
            juntos se o sistema resolve a tua dor.
          </p>
          <p className="text-sm text-slate-500 mb-8 max-w-xl mx-auto">
            Quando decidir contratar: R$ 349/mês, sem fidelidade, 14 dias de garantia.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={abrirCalendlyPopup}
              className="btn-primary text-base px-8 py-3.5"
            >
              Agendar demonstração →
            </a>
            <Link
              to="/app/demo"
              className="btn-ghost text-base px-8 py-3.5"
            >
              Ver o sistema sozinho
            </Link>
          </div>
          {/* Botão "Contratar agora" cravado em 09/06/2026 — antes era link
              discreto que ninguém achava (incl. próprio Thiago). Agora é botão
              destacado, mesma proeminência dos CTAs primários acima. */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center mt-6">
            <button
              type="button"
              onClick={() => setComprarAberto(true)}
              className="inline-flex items-center justify-center text-base font-semibold text-white bg-laranja-dark hover:bg-laranja px-8 py-3.5 rounded-md transition shadow-sm"
            >
              Contratar agora · R$ 349/mês
            </button>
            <a
              href={WA_DUVIDA}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-laranja-dark transition"
            >
              ou dúvida rápida via WhatsApp →
            </a>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <span>Diário de Obra · um módulo do 5G Gerenciamento</span>
          <div className="flex items-center gap-5">
            <Link to="/termos" className="hover:text-slate-900 transition">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-slate-900 transition">Privacidade</Link>
            <span>© 2026 5G Gerenciamento</span>
          </div>
        </div>
      </footer>

      {/* Modal de compra: abre quando clica em qualquer botão "Comprar" */}
      <ModalComprar
        aberto={comprarAberto}
        onFechar={() => setComprarAberto(false)}
      />

      {/* Pop-up de saída: captura WhatsApp de quem tava saindo sem comprar */}
      <PopupSaida />
    </div>
  )
}

// ===== Subcomponentes =====

function Feature({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-lg bg-laranja-soft border border-laranja-border flex items-center justify-center text-laranja-dark text-lg font-bold mb-4">
        ■
      </div>
      <h3 className="font-bold text-lg mb-2">{titulo}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{texto}</p>
    </div>
  )
}

function Dor({ titulo, texto, fullWidth }: { titulo: string; texto: string; fullWidth?: boolean }) {
  return (
    <div
      className={
        'bg-white border border-slate-200 rounded-xl p-5 ' +
        (fullWidth ? 'md:col-span-2' : '')
      }
    >
      <div className="flex gap-3">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
          !
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base mb-1.5 leading-snug">{titulo}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{texto}</p>
        </div>
      </div>
    </div>
  )
}

function Pergunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-slate-50 transition">
        <h3 className="font-bold text-base text-slate-900">{titulo}</h3>
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
        {children}
      </div>
    </details>
  )
}
