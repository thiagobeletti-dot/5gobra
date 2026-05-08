// Error Boundary global do app.
//
// Captura qualquer erro de render/lifecycle dentro de uma rota e mostra uma
// página amigável em vez de tela branca. Loga o erro completo no console
// pra debugger via remote debugging (chrome://inspect em Android, Safari Web
// Inspector em iPhone).
//
// Uso em App.tsx:
//   <ErrorBoundary>
//     <Routes>...</Routes>
//   </ErrorBoundary>
//
// Pra rota especifica (preferido):
//   <Route element={<ErrorBoundary><Obra /></ErrorBoundary>} />

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Texto humano pra mostrar acima do botao de recarregar. Default generico. */
  contexto?: string
}

interface State {
  erro: Error | null
  info: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { erro: error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Loga TUDO no console pra captura via remote debugging
    console.error('[ErrorBoundary] erro capturado:', error)
    console.error('[ErrorBoundary] componentStack:', info.componentStack)
    this.setState({ info })
  }

  render() {
    if (!this.state.erro) return this.props.children

    const erro = this.state.erro
    const stack = erro.stack ?? '(sem stack)'

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-slate-50">
        <div className="w-full max-w-2xl bg-white border border-red-200 rounded-xl p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-red-100 text-red-600 grid place-items-center text-xl font-bold">!</span>
            <h1 className="text-xl font-bold text-slate-900">Algo deu errado</h1>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            {this.props.contexto ?? 'Encontrei um erro ao carregar essa tela. Tenta recarregar a página. Se persistir, me manda print dessa mensagem pelo WhatsApp.'}
          </p>

          <details className="bg-slate-50 border border-slate-200 rounded-lg mb-5">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
              Detalhes técnicos (toque pra expandir)
            </summary>
            <div className="px-4 py-3 border-t border-slate-200 space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Mensagem</div>
                <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono break-words">{erro.message}</pre>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Stack trace</div>
                <pre className="text-[10px] text-slate-700 whitespace-pre-wrap font-mono max-h-64 overflow-auto break-words">{stack}</pre>
              </div>
            </div>
          </details>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary flex-1"
            >
              Recarregar página
            </button>
            <a href="/" className="btn-ghost text-center flex-1">
              Voltar pro início
            </a>
          </div>
        </div>
      </div>
    )
  }
}
