import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <LogoFull />
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost">Entrar</Link>
            <Link to="/cadastro" className="btn-primary">Criar conta</Link>
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
              <Link to="/cadastro" className="btn-primary text-base px-6 py-3">Começar agora · 14 dias grátis</Link>
              <Link to="/app/demo" className="btn-ghost text-base px-6 py-3">Ver demonstração</Link>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Sem cartão no cadastro · Cancele quando quiser
            </p>
          </div>

          {/* Mock card de exemplo */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2.5 py-1 rounded-md text-xs font-semibold">Cliente · 4</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">Empresa · 2</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">Em andamento · 8</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">Conclusão · 3</span>
            </div>
            <div className="space-y-2.5">
              <div className="card-base">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="bg-peca-soft text-peca-dark border border-peca-border px-2 py-0.5 rounded-md text-xs font-bold">J1</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Item</span>
                </div>
                <div className="font-semibold mb-1">Janela sala 1</div>
                <div className="text-xs text-slate-500">Janela alumínio branco 1,20 × 1,00m, 2 folhas de correr.</div>
              </div>
              <div className="card-base">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="bg-acordo-soft text-acordo-dark border border-acordo-border px-2 py-0.5 rounded-md text-xs font-bold">A1</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Acordo</span>
                </div>
                <div className="font-semibold mb-1">Cor da janela suíte master</div>
                <div className="text-xs text-slate-500">Cliente optou por preto fosco. Acréscimo R$ 480,00.</div>
              </div>
            </div>
          </div>
        </section>

        {/* VOCÊ RECONHECE ISSO? — DORES */}
        <section className="bg-slate-50 border-y border-slate-200">
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
        <section className="bg-white">
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
        <section className="bg-slate-50 border-y border-slate-200">
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
                R$ 349 por mês, por empresa. Sem limite de obras, sem limite de usuários, sem custo extra por cliente. Você tem 14 dias de teste grátis antes de pagar qualquer coisa, e não pedimos cartão no cadastro.
              </Pergunta>

              <Pergunta titulo="O cliente precisa baixar algum aplicativo?">
                Não. O cliente acessa a obra dele pelo navegador, por um link único que você compartilha por WhatsApp ou e-mail. Sem cadastro, sem senha, sem app. Funciona em qualquer celular, tablet ou computador.
              </Pergunta>

              <Pergunta titulo="Funciona no celular?">
                Sim, é mobile-first. A equipe em obra preenche checklists e tira fotos direto do celular. O gestor acompanha do escritório no computador. Cada um na ferramenta certa pro seu papel.
              </Pergunta>

              <Pergunta titulo="Tem fidelidade ou multa de cancelamento?">
                Não. Você assina mensal, e cancela quando quiser. Se cancelar, exporta seu histórico em PDF e seus dados ficam disponíveis por mais 30 dias caso queira voltar.
              </Pergunta>

              <Pergunta titulo="E se eu tiver várias obras ao mesmo tempo?">
                Sem problema. O Diário de Obra foi feito pra fábricas que tocam várias obras em paralelo. Cada obra tem seu próprio painel, seu próprio link de cliente, e seu próprio histórico isolado. Você navega entre elas com 1 clique.
              </Pergunta>

              <Pergunta titulo="Quanto tempo até começar a usar?">
                Cadastro leva 1 minuto. Importação de itens da obra (a partir de Alumisoft ou planilha) leva mais 5. Em 10 minutos você tá com a primeira obra ativa e o link pronto pra mandar pro cliente.
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
                href="https://wa.me/5511995400050"
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
            14 dias grátis. Sem cartão no cadastro. Cancele quando quiser.
          </p>
          <Link to="/cadastro" className="btn-primary text-base px-8 py-3.5">
            Começar agora
          </Link>
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
