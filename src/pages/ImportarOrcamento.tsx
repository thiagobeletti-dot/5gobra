// Página Importar Orçamento — recebe PDF de orçamento e cria obra + cards.
//
// Cravado em 09/06/2026. Aceita PDF do formato de orçamento usado pelo Vitor/
// Windoor (parser interno em src/lib/parser-wvetro.ts). UI propositalmente
// genérica — não menciona o sistema de origem do PDF pra evitar exposição
// competitiva. Se sistema X reconhecer o padrão, processa; senão dá erro
// orientado ("PDF não reconhecido — confira o formato").
//
// FLUXO V1:
// 1. Usuário arrasta/seleciona PDF
// 2. pdfjs-dist extrai texto (browser, sem backend)
// 3. parsearTextoWvetro() retorna estrutura (sem valores monetários)
// 4. Preview: cliente + N itens detectados (editáveis)
// 5. Confirma → cria 1 obra + N cards
// 6. Redirect pra obra recém-criada

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { useAuth, sair } from '../lib/auth'
import { criarObra, criarVariosCards, pegarMinhaEmpresa } from '../lib/api'
import {
  parsearPdfOrcamentoCompleto,
  nomeSistema,
  type OrcamentoUnificado,
  type CardImportadoUnificado,
} from '../lib/parser-orcamento'

type Etapa = 'selecionar' | 'extraindo' | 'preview' | 'salvando' | 'concluido'

export default function ImportarOrcamento() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [etapa, setEtapa] = useState<Etapa>('selecionar')
  const [orcamento, setOrcamento] = useState<OrcamentoUnificado | null>(null)
  const [cards, setCards] = useState<CardImportadoUnificado[]>([])
  const [nomeObraEdit, setNomeObraEdit] = useState('')
  const [interacaoCliente, setInteracaoCliente] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [obraIdCriada, setObraIdCriada] = useState<string | null>(null)
  const [edicoes, setEdicoes] = useState<Record<string, EdicaoItem>>({})

  async function logout() {
    await sair()
    navigate('/')
  }

  async function lidarComArquivo(arquivo: File) {
    setErro(null)
    setEtapa('extraindo')
    try {
      if (arquivo.type && !arquivo.type.includes('pdf')) {
        throw new Error('O arquivo precisa ser um PDF.')
      }
      const orc = await parsearPdfOrcamentoCompleto(arquivo)
      setOrcamento(orc)
      setCards(orc.cards)
      setEdicoes({})
      setNomeObraEdit(orc.cliente.nome ?? 'Obra importada')
      setEtapa('preview')
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao processar PDF')
      setEtapa('selecionar')
    }
  }

  async function confirmarImportacao() {
    if (!orcamento || cards.length === 0) return
    const itensPreview = itensDoOrcamento(orcamento)
    if (totalPecasComEdicoes(itensPreview, edicoes) === 0) {
      setErro('Selecione pelo menos um item pra criar a obra.')
      return
    }
    setErro(null)
    setEtapa('salvando')
    try {
      const empresa = await pegarMinhaEmpresa()
      if (!empresa) throw new Error('Empresa não encontrada. Cria uma empresa primeiro.')

      const obra = await criarObra({
        empresa_id: empresa.id,
        nome: nomeObraEdit.trim() || 'Obra importada',
        endereco: orcamento.cliente.endereco ?? undefined,
        cliente_nome: orcamento.cliente.nome ?? undefined,
        interacao_cliente: interacaoCliente,
      })

      // Cria os cards em batch, aplicando as edições do preview (qtde alterada /
      // itens removidos). Obra gerencial (sem interação do cliente): não existe lane
      // do cliente — itens já nascem em Técnica (mesma regra do criarNovo/aplicarModoGerencialNaObra).
      const aba = interacaoCliente ? ('cliente' as const) : ('tecnica' as const)
      await criarVariosCards(
        construirLinhasParaCriar(obra.id, itensPreview, cards, edicoes, aba),
      )

      setObraIdCriada(obra.id)
      setEtapa('concluido')
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao criar obra')
      setEtapa('preview')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/app/dashboard">
            <LogoFull />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/app/dashboard" className="text-slate-500 hover:text-slate-900">
              Dashboard
            </Link>
            <Link to="/app/obras" className="text-slate-500 hover:text-slate-900">
              Obras
            </Link>
            <Link to="/app/ajuda" className="text-slate-500 hover:text-slate-900">
              Ajuda
            </Link>
            <Link to="/app/configuracoes" className="text-slate-500 hover:text-slate-900">
              Configurações
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden lg:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Importar Orçamento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Suba o PDF do orçamento e o sistema cria a obra com todas as peças prontas pra
            você gerenciar.
          </p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {erro}
          </div>
        )}

        {etapa === 'selecionar' && <SelecionarArquivo onArquivo={lidarComArquivo} />}

        {etapa === 'extraindo' && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3 animate-pulse">📄</div>
            <p className="text-base font-semibold text-slate-800">Lendo o PDF</p>
            <p className="text-sm text-slate-500 mt-1">
              Extraindo texto e identificando itens... costuma levar 2-5 segundos.
            </p>
          </div>
        )}

        {etapa === 'preview' && orcamento && (
          <Preview
            orcamento={orcamento}
            cards={cards}
            nomeObra={nomeObraEdit}
            onNomeObraChange={setNomeObraEdit}
            interacaoCliente={interacaoCliente}
            onInteracaoClienteChange={setInteracaoCliente}
            edicoes={edicoes}
            onEditarItem={(chave, patch) =>
              setEdicoes((prev) => ({ ...prev, [chave]: { ...(prev[chave] ?? {}), ...patch } }))
            }
            onConfirmar={confirmarImportacao}
            onVoltar={() => setEtapa('selecionar')}
          />
        )}

        {etapa === 'salvando' && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3 animate-pulse">💾</div>
            <p className="text-base font-semibold text-slate-800">Criando obra no G Obra</p>
            <p className="text-sm text-slate-500 mt-1">
              Salvando a obra e os {cards.length} cards de peça... quase lá.
            </p>
          </div>
        )}

        {etapa === 'concluido' && obraIdCriada && (
          <ConcluidoCard obraId={obraIdCriada} qtdeCards={cards.length} />
        )}
      </main>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

