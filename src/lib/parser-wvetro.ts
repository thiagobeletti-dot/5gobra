// Parser de PDF do W.Vetro (sistema de orçamento de esquadrias)
//
// Cravado em 09/06/2026 após análise de PDF real do Vitor/Windoor Esquadrias
// na reunião da Campanha 2. Wvetro tem ~5.000 empresas no Brasil — mercado
// endereçável 5x maior que CEM. Importação fácil é o principal bloqueador
// pra cliente Wvetro virar cliente 5G.
//
// ============== O QUE FAZ ==============
// Recebe TEXTO extraído de PDF do W.Vetro (já passou por pdfjs-dist ou similar)
// e retorna estrutura tipada com:
//   - Metadados do orçamento (cliente, fornecedor, número, data, valor)
//   - Lista de ITENS de esquadria com tipologia, dimensões, cor, vidro
//
// ============== NÃO FAZ ==============
// - Extração do PDF binário (separação de responsabilidades: extração é em
//   outro arquivo via pdfjs-dist no browser ou pdf-parse no edge)
// - Lista de materiais brutos (perfis, parafusos) — Wvetro só exporta orçamento
//   no PDF; materiais ficam no sistema deles (acessível só via API ou backend)
//
// ============== EVOLUÇÃO V2 ==============
// - Tolerar variações de layout entre versões/clientes Wvetro
// - Detectar e separar "kit" vs "item simples" (alguns PDFs têm sub-itens)
// - Integração via API Wvetro (quando equipe deles liberar)

export type TipologiaWvetro = 'giro' | 'correr' | 'maxim_ar' | 'fixo' | 'desconhecida'
export type TipoVidroWvetro = 'comum' | 'temperado' | 'laminado' | 'outros' | 'sem_vidro'

export interface VidroItem {
  descricaoBruta: string         // Ex: "INCOLOR 06MM - TEMPERADO"
  tipo: TipoVidroWvetro
  espessuraMm: number | null     // Ex: 6
  cor: string | null             // Ex: "INCOLOR"
  semVidro: boolean
}

export interface ItemWvetro {
  ordem: number                  // Posição no orçamento (1, 2, 3...) — uso interno
  tipo: string                   // Código do tipo (PA1, PA2, JA1, JA3, PA07...)
  ambiente: string               // Local/ambiente onde vai (ex: "ACESSO REFEITÓRIO")
  descricaoCompleta: string      // Texto inteiro (ex: "PORTA DE GIRO 02 FOLHAS COM VIDRO SUPERIOR E VENEZIANA INFERIOR")
  tipologia: TipologiaWvetro     // Inferida da descrição
  linha: string                  // "L. SUPREMA" → "SUPREMA"
  corPerfil: string              // "BRANCO"
  corAcessorio: string           // "BRANCO"
  qtde: number                   // Quantas peças desse item (cada uma vira 1 card no G Obra)
  larguraMm: number              // Em mm
  alturaMm: number               // Em mm
  vidro: VidroItem
}

export interface ClienteWvetro {
  nome: string | null            // "LEMAM - ARAÇATUBA"
  endereco: string | null
  cep: string | null
}

export interface OrcamentoWvetro {
  cliente: ClienteWvetro
  itens: ItemWvetro[]
  textoOriginal: string          // Pra debug
}

// ============================================================
// PARSE PRINCIPAL
// ============================================================

/**
 * Parseia texto bruto extraído de PDF do W.Vetro em estrutura tipada.
 *
 * Estratégia:
 * 1. Extrai metadados do cabeçalho (regex em padrões fixos)
 * 2. Divide o texto em blocos por marcador "DATA ENTREGA: / /"
 * 3. Pra cada bloco, extrai os campos do item via state machine + regex
 * 4. Infere tipologia (giro/correr/maxim_ar/fixo) pela descrição
 * 5. Infere tipo de vidro (temperado/comum/laminado) pela descrição do vidro
 *
 * Robusto a:
 *   - Quebras de linha aleatórias (texto extraído de PDF tem espaços e \n imprevisíveis)
 *   - Itens sem TIPO ou sem ambiente preenchido
 *   - "SEM VIDRO" como variante de cor/espessura
 */
