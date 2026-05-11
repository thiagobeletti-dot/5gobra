// Geracao de PDFs de Documentos da obra (frontend, com pdf-lib).
//
// 2 tipos de documento, ambos consolidam VARIOS itens (cards do tipo 'peca')
// em 1 unico PDF:
//
// 1) MEDICAO — pra cada peca selecionada, mostra os dados estruturados de M1
//    (medicao 1) e M2 (medicao 2, se houver). Util pra revisao tecnica,
//    arquivo da empresa, conferencia com fornecedor.
//
// 2) DOSSIE — pra cada peca selecionada, mostra a timeline cronologica de
//    eventos publicos (interno=false ja filtrado upstream em listarHistoricoEmLote).
//    Util pra arquivo juridico, anexo em laudo, prova de comunicacao.
//
// Renderizacao no browser, sem ida ao servidor — gera Uint8Array e triggera
// download via Blob URL. Custo zero por geracao.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { Card, ObraInfo } from '../types/obra'
import type { Checklist, DadosMedicao1, DadosMedicao2 } from '../types/checklist'
import { ROTULOS_TIPOLOGIA } from '../types/checklist'
import type { HistoricoRow } from './api'

// =============== Rotulos pros enums de spec tecnica ===============
// Esses traduzem os valores enum do checklist em texto humano pro PDF.
const ROTULOS_CORRER_ABERTURA: Record<string, string> = {
  esquerda: 'Esquerda',
  direita: 'Direita',
  ambos: 'Ambos os lados',
}
const ROTULOS_CORRER_FECHO: Record<string, string> = {
  fechadura: 'Fechadura',
  cremona: 'Cremona',
  concha: 'Concha',
}
const ROTULOS_CORRER_TRILHO: Record<string, string> = {
  convencional: 'Convencional',
  embutido_u: 'Embutido em U',
  embutido_concavo: 'Embutido côncavo',
  na: 'Não se aplica',
}
const ROTULOS_GIRO_ABERTURA: Record<string, string> = {
  interna: 'Para dentro (interna)',
  externa: 'Para fora (externa)',
}
const ROTULOS_LADO: Record<string, string> = {
  esquerda: 'Esquerda',
  direita: 'Direita',
}
const ROTULOS_INSTALACAO: Record<string, string> = {
  face_interna: 'Face interna',
  face_externa: 'Face externa',
  eixo: 'No eixo',
}
const ROTULOS_ARREMATE_EXT: Record<string, string> = {
  cantoneira: 'Cantoneira',
  meia_cana: 'Meia-cana',
}

function rotular(mapa: Record<string, string>, valor: string): string {
  return mapa[valor] ?? valor
}

// =============== API publica ===============

export interface EmpresaInfo {
  nome: string
  cnpj?: string | null
  logoUrl?: string | null
}

export async function gerarPdfMedicao(
  obra: ObraInfo,
  empresa: EmpresaInfo,
  cards: Card[],
  opts?: { incluirFotos?: boolean },
): Promise<Uint8Array> {
  const cardsOrdenados = ordenarPorSigla(cards)
  const ctx = await criarContexto('Ficha de Medição')
  const logoImg = await carregarLogoEmpresa(ctx, empresa.logoUrl)
  // Pre-carrega fotos de TODAS as pecas em paralelo (so se opt-in)
  const fotosPorCard = opts?.incluirFotos
    ? await carregarFotosDosCards(ctx, cardsOrdenados)
    : new Map<string, any[]>()
  desenharCapa(ctx, 'Ficha de Medição', obra, empresa, cardsOrdenados.length, 'peças com M1/M2', logoImg)
  for (const card of cardsOrdenados) {
    desenharSecaoMedicao(ctx, card)
    if (opts?.incluirFotos) {
      const fotos = fotosPorCard.get(card.id) ?? []
      if (fotos.length > 0) desenharGaleriaPeca(ctx, fotos)
    }
  }
  desenharBrandingTopo(ctx)
  desenharFooters(ctx, empresa)
  return await ctx.pdf.save()
}

export async function gerarPdfDossie(
  obra: ObraInfo,
  empresa: EmpresaInfo,
  cards: Card[],
  historicoPorCard: Map<string, HistoricoRow[]>,
  opts?: { incluirFotos?: boolean },
): Promise<Uint8Array> {
  const cardsOrdenados = ordenarPorSigla(cards)
  const ctx = await criarContexto('Dossiê da obra')
  const logoImg = await carregarLogoEmpresa(ctx, empresa.logoUrl)
  const fotosPorCard = opts?.incluirFotos
    ? await carregarFotosDosCards(ctx, cardsOrdenados)
    : new Map<string, any[]>()
  desenharCapa(ctx, 'Dossiê da obra', obra, empresa, cardsOrdenados.length, 'peças com histórico', logoImg)
  desenharSumarioDossie(ctx, cardsOrdenados)
  for (const card of cardsOrdenados) {
    const eventos = historicoPorCard.get(card.id) ?? []
    const fotos = fotosPorCard.get(card.id) ?? []
    desenharSecaoDossie(ctx, card, eventos, fotos)
  }
  desenharBrandingTopo(ctx)
  desenharFooters(ctx, empresa)
  return await ctx.pdf.save()
}

