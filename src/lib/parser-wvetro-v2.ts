// Parser de PDF do Wvetro V2 (geração nova/moderna).
//
// Cravado em 10/06/2026 após Anderson (primeiro cliente) testar com PDF
// "Herculis 3508.pdf" — versão NOVA do Wvetro que gera propostas com layout
// de cards visuais (imagem do desenho + tabela tabular limpa). MUITO diferente
// do PDF "antigo" (LEMAM/ELVIS CALHAS) que o parser-wvetro.ts trata.
//
// ============== O QUE FAZ ==============
// Recebe TEXTO extraído de PDF do Wvetro V2 (já passou por pdfjs-dist)
// e retorna estrutura tipada com:
//   - Metadados (proposta nº, cliente, endereço)
//   - Lista de ITENS de esquadria — layout uniforme, 8 linhas por item
//
// ============== FORMATO DO PDF Wvetro V2 ==============
// Rodapé fixo: "© Wvetro - Sistema para Vidraçarias e Serralherias"
// Início: "Proposta NNNN"
// Cliente: linha "Cliente: <nome>"
//
// Por item (8 linhas):
//   NOME_TIPOLOGIA | LINHA_PRODUTO         (ex: "JANELA DE CORRER 02 FOLHAS MÓVEIS | SUPREMA")
//   Perfil: COR
//   Acessórios: COR
//   Vidro: DESCRIÇÃO_VIDRO                  (pode ser vazio em alguns itens)
//   Localização: AMBIENTE
//   <ORDEM>                                  (ex: "1" sozinho)
//   Tipo: Qtd: M2: L: H: Vlr Unt: Vlr Total: (header da tabela)
//   <tipo> <qtd> <m2> <largura> <altura> <vlr_un> <vlr_tot>
//                                            (tipo costuma ser vazio; restante numérico)
//
// ============== NÃO FAZ ==============
// - Extração do PDF binário (compartilhada com parser-wvetro: extrairTextoDoPdf)
// - Valores monetários (decisão Thiago 09/06: G Obra é gestão, não financeiro)

export type TipologiaWvetroV2 =
  | 'giro'
  | 'correr'
  | 'maxim_ar'
  | 'fixo'
  | 'bascula'
  | 'box'
  | 'desconhecida'

export type TipoVidroWvetroV2 =
  | 'comum'
  | 'temperado'
  | 'laminado'
  | 'refletivo'
  | 'outros'
  | 'sem_vidro'

export interface VidroItemWvetroV2 {
  descricaoBruta: string
  tipo: TipoVidroWvetroV2
  espessuraMm: number | null
  cor: string | null
  semVidro: boolean
}

export interface ItemWvetroV2 {
  ordem: number
  descricaoCompleta: string
  tipologia: TipologiaWvetroV2
  linha: string                    // "SUPREMA", "BOX ELEGANCE", "CHROMA", "LINHA 30"
  corPerfil: string
  corAcessorio: string
  ambiente: string
  qtde: number
  larguraMm: number
  alturaMm: number
  vidro: VidroItemWvetroV2
}

export interface ClienteWvetroV2 {
  nome: string | null
  endereco: string | null
  cidade: string | null
}

export interface OrcamentoWvetroV2 {
  propostaNumero: string | null
  cliente: ClienteWvetroV2
  itens: ItemWvetroV2[]
  textoOriginal: string
}

// ============================================================
// DETECÇÃO
// ============================================================

/**
 * Heurística pra confirmar que é Wvetro V2.
 * Roteador `parser-orcamento.ts` chama antes de parsear.
 */
export function ehPdfWvetroV2(texto: string): boolean {
  // V2 tem rodapé "© Wvetro - Sistema para Vidraçarias" E header de tabela
  // "Tipo: Qtd: M2: L: H:" — assinatura única.
  const temRodape = /©\s*Wvetro\s*-?\s*Sistema/i.test(texto)
  const temHeaderTabelaV2 = /Tipo:\s*Qtd:\s*M2:\s*L:\s*H:/i.test(texto)
  return temRodape && temHeaderTabelaV2
}

// ============================================================
// PARSE PRINCIPAL
// ============================================================

