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
  parsearTextoWvetroV2,
  expandirItensWvetroV2EmCards,
  ehPdfWvetroV2,
  type CardImportadoWvetroV2,
  type ClienteWvetroV2,
  type OrcamentoWvetroV2,
} from './parser-wvetro-v2'
import {
  parsearTextoSmartCEM,
  expandirItensSmartCEMEmCards,
  ehPdfSmartCEM,
  type CardImportadoSmartCEM,
  type ClienteSmartCEM,
  type OrcamentoSmartCEM,
} from './parser-smartcem'
import {
  parsearTextoInvictos,
  expandirItensInvictosEmCards,
  ehPdfInvictos,
  type CardImportadoInvictos,
  type ClienteInvictos,
  type OrcamentoInvictos,
} from './parser-invictos'

export type SistemaOrcamento = 'smartcem' | 'wvetro' | 'wvetro-v2' | 'invictos'

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
    wvetroV2?: OrcamentoWvetroV2
    invictos?: OrcamentoInvictos
  }
}

// ============================================================
// DETECÇÃO
// ============================================================

/**
 * Detecta o sistema do PDF pelo texto extraído.
 * Retorna null se não reconhecer.
 *
 * Ordem importa — sistemas mais específicos antes (Wvetro V2 antes do V1 antigo,
 * porque V2 tem marcador único; SmartCEM antes de tudo).
 */
export function detectarSistema(texto: string): SistemaOrcamento | null {
  if (ehPdfSmartCEM(texto)) return 'smartcem'
  if (ehPdfInvictos(texto)) return 'invictos'
  // Wvetro V2 (novo): assinatura única "© Wvetro" + header "Tipo: Qtd: M2: L: H:"
  if (ehPdfWvetroV2(texto)) return 'wvetro-v2'
  // Wvetro V1 (antigo): marcadores típicos do impresso tradicional
  if (/DATA\s+ENTREGA/i.test(texto)) return 'wvetro'
  if (/\*COR\s*PERFIL:/i.test(texto)) return 'wvetro'
  if (/L\.\s*(SUPREMA|GOLD|MASTER)/i.test(texto) && /QTDE/i.test(texto)) return 'wvetro'
  // Fallback: tem o rodapé do Wvetro mas não casou outros
  if (/w\.?vetro\s+sistema/i.test(texto)) return 'wvetro'
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

  if (!sistema) {
    console.warn('[parser-orcamento] Sistema não reconhecido. Texto extraído:', texto.slice(0, 500))
    throw new Error(
      'Formato do PDF não reconhecido. Hoje aceito orçamentos do SmartCEM/Alumisoft e do W.Vetro. Se você usa outro sistema, fala comigo que adiciono.',
    )
  }

  if (sistema === 'wvetro') {
    const orc = parsearTextoWvetro(texto)
    if (orc.itens.length === 0) {
      console.warn('[parser-orcamento] Wvetro V1 detectado mas 0 itens parseados. Cliente:', orc.cliente)
      console.info('[parser-orcamento] ============ TEXTO EXTRAÍDO ============')
      console.info(texto)
      console.info('[parser-orcamento] ============ FIM TEXTO (', texto.length, 'chars) ============')
      throw new Error(
        'PDF reconhecido como W.Vetro (versão antiga), mas nenhum item foi identificado. Abre o console (F12 → Console) e copia o texto que aparece — me manda no chat pra eu calibrar.',
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

  if (sistema === 'wvetro-v2') {
    const orc = parsearTextoWvetroV2(texto)
    if (orc.itens.length === 0) {
      console.warn('[parser-orcamento] Wvetro V2 detectado mas 0 itens parseados. Cliente:', orc.cliente, 'Proposta:', orc.propostaNumero)
      console.info('[parser-orcamento] ============ TEXTO EXTRAÍDO ============')
      console.info(texto)
      console.info('[parser-orcamento] ============ FIM TEXTO (', texto.length, 'chars) ============')
      throw new Error(
        'PDF reconhecido como W.Vetro (versão nova), mas nenhum item foi identificado. Abre o console (F12 → Console) e copia o texto — me manda pra calibrar.',
      )
    }
    const cardsV2 = expandirItensWvetroV2EmCards(orc.itens)
    return {
      sistema,
      cliente: clienteWvetroV2ParaUnificado(orc.cliente),
      numeroItens: orc.itens.length,
      cards: cardsV2.map(cardWvetroV2ParaUnificado),
      detalhes: { wvetroV2: orc },
    }
  }

  if (sistema === 'invictos') {
    const orc = parsearTextoInvictos(texto)
    if (orc.itens.length === 0) {
      console.warn('[parser-orcamento] Invictos detectado mas 0 itens parseados. Cliente:', orc.cliente, 'Proposta:', orc.propostaNumero)
      console.info('[parser-orcamento] ============ TEXTO EXTRAÍDO ============')
      console.info(texto)
      console.info('[parser-orcamento] ============ FIM TEXTO (', texto.length, 'chars) ============')
      throw new Error(
        'PDF reconhecido como Invictos Vidros, mas nenhum item foi identificado. Abre o console (F12 → Console) e copia o texto — me manda pra calibrar.',
      )
    }
    const cardsInv = expandirItensInvictosEmCards(orc.itens)
    return {
      sistema,
      cliente: clienteInvictosParaUnificado(orc.cliente),
      numeroItens: orc.itens.length,
      cards: cardsInv.map(cardInvictosParaUnificado),
      detalhes: { invictos: orc },
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
  if (sistema === 'wvetro') return 'W.Vetro (clássico)'
  if (sistema === 'wvetro-v2') return 'W.Vetro'
  if (sistema === 'invictos') return 'Invictos Vidros'
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

function clienteWvetroV2ParaUnificado(c: ClienteWvetroV2): ClienteUnificado {
  // Wvetro V2 separa endereço + cidade — junta no campo unificado
  const endereco = [c.endereco, c.cidade].filter(Boolean).join(' — ')
  return { nome: c.nome, endereco: endereco || null }
}

function cardWvetroV2ParaUnificado(c: CardImportadoWvetroV2): CardImportadoUnificado {
  return {
    sigla: c.sigla,
    nome: c.nome,
    descricao: c.descricao,
    ambiente: c.ambiente,
    larguraMm: c.larguraMm,
    alturaMm: c.alturaMm,
  }
}

function clienteInvictosParaUnificado(c: ClienteInvictos): ClienteUnificado {
  const endereco = [c.obra, c.cidade].filter(Boolean).join(' — ')
  return { nome: c.nome, endereco: endereco || null }
}

function cardInvictosParaUnificado(c: CardImportadoInvictos): CardImportadoUnificado {
  return {
    sigla: c.sigla,
    nome: c.nome,
    descricao: c.descricao,
    ambiente: c.ambiente,
    larguraMm: c.larguraMm,
    alturaMm: c.alturaMm,
  }
}