// Baixa as fotos de todos os cards em paralelo e embed no PDF.
// Limita 4 fotos por peca (decisao de produto pra controlar tamanho do PDF).
// Mais antigas primeiro pra casar com timeline cronologica do dossie.
async function carregarFotosDosCards(ctx: Ctx, cards: Card[]): Promise<Map<string, any[]>> {
  const mapa = new Map<string, any[]>()
  const LIMITE_FOTOS = 4

  await Promise.all(cards.map(async (card) => {
    const fotos = card.fotos ?? []
    if (fotos.length === 0) return
    // Card.fotos vem do banco ordenado DESC (mais recente primeiro). Pegamos 4
    // mais recentes e reordena ASC pra casar com cronologia da timeline.
    const selecionadas = fotos.slice(0, LIMITE_FOTOS).slice().reverse()
    const embedded = await Promise.all(selecionadas.map(async (f) => {
      try {
        const resp = await fetch(f.url)
        if (!resp.ok) return null
        const buf = await resp.arrayBuffer()
        const bytes = new Uint8Array(buf)
        const img = (bytes[0] === 0x89 && bytes[1] === 0x50)
          ? await ctx.pdf.embedPng(bytes)
          : await ctx.pdf.embedJpg(bytes)
        return { img, createdAt: f.createdAt }
      } catch (e) {
        console.warn('[pdf] Falha ao baixar foto:', e)
        return null
      }
    }))
    const filtradas = embedded.filter((x): x is { img: any; createdAt: string } => x !== null)
    if (filtradas.length > 0) mapa.set(card.id, filtradas)
  }))

  return mapa
}

// Desenha grade de fotos (4 por linha). Mantem aspect ratio dentro da caixa.
function desenharGaleriaPeca(ctx: Ctx, fotos: { img: any; createdAt: string }[]) {
  if (fotos.length === 0) return
  const colunas = 4
  const gap = 8
  const larguraDisponivel = PAGE_W - MARGIN * 2
  const caixaW = (larguraDisponivel - gap * (colunas - 1)) / colunas
  const caixaH = caixaW * 0.75 // proporcao 4:3
  const linhas = Math.ceil(fotos.length / colunas)
  const alturaTotal = linhas * caixaH + (linhas - 1) * gap + 18

  garantirEspaco(ctx, alturaTotal)

  desenharTexto(ctx, 'Fotos da peça (' + fotos.length + ')', { size: 10, font: ctx.fontBold, color: COR_LABEL })
  ctx.y -= 14

  for (let i = 0; i < fotos.length; i++) {
    const col = i % colunas
    const linha = Math.floor(i / colunas)
    const x = MARGIN + col * (caixaW + gap)
    const y = ctx.y - (linha + 1) * caixaH - linha * gap
    desenharFotoEnquadrada(ctx, fotos[i].img, x, y, caixaW, caixaH)
  }
  ctx.y -= linhas * caixaH + (linhas - 1) * gap + 8
}

// Desenha uma foto centrada/contida numa caixa (x, y, w, h) mantendo proporcao.
function desenharFotoEnquadrada(ctx: Ctx, img: any, x: number, y: number, w: number, h: number) {
  // Fundo cinza claro pra "caixa"
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.96, 0.96, 0.96), borderColor: COR_LINHA, borderWidth: 0.5 })
  // Calcula tamanho da foto pra caber mantendo proporcao
  const escala = Math.min(w / img.width, h / img.height)
  const fw = img.width * escala
  const fh = img.height * escala
  const fx = x + (w - fw) / 2
  const fy = y + (h - fh) / 2
  ctx.page.drawImage(img, { x: fx, y: fy, width: fw, height: fh })
}

// Baixa o logo da empresa (URL publica do Supabase Storage) e embed no PDF.
// Retorna null se nao houver logo ou se falhar (best-effort: PDF gera sem logo).
async function carregarLogoEmpresa(ctx: Ctx, logoUrl: string | null | undefined) {
  if (!logoUrl) return null
  try {
    const resp = await fetch(logoUrl)
    if (!resp.ok) return null
    const buffer = await resp.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    // pdf-lib decide entre embedJpg/embedPng pelo magic bytes
    // PNG: 89 50 4e 47 ... | JPG: ff d8 ff ...
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return await ctx.pdf.embedPng(bytes)
    }
    return await ctx.pdf.embedJpg(bytes)
  } catch (e) {
    console.warn('[pdf] Falha ao baixar logo da empresa:', e)
    return null
  }
}

// Ordena por sigla usando natural sort (J1_1 < J1_3 < J1_10 < J2_1).
// Aceita acordo/apontamento misturados — siglas com letras + numero + sufixo
// caem todas nessa ordenacao consistente.
function ordenarPorSigla(cards: Card[]): Card[] {
  return [...cards].sort((a, b) =>
    a.sigla.localeCompare(b.sigla, 'pt-BR', { numeric: true })
  )
}

