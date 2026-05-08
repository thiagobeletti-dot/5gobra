// Hook reutilizavel pra usar ConfirmDialog em estilo de promise.
//
// Em vez de gerenciar boolean state pra cada confirmacao + callbacks separados,
// faz `await confirmar({ titulo, descricao, ... })` e a promise resolve com
// o motivo (string) ou null se cancelou. Codigo fica linear e legivel.
//
// Uso:
//   function MeuComponente() {
//     const { confirmar, dialog } = useConfirm()
//
//     async function apagar() {
//       const motivo = await confirmar({
//         titulo: 'Apagar item?',
//         descricao: 'Essa acao nao pode ser desfeita.',
//         digitacaoExigida: 'APAGAR',
//         destrutivo: true,
//       })
//       if (motivo === null) return  // usuario cancelou
//       await api.apagar(...)
//     }
//
//     return (
//       <>
//         <button onClick={apagar}>Apagar</button>
//         {dialog}
//       </>
//     )
//   }

import { useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

interface OpcoesConfirm {
  titulo: string
  descricao?: string
  labelConfirmar?: string
  labelCancelar?: string
  destrutivo?: boolean
  digitacaoExigida?: string
  pedirMotivo?: boolean
  placeholderMotivo?: string
}

export function useConfirm() {
  const [opts, setOpts] = useState<OpcoesConfirm | null>(null)
  // Usamos ref pro resolver pra evitar problemas com setState de funcao
  const resolverRef = useRef<((valor: string | null) => void) | null>(null)

  function confirmar(novoOpts: OpcoesConfirm): Promise<string | null> {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setOpts(novoOpts)
    })
  }

  function fechar(motivo: string | null) {
    const r = resolverRef.current
    resolverRef.current = null
    setOpts(null)
    r?.(motivo)
  }

  const dialog = opts ? (
    <ConfirmDialog
      aberto={true}
      titulo={opts.titulo}
      descricao={opts.descricao}
      labelConfirmar={opts.labelConfirmar}
      labelCancelar={opts.labelCancelar}
      destrutivo={opts.destrutivo}
      digitacaoExigida={opts.digitacaoExigida}
      pedirMotivo={opts.pedirMotivo}
      placeholderMotivo={opts.placeholderMotivo}
      onConfirmar={(motivo) => fechar(motivo ?? '')}
      onCancelar={() => fechar(null)}
    />
  ) : null

  return { confirmar, dialog }
}
