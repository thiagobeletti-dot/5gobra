// Pagina publica /termos
// Renderiza o texto vigente dos Termos de Uso para clientes existentes
// e prospects relerem a qualquer momento, sem login.

import PaginaContrato from './PaginaContrato'
import { DOC_TERMOS_USO, TERMOS_VERSAO } from '../lib/contratos'

export default function Termos() {
  return <PaginaContrato titulo="Termos de Uso" texto={DOC_TERMOS_USO} versao={TERMOS_VERSAO} />
}