// Helper que dispara o download no browser (cria Blob URL e clica num <a>).
export function baixarPdf(bytes: Uint8Array, filename: string) {
  // TS 5 estrito reclama de Uint8Array<ArrayBufferLike> vs BlobPart.
  // Cast seguro: em runtime Uint8Array sempre eh BlobPart valido.
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// =============== Contexto compartilhado ===============

interface Ctx {
  pdf: PDFDocument
  fontRegular: PDFFont
  fontBold: PDFFont
  fontMono: PDFFont
  page: PDFPage
  y: number
  pageW: number
  pageH: number
  margin: number
  documentoTitulo: string
}

const PAGE_W = 595 // A4 portrait
const PAGE_H = 842
const MARGIN = 50
const LINE_H = 12
const FONT_BODY = 9
const COR_TEXTO = rgb(0.15, 0.15, 0.15)
const COR_SOFT = rgb(0.45, 0.45, 0.45)
const COR_LABEL = rgb(0.3, 0.3, 0.3)
const COR_LINHA = rgb(0.85, 0.85, 0.85)
const COR_DESTAQUE = rgb(0.92, 0.45, 0.04) // laranja G Obra
const COR_CARD_BG = rgb(0.985, 0.985, 0.99) // cinza muito claro pra fundo de evento

// Cores por autor — facilita ler "quem fez o quê" no dossiê
const COR_AUTOR: Record<string, ReturnType<typeof rgb>> = {
  empresa: rgb(0.92, 0.45, 0.04),   // laranja
  cliente: rgb(0.20, 0.50, 0.85),   // azul
  tecnico: rgb(0.05, 0.55, 0.45),   // verde-azulado / teal
  sistema: rgb(0.55, 0.55, 0.55),   // cinza
}
function corDoAutor(tipo: string): ReturnType<typeof rgb> {
  return COR_AUTOR[tipo] ?? COR_SOFT
}

async function criarContexto(documentoTitulo: string): Promise<Ctx> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdf.embedFont(StandardFonts.Courier)
  const page = pdf.addPage([PAGE_W, PAGE_H])
  return {
    pdf, fontRegular, fontBold, fontMono, page,
    y: PAGE_H - MARGIN, pageW: PAGE_W, pageH: PAGE_H, margin: MARGIN,
    documentoTitulo,
  }
}

function novaPagina(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

function garantirEspaco(ctx: Ctx, altura: number) {
  if (ctx.y - altura < MARGIN + 30) novaPagina(ctx)
}

// =============== Desenho de blocos comuns ===============

function desenharLinha(ctx: Ctx, cor = COR_LINHA) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: cor,
  })
}

function desenharTexto(ctx: Ctx, texto: string, opts: { x?: number; size?: number; font?: PDFFont; color?: any } = {}) {
  const x = opts.x ?? MARGIN
  const size = opts.size ?? FONT_BODY
  const font = opts.font ?? ctx.fontRegular
  const color = opts.color ?? COR_TEXTO
  ctx.page.drawText(sanitize(texto), { x, y: ctx.y - size, size, font, color })
}

function quebrarLinhas(texto: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const linhasRaw = sanitize(texto).split('\n')
  const out: string[] = []
  for (const linha of linhasRaw) {
    if (linha === '') { out.push(''); continue }
    let atual = ''
    for (const palavra of linha.split(' ')) {
      const tentativa = atual ? atual + ' ' + palavra : palavra
      const w = font.widthOfTextAtSize(tentativa, size)
      if (w > maxWidth && atual) {
        out.push(atual)
        atual = palavra
      } else {
        atual = tentativa
      }
    }
    if (atual) out.push(atual)
  }
  return out
}

// pdf-lib StandardFonts (WinAnsi) nao tem TODOS os caracteres unicode.
// Como os textos do app vem com acentos (português), normalizamos pra
// formato seguro mantendo legibilidade.
function sanitize(s: string): string {
  if (!s) return ''
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '*')
    .replace(/ /g, ' ')
}

// =============== Capa ===============

function desenharCapa(ctx: Ctx, titulo: string, obra: ObraInfo, empresa: EmpresaInfo, qtde: number, sufixo: string, logoImg: any | null) {
  // Logo da empresa no canto superior direito (se houver)
  if (logoImg) {
    const maxW = 80
    const maxH = 60
    const imgW = logoImg.width
    const imgH = logoImg.height
    // Mantem proporção, cabe em maxW x maxH
    const escala = Math.min(maxW / imgW, maxH / imgH, 1)
    const w = imgW * escala
    const h = imgH * escala
    ctx.page.drawImage(logoImg, {
      x: PAGE_W - MARGIN - w,
      y: ctx.y - h,
      width: w,
      height: h,
    })
  }

  desenharTexto(ctx, titulo, { size: 22, font: ctx.fontBold })
  ctx.y -= 28
  desenharTexto(ctx, 'G Obra · 5gobra.com.br', { size: 9, color: COR_SOFT })
  ctx.y -= 18
  desenharLinha(ctx)
  ctx.y -= 14

  // So mostra campos preenchidos (escondendo "-" feio quando vazio)
  const bloco: [string, string][] = [
    ['Obra', obra.nome || '(sem nome)'],
  ]
  if (obra.endereco) bloco.push(['Endereço', obra.endereco])
  if (obra.cliente) bloco.push(['Cliente', obra.cliente])
  if (obra.inicio) bloco.push(['Início da obra', obra.inicio])
  bloco.push(['Empresa emitente', empresa.nome + (empresa.cnpj ? ' (CNPJ ' + empresa.cnpj + ')' : '')])
  bloco.push(['Data de emissão', formatarDataHoraCompacta(new Date().toISOString())])
  bloco.push(['Conteúdo', String(qtde) + ' ' + sufixo])
  for (const [k, v] of bloco) {
    ctx.page.drawText(k + ':', { x: MARGIN, y: ctx.y - 4, size: 8, font: ctx.fontBold, color: COR_LABEL })
    const linhas = quebrarLinhas(String(v), ctx.fontRegular, 9, PAGE_W - MARGIN * 2 - 130)
    for (let i = 0; i < linhas.length; i++) {
      ctx.page.drawText(linhas[i], { x: MARGIN + 130, y: ctx.y - 4, size: 9, font: ctx.fontRegular, color: COR_TEXTO })
      if (i < linhas.length - 1) ctx.y -= LINE_H
    }
    ctx.y -= LINE_H
  }
  ctx.y -= 6
  desenharLinha(ctx)
  ctx.y -= 18
}

