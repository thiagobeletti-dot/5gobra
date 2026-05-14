// Importação de itens em massa via planilha .xlsx
// =================================================
//
// Pra empresas que NÃO usam Alumisoft. Cliente baixa template, preenche em
// Excel/Google Sheets, sobe de volta e o parser converte em ItemImportado[]
// (mesmo tipo que o parser do Alumisoft retorna — assim a UI de preview é única).
//
// Decisões de design:
//   - Aceita .xlsx, .xls e .csv (SheetJS lida com todos).
//   - Headers tolerantes a maiúsculas/minúsculas/acentos.
//   - NOME é a única coluna obrigatória.
//   - QTDE > 1 expande em N itens com siglas sequenciais (igual o Alumisoft).
//   - Se SIGLA vazia, gera a partir de TIPO + contador.
//   - Validação dá erros legíveis ("Linha 5: NOME está vazio").
//   - Template gerado dinamicamente (sem arquivo estático em /public).

import * as XLSX from 'xlsx'
import type { ItemImportado } from './alumisoft'

// =============== Tipos ===============

export interface PlanilhaImportResult {
  itens: ItemImportado[]
  avisos: string[]   // warnings não-bloqueantes (ex: "10 linhas vazias ignoradas")
}

interface LinhaCru {
  sigla?: string
  tipo?: string
  nome?: string
  descricao?: string
  largura_mm?: number
  altura_mm?: number
  qtde?: number
  linha?: string
  cor?: string
  vidro?: string
  localizacao?: string
  observacao?: string
}

// =============== Headers aceitos ===============
// Mapeia variações pra chave canônica. Tolera caps, acento, traço, sublinhado.

const HEADER_ALIASES: Record<string, keyof LinhaCru> = {
  // sigla
  'sigla': 'sigla',
  // tipo
  'tipo': 'tipo',
  // nome
  'nome': 'nome',
  // descricao
  'descricao': 'descricao',
  'descrição': 'descricao',
  // largura
  'largura': 'largura_mm',
  'largura mm': 'largura_mm',
  'larguramm': 'largura_mm',
  'largura_mm': 'largura_mm',
  'largura (mm)': 'largura_mm',
  // altura
  'altura': 'altura_mm',
  'altura mm': 'altura_mm',
  'alturamm': 'altura_mm',
  'altura_mm': 'altura_mm',
  'altura (mm)': 'altura_mm',
  // qtde
  'qtde': 'qtde',
  'quantidade': 'qtde',
  'qtd': 'qtde',
  // linha
  'linha': 'linha',
  // cor
  'cor': 'cor',
  'acabamento': 'cor',
  // vidro
  'vidro': 'vidro',
  // localizacao
  'localizacao': 'localizacao',
  'localização': 'localizacao',
  'local': 'localizacao',
  // observacao
  'observacao': 'observacao',
  'observação': 'observacao',
  'obs': 'observacao',
}

function normalizarHeader(h: string): string {
  return String(h)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
}

function mapearHeaderParaChave(headerCru: string): keyof LinhaCru | null {
  const semAcento = normalizarHeader(headerCru)
  if (HEADER_ALIASES[semAcento]) return HEADER_ALIASES[semAcento]
  // Tentativa final: a chave canônica já é a normalizada
  if (semAcento in {} as LinhaCru) return semAcento as keyof LinhaCru
  return null
}

// =============== Parser ===============

/**
 * Lê um arquivo .xlsx / .xls / .csv e converte em itens prontos pra importar.
 * Lança Error com mensagem legível se algo der errado.
 */
export async function parsePlanilhaArquivo(arquivo: File): Promise<PlanilhaImportResult> {
  const buffer = await arquivo.arrayBuffer()
  return parsePlanilhaBuffer(buffer)
}