/**
 * Parseia texto bruto extraído de PDF do Wvetro V2 em estrutura tipada.
 *
 * Estratégia: detecta blocos pelo header "Tipo: Qtd: M2: L: H:" (presente
 * 1x por item, sem ambiguidade com outros campos). Pra cada bloco, captura
 * os campos pela busca de labels específicos ("Perfil:", "Vidro:", etc).
 */
export function parsearTextoWvetroV2(texto: string): OrcamentoWvetroV2 {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  // ----- Metadados -----
  const propostaNumero = extrairProposta(linhas)
  const cliente = extrairCliente(linhas)
  const itens = extrairItens(linhas)

  return {
    propostaNumero,
    cliente,
    itens,
    textoOriginal: texto,
  }
}

function extrairProposta(linhas: string[]): string | null {
  for (const l of linhas) {
    const m = l.match(/Proposta\s+(\d+)/i)
    if (m) return m[1]
  }
  return null
}

function extrairCliente(linhas: string[]): ClienteWvetroV2 {
  let nome: string | null = null
  let endereco: string | null = null
  let cidade: string | null = null

  for (const l of linhas) {
    if (!nome) {
      // "Cliente: HÉRCULES BARBIERI" ou "Cliente: HÉRCULES BARBIERI Endereço: ..."
      const m = l.match(/Cliente\s*:\s*([^|]+?)(?:\s+Endere[çc]o\s*:|\s+Telefone\s*:|$)/i)
      if (m && m[1].trim()) nome = m[1].trim()
    }
    if (!endereco) {
      const m = l.match(/Endere[çc]o\s+Obra\s*:\s*([^|]+?)(?:\s+Cidade\s*:|$)/i)
      if (m) {
        const e = m[1].trim()
        if (e && e !== ',' && e !== '/') endereco = e
      }
    }
    if (!cidade) {
      const m = l.match(/Cidade\s*:\s*([^|]+?)(?:\s+Vendedor\s*:|\s+Telefone\s*:|$)/i)
      if (m) {
        const c = m[1].trim()
        if (c && c !== '/' && c !== ',') cidade = c
      }
    }
  }

  return { nome, endereco, cidade }
}

// ============================================================
// EXTRAÇÃO DE ITENS
// ============================================================

function extrairItens(linhas: string[]): ItemWvetroV2[] {
  // Acha índices da linha-header da tabela "Tipo: Qtd: M2: L: H:"
  const reHeader = /^Tipo:\s*Qtd:\s*M2:\s*L:\s*H:/i
  const indicesHeader: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (reHeader.test(linhas[i])) indicesHeader.push(i)
  }

  if (indicesHeader.length === 0) return []

  const itens: ItemWvetroV2[] = []
  for (let i = 0; i < indicesHeader.length; i++) {
    const idxHeader = indicesHeader[i]
    // Bloco: do header ANTERIOR + 2 (pulando ele e seus dados) até o header atual
    const inicio = i === 0 ? 0 : indicesHeader[i - 1] + 2
    // Linha de dados é logo após o header atual
    const idxDados = idxHeader + 1
    const blocoAntes = linhas.slice(inicio, idxHeader)
    const linhaDados = linhas[idxDados] ?? ''
    const item = parsearItem(blocoAntes, linhaDados, i + 1)
    if (item) itens.push(item)
  }

  return itens
}