// =============== Secao MEDICAO ===============

function desenharSecaoMedicao(ctx: Ctx, card: Card) {
  garantirEspaco(ctx, 200)
  desenharCabecalhoPeca(ctx, card)

  const m1 = card.checklists.find((c) => c.tipo === 'medicao1')
  const m2 = card.checklists.find((c) => c.tipo === 'medicao2')

  desenharBlocoM1(ctx, m1)
  desenharBlocoM2(ctx, m2)

  ctx.y -= 8
}

function desenharCabecalhoPeca(ctx: Ctx, card: Card) {
  garantirEspaco(ctx, 50)
  const altura = 22
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - altura,
    width: PAGE_W - MARGIN * 2, height: altura,
    color: COR_DESTAQUE,
  })
  ctx.page.drawText(sanitize(card.sigla), {
    x: MARGIN + 10, y: ctx.y - 16,
    size: 12, font: ctx.fontBold, color: rgb(1, 1, 1),
  })
  ctx.page.drawText(sanitize(card.nome), {
    x: MARGIN + 60, y: ctx.y - 16,
    size: 11, font: ctx.fontRegular, color: rgb(1, 1, 1),
  })
  // Localização da peça (extraída do XML do Alumisoft) à direita
  const local = extrairLocalizacao(card.descricao)
  if (local) {
    const txt = local.toUpperCase()
    const w = ctx.fontBold.widthOfTextAtSize(txt, 10)
    ctx.page.drawText(sanitize(txt), {
      x: PAGE_W - MARGIN - 10 - w, y: ctx.y - 16,
      size: 10, font: ctx.fontBold, color: rgb(1, 1, 1),
      opacity: 0.85,
    })
  }
  ctx.y -= altura + 10
}

// Extrai "Local: LAVANDERIA" da descricao do card. Localizacao vem do XML do
// Alumisoft via `tp.localizacao` e é concatenada na descricao no momento da
// importacao (alumisoft.ts:tipologiasParaItens).
function extrairLocalizacao(descricao: string | null | undefined): string {
  if (!descricao) return ''
  const m = descricao.match(/Local:\s*([^|]+)/i)
  if (!m) return ''
  return m[1].trim()
}

function desenharBlocoM1(ctx: Ctx, m1: Checklist | undefined) {
  garantirEspaco(ctx, 60)
  desenharTexto(ctx, 'Medição 1 — Visita inicial', { size: 11, font: ctx.fontBold })
  ctx.y -= 16

  if (!m1) {
    desenharTexto(ctx, 'Não realizada.', { color: COR_SOFT })
    ctx.y -= LINE_H
    return
  }

  const d = m1.dados as DadosMedicao1
  const linhas: [string, string][] = [
    ['Data', formatarDataCurta(d.data)],
    ['Técnico', d.tecnico || '-'],
    ['Responsável na obra', d.responsavel_obra || '-'],
    ['Tipologia executável?', traduzirSimNao(d.tipologia_executavel)],
  ]
  if (d.tipologia_executavel === 'nao' && d.tipologia_problema) {
    linhas.push(['Problema reportado', d.tipologia_problema])
  }
  if (d.tipologia) linhas.push(['Tipologia', ROTULOS_TIPOLOGIA[d.tipologia as Exclude<typeof d.tipologia, ''>] ?? d.tipologia])

  // Specs de Correr
  if (d.tipologia === 'correr') {
    if (d.correr_abertura_lado) linhas.push(['Lado da abertura', rotular(ROTULOS_CORRER_ABERTURA, d.correr_abertura_lado)])
    if (d.correr_fecho) linhas.push(['Fecho', rotular(ROTULOS_CORRER_FECHO, d.correr_fecho)])
    if (d.correr_trilho) linhas.push(['Trilho', rotular(ROTULOS_CORRER_TRILHO, d.correr_trilho)])
    if (d.correr_somente_puxador) linhas.push(['Somente puxador (sem chave)', 'Sim'])
  }

  // Specs de Giro
  if (d.tipologia === 'giro') {
    if (d.giro_abertura) linhas.push(['Sentido de abertura', rotular(ROTULOS_GIRO_ABERTURA, d.giro_abertura)])
    if (d.giro_fechadura_lado) linhas.push(['Lado da fechadura', rotular(ROTULOS_LADO, d.giro_fechadura_lado)])
    if (d.giro_puxador) linhas.push(['Puxador adicional', 'Sim'])
  }

  // Estrutura
  if (d.contra_marco) linhas.push(['Contra-marco', traduzirSimNao(d.contra_marco)])
  if (d.soleira) linhas.push(['Soleira', traduzirSimNao(d.soleira)])
  if (d.contra_marco === 'nao' && d.instalacao) {
    linhas.push(['Instalação', rotular(ROTULOS_INSTALACAO, d.instalacao)])
  }

  // Acabamento (sempre relevante pra producao)
  linhas.push(['Arremate interno', d.arremate_interno ? 'Sim' : 'Não'])
  if (d.arremate_externo) {
    const tipo = d.arremate_externo_tipo ? ' (' + rotular(ROTULOS_ARREMATE_EXT, d.arremate_externo_tipo) + ')' : ''
    linhas.push(['Arremate externo', 'Sim' + tipo])
  } else {
    linhas.push(['Arremate externo', 'Não'])
  }
  if (d.meia_cana_interna) linhas.push(['Meia-cana interna', 'Sim'])

  // Diagnostico do vao
  if (d.vao_pronto) linhas.push(['Vão pronto', traduzirSimNao(d.vao_pronto)])
  if (d.vao_pronto === 'nao' && d.precisa_correcao) {
    linhas.push(['Pendências do vão', d.precisa_correcao])
  }

  // Medidas
  if (d.medida_largura || d.medida_altura) {
    linhas.push(['Medidas (LxA)', (d.medida_largura || '?') + ' x ' + (d.medida_altura || '?')])
  }

  // Motor (se aplicavel)
  if (d.tem_motor) {
    linhas.push(['Motor', 'Sim, lado ' + (d.motor_lado || '?') + ', ' + (d.motor_tensao || '?')])
  }

  if (d.observacao) linhas.push(['Observações', d.observacao])

  desenharTabelaChaveValor(ctx, linhas)
  ctx.y -= 6
}

