// Parser de XML do Alumisoft (SmartCEM)
// Estrutura mapeada de exemplo real (caso Edson Rizzo, Fabrica da Esquadria)

import type { TipoCard } from '../types/obra'

export interface AlumisoftObra {
  codigo: string
  nome: string
  endereco: string
  corPerfilPadrao: string
  cliente: {
    nome: string
    cpfCnpj: string
    telefone: string
    email: string
  }
  tipologias: AlumisoftTipologia[]
}

export interface AlumisoftTipologia {
  codesqd: string
  tipo: string
  qtde: number
  larguraMm: number
  alturaMm: number
  acabamento: string
  descricao: string
  descricaoVidro: string
  localizacao: string
  pesoKg: number
  precoTotal: number
  precoEsqd: number
  precoVidro: number
}

// Item individual depois de expandir QTDE
export interface ItemImportado {
  sigla: string         // editavel pelo usuario
  nome: string          // descricao curta tipo "Porta de correr"
  descricao: string     // detalhes completos
  tipo: TipoCard        // sempre 'peca' nesse fluxo
  larguraMm: number
  alturaMm: number
  localizacao: string
  precoUnit: number
  origemTipologia: string  // codesqd, pra debug
}

// =============== Parsear XML ===============

/**
 * Le um arquivo XML do Alumisoft (encoding pode ser windows-1252).
 * Recebe ArrayBuffer pra suportar encoding nao-UTF8.
 */
export async function lerXmlAlumisoft(arquivo: File): Promise<AlumisoftObra> {
  const buffer = await arquivo.arrayBuffer()
  return parseXmlBuffer(buffer)
}

export function parseXmlBuffer(buffer: ArrayBuffer): AlumisoftObra {
  // Detecta encoding pelo declaration
  const bytes = new Uint8Array(buffer)
  const inicio = new TextDecoder('ascii').decode(bytes.slice(0, 200)).toLowerCase()

  let texto: string
  if (inicio.includes('windows-1252') || inicio.includes('iso-8859-1')) {
    texto = new TextDecoder('windows-1252').decode(buffer)
  } else {
    texto = new TextDecoder('utf-8').decode(buffer)
  }

  return parseXmlString(texto)
}

export function parseXmlString(texto: string): AlumisoftObra {
  const parser = new DOMParser()
  const doc = parser.parseFromString(texto, 'application/xml')
  const erro = doc.querySelector('parsererror')
  if (erro) throw new Error('XML invalido: ' + erro.textContent)

  const raiz = doc.querySelector('OBRA')
  if (!raiz) throw new Error('XML nao parece ser do Alumisoft (faltando <OBRA>)')

  const dadosObra = raiz.querySelector('DADOS_OBRA')
  const dadosCliente = raiz.querySelector('DADOS_CLIENTE')

  const obra: AlumisoftObra = {
    codigo: t(dadosObra, 'CODIGO'),
    nome: t(dadosObra, 'NOME'),
    endereco: enderecoConcat(dadosObra?.querySelector('ENDERECO_OBRA')),
    corPerfilPadrao: t(dadosObra, 'COR_PERF'),
    cliente: {
      nome: t(dadosCliente, 'NOME'),
      cpfCnpj: t(dadosCliente, 'CNPJ_CPF'),
      telefone: t(dadosCliente, 'CONTATO') || t(dadosCliente, 'END_FONE'),
      email: t(dadosCliente, 'EMAIL'),
    },
    tipologias: [],
  }

  raiz.querySelectorAll('TIPOLOGIA').forEach((tp) => {
    obra.tipologias.push({
      codesqd: t(tp, 'CODESQD'),
      tipo: t(tp, 'TIPO'),
      qtde: parseInt(t(tp, 'QTDE') || '1', 10) || 1,
      larguraMm: parseInt(t(tp, 'LARGURA') || '0', 10) || 0,
      alturaMm: parseInt(t(tp, 'ALTURA') || '0', 10) || 0,
      acabamento: t(tp, 'TRAT_PERF'),
      descricao: t(tp, 'DESCR'),
      descricaoVidro: t(tp, 'DESCR_VIDRO'),
      localizacao: t(tp, 'LOCALIZACAO'),
      pesoKg: parseFloat(t(tp, 'PESO_UNIT') || '0') || 0,
      precoTotal: parseFloat(t(tp, 'PRECO_UNIT') || '0') || 0,
      precoEsqd: parseFloat(t(tp, 'PRECO_UNIT_ESQD') || '0') || 0,
      precoVidro: parseFloat(t(tp, 'PRECO_UNIT_VIDRO') || '0') || 0,
    })
  })

  if (obra.tipologias.length === 0) {
    throw new Error('XML nao tem nenhuma tipologia listada')
  }

  return obra
}

