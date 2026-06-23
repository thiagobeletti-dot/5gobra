// Parser de PDF do Sistema Invictos Vidros (sistema regional usado em
// vidraçarias do Centro-Oeste/MS — site: www.invictos.com.br).
//
// Cravado em 11/06/2026 após Cristiano (MS VIDROS, Maracaju) querer fechar
// como cliente HOJE. Ele tinha apresentado o sistema em 10/06 mas não
// importação. Recebemos 5 arquivos pra calibrar (2 PDFs + 2 XLS + 1 DOC) —
// todos no MESMO template Invictos, mudando só formato de saída.
//
// ============== FORMATO DO PDF Invictos ==============
// Cabeçalho fixo: "Emitido pelo Sistema Invictos Vidros - www.invictos.com.br"
// Empresa: "MS VIDROS" (ou outra que use o sistema)
// Cliente: "NOME: <num> <nome>"
// Cidade: "CIDADE: <cidade>"
//
// Por item (estrutura regular ~10 linhas):
//   NOME_TIPOLOGIA                                  @@PPIMAGE1@@NOMEIMAGEM@@R@@
//                       PROJETO: <código>
//                       MEDIDAS: FRONTAL L.<larg> A.<alt>          CÓDIGO: <num>
//                       VIDRO: <descrição vidro>                   <area>m2
//                       FERRAGEM: <cor>, PERFIL: <cor>,
//
//   AMBIENTE: <texto>                                              QUANTIDADE: <num>
//   OBSERVAÇÃO:
//   TRATAMENTO: R$ 0,00                            SUB-TOTAL PROJETO   R$ <valor>

export type TipologiaInvictos =
  | 'correr'
  | 'giro'
  | 'pivotante'
  | 'maxim_ar'
  | 'bascula'
  | 'fixo'
  | 'desconhecida'

export type TipoVidroInvictos = 'comum' | 'temperado' | 'laminado' | 'outros' | 'sem_vidro'

export interface VidroItemInvictos {
  descricaoBruta: string
  tipo: TipoVidroInvictos
  espessuraMm: number | null
  cor: string | null
  semVidro: boolean
}

export interface ItemInvictos {
  ordem: number
  descricaoCompleta: string
  tipologia: TipologiaInvictos
  projeto: string                  // "PORTA 3 F(4)", "29", "KIT 13"
  codigo: string                   // "14844", "14864"
  corPerfil: string
  corFerragem: string
  ambiente: string
  qtde: number
  larguraMm: number
  alturaMm: number
  vidro: VidroItemInvictos
}

export interface ClienteInvictos {
  nome: string | null
  cidade: string | null
  obra: string | null
}

export interface OrcamentoInvictos {
  propostaNumero: string | null
  cliente: ClienteInvictos
  vendedor: string | null
  itens: ItemInvictos[]
  textoOriginal: string
}

// ============================================================
// DETECÇÃO
// ============================================================

export function ehPdfInvictos(texto: string): boolean {
  // Marcador 100% específico do sistema
  return /Emitido\s+pelo\s+Sistema\s+Invictos/i.test(texto)
}

// ============================================================
// PARSE PRINCIPAL
// ============================================================

export function parsearTextoInvictos(texto: string): OrcamentoInvictos {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const propostaNumero = extrairProposta(linhas)
  const cliente = extrairCliente(linhas)
  const vendedor = extrairVendedor(linhas)
  const itens = extrairItens(linhas)

  return {
    propostaNumero,
    cliente,
    vendedor,
    itens,
    textoOriginal: texto,
  }
}

function extrairProposta(linhas: string[]): string | null {
  for (const l of linhas) {
    const m = l.match(/PROPOSTA\s+(\d+)/i)
    if (m) return m[1]
  }
  return null
}

function extrairCliente(linhas: string[]): ClienteInvictos {
  let nome: string | null = null
  let cidade: string | null = null
  let obra: string | null = null

  for (const l of linhas) {
    // "NOME: 732 MARCIO TIM" ou "NOME: 1930.0 CLEITON GUARESMA FAMA AGRICULA"
    if (!nome) {
      const m = l.match(/^NOME:\s*[\d.]+\s+([^|]+?)(?:\s+VENDEDOR:|\s+OBRA:|$)/i)
      if (m && m[1].trim()) nome = m[1].trim()
    }
    if (!cidade) {
      // "CIDADE: Maracaju" — distinguir do "CIDADE: Maracaju - MS" do cabeçalho da empresa
      const m = l.match(/^CIDADE:\s*([^|]+?)(?:\s+BAIRRO:|$)/i)
      if (m && !l.includes('Maracaju - MS')) cidade = m[1].trim()
    }
    if (!obra) {
      const m = l.match(/OBRA:\s*([^|]+?)(?:\s+CIDADE:|$)/i)
      if (m && m[1].trim()) obra = m[1].trim()
    }
  }

  return { nome, cidade, obra }
}