function desenharBlocoM2(ctx: Ctx, m2: Checklist | undefined) {
  garantirEspaco(ctx, 60)
  desenharTexto(ctx, 'Medição 2 — Conferência final', { size: 11, font: ctx.fontBold })
  ctx.y -= 16

  if (!m2) {
    desenharTexto(ctx, 'Não realizada.', { color: COR_SOFT })
    ctx.y -= LINE_H
    ctx.y -= 8
    return
  }

  const d = m2.dados as DadosMedicao2
  const linhas: [string, string][] = [
    ['Data', formatarDataCurta(d.data)],
    ['Técnico', d.tecnico || '-'],
    ['Responsável na obra', d.responsavel_obra || '-'],
  ]

  // Estado do vao
  if (d.contra_marco_instalado) linhas.push(['Contra-marco instalado?', traduzirSimNao(d.contra_marco_instalado)])
  if (d.piso_acabado) linhas.push(['Piso acabado?', traduzirSimNao(d.piso_acabado)])
  if (d.vao_acabado) linhas.push(['Vão acabado?', traduzirSimNao(d.vao_acabado)])
  if (d.nivel_ok) linhas.push(['Nível OK?', traduzirSimNao(d.nivel_ok) + (d.nivel_obs ? ' (' + d.nivel_obs + ')' : '')])
  if (d.prumo_ok) linhas.push(['Prumo OK?', traduzirSimNao(d.prumo_ok) + (d.prumo_obs ? ' (' + d.prumo_obs + ')' : '')])

  // Tipologia + specs finais
  if (d.tipologia) linhas.push(['Tipologia (final)', ROTULOS_TIPOLOGIA[d.tipologia as Exclude<typeof d.tipologia, ''>] ?? d.tipologia])

  // Specs de Correr
  if (d.tipologia === 'correr') {
    if (d.correr_abertura_lado) linhas.push(['Lado da abertura', rotular(ROTULOS_CORRER_ABERTURA, d.correr_abertura_lado)])
    if (d.correr_fecho) linhas.push(['Fecho', rotular(ROTULOS_CORRER_FECHO, d.correr_fecho)])
    if (d.correr_trilho) linhas.push(['Trilho', rotular(ROTULOS_CORRER_TRILHO, d.correr_trilho)])
    if (d.correr_somente_puxador) linhas.push(['Somente puxador (sem chave)', 'Sim'])
  }

  // Specs de Giro
  if (d.tipologia === 'giro') {
    if (d.giro_abertura) linhas.push(['Sentido de abertura', rotular(ROTULOS_GIRO_ABERTURA, d.giro_abertura)])
    if (d.giro_fechadura_lado) linhas.push(['Lado da fechadura', rotular(ROTULOS_LADO, d.giro_fechadura_lado)])
    if (d.giro_puxador) linhas.push(['Puxador adicional', 'Sim'])
  }

  if (d.soleira) linhas.push(['Soleira', traduzirSimNao(d.soleira)])

  // Acabamento
  linhas.push(['Arremate interno', d.arremate_interno ? 'Sim' : 'Não'])
  if (d.arremate_externo) {
    const tipo = d.arremate_externo_tipo ? ' (' + rotular(ROTULOS_ARREMATE_EXT, d.arremate_externo_tipo) + ')' : ''
    linhas.push(['Arremate externo', 'Sim' + tipo])
  } else {
    linhas.push(['Arremate externo', 'Não'])
  }

  // Motor (se aplicavel)
  if (d.tem_motor) {
    linhas.push(['Motor', 'Sim, lado ' + (d.motor_lado || '?') + ', ' + (d.motor_tensao || '?')])
  }

  // Medidas finais
  if (d.medida_largura || d.medida_altura) {
    linhas.push(['Medidas finais (LxA)', (d.medida_largura || '?') + ' x ' + (d.medida_altura || '?')])
  }

  linhas.push(['Liberado pra produção?', traduzirSimNao(d.liberado_producao)])
  if (d.liberado_producao === 'nao' && d.pendencias) {
    linhas.push(['Pendências', d.pendencias])
  }

  desenharTabelaChaveValor(ctx, linhas)
  ctx.y -= 6
}

