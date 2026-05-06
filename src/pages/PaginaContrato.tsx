// Pagina publica generica pra renderizar Termos ou Politica.
// Usada pelas rotas /termos e /privacidade.
//
// Decisao de UX: header simples (logo + voltar pra home), conteudo em <pre>
// preservando a formatacao original, footer com versao e data.
//
// Por que <pre> em vez de remarcar como prose Markdown:
//   1. Os textos vivem como string em lib/contratos.ts pra serem hashed/snapshotted
//      identicos ao que o usuario aceitou no cadastro. Reformatar visualmente
//      poderia gerar discrepancia entre "o que o cliente assinou" vs "o que ele le".
//   2. <pre className="whitespace-pre-wrap"> mantem quebras e numeracao mas quebra
//      linhas longas em telas pequenas — melhor dos dois mundos.

import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'

interface Props {
  titulo: string
  texto: string
  versao: string
}

export default function PaginaContrato({ titulo, texto, versao }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center"><LogoFull small /></Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">← Voltar pra home</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">{titulo}</h1>
            <span className="text-xs text-slate-500 font-mono">v{versao}</span>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{texto}</pre>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          Duvidas sobre este documento? Fala com a gente em <a href="mailto:dpo@5gobra.com.br" className="text-laranja-dark hover:underline">dpo@5gobra.com.br</a> ou no WhatsApp oficial.
        </p>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-slate-500">
          <span>G Obra · um modulo do 5G Gerenciamento</span>
          <span>© 2026 5G Gerenciamento</span>
        </div>
      </footer>
    </div>
  )
}