function parsearItem(
  blocoAntes: string[],
  linhaDados: string,
  ordemFallback: number,
): ItemWvetroV2 | null {
  // ----- Linha de dados: "1 2.608 1380 1890 435,65 435,65"
  // Estrutura: <tipo?> <qtd> <m2> <larg> <alt> <vlr_un> <vlr_tot>
  // No PDF do Anderson, Tipo é vazio, então temos 6 valores:
  //   qtd m2 larg alt vlr_un vlr_tot
  // Em outros PDFs pode ter Tipo preenchido com código alfanumérico.
  //
  // Captura:
  //   - qtd: inteiro
  //   - m2: decimal (pode ter . como separador decimal)
  //   - larg, alt: inteiros (200-30000)
  //   - vlr_un, vlr_tot: decimais com vírgula
  //
  // Estratégia: encontra "qtd m2 L H" via padrão "1+ 0-3-dígitos.OU(dígitos) número número"
  // onde L e H estão na faixa de mm.

  let qtde: number | null = null
  let larguraMm: number | null = null
  let alturaMm: number | null = null

  // Tenta padrão 1: <qtd> <m2_decimal> <larg> <alt> <resto>
  // m2 pode ser "1" ou "2.608" ou "13.25" ou "3"
  let m = linhaDados.match(/^(\d+)\s+(\d+(?:\.\d+)?)\s+(\d{2,5})\s+(\d{2,5})\b/)
  if (m) {
    const q = parseInt(m[1], 10)
    const lg = parseInt(m[3], 10)
    const al = parseInt(m[4], 10)
    if (lg >= 200 && lg <= 30000 && al >= 200 && al <= 30000 && q > 0 && q < 1000) {
      qtde = q
      larguraMm = lg
      alturaMm = al
    }
  }

  // Padrão 2: com Tipo preenchido — começa com texto/código alfanumérico
  if (qtde === null) {
    m = linhaDados.match(/^(\S+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d{2,5})\s+(\d{2,5})\b/)
    if (m) {
      const q = parseInt(m[2], 10)
      const lg = parseInt(m[4], 10)
      const al = parseInt(m[5], 10)
      if (lg >= 200 && lg <= 30000 && al >= 200 && al <= 30000 && q > 0 && q < 1000) {
        qtde = q
        larguraMm = lg
        alturaMm = al
      }
    }
  }

  if (qtde === null || larguraMm === null || alturaMm === null) return null

  // ----- Bloco de descrição -----
  // Filtra ruído: rodapé, números de página, dados do cabeçalho da empresa
  const linhasDescricao = blocoAntes.filter((l) => {
    if (/^©|Wvetro\s*-/i.test(l)) return false
    if (/^\d+\s*\/\s*\d+$/.test(l)) return false // "1 / 6"
    if (/^WS VIDROS|^Proposta\s+\d/i.test(l)) return false
    if (/vidracariawsna@|@gmail\.com/i.test(l)) return false
    if (/^\(\d{2}\)\d/.test(l)) return false // telefones
    if (/^(Cliente|Endere[çc]o|Telefone|Email|CNPJ|IE\/RG|Obra|Contato|Vendedor|Cidade|Dt\.Proposta)\s*:/i.test(l)) return false
    if (/Lista de vari[áa]veis|POSI[ÇC][ÃA]O|V[ÃA]O SUPERIOR|CANTONEIRA|DOBRADI[ÇC]A|VIS[ÃA]O DA TIPOLOGIA/i.test(l)) return false
    return true
  })

  let descricaoCompleta = ''
  let linhaProduto = ''
  let corPerfil = ''
  let corAcessorio = ''
  let vidroBruto = ''
  let ambiente = ''

  let acumuladorDescricao = ''
  let descricaoFinalizada = false

  for (const l of linhasDescricao) {
    // Perfil: PRETO
    const mPerfil = l.match(/^Perfil\s*:\s*(.+)$/i)
    if (mPerfil) {
      if (!descricaoFinalizada && acumuladorDescricao) {
        finalizarDescricao(acumuladorDescricao)
        descricaoFinalizada = true
      }
      corPerfil = mPerfil[1].trim()
      continue
    }
    // Acessórios: PRETO
    const mAcess = l.match(/^Acess[óo]rios\s*:\s*(.+)$/i)
    if (mAcess) {
      corAcessorio = mAcess[1].trim()
      continue
    }
    // Vidro: INCOLOR 06MM - TEMPERADO   (pode ter ":" e vir vazio)
    const mVidro = l.match(/^Vidro\s*:\s*(.*)$/i)
    if (mVidro) {
      vidroBruto = mVidro[1].trim()
      continue
    }
    // Localização: SUÍTE
    const mLoc = l.match(/^Localiza[çc][ãa]o\s*:\s*(.+)$/i)
    if (mLoc) {
      ambiente = mLoc[1].trim()
      continue
    }
    // Número solo (ordem do item) — ignora pra descrição
    if (/^\d+$/.test(l)) continue
    // Linha de descrição — acumula
    acumuladorDescricao = acumuladorDescricao ? `${acumuladorDescricao} ${l}` : l
  }

  function finalizarDescricao(s: string): void {
    // Separa "DESCRIÇÃO | LINHA" — última parte é a linha do produto
    const partes = s.split('|').map((p) => p.trim())
    if (partes.length > 1) {
      linhaProduto = partes[partes.length - 1]
      descricaoCompleta = partes.slice(0, -1).join(' | ').trim()
    } else {
      descricaoCompleta = s.trim()
    }
  }

  if (!descricaoFinalizada && acumuladorDescricao) {
    finalizarDescricao(acumuladorDescricao)
  }

  // Fallback: se descrição vazia, tenta primeira linha do bloco
  if (!descricaoCompleta && linhasDescricao.length > 0) {
    finalizarDescricao(linhasDescricao[0])
  }

  return {
    ordem: ordemFallback,
    descricaoCompleta,
    tipologia: inferirTipologia(descricaoCompleta),
    linha: linhaProduto,
    corPerfil,
    corAcessorio,
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

function inferirTipologia(descricao: string): TipologiaWvetroV2 {
  const d = descricao.toUpperCase()
  if (/MAXIM[-\s]?AR/.test(d)) return 'maxim_ar'
  if (/BASCULA(NTE)?/.test(d)) return 'bascula'
  if (/\bBOX\b/.test(d)) return 'box'
  if (/CORRER/.test(d)) return 'correr'
  if (/GIRO|ABRIR/.test(d)) return 'giro'
  if (/FIXO/.test(d)) return 'fixo'
  return 'desconhecida'
}

function parsearVidro(bruto: string): VidroItemWvetroV2 {
  if (!bruto || /^sem\s+vidro$/i.test(bruto.trim())) {
    return {
      descricaoBruta: bruto || 'SEM VIDRO',
      tipo: 'sem_vidro',
      espessuraMm: null,
      cor: null,
      semVidro: !bruto || /sem vidro/i.test(bruto),
    }
  }

  const u = bruto.toUpperCase()

  let tipo: TipoVidroWvetroV2 = 'outros'
  if (/TEMPERAD/.test(u)) tipo = 'temperado'
  else if (/LAMINAD/.test(u)) tipo = 'laminado'
  else if (/REFLETIV/.test(u)) tipo = 'refletivo'
  else if (/COMUM|FLOAT|LISO/.test(u)) tipo = 'comum'

  const mEsp = bruto.match(/(\d+)\s*MM/i)
  const espessuraMm = mEsp ? parseInt(mEsp[1], 10) : null

  // Cor: tudo antes do "<n>MM" (ex: "INCOLOR", "REFLETIVO CINZA", "FUMÊ")
  let cor: string | null = null
  if (mEsp) {
    cor = bruto.split(mEsp[0])[0].trim().replace(/-\s*$/, '').trim()
  }
  if (!cor) {
    const corMatch = bruto.match(/^([A-ZÁÉÍÓÚÂÊÔÃÇ\s]+?)\s*\d/i)
    cor = corMatch?.[1]?.trim() ?? null
  }

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

export interface CardImportadoWvetroV2 {
  sigla: string
  nome: string
  descricao: string
  ambiente: string
  larguraMm: number
  alturaMm: number
  tipologia: TipologiaWvetroV2
  corPerfil: string
  corAcessorio: string
  corVidro: string | null
  espessuraMm: number | null
  tipoVidro: TipoVidroWvetroV2
}

export function expandirItensWvetroV2EmCards(itens: ItemWvetroV2[]): CardImportadoWvetroV2[] {
  const cards: CardImportadoWvetroV2[] = []

  for (const item of itens) {
    for (let i = 0; i < item.qtde; i++) {
      const sufixo = item.qtde > 1 ? ` (${i + 1}/${item.qtde})` : ''
      const baseSigla = `IT${item.ordem}`
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
        corAcessorio: item.corAcessorio,
        corVidro: item.vidro.cor,
        espessuraMm: item.vidro.espessuraMm,
        tipoVidro: item.vidro.tipo,
      })
    }
  }

  return cards
}

function nomeCurtoDoItem(item: ItemWvetroV2): string {
  const desc = item.descricaoCompleta
  if (!desc) return `Item ${item.ordem}`
  // Pega primeira parte antes de "(" ou ":"
  const compacto = desc.split(/[\(\:]/)[0].trim()
  return formatarTitulo(compacto)
}

function formatarTitulo(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(De|Do|Da|Com|E|Em|Pra|Ou)\b/g, (c) => c.toLowerCase())
}
