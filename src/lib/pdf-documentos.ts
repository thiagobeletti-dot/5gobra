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

// =============== API publica ===============

export interface EmpresaInfo {
  nome: string
  cnpj?: string | null
}

export async function gerarPdfMedicao(
  obra: ObraInfo,
  empresa: EmpresaInfo,
  cards: Card[],
): Promise<Uint8Array> {
  const ctx = await criarContexto('Ficha de Medicao')
  desenharCapa(ctx, 'Ficha de Medicao', obra, empresa, cards.length, 'pecas com M1/M2')
  for (const card of cards) {
    desenharSecaoMedicao(ctx, card)
  }
  desenharFooters(ctx, 'Ficha de Medicao')
  return await ctx.pdf.save()
}

export async function gerarPdfDossie(
  obra: ObraInfo,
  empresa: EmpresaInfo,
  cards: Card[],
  historicoPorCard: Map<string, HistoricoRow[]>,
): Promise<Uint8Array> {
  const ctx = await criarContexto('Dossie da obra')
  desenharCapa(ctx, 'Dossie da obra', obra, empresa, cards.length, 'pecas com historico')
  for (const card of cards) {
    const eventos = historicoPorCard.get(card.id) ?? []
    desenharSecaoDossie(ctx, card, eventos)
  }
  desenharFooters(ctx, 'Dossie da obra')
  return await ctx.pdf.save()
}

// Helper que dispara o download no browser (cria Blob URL e clica num <a>).
export function baixarPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
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

function desenharCapa(ctx: Ctx, titulo: string, obra: ObraInfo, empresa: EmpresaInfo, qtde: number, sufixo: string) {
  desenharTexto(ctx, titulo, { size: 22, font: ctx.fontBold })
  ctx.y -= 28
  desenharTexto(ctx, 'G Obra · 5gobra.com.br', { size: 9, color: COR_SOFT })
  ctx.y -= 18
  desenharLinha(ctx)
  ctx.y -= 14

  const bloco: [string, string][] = [
    ['Obra', obra.nome ?? '(sem nome)'],
    ['Endereco', obra.endereco ?? '-'],
    ['Cliente', obra.cliente ?? '-'],
    ['Inicio da obra', obra.inicio ?? '-'],
    ['Empresa emitente', empresa.nome + (empresa.cnpj ? ' (CNPJ ' + empresa.cnpj + ')' : '')],
    ['Data de emissao', formatarDataLonga(new Date().toISOString())],
    ['Conteudo', String(qtde) + ' ' + sufixo],
  ]
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
  ctx.y -= altura + 10
}

function desenharBlocoM1(ctx: Ctx, m1: Checklist | undefined) {
  garantirEspaco(ctx, 60)
  desenharTexto(ctx, 'Medicao 1 — Visita inicial', { size: 11, font: ctx.fontBold })
  ctx.y -= 16

  if (!m1) {
    desenharTexto(ctx, 'Nao realizada.', { color: COR_SOFT })
    ctx.y -= LINE_H
    return
  }

  const d = m1.dados as DadosMedicao1
  const linhas: [string, string][] = [
    ['Data', formatarDataCurta(d.data)],
    ['Tecnico', d.tecnico || '-'],
    ['Responsavel na obra', d.responsavel_obra || '-'],
    ['Tipologia executavel?', traduzirSimNao(d.tipologia_executavel)],
  ]
  if (d.tipologia_executavel === 'nao' && d.tipologia_problema) {
    linhas.push(['Problema reportado', d.tipologia_problema])
  }
  if (d.tipologia) linhas.push(['Tipologia', ROTULOS_TIPOLOGIA[d.tipologia as Exclude<typeof d.tipologia, ''>] ?? d.tipologia])
  if (d.contra_marco) linhas.push(['Contra-marco', traduzirSimNao(d.contra_marco)])
  if (d.soleira) linhas.push(['Soleira', traduzirSimNao(d.soleira)])
  if (d.vao_pronto) linhas.push(['Vao pronto', traduzirSimNao(d.vao_pronto)])
  if (d.vao_pronto === 'nao' && d.precisa_correcao) {
    linhas.push(['Pendencias do vao', d.precisa_correcao])
  }
  if (d.medida_largura || d.medida_altura) {
    linhas.push(['Medidas (LxA)', (d.medida_largura || '?') + ' x ' + (d.medida_altura || '?')])
  }
  if (d.tem_motor) {
    linhas.push(['Motor', 'Sim, lado ' + (d.motor_lado || '?') + ', ' + (d.motor_tensao || '?')])
  }
  if (d.observacao) linhas.push(['Observacoes', d.observacao])

  desenharTabelaChaveValor(ctx, linhas)
  ctx.y -= 6
}