export function parsearTextoWvetro(texto: string): OrcamentoWvetro {
  const cliente = extrairCliente(texto)
  const itens = extrairItens(texto)

  return {
    cliente,
    itens,
    textoOriginal: texto,
  }
}

// ============================================================
// EXTRATORES DE CABEÇALHO
// ============================================================

function extrairCliente(texto: string): ClienteWvetro {
  // Padrão: "CLIENTE: LEMAM - ARAÇATUBA"
  const nomeMatch = texto.match(/CLIENTE:\s*([^\n\r]+?)(?:\s*TEL\.|\s*$)/m)
  // Endereço aparece depois de "ENDEREÇO:"
  const endMatch = texto.match(/ENDEREÇO:\s*([^\n\r]*?)(?:\s*IE\/RG:|$)/m)
  // CEP cliente vem em "CEP: - <cidade>/<UF> -"
  const cepClienteMatch = texto.match(/CEP:\s*([0-9]{8}|[^\n\r]*?-\s*[A-ZÁÉÍÓÚÂÊÔÃÇ]+\/[A-Z]{2})/)

  return {
    nome: nomeMatch?.[1]?.trim() || null,
    endereco: endMatch?.[1]?.trim() || null,
    cep: cepClienteMatch?.[1]?.trim() || null,
  }
}

// ============================================================
// EXTRATOR DE ITENS — coração do parser
// ============================================================

function extrairItens(texto: string): ItemWvetro[] {
  // Divide o texto em blocos por "DATA ENTREGA: / /" (marcador de início de item)
  // Cada bloco contém um item completo.
  const blocos = texto.split(/DATA ENTREGA:\s*\/\s*\/\s*/i).slice(1)
  // O primeiro split é "antes do primeiro DATA ENTREGA" = cabeçalho. Pula com slice(1).

  const itens: ItemWvetro[] = []

  for (const bloco of blocos) {
    const item = parsearBlocoItem(bloco)
    if (item) itens.push(item)
  }

  return itens
}