function extrairVendedor(linhas: string[]): string | null {
  for (const l of linhas) {
    const m = l.match(/VENDEDOR:\s*([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i)
    if (m) return m[1].trim()
  }
  return null
}

// ============================================================
// EXTRAÇÃO DE ITENS
// ============================================================

function extrairItens(linhas: string[]): ItemInvictos[] {
  // Junta os itens estruturados (com PROJETO:/medidas/vidro) com os itens
  // "INSERIDOS MANUALMENTE" (tabela simples, sem medidas). Cravado 22/06/2026
  // após o orçamento do Cristiano (Roan Vinicius) ter SÓ item manual → 0 itens.
  const estruturados = extrairItensEstruturados(linhas)
  const manuais = extrairItensManuais(linhas)
  return [...estruturados, ...manuais].map((it, i) => ({ ...it, ordem: i + 1 }))
}

function extrairItensEstruturados(linhas: string[]): ItemInvictos[] {
  // Cada item tem o marcador "@@PPIMAGE1@@NOMEIMAGEM@@R@@" no fim da linha do nome
  // (placeholder do template que sobra na exportação). Usamos isso como âncora.
  //
  // Ou: "PROJETO:" na linha seguinte também marca início de bloco.
  //
  // Estratégia: detecta linhas com tipologia (PORTA, JANELA, MAXIM-AR, VIDRO,
  // BASCULANTE, etc) que precedem uma linha com "PROJETO:" — essas são as
  // descrições de itens.

  // Estratégia cravada 12/06: usa PROJETO: como âncora primária (presente em
  // 100% dos itens). O marker @@PPIMAGE é instável — pdfplumber extrai bagunçado
  // (intercala chars com o nome do item, ou fica em linha separada).
  //
  // Lógica:
  //   1. Acha todas linhas com PROJETO:
  //   2. Pra cada uma, volta até 5 linhas procurando o nome do item (linha
  //      descritiva, não-cabeçalho, não-vazia)
  //   3. Esse é o início do bloco do item
  //
  // Bug reportado por Cristiano (MS VIDROS) 12/06 — antes do fix perdia
  // ESPELHO, PAINEL, QUADRO, FIXO e variações com layout quebrado.
  function ehLinhaCabecalho(linha: string): boolean {
    const l = linha.trim()
    if (!l) return true
    if (/^Emitido pelo Sistema/i.test(l)) return true
    if (/^P[áa]gina\s+\d+/i.test(l)) return true
    // Linha que é só o placeholder do marker
    if (/^[@\s]+(PPIMAGE|NOMEIMAGEM|R)[@\s]*$/i.test(l)) return true
    // Linha com cabeçalho contábil (PEND VENCTO etc)
    if (/^PEND\s+VENCTO\s+VALOR/i.test(l)) return true
    if (/^\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+R\$/.test(l)) return true
    return false
  }

  const indicesItem: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (!/PROJETO:/i.test(linhas[i])) continue
    // Volta até 5 linhas procurando o nome do item
    let idxNome = -1
    for (let k = i - 1; k >= Math.max(0, i - 5); k--) {
      const lin = linhas[k]
      if (ehLinhaCabecalho(lin)) continue
      // Limpa placeholder bagunçado pra avaliar conteúdo real
      const limpa = lin.replace(/@+P+I*M*A*G*E*\d*/gi, '').replace(/@+/g, '').replace(/NOMEIMAGEM/gi, '').replace(/\s+/g, ' ').trim()
      if (limpa.length >= 4) {
        idxNome = k
        break
      }
    }
    if (idxNome >= 0) indicesItem.push(idxNome)
  }

  if (indicesItem.length === 0) return []

  const itens: ItemInvictos[] = []
  for (let i = 0; i < indicesItem.length; i++) {
    const inicio = indicesItem[i]
    const fim = i < indicesItem.length - 1 ? indicesItem[i + 1] : linhas.length
    const bloco = linhas.slice(inicio, fim)
    const item = parsearBloco(bloco, i + 1)
    if (item) itens.push(item)
  }

  return itens
}

// Itens "INSERIDOS MANUALMENTE": tabela simples REFERÊNCIA | COR | DESCRIÇÃO |
// QUANTIDADE | VALOR — sem PROJETO, sem medidas, sem vidro. Acessórios/avulsos
// (ex: "CONTRA MARCO ALVENARIA ... 1 und."). Âncora = a quantidade no FIM da
// linha de detalhe ("N und./un/pç/m..."). A referência (código curto) costuma
// vir na linha anterior — mas o parser também funciona se vier junta.
function extrairItensManuais(linhas: string[]): ItemInvictos[] {
  const out: ItemInvictos[] = []
  const iSec = linhas.findIndex((l) => /ITENS\s+INSERIDOS\s+MANUALMENTE/i.test(l))
  if (iSec < 0) return out

  // Fim da seção (rodapé do orçamento)
  const reFim = /^(CADERNO:|MEDIDAS\s+INFORMADAS|PRAZO\s+DE\s+ENTREGA|VALOR\s+TOTAL|VENDEDOR:)/i
  // Quantidade + unidade ANCORADA NO FIM da linha (evita falso-positivo tipo
  // "200 6M" no meio da descrição).
  const reQtdFim = /(\d+(?:[.,]\d+)?)\s*(und|un|p[çc]|pe[çc]as?|cj|conj|m2|m|kg)\.?\s*$/i

  let ref = ''
  for (let i = iSec + 1; i < linhas.length; i++) {
    const l = linhas[i]
    if (reFim.test(l)) break
    if (/^REFER[ÊE]NCIA\b/i.test(l)) continue        // cabeçalho de coluna
    if (/^OBSERVA[ÇC][AÃ]O:/i.test(l)) continue        // label, não item
    if (/^Valor\b/i.test(l)) continue                  // coluna de valores (direita)
    // placeholder de imagem do template
    const semPlaceholder = l.replace(/@+P+I*M*A*G*E*\d*/gi, '').replace(/@+/g, '').replace(/NOMEIMAGEM/gi, '').replace(/\bR\b/g, '').trim()
    if (/@/.test(l) && semPlaceholder.length < 4) continue

    const m = l.match(reQtdFim)
    if (m && m.index !== undefined) {
      const qtde = Math.max(1, Math.round(parseFloat(m[1].replace(',', '.'))) || 1)
      const desc = l.slice(0, m.index).replace(/\bXXX\b/g, ' ').replace(/\s+/g, ' ').trim()
      const descricaoCompleta = [ref, desc].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      if (descricaoCompleta.length >= 3) {
        out.push({
          ordem: 0,
          descricaoCompleta,
          tipologia: inferirTipologia(descricaoCompleta),
          projeto: ref,
          codigo: '',
          corPerfil: '',
          corFerragem: '',
          ambiente: '',
          qtde,
          larguraMm: 0,
          alturaMm: 0,
          vidro: parsearVidro('SEM VIDRO'),
        })
      }
      ref = ''
    } else if (l.length > 0 && l.length <= 40) {
      // provável linha de referência (código curto) — guarda pra próxima linha
      ref = l
    }
  }
  return out
}

function parsearBloco(bloco: string[], ordem: number): ItemInvictos | null {
  if (bloco.length === 0) return null

  // Primeira linha contém a tipologia — remove o placeholder "@@PPIMAGE1@@..."
  const descricaoCompleta = bloco[0]
    .replace(/@@PPIMAGE\d*@@[^@]*@@R@@/g, '')
    .replace(/\s+$/, '')
    .trim()

  // Junta resto em texto pra fazer match
  const textoBloco = bloco.slice(1).join('\n')

  // PROJETO: ex "PORTA 3 F(4)", "29", "KIT 13"
  let projeto = ''
  const mProj = textoBloco.match(/PROJETO:\s*(.+?)(?=\s*CÓDIGO:|\s*$|\n)/i)
  if (mProj) projeto = mProj[1].trim()

  // CÓDIGO: ex "14844"
  let codigo = ''
  const mCod = textoBloco.match(/C[ÓO]DIGO:\s*(\d+)/i)
  if (mCod) codigo = mCod[1].trim()

  // MEDIDAS: FRONTAL L.<larg> A.<alt>
  let larguraMm = 0
  let alturaMm = 0
  const mMed = textoBloco.match(/L\.\s*(\d+)\s+A\.\s*(\d+)/i)
  if (mMed) {
    larguraMm = parseInt(mMed[1], 10)
    alturaMm = parseInt(mMed[2], 10)
  }

  // VIDRO: ex "VIDRO 6MM TEMPERADO XXX INCOLOR  7.24m2"
  let vidroBruto = ''
  const mVidro = textoBloco.match(/VIDRO:\s*(.+?)(?=\s+\d+(?:\.\d+)?m2|$|\n)/i)
  if (mVidro) vidroBruto = mVidro[1].trim()

  // FERRAGEM: PRETO, PERFIL: PRETO
  let corFerragem = ''
  let corPerfil = ''
  const mFer = textoBloco.match(/FERRAGEM:\s*([A-ZÁÉÍÓÚÂÊÔÃÇ\s]+?),/i)
  if (mFer) corFerragem = mFer[1].trim()
  const mPer = textoBloco.match(/PERFIL:\s*([A-ZÁÉÍÓÚÂÊÔÃÇ\s]+?)[,\n]/i)
  if (mPer) corPerfil = mPer[1].trim()

  // AMBIENTE: <texto>  (campo principal cadastrado no Invictos)
  let ambiente = ''
  const mAmb = textoBloco.match(/AMBIENTE:\s*(.*?)(?=\s+QUANTIDADE:|\s*$|\n)/i)
  if (mAmb) ambiente = mAmb[1].trim()

  // OBSERVAÇÃO: <texto livre>  (cravado 12/06 — Cristiano pediu, identifica local real)
  // Quando AMBIENTE está vazio, usar OBSERVAÇÃO como fallback. Quando os 2 estão
  // preenchidos, combinar com separador.
  const mObs = textoBloco.match(/OBSERVA[ÇC][AÃ]O:\s*([^\n]*?)(?=\s*TRATAMENTO|\s*$|\n)/i)
  const observacao = mObs ? mObs[1].trim() : ''
  if (observacao) {
    if (!ambiente) ambiente = observacao
    else ambiente = ambiente + ' — ' + observacao
  }

  // QUANTIDADE: <n>
  let qtde = 1
  const mQtd = textoBloco.match(/QUANTIDADE:\s*(\d+)/i)
  if (mQtd) qtde = parseInt(mQtd[1], 10)

  // Validação mínima: precisa ter pelo menos dimensões válidas
  if (larguraMm < 50 || larguraMm > 30000 || alturaMm < 50 || alturaMm > 30000) {
    return null
  }
  // qtde 0 ocasionalmente aparece (Cristiano cravou bug do Invictos) — defaulta 1
  if (qtde <= 0) qtde = 1

  return {
    ordem,
    descricaoCompleta,
    tipologia: inferirTipologia(descricaoCompleta),
    projeto,
    codigo,
    corPerfil,
    corFerragem,
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

function inferirTipologia(descricao: string): TipologiaInvictos {
  const d = descricao.toUpperCase()
  if (/MAXIM[-\s]?AR/.test(d)) return 'maxim_ar'
  if (/BASCULA(NTE)?/.test(d)) return 'bascula'
  if (/PIVOTANTE/.test(d)) return 'pivotante'
  if (/CORRER/.test(d)) return 'correr'
  if (/GIRO|ABRIR/.test(d)) return 'giro'
  if (/FIXO/.test(d)) return 'fixo'
  return 'desconhecida'
}

function parsearVidro(bruto: string): VidroItemInvictos {
  if (!bruto || /sem\s+vidro/i.test(bruto)) {
    return {
      descricaoBruta: bruto || 'SEM VIDRO',
      tipo: 'sem_vidro',
      espessuraMm: null,
      cor: null,
      semVidro: true,
    }
  }

  const u = bruto.toUpperCase()

  let tipo: TipoVidroInvictos = 'outros'
  if (/TEMPERAD/.test(u)) tipo = 'temperado'
  else if (/LAMINAD/.test(u)) tipo = 'laminado'
  else if (/COMUM|FLOAT|LISO/.test(u)) tipo = 'comum'

  const mEsp = bruto.match(/(\d+)\s*MM/i)
  const espessuraMm = mEsp ? parseInt(mEsp[1], 10) : null

  // Cor: depois de "XXX " (separador) ou no final
  let cor: string | null = null
  const corMatch = bruto.match(/XXX\s+([A-ZÁÉÍÓÚÂÊÔÃÇ]+)/i)
  if (corMatch) cor = corMatch[1].trim()
  else {
    const cor2 = bruto.match(/\b(INCOLOR|VERDE|FUM[EÊ]|BRONZE|REFLETIVO|MINIBOREAL)\b/i)
    if (cor2) cor = cor2[1].toLowerCase()
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

export interface CardImportadoInvictos {
  sigla: string
  nome: string
  descricao: string
  ambiente: string
  larguraMm: number
  alturaMm: number
  tipologia: TipologiaInvictos
  corPerfil: string
  corVidro: string | null
  espessuraMm: number | null
  tipoVidro: TipoVidroInvictos
}

export function expandirItensInvictosEmCards(itens: ItemInvictos[]): CardImportadoInvictos[] {
  const cards: CardImportadoInvictos[] = []

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
          item.projeto ? `Projeto: ${item.projeto}` : '',
          item.ambiente ? `Local: ${item.ambiente}` : '',
          item.larguraMm && item.alturaMm ? `Dimensões: ${item.larguraMm}×${item.alturaMm}mm` : '',
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

function nomeCurtoDoItem(item: ItemInvictos): string {
  const desc = item.descricaoCompleta
  if (!desc) return `Item ${item.ordem}`
  // Pega primeira parte antes de "(" ou ":" e formata
  const compacto = desc.split(/[\(\:]/)[0].trim()
  return formatarTitulo(compacto)
}

function formatarTitulo(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(De|Do|Da|Com|E|Em|Pra|Ou)\b/g, (c) => c.toLowerCase())
}