function desenharBlocoM2(ctx: Ctx, m2: Checklist | undefined) {
  garantirEspaco(ctx, 60)
  desenharTexto(ctx, 'Medicao 2 — Conferencia final', { size: 11, font: ctx.fontBold })
  ctx.y -= 16

  if (!m2) {
    desenharTexto(ctx, 'Nao realizada.', { color: COR_SOFT })
    ctx.y -= LINE_H
    ctx.y -= 8
    return
  }

  const d = m2.dados as DadosMedicao2
  const linhas: [string, string][] = [
    ['Data', formatarDataCurta(d.data)],
    ['Tecnico', d.tecnico || '-'],
    ['Responsavel na obra', d.responsavel_obra || '-'],
  ]
  if (d.contra_marco_instalado) linhas.push(['Contra-marco instalado?', traduzirSimNao(d.contra_marco_instalado)])
  if (d.piso_acabado) linhas.push(['Piso acabado?', traduzirSimNao(d.piso_acabado)])
  if (d.vao_acabado) linhas.push(['Vao acabado?', traduzirSimNao(d.vao_acabado)])
  if (d.nivel_ok) linhas.push(['Nivel OK?', traduzirSimNao(d.nivel_ok) + (d.nivel_obs ? ' (' + d.nivel_obs + ')' : '')])
  if (d.prumo_ok) linhas.push(['Prumo OK?', traduzirSimNao(d.prumo_ok) + (d.prumo_obs ? ' (' + d.prumo_obs + ')' : '')])
  if (d.tipologia) linhas.push(['Tipologia (final)', ROTULOS_TIPOLOGIA[d.tipologia as Exclude<typeof d.tipologia, ''>] ?? d.tipologia])
  if (d.medida_largura || d.medida_altura) {
    linhas.push(['Medidas finais (LxA)', (d.medida_largura || '?') + ' x ' + (d.medida_altura || '?')])
  }
  linhas.push(['Liberado pra producao?', traduzirSimNao(d.liberado_producao)])
  if (d.liberado_producao === 'nao' && d.pendencias) {
    linhas.push(['Pendencias', d.pendencias])
  }

  desenharTabelaChaveValor(ctx, linhas)
  ctx.y -= 6
}

// =============== Secao DOSSIE ===============

function desenharSecaoDossie(ctx: Ctx, card: Card, eventos: HistoricoRow[]) {
  garantirEspaco(ctx, 80)
  desenharCabecalhoPeca(ctx, card)

  if (eventos.length === 0) {
    desenharTexto(ctx, 'Sem eventos publicos registrados.', { color: COR_SOFT })
    ctx.y -= LINE_H
    ctx.y -= 8
    return
  }

  desenharTexto(ctx, 'Linha do tempo (' + eventos.length + ' evento' + (eventos.length === 1 ? '' : 's') + ')', { size: 10, font: ctx.fontBold })
  ctx.y -= 14

  for (const ev of eventos) {
    desenharEventoTimeline(ctx, ev)
  }
  ctx.y -= 8
}

function desenharEventoTimeline(ctx: Ctx, ev: HistoricoRow) {
  const headerLine = formatarDataLonga(ev.created_at) + ' — ' + (ev.autor || '(autor nao informado)') + ' (' + traduzirAutorTipo(ev.autor_tipo) + ')'
  const corpoLinhas = quebrarLinhas(ev.texto || '(sem texto)', ctx.fontRegular, FONT_BODY, PAGE_W - MARGIN * 2 - 16)

  garantirEspaco(ctx, 16 + corpoLinhas.length * LINE_H + 4)

  ctx.page.drawCircle({
    x: MARGIN + 3, y: ctx.y - 4,
    size: 2, color: COR_DESTAQUE,
  })
  ctx.page.drawText(sanitize(headerLine), {
    x: MARGIN + 12, y: ctx.y - 4, size: 8, font: ctx.fontBold, color: COR_LABEL,
  })
  ctx.y -= LINE_H

  for (const linha of corpoLinhas) {
    garantirEspaco(ctx, LINE_H)
    ctx.page.drawText(linha, {
      x: MARGIN + 12, y: ctx.y - FONT_BODY, size: FONT_BODY, font: ctx.fontRegular, color: COR_TEXTO,
    })
    ctx.y -= LINE_H
  }
  ctx.y -= 4
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

// =============== Footer com paginacao ===============

function desenharFooters(ctx: Ctx, titulo: string) {
  const total = ctx.pdf.getPageCount()
  for (let i = 0; i < total; i++) {
    const p = ctx.pdf.getPage(i)
    p.drawText('G Obra — ' + sanitize(titulo), {
      x: MARGIN, y: 22, size: 8, font: ctx.fontRegular, color: COR_SOFT,
    })
    p.drawText((i + 1) + ' / ' + total, {
      x: PAGE_W - MARGIN - 30, y: 22, size: 8, font: ctx.fontRegular, color: COR_SOFT,
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
  if (v === 'nao') return 'Nao'
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
