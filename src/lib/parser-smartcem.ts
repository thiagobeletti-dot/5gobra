// Parser de PDF do SmartCEM/Alumisoft (sistema de orçamento de esquadrias)
//
// Cravado em 10/06/2026 após Thiago testar com PDF real da própria Fábrica
// da Esquadria (gerado pelo SmartCEM). Adiciona suporte ao 2º sistema mais
// usado no nicho, complementando o parser Wvetro de 09/06.
//
// ============== O QUE FAZ ==============
// Recebe TEXTO extraído de PDF do SmartCEM (já passou por pdfjs-dist)
// e retorna estrutura tipada com:
//   - Metadados (proposta nº, cliente, obra, endereço)
//   - Lista de ITENS de esquadria com tipologia, dimensões, cor, vidro, linha
//
// ============== FORMATO DO PDF SmartCEM ==============
// O SmartCEM gera PDFs com estrutura tabular MAIS LIMPA que o Wvetro:
//
//   PORTA DE CORRER - 2 FOLHAS - LINHA SUPREMA
//   Cor: PINTURA PRETO FOSCO - RAL9005F
//   Vidros: Temperado de 6 mm incolor
//   Localização: <ambiente>
//   Tipo: Qtd: L: H: Linha: Valor (un.): Valor Total:
//     1    1   2000   2100   SUPREMA   R$ 5.024,53   R$ 5.024,53
//
// Cabeçalho fixo: "SmartCEM - Alumisoft Sistemas"
// Cliente: linha "Cliente: <nome>"
//
// ============== NÃO FAZ ==============
// - Extração do PDF binário (compartilhada com parser-wvetro: extrairTextoDoPdf)
// - Valores monetários (decisão Thiago 09/06: G Obra é gestão, não financeiro)

export type TipologiaSmartCEM = 'giro' | 'correr' | 'maxim_ar' | 'fixo' | 'bascula' | 'desconhecida'
export type TipoVidroSmartCEM = 'comum' | 'temperado' | 'laminado' | 'mineboreal' | 'outros' | 'sem_vidro'

export interface VidroItemSmartCEM {
  descricaoBruta: string         // Ex: "Temperado de 6 mm incolor"
  tipo: TipoVidroSmartCEM
  espessuraMm: number | null     // Ex: 6
  cor: string | null             // Ex: "incolor"
  semVidro: boolean
}

export interface ItemSmartCEM {
  ordem: number                  // Posição no orçamento (1, 2, 3...) — uso interno/fallback
  tipo: string                   // Valor da coluna "Tipo" do orçamento (ex: "CA01") — vira a sigla
  descricaoCompleta: string      // Ex: "PORTA DE CORRER - 2 FOLHAS - LINHA SUPREMA"
  tipologia: TipologiaSmartCEM   // Inferida da descrição
  linha: string                  // "LINHA SUPREMA" → "SUPREMA"
  corPerfil: string              // "PINTURA PRETO FOSCO - RAL9005F"
  ambiente: string               // Localização (frequentemente vazio no SmartCEM)
  qtde: number                   // Quantas peças desse tipo
  larguraMm: number              // Em mm
  alturaMm: number               // Em mm
  vidro: VidroItemSmartCEM
}

export interface ClienteSmartCEM {
  nome: string | null            // "VITOR 3A"
  endereco: string | null
  cidade: string | null
}

export interface OrcamentoSmartCEM {
  propostaNumero: string | null  // "26-06-2318"
  obra: string | null            // "ESQUADRIAS"
  cliente: ClienteSmartCEM
  itens: ItemSmartCEM[]
  textoOriginal: string          // Pra debug
}

// ============================================================
// DETECÇÃO
// ============================================================

/**
 * Heurística pra confirmar que é PDF do SmartCEM.
 * Roteador `parser-orcamento.ts` usa antes de chamar este parser.
 */
export function ehPdfSmartCEM(texto: string): boolean {
  return /SmartCEM|Alumisoft\s+Sistemas/i.test(texto)
}

// ============================================================
// PARSE PRINCIPAL
// ============================================================

/**
 * Parseia texto bruto extraído de PDF do SmartCEM em estrutura tipada.
 *
 * Estratégia:
 * 1. Extrai metadados do cabeçalho (Proposta Nº, Obra, Cliente)
 * 2. Divide o texto em blocos por marcador "Tipo:\s+Qtd:\s+L:\s+H:\s+Linha:" (header da tabela)
 * 3. Pra cada bloco anterior ao header, captura descrição + Cor + Vidros + Localização
 * 4. Da linha de dados (logo após o header), captura tipo/qtd/L/H/linha
 * 5. Infere tipologia (giro/correr/maxim_ar/fixo/bascula) pela descrição
 */