export function parsePlanilhaBuffer(buffer: ArrayBuffer): PlanilhaImportResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  // Procura a primeira aba que NÃO seja "Instruções"
  const nomesAbas = workbook.SheetNames
  let abaItens = nomesAbas[0]
  for (const nome of nomesAbas) {
    if (!/instru/i.test(nome) && !/leia/i.test(nome)) {
      abaItens = nome
      break
    }
  }
  const sheet = workbook.Sheets[abaItens]
  if (!sheet) throw new Error('Planilha não tem aba com itens.')

  // Lê como array de objetos com headers da primeira linha
  const linhasRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (linhasRaw.length === 0) {
    throw new Error('A planilha está vazia ou só tem o cabeçalho.')
  }

  // Mapeia headers da planilha pras chaves canônicas
  const primeiraLinha = linhasRaw[0]
  const mapaHeaders: Record<string, keyof LinhaCru> = {}
  for (const headerCru of Object.keys(primeiraLinha)) {
    const chave = mapearHeaderParaChave(headerCru)
    if (chave) mapaHeaders[headerCru] = chave
  }

  if (!Object.values(mapaHeaders).includes('nome')) {
    throw new Error(
      'Coluna NOME não encontrada. Confere se você usou o template ou se renomeou a coluna.',
    )
  }

  const avisos: string[] = []
  const itens: ItemImportado[] = []
  const contadoresPorTipo: Record<string, number> = {}

  // Conta linhas vazias pra reportar
  let vazias = 0

  linhasRaw.forEach((linhaRaw, idx) => {
    const numLinhaPlanilha = idx + 2 // +2 porque idx=0 é a linha 2 do Excel (após header)

    const linha = converterLinha(linhaRaw, mapaHeaders)

    // Linha totalmente vazia?
    const temConteudo = linha.nome || linha.sigla || linha.descricao || linha.largura_mm || linha.altura_mm
    if (!temConteudo) {
      vazias++
      return
    }

    // NOME é obrigatório
    if (!linha.nome || !linha.nome.trim()) {
      throw new Error(`Linha ${numLinhaPlanilha}: coluna NOME está vazia. Preenche ou apaga a linha inteira.`)
    }

    const qtde = Math.max(1, Math.floor(linha.qtde || 1))

    // Expande qtde em N itens
    for (let i = 0; i < qtde; i++) {
      let siglaFinal: string

      if (linha.sigla && linha.sigla.trim()) {
        // Se user informou SIGLA, usa ela. Se qtde > 1, adiciona sufixo _N.
        siglaFinal = qtde > 1
          ? `${linha.sigla.trim().toUpperCase()}_${i + 1}`
          : linha.sigla.trim().toUpperCase()
      } else if (linha.tipo && linha.tipo.trim()) {
        // Sem SIGLA mas com TIPO: usa TIPO + contador
        const tipoUp = linha.tipo.trim().toUpperCase()
        contadoresPorTipo[tipoUp] = (contadoresPorTipo[tipoUp] || 0) + 1
        siglaFinal = `${tipoUp}_${contadoresPorTipo[tipoUp]}`
      } else {
        // Sem SIGLA e sem TIPO: usa PEC (peca) + contador
        contadoresPorTipo['PEC'] = (contadoresPorTipo['PEC'] || 0) + 1
        siglaFinal = `PEC${contadoresPorTipo['PEC']}`
      }

      // Monta descrição completa concatenando os campos opcionais
      const partesDescricao: string[] = []
      if (linha.descricao && linha.descricao.trim()) partesDescricao.push(linha.descricao.trim())
      if (linha.largura_mm && linha.altura_mm) {
        partesDescricao.push(`Dimensões: ${linha.largura_mm}x${linha.altura_mm}mm`)
      }
      if (linha.linha && linha.linha.trim()) partesDescricao.push(`Linha: ${linha.linha.trim()}`)
      if (linha.cor && linha.cor.trim()) partesDescricao.push(`Cor: ${linha.cor.trim()}`)
      if (linha.vidro && linha.vidro.trim()) partesDescricao.push(`Vidro: ${linha.vidro.trim()}`)
      if (linha.localizacao && linha.localizacao.trim()) partesDescricao.push(`Local: ${linha.localizacao.trim()}`)
      if (linha.observacao && linha.observacao.trim()) partesDescricao.push(`Obs: ${linha.observacao.trim()}`)

      itens.push({
        sigla: siglaFinal,
        nome: linha.nome.trim(),
        descricao: partesDescricao.join(' | '),
        tipo: 'peca',
        larguraMm: linha.largura_mm || 0,
        alturaMm: linha.altura_mm || 0,
        localizacao: (linha.localizacao || '').trim(),
        precoUnit: 0,
        origemTipologia: `planilha:L${numLinhaPlanilha}`,
      })
    }
  })

  if (vazias > 0) avisos.push(`${vazias} linha(s) vazia(s) ignoradas.`)
  if (itens.length === 0) {
    throw new Error('Nenhum item válido encontrado na planilha. Confere se preencheu a coluna NOME pelo menos.')
  }

  return { itens, avisos }
}

// =============== Helpers ===============

function converterLinha(
  linhaRaw: Record<string, unknown>,
  mapaHeaders: Record<string, keyof LinhaCru>,
): LinhaCru {
  const out: LinhaCru = {}
  for (const [headerCru, valor] of Object.entries(linhaRaw)) {
    const chave = mapaHeaders[headerCru]
    if (!chave) continue
    if (chave === 'largura_mm' || chave === 'altura_mm' || chave === 'qtde') {
      const num = Number(String(valor).replace(/[^\d.,-]/g, '').replace(',', '.'))
      if (!isNaN(num) && num > 0) out[chave] = num
    } else {
      const str = String(valor || '').trim()
      if (str) (out[chave] as string) = str
    }
  }
  return out
}