function parsearBlocoItem(bloco: string): ItemWvetro | null {
  // Padrões esperados (em qualquer ordem, dentro do bloco):
  //   TIPO: <codigo>     (PA1, PA2, JA1, JA3, PA07, etc — código de tipologia)
  //   <ordem>            (1, 2, 3... número do item)
  //   ITEM
  //   <vlr_unit> <vlr_total>
  //   *LOCAL/AMBIENTE: <texto>
  //   *COR PERFIL: <cor>
  //   <vidro_descricao>  (linha solta — INCOLOR 06MM - TEMPERADO / SEM VIDRO / MINI-BOREAL 04MM - COMUM)
  //   <cor_acessorio>
  //   <descricao_esquadria> | <linha>
  //   L. <linha>
  //   QTDE. LARGURA: ALTURA: COR E ESPESSURA VLR. TOTAL
  //   <qtde> <largura> <altura>

  const tipoMatch = bloco.match(/TIPO:\s*([A-Z0-9]*)/i)
  const ambienteMatch = bloco.match(/\*LOCAL\/AMBIENTE:\s*([^\n\r*]+?)(?:\s*\*|\n|$)/i)
  const corPerfilMatch = bloco.match(/\*COR PERFIL:\s*([A-ZÁÉÍÓÚÂÊÔÃÇ\s]+?)(?:\s*\*|\n|$)/i)
  const linhaMatch = bloco.match(/L\.\s*([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i)
  const ordemEValoresMatch = bloco.match(/(\d+)\s*\n\s*ITEM\s*\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})/)

  // Qtde + largura + altura: padrão "1 2600 2100" ou "4 1000 2100"
  // Aparece DEPOIS de "QTDE. LARGURA: ALTURA:..."
  const dimsMatch = bloco.match(/QTDE\.[^\n]*\n\s*(\d+)\s+(\d+)\s+(\d+)/i)

  // Descrição da esquadria: aparece antes de "| SUPREMA" (ou outra linha)
  // Pode quebrar em duas linhas no PDF — capturamos até ver "| LINHA" ou "L. LINHA"
  const descMatch = bloco.match(/([A-ZÁÉÍÓÚÂÊÔÃÇ0-9°º ]+(?:GIRO|CORRER|MAXIM-?AR|FIXO|JANELA|PORTA)[A-ZÁÉÍÓÚÂÊÔÃÇ0-9°º ]+)\s*\|\s*([A-ZÁÉÍÓÚÂÊÔÃÇ\s]+)/i)

  // Cor/espessura do vidro: linha solta entre "*COR PERFIL: X" e "<cor_acessorio>"
  // Padrão típico: "INCOLOR 06MM - TEMPERADO" ou "SEM VIDRO" ou "MINI-BOREAL 04MM - COMUM"
  const vidroMatch = bloco.match(/\*COR PERFIL:[^\n]*\n\s*([A-ZÁÉÍÓÚÂÊÔÃÇ0-9 \-]+)\s*\n/i)

  // Cor acessório: linha solta após cor/espessura (geralmente "BRANCO")
  const corAcessorioMatch = bloco.match(/\*COR ACESSÓRIO:[^\n]*\n[\s\S]*?(?:\n([A-ZÁÉÍÓÚÂÊÔÃÇ]+)\s*\n[A-ZÁÉÍÓÚÂÊÔÃÇ0-9 ]+\|)/i)

  if (!ordemEValoresMatch || !dimsMatch) {
    // Bloco sem ordem/valores ou sem dimensões = sucata. Possivelmente é o rodapé.
    // Nota: regex de valores é usada APENAS como âncora pra identificar o início
    // do bloco — os valores em si são descartados (G Obra não armazena dados
    // financeiros do orçamento).
    return null
  }

  const ordem = parseInt(ordemEValoresMatch[1], 10)
  const qtde = parseInt(dimsMatch[1], 10)
  const larg = parseInt(dimsMatch[2], 10)
  const alt = parseInt(dimsMatch[3], 10)

  const descricaoCompleta = (descMatch?.[1] ?? '').trim()
  const linha = (descMatch?.[2] ?? linhaMatch?.[1] ?? '').trim()
  const vidroDesc = (vidroMatch?.[1] ?? '').trim()

  return {
    ordem,
    tipo: tipoMatch?.[1]?.trim() ?? '',
    ambiente: ambienteMatch?.[1]?.trim() ?? '',
    descricaoCompleta,
    tipologia: inferirTipologia(descricaoCompleta),
    linha,
    corPerfil: corPerfilMatch?.[1]?.trim() ?? '',
    corAcessorio: corAcessorioMatch?.[1]?.trim() ?? '',
    qtde,
    larguraMm: larg,
    alturaMm: alt,
    vidro: parsearVidro(vidroDesc),
  }
}

// ============================================================
// INFERÊNCIAS — descrição → tipologia / cor → tipo vidro
// ============================================================

function inferirTipologia(descricao: string): TipologiaWvetro {
  const desc = descricao.toUpperCase()
  // Ordem importa: MAXIM-AR antes de PORTA/JANELA pra capturar primeiro
  if (desc.includes('MAXIM') || desc.includes('BASCULANTE')) return 'maxim_ar'
  if (desc.includes('CORRER') || desc.includes('CORRER')) return 'correr'
  if (desc.includes('GIRO') || desc.includes('PIVOT') || desc.includes('ABRIR')) return 'giro'
  if (desc.includes('FIXO') || desc.includes('FIXA')) return 'fixo'
  return 'desconhecida'
}

function parsearVidro(descricao: string): VidroItem {
  const desc = descricao.toUpperCase().trim()

  if (!desc || desc.includes('SEM VIDRO') || desc === 'BRANCO') {
    return {
      descricaoBruta: desc || 'SEM VIDRO',
      tipo: 'sem_vidro',
      espessuraMm: null,
      cor: null,
      semVidro: true,
    }
  }

  // Tipo de vidro
  let tipo: TipoVidroWvetro = 'outros'
  if (desc.includes('TEMPERADO')) tipo = 'temperado'
  else if (desc.includes('LAMINADO')) tipo = 'laminado'
  else if (desc.includes('COMUM') || desc.includes('FLOAT')) tipo = 'comum'

  // Espessura (busca padrão "06MM", "08MM", "4MM", "4 MM", etc)
  const espMatch = desc.match(/(\d+)\s*MM/)
  const espessuraMm = espMatch ? parseInt(espMatch[1], 10) : null

  // Cor: tudo antes do número de espessura (ou tudo antes de "- TEMPERADO/COMUM/etc")
  let cor: string | null = null
  if (espMatch) {
    cor = desc.split(espMatch[0])[0].trim().replace(/-$/, '').trim()
  }
  if (!cor) {
    // Tenta capturar primeira palavra antes de hífen
    const corMatch = desc.match(/^([A-ZÁÉÍÓÚÂÊÔÃÇ-]+)/)
    cor = corMatch?.[1]?.trim() ?? null
  }

  return {
    descricaoBruta: desc,
    tipo,
    espessuraMm,
    cor,
    semVidro: false,
  }
}

