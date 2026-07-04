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

  // Tentativa direta (layout WINDOOR/ORÇAMENTO): linha "CLIENTE: <nome> TEL. FIXO:..."
  for (const linha of linhas) {
    const m = linha.match(/CLIENTE\s*:\s*(.+?)(?:\s+TEL\b|\s+CELULAR\b|\s+EMAIL\b|\s+CNPJ\b|$)/i)
    if (m) {
      const cand = m[1].trim()
      if (cand.length > 2 && !/^(CELULAR|TEL|EMAIL|CNPJ|FIXO|RG)\b/i.test(cand)) {
        nomeCandidato = cand
        break
      }
    }
  }

  if (!nomeCandidato) for (const linha of linhas) {
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
  // REFATORADO 10/06/2026 — domínio confirmado pelo Thiago:
  //   "No Wvetro o ITEM é obrigatório, o TIPO é opcional."
  //
  // ANCORA PRIMÁRIA: "*COR PERFIL:". Por que essa e não "ITEM" ou "DATA ENTREGA":
  //   - "ITEM" no PDF do LEMAM aparece sozinho (label vertical); no PDF do
  //     Anderson (ELVIS CALHAS) aparece como header da tabela junto com QTDE,
  //     M2, LARGURA — não é distinguível.
  //   - "DATA ENTREGA: / /" no LEMAM aparece como "/ / DATA ENTREGA:" (ordem
  //     "/" antes); no Anderson aparece como "DATA ENTREGA: / /" (ordem inversa)
  //     porque está lado-a-lado com LINHA: na linha 2-colunas.
  //   - "*COR PERFIL:" aparece exatamente 1x por item nos DOIS PDFs e nunca
  //     em headers de tabela. É a âncora mais estável.
  //
  // Estratégia:
  //   1. Detecta TODAS as ocorrências de "*COR PERFIL:" no texto
  //   2. Cada ocorrência marca um item
  //   3. Bloco do item N vai da ocorrência N-1 (ou início) até a N (exclusive)
  //      OU da ocorrência N até N+1 — usamos meio-a-meio pra capturar contexto
  //      tanto antes quanto depois do label.
  //
  // Variações de layout cobertas:
  //   - LEMAM (Vitor): 1 coluna, TIPO preenchido
  //   - ELVIS CALHAS (Anderson): 2 colunas, TIPO vazio, coluna M2 nova
  //   - Futuras vidraçarias com layouts customizados

  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // ANCORA PRIMÁRIA (adicionada 04/07/2026, demo Windoor/Patrick): "*LOCAL/AMBIENTE:"
  // marca o INÍCIO de cada item e aparece 1x por item em todos os layouts Wvetro
  // (LEMAM, ELVIS, WINDOOR), mesmo com valor vazio (o label continua). Bloco = de
  // um marcador ao próximo (exclusive) → bloco COMPLETO e sem sobreposição
  // (descrição + cor + linha + a linha de dados do MESMO item).
  //
  // Motivo: o layout "ORÇAMENTO" do Windoor punha a linha de dados exatamente no
  // ponto-médio entre âncoras "*COR PERFIL:", que a estratégia antiga cortava fora
  // → 0 itens. Split por "*LOCAL/AMBIENTE:" resolve pra todos os layouts.
  const indicesLocal: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (/\*LOCAL\/AMBIENTE:/i.test(linhas[i])) indicesLocal.push(i)
  }

  if (indicesLocal.length > 0) {
    const itensLocal: ItemWvetro[] = []
    for (let i = 0; i < indicesLocal.length; i++) {
      const inicio = indicesLocal[i]
      const fim = i < indicesLocal.length - 1 ? indicesLocal[i + 1] : linhas.length
      const item = parsearBlocoItemLinhas(linhas.slice(inicio, fim), i + 1)
      if (item) itensLocal.push(item)
    }
    if (itensLocal.length > 0) return itensLocal
    // se não achou item nenhum, cai no fallback (âncora *COR PERFIL) abaixo
  }

  // FALLBACK (layouts sem "*LOCAL/AMBIENTE:"): âncora "*COR PERFIL:" + blocos por
  // ponto-médio (estratégia original cravada 10/06 pra LEMAM/ELVIS).
  const indicesAncora: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (/\*COR\s*PERFIL:/i.test(linhas[i])) indicesAncora.push(i)
  }
  if (indicesAncora.length === 0) return []

  const itens: ItemWvetro[] = []
  for (let i = 0; i < indicesAncora.length; i++) {
    const ancoraAtual = indicesAncora[i]
    const ancoraAnterior = i > 0 ? indicesAncora[i - 1] : -1
    const ancoraProxima = i < indicesAncora.length - 1 ? indicesAncora[i + 1] : linhas.length
    const inicio = ancoraAnterior === -1 ? 0 : Math.floor((ancoraAnterior + ancoraAtual) / 2)
    const fim = Math.floor((ancoraAtual + ancoraProxima) / 2)
    const item = parsearBlocoItemLinhas(linhas.slice(inicio, fim), i + 1)
    if (item) itens.push(item)
  }

  return itens
}

