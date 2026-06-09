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
  parsearTextoWvetro,
  expandirItensEmCards,
  type OrcamentoWvetro,
  type CardImportadoWvetro,
} from '../lib/parser-wvetro'

type Etapa = 'selecionar' | 'extraindo' | 'preview' | 'salvando' | 'concluido'

export default function ImportarOrcamento() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [etapa, setEtapa] = useState<Etapa>('selecionar')
  const [orcamento, setOrcamento] = useState<OrcamentoWvetro | null>(null)
  const [cards, setCards] = useState<CardImportadoWvetro[]>([])
  const [nomeObraEdit, setNomeObraEdit] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [obraIdCriada, setObraIdCriada] = useState<string | null>(null)

  async function logout() {
    await sair()
    navigate('/')
  }

  async function lidarComArquivo(arquivo: File) {
    setErro(null)
    setEtapa('extraindo')
    try {
      const texto = await extrairTextoDoPdf(arquivo)
      // Debug temporário (09/06/2026) — log do texto extraído pra ajustar parser
      // conforme o formato real que o pdfjs produz no browser. Remover quando
      // parser estiver estável em prod.
      console.info('[importar-orcamento] Texto extraído do PDF:', texto)
      console.info('[importar-orcamento] Tamanho:', texto.length, 'caracteres')

      const orc = parsearTextoWvetro(texto)
      if (orc.itens.length === 0) {
        console.warn('[importar-orcamento] Parser não encontrou itens. Cliente detectado:', orc.cliente)
        throw new Error(
          `Nenhum item identificado no PDF (${texto.length} caracteres extraídos). Abre o console do navegador (F12 → Console) e me manda o texto que o sistema extraiu — vou ajustar o parser.`,
        )
      }
      const cardsExpandidos = expandirItensEmCards(orc.itens)
      setOrcamento(orc)
      setCards(cardsExpandidos)
      setNomeObraEdit(orc.cliente.nome ?? 'Obra importada')
      setEtapa('preview')
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao processar PDF')
      setEtapa('selecionar')
    }
  }

  async function confirmarImportacao() {
    if (!orcamento || cards.length === 0) return
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
      })

      // Cria os cards em batch
      await criarVariosCards(
        cards.map((c) => ({
          obra_id: obra.id,
          tipo: 'peca' as const,
          sigla: c.sigla,
          nome: c.nome,
          descricao: c.descricao,
          aba: 'cliente' as const,
        })),
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
            <div className="text-3xl mb-3 animate-pulse">📄</div>
            <p className="text-sm text-slate-600">Lendo o PDF e identificando itens...</p>
          </div>
        )}

        {etapa === 'preview' && orcamento && (
          <Preview
            orcamento={orcamento}
            cards={cards}
            nomeObra={nomeObraEdit}
            onNomeObraChange={setNomeObraEdit}
            onConfirmar={confirmarImportacao}
            onVoltar={() => setEtapa('selecionar')}
          />
        )}

        {etapa === 'salvando' && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="text-3xl mb-3 animate-pulse">💾</div>
            <p className="text-sm text-slate-600">
              Criando obra e {cards.length} cards no sistema...
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

function Preview({
  orcamento,
  cards,
  nomeObra,
  onNomeObraChange,
  onConfirmar,
  onVoltar,
}: {
  orcamento: OrcamentoWvetro
  cards: CardImportadoWvetro[]
  nomeObra: string
  onNomeObraChange: (v: string) => void
  onConfirmar: () => void
  onVoltar: () => void
}) {
  const qtdeItens = orcamento.itens.length

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-base">📄 Dados identificados</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">Cliente</dt>
            <dd className="font-medium">{orcamento.cliente.nome ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Endereço</dt>
            <dd className="font-medium">{orcamento.cliente.endereco ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Tipos de item</dt>
            <dd className="font-medium">
              {qtdeItens} item{qtdeItens !== 1 ? 's' : ''} · {cards.length} peças no total
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
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-base">
          📦 Itens identificados ({orcamento.itens.length})
        </h2>
        <ul className="space-y-2">
          {orcamento.itens.map((item) => (
            <li
              key={item.ordem}
              className="border border-slate-200 rounded-lg p-3 text-sm"
            >
              <div className="font-semibold flex items-center gap-2 flex-wrap">
                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700 font-mono">
                  {item.tipo || `IT${item.ordem}`}
                </span>
                <span>{item.descricaoCompleta}</span>
                <span className="text-xs text-slate-500">
                  · {item.qtde}× {item.larguraMm}×{item.alturaMm}mm
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <strong>Ambiente:</strong> {item.ambiente || '—'} ·{' '}
                <strong>Tipologia:</strong> {item.tipologia} ·{' '}
                <strong>Vidro:</strong> {item.vidro.descricaoBruta || 'Sem vidro'} ·{' '}
                <strong>Cor perfil:</strong> {item.corPerfil || '—'}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          💡 Cada item vira <strong>{cards.length}</strong> card
          {cards.length !== 1 ? 's' : ''} individual no G Obra (1 por peça da quantidade).
          Você gerencia medição, produção e aceite peça a peça.
        </p>
      </section>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button onClick={onVoltar} className="btn-ghost">
          ← Voltar
        </button>
        <button onClick={onConfirmar} className="btn-primary">
          Criar obra com {cards.length} peças →
        </button>
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

// ============================================================
// EXTRAÇÃO DE TEXTO DO PDF — usa pdfjs-dist (browser)
// ============================================================

async function extrairTextoDoPdf(arquivo: File): Promise<string> {
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