// =============== Sumario do Dossie ===============

// Tabela executiva no inicio do Dossie: peça | tipo | situação | aceite-em.
// Permite leitura "executiva" antes de mergulhar nos detalhes de cada peca.
function desenharSumarioDossie(ctx: Ctx, cards: Card[]) {
  if (cards.length === 0) return

  garantirEspaco(ctx, 40 + cards.length * 14)

  // Titulo
  desenharTexto(ctx, 'Sumário das peças', { size: 11, font: ctx.fontBold })
  ctx.y -= 18

  // Colunas (X positions)
  const colSigla = MARGIN + 4
  const colTipo = MARGIN + 80
  const colSituacao = MARGIN + 170
  const colAceite = PAGE_W - MARGIN - 80

  // Header da tabela
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - 14,
    width: PAGE_W - MARGIN * 2, height: 14,
    color: rgb(0.95, 0.95, 0.95),
  })
  ctx.page.drawText('Peça', { x: colSigla, y: ctx.y - 10, size: 8, font: ctx.fontBold, color: COR_LABEL })
  ctx.page.drawText('Tipo', { x: colTipo, y: ctx.y - 10, size: 8, font: ctx.fontBold, color: COR_LABEL })
  ctx.page.drawText('Situação', { x: colSituacao, y: ctx.y - 10, size: 8, font: ctx.fontBold, color: COR_LABEL })
  ctx.page.drawText('Aceite em', { x: colAceite, y: ctx.y - 10, size: 8, font: ctx.fontBold, color: COR_LABEL })
  ctx.y -= 16

  // Linhas
  for (const card of cards) {
    garantirEspaco(ctx, 14)
    const tipoLabel: Record<string, string> = { peca: 'Item', acordo: 'Acordo', reclamacao: 'Apontamento' }
    const tipo = tipoLabel[card.tipo] ?? card.tipo
    const situacao = resumirSituacao(card)
    const aceite = card.aceiteFinal ? formatarDataCurta(card.aceiteFinal) : '—'

    // Trunca situação pra não invadir coluna aceite
    const larguraSit = colAceite - colSituacao - 8
    const situacaoFinal = truncarTexto(situacao, ctx.fontRegular, 9, larguraSit)

    ctx.page.drawText(sanitize(card.sigla), { x: colSigla, y: ctx.y - 9, size: 9, font: ctx.fontBold, color: COR_TEXTO })
    ctx.page.drawText(sanitize(tipo), { x: colTipo, y: ctx.y - 9, size: 9, font: ctx.fontRegular, color: COR_TEXTO })
    ctx.page.drawText(sanitize(situacaoFinal), { x: colSituacao, y: ctx.y - 9, size: 9, font: ctx.fontRegular, color: COR_TEXTO })
    ctx.page.drawText(sanitize(aceite), { x: colAceite, y: ctx.y - 9, size: 9, font: ctx.fontRegular, color: COR_SOFT })

    // Linha separadora fina
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y - 13 },
      end: { x: PAGE_W - MARGIN, y: ctx.y - 13 },
      thickness: 0.3,
      color: COR_LINHA,
    })
    ctx.y -= 14
  }
  ctx.y -= 14
}

// Resumo curto da situacao do card pra coluna do sumario
function resumirSituacao(card: Card): string {
  if (card.aceiteFinal) return 'Aceite confirmado'
  if (card.encerrado) return card.subStatus ?? 'Encerrado'
  if (card.subStatus) return card.subStatus
  // Fallback por aba
  const porAba: Record<string, string> = {
    cliente: 'Aguardando cliente',
    empresa: 'Aguardando empresa',
    tecnica: 'Aguardando visita técnica',
    emandamento: card.statusEmAndamento ?? 'Em produção',
    conclusao: 'Aguardando aceite',
  }
  return porAba[card.aba] ?? card.aba
}

// Trunca texto pra caber em largura maxima (com elipse)
function truncarTexto(texto: string, font: PDFFont, size: number, maxWidth: number): string {
  if (!texto) return ''
  const safe = sanitize(texto)
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe
  // Trunca char por char ate caber + reticencias
  for (let i = safe.length - 1; i > 0; i--) {
    const tentativa = safe.slice(0, i) + '…'
    if (font.widthOfTextAtSize(tentativa, size) <= maxWidth) return tentativa
  }
  return '…'
}

// =============== Secao DOSSIE ===============

function desenharSecaoDossie(ctx: Ctx, card: Card, eventos: HistoricoRow[], fotos: { img: any; createdAt: string }[] = []) {
  garantirEspaco(ctx, 80)
  desenharCabecalhoPeca(ctx, card)

  if (eventos.length === 0) {
    desenharTexto(ctx, 'Sem eventos públicos registrados.', { color: COR_SOFT })
    ctx.y -= LINE_H
    ctx.y -= 8
    return
  }

  desenharTexto(ctx, 'Linha do tempo (' + eventos.length + ' evento' + (eventos.length === 1 ? '' : 's') + ')', { size: 10, font: ctx.fontBold })
  ctx.y -= 14

  // Itera eventos. Quando achar evento "Foto adicionada", mostra fotos
  // proximas no tempo (dentro de uma janela de 1 minuto) embedded apos a caixa
  // do evento. Cada foto so usada uma vez (consome do array).
  const fotosRestantes = [...fotos]
  for (const ev of eventos) {
    desenharEventoTimeline(ctx, ev)
    if (eventoTemFoto(ev)) {
      const fotosDoEvento = consumirFotosProximas(fotosRestantes, ev.created_at)
      if (fotosDoEvento.length > 0) {
        desenharFotosInline(ctx, fotosDoEvento)
      }
    }
  }
  // Sobrou foto que nao casou com nenhum evento? Mostra em galeria no fim.
  if (fotosRestantes.length > 0) {
    desenharGaleriaPeca(ctx, fotosRestantes)
  }
  ctx.y -= 8
}