/**
 * Parseia um bloco de item (linhas entre 2 marcadores DATA ENTREGA).
 *
 * REFATORADO 10/06/2026 pra busca anchorada (independente da ordem das linhas).
 * Variações cobertas:
 *   - TIPO vazio (LEMAM tem "TIPO: PA1", ELVIS CALHAS tem "TIPO:" vazio)
 *   - *LOCAL/AMBIENTE vazio
 *   - Layout 1-coluna (LEMAM) OU 2-colunas (ELVIS — vários campos lado-a-lado)
 *   - Coluna M2 nova na tabela (ELVIS)
 *   - "ITEM" + ordem em linhas separadas OU dentro da linha de dados
 *
 * Estratégia: junta TUDO do bloco numa string + lista de linhas, depois busca
 * cada campo INDEPENDENTEMENTE com regex. Sem state machine sequencial.
 */
function parsearBlocoItemLinhas(linhas: string[], ordem: number): ItemWvetro | null {
  // Normaliza linhas (espaços, trim)
  const ls = linhas.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const textoBloco = ls.join('\n')

  // ============ TIPO (código PA1, JA1 ou VAZIO) ============
  // Domínio (Thiago 10/06): No Wvetro, TIPO é OPCIONAL — vidraçarias como a
  // WS VIDROS (Anderson) deixam vazio. A âncora real é ITEM, que já veio
  // resolvida pelo extrairItens. Aqui captura TIPO se vier preenchido.
  let tipo = ''
  const mTipo = textoBloco.match(/TIPO:[ \t]*([A-Z0-9]*)/i)
  if (mTipo) tipo = mTipo[1].trim()

  // ============ *LOCAL/AMBIENTE (pode ser vazio) ============
  // BUG cravado por Anderson 11/06: em PDFs com layout 2-colunas, "LOCAL" e
  // "TIPO" ficam lado-a-lado na mesma linha visual. Com fix XY do pdfjs viram
  // uma string só ("LOCAL/AMBIENTE: ESCRITÓRIO TIPO: J05"). Regex precisa
  // CORTAR antes de "TIPO:" (e outros labels que possam vir lado-a-lado).
  let ambiente = ''
  const mAmb = textoBloco.match(/\*LOCAL\/AMBIENTE:\s*([^\n*]*)/i)
  if (mAmb) {
    ambiente = mAmb[1]
      .replace(/\s+TIPO:.*$/i, '') // corta "TIPO: J05" que vaza da coluna ao lado
      .replace(/\s+\*.*$/, '')      // corta qualquer outro "*CAMPO:" que vaze
      .trim()
  }

  // ============ *COR PERFIL ============
  let corPerfil = ''
  const mCorP = textoBloco.match(/\*COR\s*PERFIL:\s*([A-ZÁÉÍÓÚÂÊÔÃÇ\s/\-]+?)(?=\s*\*|\s*\n|$)/i)
  if (mCorP) corPerfil = mCorP[1].trim()

  // ============ *COR ACESSÓRIO ============
  let corAcessorio = ''
  const mCorA = textoBloco.match(/\*COR\s*ACESS[ÓO]RIO:\s*([A-ZÁÉÍÓÚÂÊÔÃÇ\s/\-]*?)(?=\s*\*|\s*\n|$)/i)
  if (mCorA) corAcessorio = mCorA[1].trim()

  // ============ LINHA do produto (ex: SUPREMA) ============
  // Procura "L. SUPREMA" ou "LINHA: L. SUPREMA"
  let linhaProduto = ''
  const mLinha = textoBloco.match(/L\.\s*([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i)
  if (mLinha) linhaProduto = mLinha[1].toUpperCase()

  // ============ VIDRO ============
  // Busca padrões: "INCOLOR 06MM - TEMPERADO", "INCOLOR 6MM - TEMPERADO",
  // "SEM VIDRO", "BRANCO X 04MM - LAMINADO", etc.
  let vidroDesc = ''
  // Primeiro tenta SEM VIDRO
  if (/\bSEM\s+VIDRO\b/i.test(textoBloco)) {
    vidroDesc = 'SEM VIDRO'
  } else {
    // Extrai SÓ a parte do vidro ("INCOLOR 06MM - TEMPERADO"), ignorando os
    // números de dimensão (WINDOOR: "1 1 1489 1447 INCOLOR 06MM...") e os valores
    // monetários que vêm depois na mesma linha.
    const reVidro = /[A-ZÁÉÍÓÚÂÊÔÃÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÇ]+)*\s+\d+\s*MM\s*-\s*(?:TEMPERADO|LAMINADO|COMUM|FLOAT)/i
    for (const l of ls) {
      const mV = l.match(reVidro)
      if (mV) {
        vidroDesc = mV[0].replace(/\s+/g, ' ').trim()
        break
      }
    }
    // Fallback: qualquer linha com "MM" + cor/tipo (também só a parte do vidro)
    if (!vidroDesc) {
      const reVidro2 = /[A-ZÁÉÍÓÚÂÊÔÃÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÇ]+)*\s+\d+\s*MM(?:\s*-\s*[A-ZÁÉÍÓÚÂÊÔÃÇ]+)?/i
      for (const l of ls) {
        if (/\d+\s*MM/i.test(l) && /(TEMPERADO|LAMINADO|COMUM|FLOAT|INCOLOR)/i.test(l)) {
          const mV = l.match(reVidro2)
          vidroDesc = mV ? mV[0].replace(/\s+/g, ' ').trim() : l
          break
        }
      }
    }
  }

  // ============ DESCRIÇÃO COMPLETA ============
  // Linha com "|" que tem palavras-chave de tipologia. Pode quebrar em 2 linhas
  // (a 2ª linha contém só o nome da linha SUPREMA/GOLD).
  let descricaoCompleta = ''
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i]
    const ehDescr =
      l.includes('|') &&
      /(PORTA|JANELA|MAXIM|FIXO|BASCUL|CORRER|GIRO|ABRIR|PIVOT|BOX|TAMPA|CAIXIL|CALHA|VENTILA|LAMBRI)/i.test(l)
    if (!ehDescr) continue

    descricaoCompleta = l
    // Se a linha termina com "|" sozinho, junta a próxima linha (continuação)
    if (/\|\s*$/.test(descricaoCompleta) && i + 1 < ls.length) {
      const proxima = ls[i + 1]
      if (proxima && /^[A-ZÁÉÍÓÚÂÊÔÃÇ ]+$/i.test(proxima) && proxima.length < 30) {
        descricaoCompleta += ' ' + proxima
      }
    }
    // Limpa a parte depois do último "|" (que é o nome da linha SUPREMA)
    const partes = descricaoCompleta.split('|').map((s) => s.trim())
    if (partes.length > 1) {
      // Junta tudo menos a última (que é a linha de produto, já capturada em linhaProduto)
      descricaoCompleta = partes.slice(0, -1).join(' | ')
    }
    break
  }

  // ============ DIMENSÕES (qtde, largura, altura) ============
  // Linhas comuns:
  //   LEMAM:  "1 2600 2100"       (qtde larg alt)
  //   ELVIS:  "1 1 1,500 1500 1000 INCOLOR 6MM - TEMPERADO 2.800,00 2.800,00"
  //           (item qtde m2 larg alt cor_vidro vlr_un vlr_total)
  // Estratégia: procura 3 números inteiros consecutivos onde 2º e 3º estão na
  // faixa de dimensões (200-30000mm).
  let qtde: number | null = null
  let larguraMm: number | null = null
  let alturaMm: number | null = null

  for (const l of ls) {
    // Skip linhas que são header da tabela
    if (/QTDE|LARGURA|ALTURA|COR.*ESPESSURA|VLR/i.test(l)) continue

    // Padrão LEMAM (3 inteiros separados): "1 2600 2100"
    let m = l.match(/^(\d+)\s+(\d{2,5})\s+(\d{2,5})\b/)
    if (m) {
      const q = parseInt(m[1], 10)
      const lg = parseInt(m[2], 10)
      const al = parseInt(m[3], 10)
      // Valida dimensões plausíveis: largura/altura em mm (200-30000)
      if (lg >= 200 && lg <= 30000 && al >= 200 && al <= 30000 && q > 0 && q < 1000) {
        qtde = q
        larguraMm = lg
        alturaMm = al
        break
      }
    }

    // Padrão ELVIS (linha completa da tabela com M2):
    // "1 1 1,500 1500 1000 INCOLOR..."  ou  "1 1 1500 1000 ..."
    m = l.match(/^\d+\s+(\d+)\s+[\d.,]+\s+(\d{2,5})\s+(\d{2,5})\b/)
    if (m) {
      const q = parseInt(m[1], 10)
      const lg = parseInt(m[2], 10)
      const al = parseInt(m[3], 10)
      if (lg >= 200 && lg <= 30000 && al >= 200 && al <= 30000 && q > 0 && q < 1000) {
        qtde = q
        larguraMm = lg
        alturaMm = al
        break
      }
    }

    // Padrão WINDOOR (Wvetro layout "ORÇAMENTO"): "ITEM QTDE LARGURA ALTURA ..."
    // 4 inteiros, SEM coluna M2. Ex: "1 1 1489 1447 INCOLOR 06MM - TEMPERADO ..."
    // (1º número = ITEM, 2º = QTDE, 3º = largura, 4º = altura). Vem depois dos
    // padrões LEMAM/ELVIS pra só capturar linhas que eles não pegaram.
    m = l.match(/^(\d+)\s+(\d+)\s+(\d{2,5})\s+(\d{2,5})\b/)
    if (m) {
      const q = parseInt(m[2], 10)
      const lg = parseInt(m[3], 10)
      const al = parseInt(m[4], 10)
      if (lg >= 200 && lg <= 30000 && al >= 200 && al <= 30000 && q > 0 && q < 1000) {
        qtde = q
        larguraMm = lg
        alturaMm = al
        break
      }
    }
  }

  // ============ VALIDAÇÃO MÍNIMA ============
  // Pra considerar um bloco válido, precisa pelo menos das dimensões e qtde.
  // Tipo e ambiente podem vir vazios (ELVIS CALHAS). Ordem cai no fallback se
  // não detectada.
  if (qtde === null || larguraMm === null || alturaMm === null) {
    return null
  }

  // Se descrição não foi encontrada, tenta usar a primeira linha "longa em
  // maiúsculas" do bloco como fallback.
  if (!descricaoCompleta) {
    for (const l of ls) {
      if (l.length > 15 && /^[A-ZÁÉÍÓÚÂÊÔÃÇ0-9\s|()/-]+$/i.test(l)) {
        if (/(PORTA|JANELA|MAXIM|FIXO|BASCUL|CORRER|GIRO|ABRIR|PIVOT|BOX|CALHA|TAMPA)/i.test(l)) {
          descricaoCompleta = l.replace(/\|.*$/, '').trim()
          break
        }
      }
    }
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
 *
 * Reconstrói linhas baseado na posição Y do transform de cada item, E ordena
 * items DENTRO de cada linha por posição X.
 *
 * Por que a ordenação por X importa: o pdfjs entrega items na ordem do stream
 * interno do PDF, que não é garantida visual esquerda→direita. Em PDFs com
 * tabelas (ex: SmartCEM), o stream pode estar em ordem por coluna, embaralhando
 * o texto reconstruído. Bug histórico cravado em 10/06: SmartCEM entregava
 * "Tipo: Linha: L: H: Qtd:" em vez de "Tipo: Qtd: L: H: Linha:".
 *
 * Fix: agrupa items por linha (Y), depois ordena por X (transform[4]) antes
 * de concatenar. Funciona pra qualquer PDF (não muda o output do Wvetro).
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

    // Agrupa items por linha (mesmo Y, com tolerância de 2pt)
    type Item = { str: string; x: number; y: number }
    const items: Item[] = (textContent.items as Array<{ str: string; transform: number[] }>).map(
      (it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }),
    )

    // Bucket por Y arredondado pra agrupar linhas visualmente similares
    const linhasBuckets: Map<number, Item[]> = new Map()
    for (const item of items) {
      // Arredonda Y pra inteiro pra tolerar pequenas variações
      const yKey = Math.round(item.y)
      // Procura bucket existente com Y próximo (tolerância 2pt)
      let bucketKey = yKey
      for (const k of linhasBuckets.keys()) {
        if (Math.abs(k - yKey) <= 2) {
          bucketKey = k
          break
        }
      }
      const arr = linhasBuckets.get(bucketKey) ?? []
      arr.push(item)
      linhasBuckets.set(bucketKey, arr)
    }

    // Ordena buckets por Y descrescente (PDF tem Y crescente de baixo pra cima)
    const yOrdenados = Array.from(linhasBuckets.keys()).sort((a, b) => b - a)

    const linhas: string[] = []
    for (const y of yOrdenados) {
      const itensLinha = linhasBuckets.get(y)!
      // Ordena items DENTRO da linha por X crescente (esquerda → direita)
      itensLinha.sort((a, b) => a.x - b.x)
      const texto = itensLinha
        .map((it) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (texto) linhas.push(texto)
    }

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