function SelecionarArquivo({ onArquivo }: { onArquivo: (f: File) => void }) {
  const [arrastando, setArrastando] = useState(false)

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setArrastando(false)
    const arquivo = e.dataTransfer.files[0]
    if (arquivo) onArquivo(arquivo)
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      className={`bg-white border-2 border-dashed rounded-xl p-12 text-center transition ${
        arrastando ? 'border-laranja bg-laranja-soft' : 'border-slate-300'
      }`}
    >
      <div className="text-4xl mb-3 opacity-40">📥</div>
      <h2 className="font-semibold text-lg mb-1">Arraste o PDF aqui</h2>
      <p className="text-sm text-slate-500 mb-5">ou clique pra selecionar do computador</p>
      <label className="btn-primary cursor-pointer inline-block">
        Selecionar PDF
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0]
            if (arquivo) onArquivo(arquivo)
          }}
        />
      </label>
      <p className="text-xs text-slate-400 mt-6 max-w-md mx-auto">
        💡 Funciona com PDFs de orçamento padrão da indústria de esquadrias (com tipo,
        dimensões e quantidade por item). O sistema identifica automaticamente cliente e
        peças.
      </p>
    </div>
  )
}

// Item normalizado pra exibição no preview (campos comuns entre sistemas).
type ItemPreview = {
  chave: string
  codigo: string                   // PA1, PA2, T1, T2...
  descricao: string
  qtde: number
  larguraMm: number
  alturaMm: number
  ambiente: string
  tipologia: string
  vidroDescricao: string
  corPerfil: string
}