// ============================================================
// HELPERS
// ============================================================

function parseNumeroBR(s: string): number {
  // "4.245,74" → 4245.74
  const limpo = s.replace(/\./g, '').replace(',', '.')
  return parseFloat(limpo)
}

// ============================================================
// HELPERS DE EXPORTAÇÃO — converte itens em "cards" pro G Obra
// ============================================================

export interface CardImportadoWvetro {
  sigla: string                  // Tipo do PDF (PA1, JA1, etc) — pode reusar como sigla
  nome: string                   // Descrição curta ("Porta de giro 2 folhas")
  descricao: string              // Linha completa do orçamento + ambiente + dimensões
  ambiente: string
  larguraMm: number
  alturaMm: number
  tipologia: TipologiaWvetro
  corPerfil: string
  corVidro: string | null
  espessuraMm: number | null
  tipoVidro: TipoVidroWvetro
}

/**
 * Converte itens parseados em N cards (1 por unidade da quantidade).
 * Ex: Item "PA2, qtde=4" vira 4 cards independentes.
 *
 * Útil pra G Obra: cada peça vira card individual com seu próprio ciclo
 * de medição, instalação e aceite.
 */
export function expandirItensEmCards(itens: ItemWvetro[]): CardImportadoWvetro[] {
  const cards: CardImportadoWvetro[] = []

  for (const item of itens) {
    for (let i = 0; i < item.qtde; i++) {
      const sufixo = item.qtde > 1 ? ` (${i + 1}/${item.qtde})` : ''
      const sigla = item.tipo || `IT${item.ordem}`
      const nome = nomeCurtoDoItem(item)
      cards.push({
        sigla: item.qtde > 1 ? `${sigla}-${i + 1}` : sigla,
        nome: `${nome}${sufixo}`,
        descricao: [
          item.descricaoCompleta,
          item.linha ? `Linha: ${item.linha}` : '',
          item.ambiente ? `Local: ${item.ambiente}` : '',
          `Dimensões: ${item.larguraMm}×${item.alturaMm}mm`,
          item.vidro.semVidro ? 'Sem vidro' : item.vidro.descricaoBruta,
          item.corPerfil ? `Cor perfil: ${item.corPerfil}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        ambiente: item.ambiente,
        larguraMm: item.larguraMm,
        alturaMm: item.alturaMm,
        tipologia: item.tipologia,
        corPerfil: item.corPerfil,
        corVidro: item.vidro.cor,
        espessuraMm: item.vidro.espessuraMm,
        tipoVidro: item.vidro.tipo,
      })
    }
  }

  return cards
}

/**
 * Resume a descrição longa em 1-3 palavras pra exibir como nome do card.
 * Ex: "PORTA DE GIRO 02 FOLHAS COM VIDRO SUPERIOR E VENEZIANA INFERIOR"
 *     → "Porta de giro 2 folhas"
 */
function nomeCurtoDoItem(item: ItemWvetro): string {
  const desc = item.descricaoCompleta
  if (!desc) return `Item ${item.ordem}`

  // Pega só as primeiras palavras significativas
  const match = desc.match(/^([A-ZÁÉÍÓÚÂÊÔÃÇ\s\d]+?(?:GIRO|CORRER|MAXIM-?AR|FIXO|FOLHAS?)\s*(?:\d+\s*FOLHAS?)?)/i)
  if (match) {
    return formatarTitulo(match[1].trim())
  }
  return formatarTitulo(desc.split(/com|para/i)[0].trim())
}

function formatarTitulo(s: string): string {
  // CAPITALIZA-TUDO → Capitaliza só Primeira Letra
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(De|Do|Da|Com|E|Em|Pra)\b/g, (c) => c.toLowerCase())
}