export function parsearTextoSmartCEM(texto: string): OrcamentoSmartCEM {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)

  // ----- Metadados -----
  const propostaNumero = extrairCampo(linhas, /^Proposta\s+N[ºo°]?\s*:?\s*(.+)$/i)
  const obra = extrairCampo(linhas, /^Obra\s*:\s*(.+)$/i)
  const cliente = extrairCliente(linhas)

  // ----- Itens -----
  const itens = extrairItens(linhas)

  return {
    propostaNumero,
    obra,
    cliente,
    itens,
    textoOriginal: texto,
  }
}

function extrairCampo(linhas: string[], regex: RegExp): string | null {
  for (const l of linhas) {
    const m = l.match(regex)
    if (m) return m[1].trim() || null
  }
  return null
}

function extrairCliente(linhas: string[]): ClienteSmartCEM {
  // SmartCEM tem layout fixo:
  //   Cliente: VITOR 3A                Contato:
  //   Endereço Obra: ,                 Telefone:
  //   Cidade: /                        E-mail:
  let nome: string | null = null
  let endereco: string | null = null
  let cidade: string | null = null

  for (const l of linhas) {
    // Captura "Cliente: <nome>" e descarta o que vier depois (Contato:, etc)
    if (!nome) {
      const m = l.match(/Cliente\s*:\s*([^|]+?)(?:\s+(?:Contato|CPF)\s*:|$)/i)
      if (m && m[1].trim()) nome = limparTexto(m[1])
    }
    if (!endereco) {
      const m = l.match(/Endere[çc]o\s+Obra\s*:\s*([^|]+?)(?:\s+Telefone\s*:|$)/i)
      if (m) {
        const e = limparTexto(m[1])
        // Endereço vazio costuma vir como "," — filtra
        if (e && e !== ',' && e !== '/') endereco = e
      }
    }
    if (!cidade) {
      const m = l.match(/Cidade\s*:\s*([^|]+?)(?:\s+E-?mail\s*:|$)/i)
      if (m) {
        const c = limparTexto(m[1])
        if (c && c !== '/' && c !== ',') cidade = c
      }
    }
  }

  return { nome, endereco, cidade }
}

function limparTexto(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// ============================================================
// EXTRAÇÃO DE ITENS
// ============================================================

/**
 * Acha cada bloco de item rastreando linha "Tipo: Qtd: L: H: Linha: ..." que
 * funciona como âncora. Linhas ACIMA do header trazem a descrição/cor/vidro;
 * a linha LOGO ABAIXO traz tipo/qtd/dimensões/linha.
 */
function extrairItens(linhas: string[]): ItemSmartCEM[] {
  // Encontra todos os índices das linhas-header da tabela
  const headerRegex = /^Tipo\s*:\s+Qtd\s*:\s+L\s*:\s+H\s*:\s+Linha\s*:/i
  const indicesHeader: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (headerRegex.test(linhas[i])) indicesHeader.push(i)
  }

  if (indicesHeader.length === 0) return []

  const itens: ItemSmartCEM[] = []

  for (let i = 0; i < indicesHeader.length; i++) {
    const idxHeader = indicesHeader[i]
    const idxAnterior = i > 0 ? indicesHeader[i - 1] + 2 : 0 // 2 = pula header e linha de dados anterior
    const idxDados = idxHeader + 1

    // Linhas do bloco de descrição vão de idxAnterior até idxHeader - 1
    const bloco = linhas.slice(idxAnterior, idxHeader)
    const linhaDados = linhas[idxDados] ?? ''

    const item = parsearItem(bloco, linhaDados, i + 1)
    if (item) itens.push(item)
  }

  return itens
}