function itensDoOrcamento(orc: OrcamentoUnificado): ItemPreview[] {
  if (orc.detalhes.wvetro) {
    return orc.detalhes.wvetro.itens.map((i) => ({
      chave: String(i.ordem),
      codigo: i.tipo || `IT${i.ordem}`,
      descricao: i.descricaoCompleta,
      qtde: i.qtde,
      larguraMm: i.larguraMm,
      alturaMm: i.alturaMm,
      ambiente: i.ambiente,
      tipologia: i.tipologia,
      vidroDescricao: i.vidro.descricaoBruta || 'Sem vidro',
      corPerfil: i.corPerfil,
    }))
  }
  if (orc.detalhes.wvetroV2) {
    return orc.detalhes.wvetroV2.itens.map((i) => ({
      chave: String(i.ordem),
      codigo: `IT${i.ordem}`,
      descricao: i.descricaoCompleta,
      qtde: i.qtde,
      larguraMm: i.larguraMm,
      alturaMm: i.alturaMm,
      ambiente: i.ambiente,
      tipologia: i.tipologia,
      vidroDescricao: i.vidro.descricaoBruta || 'Sem vidro',
      corPerfil: i.corPerfil,
    }))
  }
  if (orc.detalhes.smartcem) {
    return orc.detalhes.smartcem.itens.map((i) => ({
      chave: String(i.ordem),
      codigo: i.tipo || `T${i.ordem}`,
      descricao: i.descricaoCompleta,
      qtde: i.qtde,
      larguraMm: i.larguraMm,
      alturaMm: i.alturaMm,
      ambiente: i.ambiente,
      tipologia: i.tipologia,
      vidroDescricao: i.vidro.descricaoBruta || 'Sem vidro',
      corPerfil: i.corPerfil,
    }))
  }
  if (orc.detalhes.invictos) {
    return orc.detalhes.invictos.itens.map((i) => ({
      chave: String(i.ordem),
      codigo: `IT${i.ordem}`,
      descricao: i.descricaoCompleta,
      qtde: i.qtde,
      larguraMm: i.larguraMm,
      alturaMm: i.alturaMm,
      ambiente: i.ambiente,
      tipologia: i.tipologia,
      vidroDescricao: i.vidro.descricaoBruta || 'Sem vidro',
      corPerfil: i.corPerfil,
    }))
  }
  return []
}

// Edições do usuário no preview. Campos opcionais = "sem override" (usa o original).
type EdicaoItem = { qtde?: number; incluir?: boolean }

/**
 * Monta as linhas de card a partir dos itens, aplicando as edições do usuário
 * (qtde alterada ou item removido). Os parsers expandem os cards EM ORDEM — item 1
 * gera qtde1 cards, item 2 gera qtde2... — então fatiamos `cards` por qtde acumulada
 * e mapeamos item→cards com segurança em qualquer formato, sem casar sigla.
 * Sem mudança de qtde: usa os cards originais (nome/descrição/sigla intactos).
 * Com mudança: regenera sigla/nome a partir da sigla-base do próprio item.
 */
function construirLinhasParaCriar(
  obraId: string,
  itens: ItemPreview[],
  cards: CardImportadoUnificado[],
  edicoes: Record<string, EdicaoItem>,
  aba: 'cliente' | 'tecnica',
) {
  const linhas: Array<{
    obra_id: string
    tipo: 'peca'
    sigla: string
    nome: string
    descricao: string
    aba: 'cliente' | 'tecnica'
    largura_mm: number
    altura_mm: number
  }> = []
  let offset = 0
  for (const item of itens) {
    const qtdeOrig = item.qtde
    const slice = cards.slice(offset, offset + qtdeOrig)
    offset += qtdeOrig
    const ed = edicoes[item.chave]
    if (ed && ed.incluir === false) continue
    const novaQtde = Math.max(1, Math.floor(ed?.qtde ?? qtdeOrig))
    if (novaQtde === qtdeOrig) {
      for (const c of slice) {
        linhas.push({
          obra_id: obraId,
          tipo: 'peca',
          sigla: c.sigla,
          nome: c.nome,
          descricao: c.descricao,
          aba,
          largura_mm: c.larguraMm,
          altura_mm: c.alturaMm,
        })
      }
    } else {
      const baseSigla = (slice[0]?.sigla ?? item.codigo).replace(/-\d+$/, '')
      for (let k = 0; k < novaQtde; k++) {
        const src = slice[Math.min(k, slice.length - 1)]
        const baseNome = (src?.nome ?? item.descricao).replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/, '')
        linhas.push({
          obra_id: obraId,
          tipo: 'peca',
          sigla: novaQtde > 1 ? `${baseSigla}-${k + 1}` : baseSigla,
          nome: novaQtde > 1 ? `${baseNome} (${k + 1}/${novaQtde})` : baseNome,
          descricao: src?.descricao ?? item.descricao,
          aba,
          largura_mm: src?.larguraMm ?? item.larguraMm,
          altura_mm: src?.alturaMm ?? item.alturaMm,
        })
      }
    }
  }
  return linhas
}

