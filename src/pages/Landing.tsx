import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import CarrosselSistema from '../components/CarrosselSistema'

const WA_COMPRAR =
  'https://wa.me/5511995400050?text=' +
  encodeURIComponent('Olá! Quero comprar o G Obra (R$ 349/mês). Posso tirar algumas dúvidas antes?')

const WA_DUVIDA =
  'https://wa.me/5511995400050?text=' +
  encodeURIComponent('Olá! Tô olhando o G Obra e tenho algumas dúvidas.')

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <LogoFull />
          <nav className="hidden md:flex items-center gap-7">
            <a href="#dores" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">Dores</a>
            <a href="#como-funciona" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">Como funciona</a>
            <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost">Entrar</Link>
            <a
              href={WA_COMPRAR}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Comprar
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block bg-laranja-soft text-laranja-dark border border-laranja-border rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide mb-5">
              Módulo do 5G Gerenciamento
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
              Comunicação clara entre <span className="text-laranja">empresa e cliente</span> em obras de esquadria.
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
              Cada peça, cada acordo, cada apontamento registrado num lugar só. Quem deve fazer o que fica óbvio. Combinado não se perde no WhatsApp.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a
                href={WA_COMPRAR}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-base px-6 py-3"
              >
                Comprar G Obra · R$ 349/mês
              </a>
              <a
                href={WA_DUVIDA}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-base px-6 py-3"
              >
                Tirar dúvidas no WhatsApp
              </a>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              <span className="font-semibold text-slate-700">14 dias de garantia.</span> Se não gostar, devolvemos seu dinheiro. Sem perguntas.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ou conheça antes pelo <Link to="/app/demo" className="underline hover:text-laranja-dark">modo demonstração</Link>.
            </p>
          </div>

          {/* Carrossel das telas do sistema */}
          <div className="min-w-0">
            <CarrosselSistema />
          </div>
        </section>

        {/* VOCÊ RECONHECE ISSO? — DORES */}
        <section id="dores" className="bg-slate-50 border-y border-slate-200 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-laranja-dark mb-3">
                Você reconhece isso?
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
                Toda obra de esquadria tem as mesmas dores.
              </h2>
              <p className="text-slate-600 mt-4 max-w-2xl mx-auto">
                Se você já passou por uma dessas, esse sistema foi feito pra você.
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
          <p className="text-slate-600 mb-8 max-w-xl mx-auto">
            R$ 349/mês com <strong className="text-slate-900">14 dias de garantia</strong>. Se não gostar, devolvemos seu dinheiro.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <a
              href={WA_COMPRAR}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-base px-8 py-3.5"
            >
              Comprar G Obra
            </a>
            <a
              href={WA_DUVIDA}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-base px-8 py-3.5"
            >
              Tirar dúvidas no WhatsApp
            </a>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-slate-500">
          <span>Diário de Obra · um módulo do 5G Gerenciamento</span>
          <span>© 2026 5G Gerenciamento</span>
        </div>
      </footer>
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