// Detecta se evento e do tipo "adicionou foto" (texto começa com "Foto adicionada")
function eventoTemFoto(ev: HistoricoRow): boolean {
  return /^Foto[s]?\s+adicionada/i.test(ev.texto || '')
}

// Pega ate N fotos do array cuja data esta dentro de 60s do timestamp do evento.
// Remove as escolhidas do array (mutate).
function consumirFotosProximas(fotos: { img: any; createdAt: string }[], iso: string): { img: any; createdAt: string }[] {
  if (fotos.length === 0) return []
  const tEvento = new Date(iso).getTime()
  const janelaMs = 60 * 1000 // 60 segundos
  const escolhidas: { img: any; createdAt: string }[] = []
  for (let i = fotos.length - 1; i >= 0; i--) {
    const tFoto = new Date(fotos[i].createdAt).getTime()
    if (Math.abs(tFoto - tEvento) <= janelaMs) {
      escolhidas.unshift(fotos[i])
      fotos.splice(i, 1)
    }
  }
  return escolhidas
}

// Versao compacta da galeria pra ficar dentro/abaixo de um evento da timeline.
// Limite implicito de 4 por linha (ja respeita os 4 do limite por peca).
function desenharFotosInline(ctx: Ctx, fotos: { img: any; createdAt: string }[]) {
  const colunas = 4
  const gap = 8
  // Indentado pra ficar visualmente "dentro" do evento (margem +10)
  const larguraDisponivel = PAGE_W - MARGIN * 2 - 10
  const caixaW = (larguraDisponivel - gap * (colunas - 1)) / colunas
  const caixaH = caixaW * 0.75
  const linhas = Math.ceil(fotos.length / colunas)
  const alturaTotal = linhas * caixaH + (linhas - 1) * gap + 4

  garantirEspaco(ctx, alturaTotal)
  ctx.y -= 2

  for (let i = 0; i < fotos.length; i++) {
    const col = i % colunas
    const linha = Math.floor(i / colunas)
    const x = MARGIN + 10 + col * (caixaW + gap)
    const y = ctx.y - (linha + 1) * caixaH - linha * gap
    desenharFotoEnquadrada(ctx, fotos[i].img, x, y, caixaW, caixaH)
  }
  ctx.y -= linhas * caixaH + (linhas - 1) * gap + 8
}

function desenharEventoTimeline(ctx: Ctx, ev: HistoricoRow) {
  // Layout: caixa cinza-clarinha cercando cada evento. Barra colorida à esquerda
  // (cor do autor: laranja=Empresa, azul=Cliente, teal=Técnico, cinza=Sistema).
  // Header da caixa: autor (cor) + data/hora compacta (cinza).
  // Corpo: texto do evento.
  const corAutor = corDoAutor(ev.autor_tipo)
  const dataCompacta = formatarDataHoraCompacta(ev.created_at)
  const autorLabel = (ev.autor || '(autor não informado)')
  const tipoLabel = traduzirAutorTipo(ev.autor_tipo)

  const larguraConteudo = PAGE_W - MARGIN * 2 - 16
  const corpoLinhas = quebrarLinhas(ev.texto || '(sem texto)', ctx.fontRegular, FONT_BODY, larguraConteudo - 8)

  const alturaConteudo = LINE_H + corpoLinhas.length * LINE_H + 8
  garantirEspaco(ctx, alturaConteudo + 6)

  // Fundo da caixa
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - alturaConteudo,
    width: PAGE_W - MARGIN * 2, height: alturaConteudo,
    color: COR_CARD_BG,
    borderColor: COR_LINHA,
    borderWidth: 0.5,
  })
  // Barra colorida à esquerda (3px)
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - alturaConteudo,
    width: 3, height: alturaConteudo,
    color: corAutor,
  })

  // Header: autor (em cor) + tipo (cinza) à esquerda, data à direita
  const yHeader = ctx.y - 4
  ctx.page.drawText(sanitize(autorLabel), {
    x: MARGIN + 10, y: yHeader - 8,
    size: 9, font: ctx.fontBold, color: corAutor,
  })
  const autorW = ctx.fontBold.widthOfTextAtSize(sanitize(autorLabel), 9)
  ctx.page.drawText(' · ' + sanitize(tipoLabel), {
    x: MARGIN + 10 + autorW, y: yHeader - 8,
    size: 8, font: ctx.fontRegular, color: COR_SOFT,
  })
  // Data alinhada à direita
  const dataW = ctx.fontRegular.widthOfTextAtSize(sanitize(dataCompacta), 8)
  ctx.page.drawText(sanitize(dataCompacta), {
    x: PAGE_W - MARGIN - 10 - dataW, y: yHeader - 8,
    size: 8, font: ctx.fontRegular, color: COR_SOFT,
  })
  ctx.y -= LINE_H + 4

  // Corpo: texto
  for (const linha of corpoLinhas) {
    ctx.page.drawText(linha, {
      x: MARGIN + 10, y: ctx.y - FONT_BODY,
      size: FONT_BODY, font: ctx.fontRegular, color: COR_TEXTO,
    })
    ctx.y -= LINE_H
  }
  ctx.y -= 6 // espaço entre caixas
}

