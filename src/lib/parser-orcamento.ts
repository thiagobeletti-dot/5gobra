// Roteador de PDFs de orçamento de esquadrias.
//
// Cravado em 10/06/2026. Detecta o sistema de origem do PDF e chama o parser
// específico. Hoje suporta:
//   - SmartCEM/Alumisoft (parser-smartcem.ts) — cravado 10/06
//   - W.Vetro (parser-wvetro.ts) — cravado 09/06
//
// Saída unificada (`CardImportadoUnificado`) pra que telas/modais não precisem
// saber de qual sistema o PDF veio.
//
// V2: adicionar Diário de Obra (formato Acelerato?), Faktory (futuro).

import {
  parsearTextoWvetro,
  expandirItensEmCards as expandirCardsWvetro,
  extrairTextoDoPdf,
  type CardImportadoWvetro,
  type ClienteWvetro,
  type OrcamentoWvetro,
} from './parser-wvetro'
import {
  parsearTextoSmartCEM,
  expandirItensSmartCEMEmCards,
  ehPdfSmartCEM,
  type CardImportadoSmartCEM,
  type ClienteSmartCEM,
  type OrcamentoSmartCEM,
} from './parser-smartcem'

export type SistemaOrcamento = 'smartcem' | 'wvetro'

/** Card normalizado pra consumo das telas. Não vaza diferenças entre sistemas. */
export interface CardImportadoUnificado {
  sigla: string
  nome: string
  descricao: string
  ambiente: string
  larguraMm: number
  alturaMm: number
}

/** Cliente normalizado (campos comuns entre os dois sistemas). */
export interface ClienteUnificado {
  nome: string | null
  endereco: string | null
}

/** Resultado pronto pras telas. */
export interface OrcamentoUnificado {
  sistema: SistemaOrcamento
  cliente: ClienteUnificado
  numeroItens: number      // Tipos distintos (ex: 14 tipos no PDF do Vitor Wvetro)
  cards: CardImportadoUnificado[] // Já expandido (ex: 47 cards = 1 por unidade)
  // Pra preview detalhado, telas podem usar:
  detalhes: {
    smartcem?: OrcamentoSmartCEM
    wvetro?: OrcamentoWvetro
  }
}

// ============================================================
// DETECÇÃO
// ============================================================

/**
 * Detecta o sistema do PDF pelo texto extraído.
 * Retorna null se não reconhecer.
 */
export function detectarSistema(texto: string): SistemaOrcamento | null {
  if (ehPdfSmartCEM(texto)) return 'smartcem'
  // Heurística Wvetro: tem marcador "DATA ENTREGA" (presente em todos os PDFs Wvetro)
  // ou padrão de tabela específico
  if (/DATA\s+ENTREGA/i.test(texto)) return 'wvetro'
  // Fallback heurístico: padrão de descrição em maiúsculas com TIPO + AMBIENTE específico do Wvetro
  if (/L\.\s*(SUPREMA|GOLD|MASTER)/i.test(texto) && /QTDE/i.test(texto)) return 'wvetro'
  return null
}

// ============================================================
// PARSE COMPLETO (USADO PELAS TELAS)
// ============================================================

/**
 * Pipeline completo: PDF → orçamento parseado + cards expandidos + cliente.
 * Detecta sistema automaticamente. Lança erro descritivo se não reconhecer
 * ou se nenhum item for detectado.
 */
export async function parsearPdfOrcamentoCompleto(
  arquivo: File,
): Promise<OrcamentoUnificado> {
  if (arquivo.size > 10 * 1024 * 1024) {
    throw new Error(
      `Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.`,
    )
  }

  const texto = await extrairTextoDoPdf(arquivo)
  const sistema = detectarSistema(texto)

  // DEBUG TEMPORÁRIO (10/06): loga sempre o texto extraído + sistema detectado.
  // Remover depois do parser SmartCEM/Wvetro estar 100% estável em prod.
  console.info('[parser-orcamento] Sistema detectado:', sistema)
  console.info('[parser-orcamento] Texto extraído (' + texto.length + ' chars):\n' + texto)

  if (!sistema) {
    throw new Error(
      'Formato do PDF não reconhecido. Hoje aceito orçamentos do SmartCEM/Alumisoft e do W.Vetro. Se você usa outro sistema, fala comigo que adiciono.',
    )
  }

  if (sistema === 'wvetro') {
    const orc = parsearTextoWvetro(texto)
    if (orc.itens.length === 0) {
      console.warn('[parser-orcamento] Wvetro detectado mas 0 itens parseados. Cliente:', orc.cliente)
      throw new Error(
        'PDF reconhecido como W.Vetro, mas nenhum item foi identificado. Confere se é o PDF de orçamento completo (com tipo, dimensões e quantidades por item).',
      )
    }
    const cardsWvetro = expandirCardsWvetro(orc.itens)
    return {
      sistema,
      cliente: clienteWvetroParaUnificado(orc.cliente),
      numeroItens: orc.itens.length,
      cards: cardsWvetro.map(cardWvetroParaUnificado),
      detalhes: { wvetro: orc },
    }
  }

  if (sistema === 'smartcem') {
    const orc = parsearTextoSmartCEM(texto)
    if (orc.itens.length === 0) {
      console.warn('[parser-orcamento] SmartCEM detectado mas 0 itens parseados. Cliente:', orc.cliente, 'Proposta:', orc.propostaNumero)
      throw new Error(
        'PDF reconhecido como SmartCEM, mas nenhum item foi identificado. Confere se é o PDF de orçamento completo da proposta.',
      )
    }
    const cardsSmartCEM = expandirItensSmartCEMEmCards(orc.itens)
    return {
      sistema,
      cliente: clienteSmartCEMParaUnificado(orc.cliente),
      numeroItens: orc.itens.length,
      cards: cardsSmartCEM.map(cardSmartCEMParaUnificado),
      detalhes: { smartcem: orc },
    }
  }

  throw new Error('Sistema não suportado: ' + sistema)
}

/** Label amigável pra mostrar nas telas ("PDF do SmartCEM detectado"). */
export function nomeSistema(sistema: SistemaOrcamento): string {
  if (sistema === 'smartcem') return 'SmartCEM / Alumisoft'
  if (sistema === 'wvetro') return 'W.Vetro'
  return sistema
}

// ============================================================
// ADAPTERS — normalização pra tipos unificados
// ============================================================

function clienteWvetroParaUnificado(c: ClienteWvetro): ClienteUnificado {
  return { nome: c.nome, endereco: c.endereco }
}

function clienteSmartCEMParaUnificado(c: ClienteSmartCEM): ClienteUnificado {
  // SmartCEM tem endereco + cidade separados — junta no campo unificado
  const endereco = [c.endereco, c.cidade].filter(Boolean).join(' — ')
  return { nome: c.nome, endereco: endereco || null }
}

function cardWvetroParaUnificado(c: CardImportadoWvetro): CardImportadoUnificado {
  return {
    sigla: c.sigla,
    nome: c.nome,
    descricao: c.descricao,
    ambiente: c.ambiente,
    larguraMm: c.larguraMm,
    alturaMm: c.alturaMm,
  }
}

function cardSmartCEMParaUnificado(c: CardImportadoSmartCEM): CardImportadoUnificado {
  return {
    sigla: c.sigla,
    nome: c.nome,
    descricao: c.descricao,
    ambiente: c.ambiente,
    larguraMm: c.larguraMm,
    alturaMm: c.alturaMm,
  }
}
