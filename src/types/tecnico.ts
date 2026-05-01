// Tipos do técnico (3º ator: pessoa que vai na obra fazer M1/M2 sem ser empresa)

export interface TecnicoObra {
  id: string
  obraId: string
  nome: string
  papel: string | null
  token: string
  ativo: boolean
  revogadoEm: string | null
  createdAt: string
}