// =============== Tabela chave-valor ===============

function desenharTabelaChaveValor(ctx: Ctx, linhas: [string, string][]) {
  const colKey = MARGIN + 8
  const colVal = MARGIN + 150
  const valWidth = PAGE_W - MARGIN - colVal

  for (const [k, v] of linhas) {
    const valLinhas = quebrarLinhas(v, ctx.fontRegular, FONT_BODY, valWidth)
    const altura = Math.max(LINE_H, valLinhas.length * LINE_H)
    garantirEspaco(ctx, altura)

    ctx.page.drawText(sanitize(k), {
      x: colKey, y: ctx.y - FONT_BODY,
      size: FONT_BODY, font: ctx.fontBold, color: COR_LABEL,
    })
    for (let i = 0; i < valLinhas.length; i++) {
      ctx.page.drawText(valLinhas[i], {
        x: colVal, y: ctx.y - FONT_BODY - i * LINE_H,
        size: FONT_BODY, font: ctx.fontRegular, color: COR_TEXTO,
      })
    }
    ctx.y -= altura
  }
}

// =============== Branding e Footer ===============

// Marca G Obra discreta no canto superior direito de todas as paginas.
// Esmaecida (cor laranja com transparencia) pra nao competir com conteudo.
function desenharBrandingTopo(ctx: Ctx) {
  const total = ctx.pdf.getPageCount()
  for (let i = 0; i < total; i++) {
    const p = ctx.pdf.getPage(i)
    const texto = 'G Obra'
    const w = ctx.fontBold.widthOfTextAtSize(texto, 9)
    // Pula a primeira pagina porque a capa ja tem o titulo grande
    if (i === 0) continue
    p.drawText(texto, {
      x: PAGE_W - MARGIN - w, y: PAGE_H - MARGIN + 6,
      size: 9, font: ctx.fontBold, color: COR_DESTAQUE,
      opacity: 0.35,
    })
  }
}

// Rodape em todas as paginas: identidade da empresa emitente + atribuicao G Obra + paginacao.
function desenharFooters(ctx: Ctx, empresa: EmpresaInfo) {
  const total = ctx.pdf.getPageCount()
  const linhaEmpresa = empresa.cnpj
    ? empresa.nome + ' · CNPJ ' + empresa.cnpj
    : empresa.nome
  const linhaGerado = 'Documento gerado pelo G Obra em ' + formatarDataHoraCompacta(new Date().toISOString())

  for (let i = 0; i < total; i++) {
    const p = ctx.pdf.getPage(i)
    // Linha separadora fininha acima do rodape
    p.drawLine({
      start: { x: MARGIN, y: 38 },
      end: { x: PAGE_W - MARGIN, y: 38 },
      thickness: 0.4,
      color: COR_LINHA,
    })
    // Linha 1: empresa emitente + CNPJ (esquerda)
    p.drawText(sanitize(linhaEmpresa), {
      x: MARGIN, y: 26, size: 8, font: ctx.fontBold, color: COR_TEXTO,
    })
    // Linha 2: atribuicao (esquerda, abaixo)
    p.drawText(sanitize(linhaGerado), {
      x: MARGIN, y: 14, size: 7, font: ctx.fontRegular, color: COR_SOFT,
    })
    // Paginacao (direita)
    const pagTxt = 'Página ' + (i + 1) + ' de ' + total
    const pagW = ctx.fontRegular.widthOfTextAtSize(pagTxt, 8)
    p.drawText(pagTxt, {
      x: PAGE_W - MARGIN - pagW, y: 20, size: 8, font: ctx.fontRegular, color: COR_SOFT,
    })
  }
}

// =============== Helpers de formatacao ===============

function formatarDataLonga(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
    }) + ' (BRT)'
  } catch {
    return iso
  }
}

// Versao compacta pra timeline e cabecalhos: "10/05/26 · 22:18"
function formatarDataHoraCompacta(iso: string): string {
  try {
    const d = new Date(iso)
    const data = d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo',
    })
    const hora = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    })
    return data + ' · ' + hora
  } catch {
    return iso
  }
}

function formatarDataCurta(iso: string): string {
  if (!iso) return '-'
  if (iso.length === 10) {
    const [y, m, d] = iso.split('-')
    return d + '/' + m + '/' + y
  }
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

function traduzirSimNao(v: string): string {
  if (v === 'sim') return 'Sim'
  if (v === 'nao') return 'Não'
  return '-'
}

function traduzirAutorTipo(t: string): string {
  const mapa: Record<string, string> = {
    empresa: 'empresa', cliente: 'cliente', tecnico: 'tecnico', sistema: 'sistema',
  }
  return mapa[t] ?? t
}

// =============== Filename helper ===============

export function nomeArquivoMedicao(obra: ObraInfo): string {
  return 'medicao_' + slugObra(obra) + '_' + dataCurtaArquivo() + '.pdf'
}

export function nomeArquivoDossie(obra: ObraInfo): string {
  return 'dossie_' + slugObra(obra) + '_' + dataCurtaArquivo() + '.pdf'
}

function slugObra(obra: ObraInfo): string {
  return (obra.nome || 'obra')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function dataCurtaArquivo(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
}