// =============== Gerador de Template ===============

/**
 * Gera um arquivo .xlsx template pra download.
 * Tem 2 abas: "Itens" (pra preencher) e "Instruções" (manual de uso).
 */
export function gerarTemplateXlsx(): Blob {
  const workbook = XLSX.utils.book_new()

  // ============ Aba 1: Itens (pra preencher) ============
  const headers = [
    'SIGLA',
    'TIPO',
    'NOME',
    'DESCRIÇÃO',
    'LARGURA (mm)',
    'ALTURA (mm)',
    'QTDE',
    'LINHA',
    'COR',
    'VIDRO',
    'LOCALIZAÇÃO',
    'OBSERVAÇÃO',
  ]

  // 3 linhas de exemplo pré-preenchidas
  const exemplos = [
    ['J1', 'J', 'Janela maxim-ar', 'Janela de abrir 2 folhas', 1200, 1000, 2, 'Suprema 25', 'Anodizado Natural', 'Comum 6mm', 'Sala', ''],
    ['P1', 'P', 'Porta de correr', 'Porta de correr 2 folhas + 2 fixas', 2400, 2100, 1, 'Domus', 'Preto Fosco', 'Laminado 8mm', 'Sacada', 'Cliente pediu trinco reforçado'],
    ['', 'BL', 'Basculante banheiro', '', 600, 400, 3, '', 'Branco', 'Mini-boreal', 'Banheiros', ''],
  ]

  const dadosAba1 = [headers, ...exemplos]
  const sheetItens = XLSX.utils.aoa_to_sheet(dadosAba1)

  // Largura das colunas
  sheetItens['!cols'] = [
    { wch: 8 },   // SIGLA
    { wch: 6 },   // TIPO
    { wch: 25 },  // NOME
    { wch: 30 },  // DESCRIÇÃO
    { wch: 12 },  // LARGURA
    { wch: 12 },  // ALTURA
    { wch: 7 },   // QTDE
    { wch: 15 },  // LINHA
    { wch: 18 },  // COR
    { wch: 18 },  // VIDRO
    { wch: 16 },  // LOCALIZAÇÃO
    { wch: 25 },  // OBSERVAÇÃO
  ]

  XLSX.utils.book_append_sheet(workbook, sheetItens, 'Itens')

  // ============ Aba 2: Instruções ============
  const instrucoes = [
    ['INSTRUÇÕES DE USO - TEMPLATE DE IMPORTAÇÃO G OBRA'],
    [''],
    ['Preencha a aba "Itens" com as peças da obra que você quer importar.'],
    ['Cada linha = um tipo de peça. Use a coluna QTDE pra indicar quantas peças daquele tipo.'],
    [''],
    ['REGRAS DE PREENCHIMENTO:'],
    [''],
    ['1. NOME é a única coluna OBRIGATÓRIA. Tudo o mais é opcional.'],
    ['2. Se você não informar SIGLA, o sistema gera automaticamente (TIPO + número).'],
    ['3. QTDE > 1 cria várias peças com siglas sequenciais (ex: J1_1, J1_2, J1_3).'],
    ['4. LARGURA e ALTURA devem ser em milímetros (mm). Apenas números.'],
    ['5. As 3 linhas de exemplo na aba "Itens" mostram preenchimentos típicos. Pode apagar.'],
    [''],
    ['DICAS:'],
    [''],
    ['- TIPO normalmente é a primeira letra: J pra janela, P pra porta, BL pra basculante.'],
    ['- LINHA, COR e VIDRO ajudam a identificar a peça depois — preencha se souber.'],
    ['- LOCALIZAÇÃO ajuda no canteiro de obra (ex: Quarto Master, Banheiro Social).'],
    ['- OBSERVAÇÃO é livre. Use pra anotar pedidos específicos do cliente.'],
    [''],
    ['DEPOIS DE PREENCHER:'],
    [''],
    ['1. Salve o arquivo (Ctrl+S).'],
    ['2. Volte ao G Obra, na tela "Importar itens em massa".'],
    ['3. Escolha a opção "Planilha" e anexe esse arquivo.'],
    ['4. Confira o preview antes de confirmar a importação.'],
    [''],
    ['Dúvidas? Suporte: contato@5gobra.com.br'],
  ]

  const sheetInstr = XLSX.utils.aoa_to_sheet(instrucoes.map(linha => [linha[0]]))
  sheetInstr['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(workbook, sheetInstr, 'Instruções')

  // Gera o blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Dispara o download do template no navegador.
 */
export function baixarTemplate(): void {
  const blob = gerarTemplateXlsx()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-importacao-g-obra.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