/** Total de peças considerando as edições (removidos não contam; qtde alterada conta). */
function totalPecasComEdicoes(itens: ItemPreview[], edicoes: Record<string, EdicaoItem>): number {
  return itens.reduce((soma, item) => {
    const ed = edicoes[item.chave]
    if (ed && ed.incluir === false) return soma
    return soma + Math.max(1, Math.floor(ed?.qtde ?? item.qtde))
  }, 0)
}

function Preview({
  orcamento,
  cards,
  nomeObra,
  onNomeObraChange,
  interacaoCliente,
  onInteracaoClienteChange,
  edicoes,
  onEditarItem,
  onConfirmar,
  onVoltar,
}: {
  orcamento: OrcamentoUnificado
  cards: CardImportadoUnificado[]
  nomeObra: string
  onNomeObraChange: (v: string) => void
  interacaoCliente: boolean
  onInteracaoClienteChange: (v: boolean) => void
  edicoes: Record<string, EdicaoItem>
  onEditarItem: (chave: string, patch: EdicaoItem) => void
  onConfirmar: () => void
  onVoltar: () => void
}) {
  const itensPreview = itensDoOrcamento(orcamento)
  const qtdeItens = itensPreview.length
  const totalPecas = totalPecasComEdicoes(itensPreview, edicoes)
  const tiposAtivos = itensPreview.filter((i) => edicoes[i.chave]?.incluir !== false).length

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-base flex items-center gap-2 flex-wrap">
          <span>📄 Dados identificados</span>
          <span className="text-xs font-normal text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            ✓ PDF lido
          </span>
          <span className="text-xs font-normal text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            {nomeSistema(orcamento.sistema)}
          </span>
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Cliente</dt>
            <dd className="font-semibold text-slate-900">{orcamento.cliente.nome ?? '—'}</dd>
          </div>
          {orcamento.cliente.endereco && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">Endereço</dt>
              <dd className="font-semibold text-slate-900">{orcamento.cliente.endereco}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Itens detectados</dt>
            <dd className="font-semibold text-slate-900">
              <span className="text-laranja">{tiposAtivos}</span> tipo{tiposAtivos !== 1 ? 's' : ''} ·{' '}
              <span className="text-laranja">{totalPecas}</span> peça{totalPecas !== 1 ? 's' : ''} no total
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-base">🏷 Nome da obra</h2>
        <input
          type="text"
          value={nomeObra}
          onChange={(e) => onNomeObraChange(e.target.value)}
          className="input"
          placeholder="Nome da obra a criar"
        />
        <p className="text-xs text-slate-500 mt-2">
          Editável. Por padrão usamos o nome do cliente do orçamento.
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={interacaoCliente}
              onChange={(e) => onInteracaoClienteChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-laranja focus:ring-laranja"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">Interação do cliente</span>
              <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                <strong>Ligado:</strong> o cliente recebe o link, acompanha a obra e dá os aceites.{' '}
                <strong>Desligado:</strong> obra em modo gerencial (só empresa) — os itens importados
                já entram em Técnica e a entrega é finalizada pela sua conferência, sem aceite do cliente.
                Dá pra mudar depois em Editar obra.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-base">
          📦 Itens identificados ({qtdeItens})
        </h2>
        <ul className="space-y-2">
          {itensPreview.map((item) => {
            const ed = edicoes[item.chave]
            const incluido = ed?.incluir !== false
            const qtde = Math.max(1, Math.floor(ed?.qtde ?? item.qtde))
            const qtdeMudou = qtde !== item.qtde
            return (
              <li
                key={item.chave}
                className={`border rounded-lg p-3 text-sm ${
                  incluido ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700 font-mono">
                        {item.codigo}
                      </span>
                      <span className={incluido ? '' : 'line-through text-slate-400'}>
                        {item.descricao}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {item.larguraMm}×{item.alturaMm}mm
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <strong>Ambiente:</strong> {item.ambiente || '—'} ·{' '}
                      <strong>Tipologia:</strong> {item.tipologia} ·{' '}
                      <strong>Vidro:</strong> {item.vidroDescricao} ·{' '}
                      <strong>Cor perfil:</strong> {item.corPerfil || '—'}
                    </div>
                    {incluido && qtdeMudou && (
                      <div className="text-xs text-amber-600 mt-1">
                        Quantidade ajustada: {item.qtde} → {qtde} peça{qtde !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {incluido ? (
                      <>
                        <div className="flex items-center gap-1" title="Quantidade de peças">
                          <button
                            type="button"
                            onClick={() => onEditarItem(item.chave, { qtde: Math.max(1, qtde - 1) })}
                            className="w-7 h-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 leading-none"
                            aria-label="Diminuir quantidade"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={qtde}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10)
                              onEditarItem(item.chave, { qtde: Number.isNaN(v) ? 1 : Math.max(1, v) })
                            }}
                            className="w-14 text-center border border-slate-300 rounded py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => onEditarItem(item.chave, { qtde: qtde + 1 })}
                            className="w-7 h-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 leading-none"
                            aria-label="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditarItem(item.chave, { incluir: false })}
                          className="w-7 h-7 rounded border border-red-200 text-red-500 hover:bg-red-50 leading-none"
                          aria-label="Remover item"
                          title="Remover item"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEditarItem(item.chave, { incluir: true })}
                        className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 whitespace-nowrap"
                      >
                        ↩ Incluir de volta
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          💡 Cada peça vira <strong>1 card</strong> individual no G Obra — total de{' '}
          <strong>{totalPecas}</strong> card{totalPecas !== 1 ? 's' : ''}. Ajuste a quantidade nos{' '}
          <span className="font-mono">− / +</span> ou remova um item no <strong>✕</strong> antes de criar.
          Você gerencia medição, produção e aceite peça a peça.
        </p>
      </section>

      <div className="bg-gradient-to-r from-laranja-soft to-amber-50 border border-laranja/30 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900">Tudo certo pra criar a obra?</div>
          <div className="text-xs text-slate-600 mt-1">
            Vamos criar <strong>1 obra</strong> e <strong>{totalPecas} card{totalPecas !== 1 ? 's' : ''} de peça</strong> no
            G Obra. Pode ajustar depois a vontade.
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={onVoltar} className="btn-ghost">
            ← Voltar
          </button>
          <button
            onClick={onConfirmar}
            disabled={totalPecas === 0}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar obra →
          </button>
        </div>
      </div>
    </div>
  )
}

function ConcluidoCard({ obraId, qtdeCards }: { obraId: string; qtdeCards: number }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-10 text-center">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="font-bold text-xl mb-1">Obra criada!</h2>
      <p className="text-sm text-slate-600 mb-6">
        {qtdeCards} peça{qtdeCards !== 1 ? 's' : ''} importada{qtdeCards !== 1 ? 's' : ''}{' '}
        do PDF.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link to={`/app/obra/${obraId}`} className="btn-primary">
          Abrir a obra →
        </Link>
        <Link to="/app/obras" className="btn-ghost">
          Ver lista de obras
        </Link>
      </div>
    </div>
  )
}

