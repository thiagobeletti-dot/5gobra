// Pagina publica /privacidade
// Renderiza o texto vigente da Politica de Privacidade.

import PaginaContrato from './PaginaContrato'
import { DOC_POLITICA_PRIVACIDADE, PRIVACIDADE_VERSAO } from '../lib/contratos'

export default function Privacidade() {
  return <PaginaContrato titulo="Politica de Privacidade" texto={DOC_POLITICA_PRIVACIDADE} versao={PRIVACIDADE_VERSAO} />
}
