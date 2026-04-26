import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <LogoFull />
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost">Entrar</Link>
            <Link to="/login" className="btn-primary">Acessar minha obra</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block bg-laranja-soft text-laranja-dark border border-laranja-border rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide mb-5">
              Modulo do 5G Gerenciamento
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
              Comunicacao clara entre <span className="text-laranja">empresa e cliente</span> em obras de esquadria.
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-lg">
              Cada peca, cada acordo, cada reclamacao registrada num lugar so. Quem deve fazer o que fica obvio. Combinado nao se perde no WhatsApp.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link to="/login" className="btn-primary text-base px-6 py-3">Comecar agora</Link>
              <Link to="/app/demo" className="btn-ghost text-base px-6 py-3">Ver demo</Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex gap-2 mb-4">
              <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2.5 py-1 rounded-md text-xs font-semibold">Cliente · 4</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">Empresa · 2</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">Em andamento · 8</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">Conclusao · 3</span>
            </div>
            <div className="space-y-2.5">
              <div className="card-base">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="bg-peca-soft text-peca-dark border border-peca-border px-2 py-0.5 rounded-md text-xs font-bold">J1</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Peca</span>
                </div>
                <div className="font-semibold mb-1">Janela sala 1</div>
                <div className="text-xs text-slate-500">Janela aluminio branco 1,20 x 1,00m, 2 folhas de correr.</div>
              </div>
              <div className="card-base">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="bg-acordo-soft text-acordo-dark border border-acordo-border px-2 py-0.5 rounded-md text-xs font-bold">A1</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Acordo</span>
                </div>
                <div className="font-semibold mb-1">Cor da janela suite master</div>
                <div className="text-xs text-slate-500">Cliente optou por preto fosco. Acrescimo R$ 480,00.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
            <Feature
              titulo="Tudo em um lugar"
              texto="Cada item da obra vira um card. Pecas, acordos, reclamacoes — todo o historico salvo, com fotos, datas e responsaveis."
            />
            <Feature
              titulo="Quem deve fazer o que"
              texto="A bola fica visivel: do lado da empresa ou do cliente. Quando alguem registra algo, a bola passa pro outro automaticamente."
            />
            <Feature
              titulo="Aceite com peso juridico"
              texto="No fim de cada peca, o cliente da o aceite com timestamp, IP e dispositivo registrados. Inicia a garantia e protege os dois lados."
            />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Pronto pra acabar com o ruido na obra?</h2>
          <p className="text-slate-600 mb-6">Sua empresa em fase beta — vagas limitadas pras primeiras serralherias.</p>
          <Link to="/login" className="btn-primary text-base px-6 py-3">Acessar G Obra</Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-slate-500">
          <span>G Obra · um modulo do 5G Gerenciamento</span>
          <span>© 2026 5G Gerenciamento</span>
        </div>
      </footer>
    </div>
  )
}

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
