// Tela mostrada quando um link público (/obra/:token ou /tec/:token) não abre.
// Pergunta ao banco POR QUÊ (situacao_link_publico): se a empresa está sem
// acesso (trial vencido / suspensa), o cliente e o técnico veem "acesso
// pausado" em vez de "link inválido" — e a empresa sente a pressão de quem
// ela já mostrou o link. Cravado 02/09/2026.

import { useEffect, useState } from 'react'
import { LogoFull } from '../lib/logo'
import { situacaoLinkPublico } from '../lib/api'

interface Props {
  token: string
  mensagem?: string
}

export default function LinkIndisponivel({ token, mensagem }: Props) {
  const [motivo, setMotivo] = useState<'ok' | 'bloqueado' | 'invalido' | null>(null)

  useEffect(() => {
    let ativo = true
    void situacaoLinkPublico(token).then((m) => {
      if (ativo) setMotivo(m)
    })
    return () => {
      ativo = false
    }
  }, [token])

  const bloqueado = motivo === 'bloqueado'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600 px-6 text-center">
      <LogoFull />
      {bloqueado ? (
        <>
          <p className="mt-6 font-semibold text-slate-800">Este acompanhamento está pausado.</p>
          <p className="text-sm text-slate-500 max-w-md">
            A empresa responsável pela obra precisa reativar o acesso ao G Obra. Nada foi perdido:
            assim que ela regularizar, o link volta a funcionar.
          </p>
          <p className="text-sm text-slate-400">Fale com a empresa que te enviou este link.</p>
        </>
      ) : (
        <>
          <p className="mt-6">{mensagem ?? 'Link inválido ou obra encerrada.'}</p>
          <p className="text-sm text-slate-400">Se você acredita que isso é um erro, fale com a empresa.</p>
        </>
      )}
    </div>
  )
}
