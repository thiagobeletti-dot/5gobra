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
  // ATUALIZADO 09/06/2026 com base no texto REAL extraído pelo pdfjs-dist.
  // O pdfjs lê PDFs por posição (Y depois X), então labels e valores aparecem
  // em ordens não-óbvias. Heurística que funciona com o orçamento Wvetro:
  // o nome do cliente aparece num padrão "NOME - CIDADE" em linha solta,
  // tipicamente antes do label "CLIENTE:" (que vem com valor confuso da tabela).
  //
  // Ex: "LEMAM - ARAÇATUBA" em linha própria, antes de "CLIENTE: CELULAR TEL. FIXO:"

  // 1ª tentativa: padrão NOME - CIDADE em linha solta (maiúsculas, separador " - ")
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let nomeCandidato: string | null = null

  for (const linha of linhas) {
    // Pula linhas que claramente NÃO são nome de cliente
    if (/^(CEP|EMAIL|TEL|CLIENTE|CNPJ|ENDEREÇO|TIPO|ITEM|VLR|QTDE|LINHA|L\.|RUA|AV|\*)/i.test(linha)) continue
    // Pula linhas que começam com pontuação, ano, hora
    if (/^[,.\d/]/.test(linha)) continue
    // Padrão: TEXTO MAIÚSCULO - TEXTO MAIÚSCULO (sem outros caracteres)
    const m = linha.match(/^([A-ZÁÉÍÓÚÂÊÔÃÇ&\s.]{2,})\s+-\s+([A-ZÁÉÍÓÚÂÊÔÃÇ\s]{2,})$/)
    if (m) {
      nomeCandidato = linha
      break
    }
  }

  // Endereço fica complicado por causa do layout do pdfjs (campos misturados);
  // deixa null em V1. CEP só se vier num formato muito claro.
  const cepClienteMatch = texto.match(/CEP:\s*([0-9]{5}-?[0-9]{3})/)

  return {
    nome: nomeCandidato,
    endereco: null,
    cep: cepClienteMatch?.[1]?.trim() || null,
  }
}

// ============================================================
// EXTRATOR DE ITENS — coração do parser
// ============================================================

function extrairItens(texto: string): ItemWvetro[] {
  // ATUALIZADO 09/06/2026 com base no texto REAL do pdfjs-dist (não como eu
  // imaginei na 1ª versão). O pdfjs entrega ordem visual top-down, e cada
  // item tem estrutura previsível em ~15 linhas. Estratégia: state machine
  // linha a linha, ao invés de regex em texto contínuo.
  //
  // Padrão real de um item (verificado em produção com PDF do Vitor):
  //
  //   / / DATA ENTREGA:           ← MARCADOR de início de item
  //   TIPO:   <codigo>             ← código (PA1, PA2, JA1, etc — pode ser vazio)
  //   <ordem>                       ← número do item (1, 2, 3...)
  //   ITEM
  //   <vlr_unit>   <vlr_total>      ← valores (DESCARTADOS — só marcador)
  //   *LOCAL/AMBIENTE:   <texto>
  //   *COR PERFIL:   <cor>
  //   <vidro_desc>                  ← "INCOLOR 06MM - TEMPERADO" ou "SEM VIDRO"
  //   <cor_acessorio>               ← geralmente "BRANCO"
  //   <descricao> | <linha>         ← pode quebrar em 2 linhas se descrição longa
  //   L. <linha>
  //   *COR ACESSÓRIO:
  //   LINHA:
  //   QTDE.   LARGURA:   ALTURA:   COR E ESPESSURA   VLR. TOTAL
  //   <qtde>   <larg>   <alt>
  //   VLR. UNIT.

  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const itens: ItemWvetro[] = []
  let bloco: string[] = []
  let dentroDeItem = false

  for (const linha of linhas) {
    if (/^\/\s*\/\s*DATA ENTREGA:/i.test(linha)) {
      // Início de novo item — fecha o anterior se houver
      if (dentroDeItem && bloco.length > 0) {
        const item = parsearBlocoItemLinhas(bloco)
        if (item) itens.push(item)
      }
      bloco = []
      dentroDeItem = true
      continue
    }
    if (dentroDeItem) {
      bloco.push(linha)
    }
  }
  // Fecha último bloco
  if (dentroDeItem && bloco.length > 0) {
    const item = parsearBlocoItemLinhas(bloco)
    if (item) itens.push(item)
  }

  return itens
}

