// Acesso ao painel gerencial e à máquina de venda, no cabeçalho.
//
// Existe porque as duas telas só eram alcançáveis digitando a URL na mão, e
// o Thiago perguntou duas vezes qual era o endereço — em 02/09 e em 11/09.
// Ferramenta que você precisa lembrar como abrir é ferramenta que você não
// usa, que é exatamente o problema que a máquina de venda veio resolver.
//
// Só aparece pra admin. Para quem não é, não renderiza nada — nem o espaço.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pegarSituacao } from '../lib/api'

// Guardado no módulo: a resposta não muda durante a navegação, e assim a RPC
// roda uma vez por carregamento de página em vez de uma vez por cabeçalho.
let ehAdminCache: boolean | null = null

export default function MenuAdmin() {
  const [ehAdmin, setEhAdmin] = useState<boolean>(ehAdminCache ?? false)

  useEffect(() => {
    if (ehAdminCache !== null) return
    let vivo = true
    void pegarSituacao().then((s) => {
      ehAdminCache = !!s?.admin
      if (vivo) setEhAdmin(ehAdminCache)
    })
    return () => { vivo = false }
  }, [])

  if (!ehAdmin) return null

  return (
    <span className="inline-flex items-center gap-3 pl-3 ml-1 border-l border-slate-200 shrink-0">
      <Link to="/app/vendas" className="text-laranja-dark font-semibold hover:underline underline-offset-4">
        Vendas
      </Link>
      <Link to="/app/admin" className="text-slate-500 hover:text-slate-900">
        Clientes
      </Link>
    </span>
  )
}