function parsearItem(bloco: string[], linhaDados: string, ordemFallback: number): ItemSmartCEM | null {
  // ----- Linha de dados: "1   1   2000   2100   SUPREMA   R$ 5.024,53   R$ 5.024,53"
  // Captura: tipo, qtd, L, H, linha. Valores (R$) ignorados.
  // Tipo pode ser número ou string curta. Linha é texto antes do " R$"
  // (lookahead — não consome). Bug histórico (10/06): `[^R$]` excluía a letra
  // R individualmente, matando palavras como "SUPREMA". Fix: lazy `.+?` + " R$".
  const dadosMatch = linhaDados.match(
    /^\s*(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s+R\$/i,
  )
  if (!dadosMatch) return null

  const ordem = parseInt(dadosMatch[1], 10) || ordemFallback
  const tipo = limparTexto(dadosMatch[1]) // "CA01", "1", etc — vira a sigla
  const qtde = parseInt(dadosMatch[2], 10) || 1
  const larguraMm = parseInt(dadosMatch[3], 10) || 0
  const alturaMm = parseInt(dadosMatch[4], 10) || 0
  const linha = limparTexto(dadosMatch[5])

  // ----- Bloco de descrição -----
  // Filtra ruído (QRCode, paginação, etc)
  const linhasDescricao = bloco.filter((l) => {
    if (/Use seu smartphone|QRCode|Realidade Aumentada/i.test(l)) return false
    if (/^\d+\/\d+$/.test(l)) return false // "2/5", "3/5"
    if (/^SmartCEM|^FABRICA DA|^www\.|WhatsApp/i.test(l)) return false
    if (/^Proposta|^Obra|^Cliente|^Endere[çc]o|^Cidade|^Contato|^Telefone|^E-?mail/i.test(l)) return false
    return true
  })

  // Descrição: primeira linha "real" antes de "Cor:", "Vidros:" ou "Localização:"
  let descricaoCompleta = ''
  let corPerfil = ''
  let vidroBruto = ''
  let ambiente = ''

  // Linhas do cabeçalho da proposta (só aparecem no bloco do 1º item, que começa no
  // topo do PDF) e rodapé de página → RESETAM o acumulador, descartando tudo que vem
  // ANTES do título da esquadria. Assim o 1º item não puxa "Proposta/Cliente/Obra/...".
  const reRuidoCabecalho = /^(End\.|Emitido\s+por|Prazo|Validade|[ÁA]rea\b|Obra\b|-+$)/i
  const reNumOuPagina = /^\d{2,}-\d{2,}-\d{2,}$|\d+\s*\/\s*\d+\s*$/

  let acumuladorDescricao = ''
  for (const l of linhasDescricao) {
    // "Cor:" OU "Acabamento:" (o SmartCEM usa Acabamento) fecham a descrição.
    if (/^(Cor|Acabamento)\s*:/i.test(l)) {
      if (acumuladorDescricao && !descricaoCompleta) descricaoCompleta = acumuladorDescricao
      acumuladorDescricao = ''
      const m = l.match(/^(?:Cor|Acabamento)\s*:\s*(.+)$/i)
      if (m) corPerfil = limparTexto(m[1])
      continue
    }
    if (/^Vidros?\s*:/i.test(l)) {
      const m = l.match(/^Vidros?\s*:\s*(.+)$/i)
      if (m) vidroBruto = limparTexto(m[1])
      continue
    }
    if (/^Localiza[çc][aã]o\s*:/i.test(l)) {
      const m = l.match(/^Localiza[çc][aã]o\s*:\s*(.+)$/i)
      if (m) ambiente = limparTexto(m[1])
      continue
    }
    // Ruído de cabeçalho/rodapé → descarta o acumulado (fica só o título).
    if (reRuidoCabecalho.test(l) || reNumOuPagina.test(l)) {
      acumuladorDescricao = ''
      continue
    }
    // Linha de descrição (pode estar quebrada em 2): acumula
    acumuladorDescricao = acumuladorDescricao
      ? `${acumuladorDescricao} ${l}`
      : l
  }

  // Se ainda não capturou a descrição, usa o acumulado (caso bloco só tenha descrição)
  if (!descricaoCompleta) descricaoCompleta = acumuladorDescricao

  // Substitui placeholder "%MODULOS%" pela qtde (ex: "MAXIM-AR %MODULOS% FOLHA(S)" → "MAXIM-AR 2 FOLHA(S)")
  if (descricaoCompleta.includes('%MODULOS%')) {
    descricaoCompleta = descricaoCompleta.replace(/%MODULOS%/g, String(qtde))
  }

  return {
    ordem,
    tipo,
    descricaoCompleta: limparTexto(descricaoCompleta),
    tipologia: inferirTipologia(descricaoCompleta),
    linha,
    corPerfil,
    ambiente,
    qtde,
    larguraMm,
    alturaMm,
    vidro: parsearVidro(vidroBruto),
  }
}

// ============================================================
// INFERÊNCIAS
// ============================================================

function inferirTipologia(descricao: string): TipologiaSmartCEM {
  const d = descricao.toUpperCase()
  if (/MAXIM[-\s]?AR/.test(d)) return 'maxim_ar'
  if (/B[ÁA]SCULA/.test(d)) return 'bascula'
  if (/CORRER/.test(d)) return 'correr'
  if (/GIRO|ABRIR|ABERTURA/.test(d)) return 'giro'
  if (/FIXO/.test(d)) return 'fixo'
  return 'desconhecida'
}

function parsearVidro(bruto: string): VidroItemSmartCEM {
  if (!bruto || /sem vidro/i.test(bruto)) {
    return {
      descricaoBruta: bruto,
      tipo: 'sem_vidro',
      espessuraMm: null,
      cor: null,
      semVidro: true,
    }
  }

  // Ex: "Temperado de 6 mm incolor"
  // Ex: "Mineboreal de 4 mm incolor"
  // Ex: "Comum Liso de 6 mm (Float) incolor"
  // Ex: "Laminado 8 mm 4+4 incolor"
  const tipoMatch = bruto.match(/^([A-Za-zÁÉÍÓÚÂÊÔÃÇ\s]+?)\s+(?:de\s+)?(\d+)\s*mm/i)
  let tipo: TipoVidroSmartCEM = 'outros'
  let espessuraMm: number | null = null
  if (tipoMatch) {
    const tipoBruto = tipoMatch[1].toUpperCase().trim()
    espessuraMm = parseInt(tipoMatch[2], 10) || null
    if (/TEMPERAD/.test(tipoBruto)) tipo = 'temperado'
    else if (/LAMINAD/.test(tipoBruto)) tipo = 'laminado'
    else if (/MINEBOREAL/.test(tipoBruto)) tipo = 'mineboreal'
    else if (/COMUM|LISO|FLOAT/.test(tipoBruto)) tipo = 'comum'
  }

  // Cor: última palavra (incolor / verde / fume / etc)
  const corMatch = bruto.match(/\b(incolor|verde|fum[eê]|bronze|reflecta|reflexiv[oa]|fosco)\b/i)
  const cor = corMatch ? corMatch[1].toLowerCase() : null

  return {
    descricaoBruta: bruto,
    tipo,
    espessuraMm,
    cor,
    semVidro: false,
  }
}

// ============================================================
// EXPANSÃO DE ITENS EM CARDS
// ============================================================

export interface CardImportadoSmartCEM {
  sigla: string
  nome: string
  descricao: string
  ambiente: string
  larguraMm: number
  alturaMm: number
  tipologia: TipologiaSmartCEM
  corPerfil: string
  corVidro: string | null
  espessuraMm: number | null
  tipoVidro: TipoVidroSmartCEM
}

/**
 * Cada item com qtde N vira N cards individuais (1 por unidade).
 * Mesma estratégia do parser-wvetro.
 */
export function expandirItensSmartCEMEmCards(itens: ItemSmartCEM[]): CardImportadoSmartCEM[] {
  const cards: CardImportadoSmartCEM[] = []

  for (const item of itens) {
    for (let i = 0; i < item.qtde; i++) {
      const sufixo = item.qtde > 1 ? ` (${i + 1}/${item.qtde})` : ''
      const baseSigla = item.tipo || `T${item.ordem}` // usa o "Tipo" do orçamento (ex: CA01); fallback T{ordem}
      const sigla = item.qtde > 1 ? `${baseSigla}-${i + 1}` : baseSigla
      const nome = nomeCurtoDoItem(item)
      cards.push({
        sigla,
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
 * Ex: "PORTA DE CORRER - 2 FOLHAS - LINHA SUPREMA" → "Porta de Correr 2 Folhas"
 */
function nomeCurtoDoItem(item: ItemSmartCEM): string {
  const desc = item.descricaoCompleta
  if (!desc) return `Tipo ${item.ordem}`

  // Remove "- LINHA SUPREMA" e similar
  const semLinha = desc.replace(/\s*-\s*LINHA\s+[A-ZÁÉÍÓÚÂÊÔÃÇ\s]+$/i, '').trim()
  // Pega só primeira parte antes de qualquer "(" ou ":"
  const compacto = semLinha.split(/[\(\:]/)[0].trim()
  return formatarTitulo(compacto)
}

function formatarTitulo(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(De|Do|Da|Com|E|Em|Pra)\b/g, (c) => c.toLowerCase())
}