/**
 * Parseia um bloco de item (lista de linhas entre 2 marcadores DATA ENTREGA).
 * Usa state machine pra extrair os campos na ordem que aparecem no PDF do Wvetro.
 */
function parsearBlocoItemLinhas(linhas: string[]): ItemWvetro | null {
  let tipo = ''
  let ordem: number | null = null
  let vlrEncontrado = false
  let ambiente = ''
  let corPerfil = ''
  let vidroDesc = ''
  let corAcessorio = ''
  let descricaoBuffer = ''
  let descricaoCompleta = ''
  let linhaProduto = ''
  let qtde: number | null = null
  let larguraMm: number | null = null
  let alturaMm: number | null = null

  type Estado =
    | 'tipo'
    | 'ordem'
    | 'item'
    | 'valores'
    | 'ambiente'
    | 'corPerfil'
    | 'vidro'
    | 'corAcessorio'
    | 'descricao'
    | 'linhaProduto'
    | 'qtdeLabel'
    | 'dimensoes'
    | 'fim'

  let estado: Estado = 'tipo'

  for (const linha of linhas) {
    // Normaliza espaços múltiplos pra um só
    const l = linha.replace(/\s+/g, ' ').trim()

    if (estado === 'tipo' && /^TIPO:/i.test(l)) {
      tipo = l.replace(/^TIPO:/i, '').trim()
      estado = 'ordem'
      continue
    }
    if (estado === 'ordem' && /^\d+$/.test(l)) {
      ordem = parseInt(l, 10)
      estado = 'item'
      continue
    }
    if (estado === 'item' && /^ITEM$/i.test(l)) {
      estado = 'valores'
      continue
    }
    if (estado === 'valores' && /[\d.]+,\d{2}.*[\d.]+,\d{2}/.test(l)) {
      // Linha "4.245,74   4.245,74" — descarta valores, só marca passagem
      vlrEncontrado = true
      estado = 'ambiente'
      continue
    }
    if (estado === 'ambiente' && /^\*LOCAL\/AMBIENTE:/i.test(l)) {
      ambiente = l.replace(/^\*LOCAL\/AMBIENTE:/i, '').trim()
      estado = 'corPerfil'
      continue
    }
    if (estado === 'corPerfil' && /^\*COR PERFIL:/i.test(l)) {
      corPerfil = l.replace(/^\*COR PERFIL:/i, '').trim()
      estado = 'vidro'
      continue
    }
    if (estado === 'vidro') {
      // Linha solta — pode ser "INCOLOR 06MM - TEMPERADO", "SEM VIDRO", etc
      vidroDesc = l
      estado = 'corAcessorio'
      continue
    }
    if (estado === 'corAcessorio') {
      // Linha solta — geralmente "BRANCO"
      corAcessorio = l
      estado = 'descricao'
      continue
    }
    if (estado === 'descricao') {
      // Caso 1: linha "L. SUPREMA" — encerra descrição. Cravado 09/06 após
      // bug em prod: state machine ficava preso em 'descricao' acumulando
      // linhas indefinidamente porque o check de "L." estava fora do bloco.
      const lMatch = l.match(/^L\.\s*([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i)
      if (lMatch) {
        if (!linhaProduto) linhaProduto = lMatch[1]
        if (!descricaoCompleta && descricaoBuffer) {
          descricaoCompleta = descricaoBuffer
        }
        estado = 'qtdeLabel'
        continue
      }

      // Caso 2: linha contém "|" — descrição + linha de produto na mesma linha
      // ou descrição quebrada (termina com "|" sem linha de produto)
      if (l.includes('|')) {
        const [desc, lp] = l.split('|').map((s) => s.trim())
        if (desc) descricaoCompleta = desc
        if (lp) {
          // "PORTA DE GIRO ... | SUPREMA" — tudo numa linha
          linhaProduto = lp
          estado = 'qtdeLabel'
        } else {
          // "PORTA DE GIRO ... |" sozinho — próxima linha é a linha do produto
          estado = 'linhaProduto'
        }
        continue
      }

      // Caso 3: linha sem "|" e sem "L." — acumula no buffer (descrição longa
      // que pode vir em múltiplas linhas antes do "|")
      if (descricaoBuffer) {
        descricaoBuffer += ' ' + l
      } else {
        descricaoBuffer = l
      }
      continue
    }

    if (estado === 'linhaProduto') {
      // Vem após "PORTA DE GIRO ... |" sozinho. Próxima linha (ex: "SUPREMA")
      // é a linha de produto. Aí vem o "L. SUPREMA" que cai em qtdeLabel.
      linhaProduto = l
      estado = 'qtdeLabel'
      continue
    }

    // Fora do estado 'descricao' — "L. SUPREMA" como fallback (caso raríssimo
    // de chegar aqui sem ter passado pelo if interno acima)
    if (/^L\.\s*([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i.test(l)) {
      const m = l.match(/^L\.\s*([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i)
      if (m && !linhaProduto) linhaProduto = m[1]
      estado = 'qtdeLabel'
      continue
    }
    if (estado === 'qtdeLabel' && /^QTDE\./i.test(l)) {
      estado = 'dimensoes'
      continue
    }
    if (estado === 'dimensoes') {
      // Linha "1 2600 2100" — qtde, largura, altura
      const m = l.match(/^(\d+)\s+(\d+)\s+(\d+)/)
      if (m) {
        qtde = parseInt(m[1], 10)
        larguraMm = parseInt(m[2], 10)
        alturaMm = parseInt(m[3], 10)
        estado = 'fim'
        continue
      }
    }
  }

  if (!vlrEncontrado || ordem === null || qtde === null || larguraMm === null || alturaMm === null) {
    return null
  }

  // Se descrição ficou no buffer mas não foi finalizada com "|", usa o buffer
  if (!descricaoCompleta && descricaoBuffer) {
    descricaoCompleta = descricaoBuffer
  }

  return {
    ordem,
    tipo,
    ambiente,
    descricaoCompleta,
    tipologia: inferirTipologia(descricaoCompleta),
    linha: linhaProduto,
    corPerfil,
    corAcessorio,
    qtde,
    larguraMm,
    alturaMm,
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

// ============================================================
// EXTRAÇÃO DE TEXTO DO PDF — usa pdfjs-dist (browser)
// Centralizado aqui pra ser reusado por ImportarOrcamento + ImportarItens
// ============================================================

/**
 * Extrai texto bruto de um arquivo PDF usando pdfjs-dist no browser.
 * Reconstrói linhas baseado na posição Y do transform de cada item.
 */
export async function extrairTextoDoPdf(arquivo: File): Promise<string> {
  // Import dinâmico pra split do bundle
  const pdfjs = await import('pdfjs-dist')

  // Worker via CDN (necessário pro pdfjs funcionar em browser).
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

  const buffer = await arquivo.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise

  const partes: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const textContent = await pagina.getTextContent()
    const linhas: string[] = []
    let linhaAtual = ''
    let yAnterior: number | null = null

    // Reconstrói linhas: itens com mesma altura Y são da mesma linha visual.
    for (const item of textContent.items as Array<{ str: string; transform: number[] }>) {
      const y = item.transform[5]
      if (yAnterior !== null && Math.abs(y - yAnterior) > 2) {
        linhas.push(linhaAtual)
        linhaAtual = ''
      }
      linhaAtual += (linhaAtual ? ' ' : '') + item.str
      yAnterior = y
    }
    if (linhaAtual) linhas.push(linhaAtual)

    partes.push(linhas.join('\n'))
  }

  return partes.join('\n')
}

/**
 * Pipeline completo: PDF → orçamento parseado + cards expandidos.
 * Lança erro descritivo se nenhum item for detectado.
 */
export async function parsearPdfWvetroCompleto(
  arquivo: File,
): Promise<{ orcamento: OrcamentoWvetro; cards: CardImportadoWvetro[] }> {
  if (arquivo.size > 10 * 1024 * 1024) {
    throw new Error(
      `Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.`,
    )
  }
  const texto = await extrairTextoDoPdf(arquivo)
  const orcamento = parsearTextoWvetro(texto)
  if (orcamento.itens.length === 0) {
    console.warn('[parser-wvetro] Nenhum item encontrado. Texto extraído:', texto)
    throw new Error(
      'Nenhum item identificado no PDF. Confere se é o PDF de orçamento completo com tipo, dimensões e quantidades por item.',
    )
  }
  const cards = expandirItensEmCards(orcamento.itens)
  return { orcamento, cards }
}