function t(el: Element | null | undefined, tag: string): string {
  if (!el) return ''
  const filho = el.querySelector(tag)
  return (filho?.textContent ?? '').trim()
}

function enderecoConcat(end: Element | null | undefined): string {
  if (!end) return ''
  const partes = [
    t(end, 'END_LOGR'),
    t(end, 'END_NUMERO'),
    t(end, 'END_BAIRRO'),
    t(end, 'END_CIDADE'),
    t(end, 'END_UF'),
  ].filter(Boolean)
  return partes.join(', ')
}

// =============== Expandir TIPOLOGIAs em itens individuais ===============

/**
 * Recebe a obra do Alumisoft e expande as tipologias em itens (1 card por unidade).
 *
 * Sigla de cada peça segue o padrão `<TIPO>_<n>`, onde <TIPO> vem do XML
 * (ex: J1, P3) e <n> é a posição da peça dentro daquela tipologia.
 * Tipologia J1 com QTDE=8 vira J1_1 ... J1_8.
 *
 * Se duas tipologias diferentes vierem com mesmo TIPO no XML (caso raro),
 * o contador continua incrementando dentro daquele bucket pra evitar colisão.
 *
 * Fallback: se TIPO vier vazio do XML, cai no padrão antigo (prefixo do
 * DESCR detectado: P pra porta, J pra janela, F pra fixo, etc).
 */
export function tipologiasParaItens(obra: AlumisoftObra): ItemImportado[] {
  const contadoresPorTipo: Record<string, number> = {}
  const contadoresPorPrefixo: Record<string, number> = {}
  const itens: ItemImportado[] = []

  for (const tp of obra.tipologias) {
    const tipoCru = (tp.tipo || '').trim()
    const prefixo = detectarPrefixo(tp.descricao)
    const nomeCurto = nomeResumido(tp.descricao)

    for (let i = 0; i < tp.qtde; i++) {
      let sigla: string
      if (tipoCru) {
        // Caminho preferido: usa o codigo TIPO do XML (J1, P3) + sufixo
        contadoresPorTipo[tipoCru] = (contadoresPorTipo[tipoCru] || 0) + 1
        const n = contadoresPorTipo[tipoCru]
        sigla = `${tipoCru}_${n}`
      } else {
        // Fallback (TIPO vazio): mantem comportamento antigo
        contadoresPorPrefixo[prefixo] = (contadoresPorPrefixo[prefixo] || 0) + 1
        sigla = `${prefixo}${contadoresPorPrefixo[prefixo]}`
      }

      const dimensoes = `${tp.larguraMm}x${tp.alturaMm}mm`
      const partesDescricao = [
        tp.descricao,
        tp.descricaoVidro && `Vidro: ${tp.descricaoVidro}`,
        `Dimensoes: ${dimensoes}`,
        tp.acabamento && `Acabamento: ${tp.acabamento}`,
        tp.localizacao && `Local: ${tp.localizacao}`,
      ].filter(Boolean)

      itens.push({
        sigla,
        nome: nomeCurto || `Item ${tp.tipo}`,
        descricao: partesDescricao.join(' | '),
        tipo: 'peca',
        larguraMm: tp.larguraMm,
        alturaMm: tp.alturaMm,
        localizacao: tp.localizacao,
        precoUnit: tp.precoTotal,
        origemTipologia: tp.codesqd,
      })
    }
  }

  return itens
}

/**
 * Detecta prefixo da sigla a partir da descricao da tipologia.
 * Ordem de prioridade matters - termos mais especificos primeiro.
 */
function detectarPrefixo(descr: string): string {
  const d = (descr || '').toUpperCase()
  if (d.includes('PORTA')) return 'P'
  if (d.includes('JANELA')) return 'J'
  if (d.includes('VENEZ')) return 'V'   // veneziana
  if (d.includes('GUILHOTINA')) return 'G'
  if (d.includes('BANDEIRA') || d.includes('FIXO') || d.includes('VIDRO')) return 'F' // fixo/bandeira
  if (d.includes('BOX')) return 'B'
  return 'T' // tipologia generica
}

/**
 * Extrai um nome curto e amigavel da descricao da tipologia.
 * "PORTA DE CORRER - 3 FOLHAS - LINHA SUPREMA" -> "Porta de correr 3 folhas"
 */
function nomeResumido(descr: string): string {
  if (!descr) return ''
  const partes = descr.split(/\s*-\s*/).filter(Boolean)
  // Pega primeiras 2 partes, ignora linha/serie no final
  const semLinha = partes.filter((p) => !/^LINHA\b/i.test(p.trim()))
  const escolhidas = semLinha.slice(0, 2)
  return escolhidas.join(' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
