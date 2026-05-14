import { useState, ChangeEvent } from 'react'
import {
  parseXmlBuffer,
  parseXmlString,
  tipologiasParaItens,
  type ItemImportado,
  type AlumisoftObra,
} from '../lib/alumisoft'
import {
  parsePlanilhaArquivo,
  baixarTemplate,
} from '../lib/planilha-import'
import { useEscClose } from '../hooks/useEscClose'
import { mensagemDeErro } from '../lib/erros'

interface ImportarItensProps {
  obraId: string  // pra log/debug, e pra criar os cards depois
  onClose: () => void
  onImportar: (itens: ItemImportado[]) => Promise<void>
}

// Os 3 "modos" do fluxo:
//   - 'escolha-origem': tela inicial onde user escolhe Alumisoft vs Planilha
//   - 'alumisoft': cole o XML / anexe o arquivo .xml
//   - 'planilha':  baixe o template / anexe a planilha preenchida
//   - 'preview':   confere e edita antes de confirmar
type Modo = 'escolha-origem' | 'alumisoft' | 'planilha' | 'preview'

type Origem = 'alumisoft' | 'planilha'

export default function ImportarItens({ obraId: _obraId, onClose, onImportar }: ImportarItensProps) {
  const [modo, setModo] = useState<Modo>('escolha-origem')
  const [origem, setOrigem] = useState<Origem | null>(null)
  const [textoXml, setTextoXml] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [obraAlumisoft, setObraAlumisoft] = useState<AlumisoftObra | null>(null)
  const [itens, setItens] = useState<ItemImportado[]>([])
  const [importando, setImportando] = useState(false)
  useEscClose(true, onClose)

  function selecionarOrigem(o: Origem) {
    setOrigem(o)
    setErro(null)
    setAviso(null)
    setModo(o)
  }

  // ============ Processadores Alumisoft ============

  async function processarArquivoXml(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setErro(null)
    try {
      const buffer = await arquivo.arrayBuffer()
      const obra = parseXmlBuffer(buffer)
      const lista = tipologiasParaItens(obra)
      setObraAlumisoft(obra)
      setItens(lista)
      setModo('preview')
    } catch (err) {
      setErro('Não consegui ler o arquivo: ' + mensagemDeErro(err))
    }
  }

  function processarTexto() {
    setErro(null)
    if (!textoXml.trim()) { setErro('Cole o XML antes de processar'); return }
    try {
      const obra = parseXmlString(textoXml)
      const lista = tipologiasParaItens(obra)
      setObraAlumisoft(obra)
      setItens(lista)
      setModo('preview')
    } catch (err) {
      setErro('Não consegui interpretar o XML: ' + mensagemDeErro(err))
    }
  }

  // ============ Processador Planilha ============

  async function processarArquivoPlanilha(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setErro(null)
    setAviso(null)
    try {
      const resultado = await parsePlanilhaArquivo(arquivo)
      setItens(resultado.itens)
      setObraAlumisoft(null) // limpa caso tenha tido import Alumisoft antes
      if (resultado.avisos.length > 0) {
        setAviso(resultado.avisos.join(' · '))
      }
      setModo('preview')
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  // ============ Helpers de UI ============

  function alterarItem(index: number, campo: keyof ItemImportado, valor: string) {
    setItens((cur) => cur.map((it, i) => i === index ? { ...it, [campo]: valor } : it))
  }

  function removerItem(index: number) {
    setItens((cur) => cur.filter((_, i) => i !== index))
  }

  async function confirmar() {
    if (itens.length === 0) { setErro('Não tem itens pra importar'); return }
    setImportando(true)
    try {
      await onImportar(itens)
    } catch (err) {
      setErro(mensagemDeErro(err))
      setImportando(false)
    }
  }

  function voltarParaEscolha() {
    setModo('escolha-origem')
    setItens([])
    setObraAlumisoft(null)
    setErro(null)
    setAviso(null)
    setTextoXml('')
  }

  // ============ Render ============

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold mb-1">Importar itens em massa</div>
            <div className="text-sm text-slate-500">
              {modo === 'escolha-origem' && 'Escolha como você quer importar a obra.'}
              {modo === 'alumisoft' && 'Use o XML exportado do Alumisoft (SmartCEM).'}
              {modo === 'planilha' && 'Baixe o template, preencha em Excel/Google Sheets, depois anexe aqui.'}
              {modo === 'preview' && `${itens.length} ${itens.length === 1 ? 'item detectado' : 'itens detectados'}. Confira e ajuste antes de importar.`}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">×</button>
        </div>

        {/* Conteúdo */}

        {modo === 'escolha-origem' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <p className="text-sm text-slate-600">
              Você pode importar de duas formas. Escolha a que se aplica ao seu caso:
            </p>

            <button
              onClick={() => selecionarOrigem('alumisoft')}
              className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 transition group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-laranja-soft text-laranja-dark grid place-items-center font-bold text-lg flex-shrink-0">A</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 mb-1">Eu uso Alumisoft (SmartCEM)</div>
                  <div className="text-sm text-slate-600">
                    Exporte sua obra como XML (botão "Exportar VDA" no SmartCEM) e anexe aqui. Eu leio as tipologias direto e crio os cards.
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => selecionarOrigem('planilha')}
              className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 transition group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-laranja-soft text-laranja-dark grid place-items-center font-bold text-lg flex-shrink-0">B</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 mb-1">Eu não uso Alumisoft — vou preencher uma planilha</div>
                  <div className="text-sm text-slate-600">
                    Baixe o nosso template em Excel/Google Sheets, preencha com as peças da obra e anexe de volta. Aceita .xlsx, .xls e .csv.
                  </div>
                </div>
              </div>
            </button>

            <div className="text-xs text-slate-400 pt-2">
              <strong>Sem Alumisoft e sem planilha?</strong> Você pode criar os cards um por um pelo botão "+ Novo item" na tela da obra. A importação em massa é só pra acelerar quando você tem muitas peças.
            </div>
          </div>
        )}

        {modo === 'alumisoft' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-700 mb-1">Como exportar do Alumisoft</div>
              No SmartCEM/Alumisoft, exporte a obra em formato XML (geralmente "Exportar VDA"). O arquivo vem com nome tipo <code className="bg-white border border-slate-200 px-1 rounded">25-03-005_VDA.xml</code>. Pode anexar aqui ou colar o conteúdo no campo abaixo.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Anexar arquivo XML</label>
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={processarArquivoXml}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-200 file:text-sm file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
            </div>

            <div className="text-center text-xs text-slate-400">ou</div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Colar XML direto</label>
              <textarea
                className="input min-h-[180px] font-mono text-xs"
                value={textoXml}
                onChange={(e) => setTextoXml(e.target.value)}
                placeholder="<?xml version=&quot;1.0&quot;?>&#10;<OBRA>&#10;  <DADOS_OBRA>...&#10;  <TIPOLOGIAS>...&#10;</OBRA>"
              />
              <button className="btn-primary mt-3" onClick={processarTexto} disabled={!textoXml.trim()}>Processar XML</button>
            </div>

            {erro && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{erro}</div>}
          </div>
        )}

        {modo === 'planilha' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="bg-laranja-soft/30 border border-laranja/30 rounded-lg p-4 text-sm text-slate-700 space-y-2">
              <div className="font-semibold text-slate-800">Como funciona</div>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
                <li>Baixe o template clicando no botão laranja abaixo.</li>
                <li>Abra no Excel ou Google Sheets — vem com 3 linhas de exemplo pra você se orientar.</li>
                <li>Apague os exemplos e preencha com as peças da SUA obra.</li>
                <li>Salve e volte aqui — anexe o arquivo preenchido.</li>
              </ol>
            </div>

            <div>
              <button
                type="button"
                onClick={baixarTemplate}
                className="btn-primary w-full justify-center flex items-center gap-2"
              >
                <span>↓</span>
                <span>Baixar template em Excel (.xlsx)</span>
              </button>
              <div className="text-xs text-slate-500 mt-2 text-center">
                Vem com 2 abas: "Itens" (pra preencher) e "Instruções" (manual).
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Anexar planilha preenchida</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={processarArquivoPlanilha}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-200 file:text-sm file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
              <div className="text-xs text-slate-400 mt-2">
                Aceita <code>.xlsx</code>, <code>.xls</code> e <code>.csv</code>. Tamanho máximo: 5MB.
              </div>
            </div>

            <details className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <summary className="cursor-pointer font-semibold text-slate-700">Regras rápidas de preenchimento</summary>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li><strong>NOME</strong> é a única coluna obrigatória.</li>
                <li>Se você não informar SIGLA, o sistema gera automaticamente (TIPO + número).</li>
                <li><strong>QTDE &gt; 1</strong> cria várias peças com siglas sequenciais (ex: J1_1, J1_2, J1_3).</li>
                <li>LARGURA e ALTURA em milímetros (mm).</li>
                <li>LINHA, COR, VIDRO, LOCALIZAÇÃO, OBSERVAÇÃO são opcionais — preencha se souber.</li>
              </ul>
            </details>

            {erro && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{erro}</div>}
          </div>
        )}

        {modo === 'preview' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Resumo da obra (só pro Alumisoft) */}
            {obraAlumisoft && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detectado no XML</div>
                <div className="text-sm text-slate-700">
                  <div><span className="text-slate-500">Código da OS:</span> <strong>{obraAlumisoft.codigo || '-'}</strong></div>
                  <div><span className="text-slate-500">Nome:</span> <strong>{obraAlumisoft.nome || '-'}</strong></div>
                  <div><span className="text-slate-500">Cliente:</span> <strong>{obraAlumisoft.cliente.nome || '-'}</strong> {obraAlumisoft.cliente.telefone && <>({obraAlumisoft.cliente.telefone})</>}</div>
                </div>
              </div>
            )}

            {!obraAlumisoft && origem === 'planilha' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Importado da planilha</div>
                <div className="text-sm text-slate-700">
                  <strong>{itens.length}</strong> {itens.length === 1 ? 'item detectado' : 'itens detectados'} (incluindo expansão de QTDE).
                </div>
              </div>
            )}

            {aviso && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
                {aviso}
              </div>
            )}

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Itens a importar</div>

            {itens.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">Nenhum item. Volte e escolha outro arquivo.</div>
            ) : (
              <div className="space-y-2">
                {itens.map((it, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-md px-3 py-2.5 text-sm flex items-center gap-2">
                    <input
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-xs font-bold text-center bg-peca-soft text-peca-dark"
                      value={it.sigla}
                      onChange={(e) => alterarItem(i, 'sigla', e.target.value.toUpperCase())}
                    />
                    <input
                      className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded text-xs"
                      value={it.nome}
                      onChange={(e) => alterarItem(i, 'nome', e.target.value)}
                    />
                    {(it.larguraMm || it.alturaMm) ? (
                      <span className="text-[10px] text-slate-400 hidden md:inline whitespace-nowrap">{it.larguraMm}x{it.alturaMm}mm</span>
                    ) : null}
                    <button
                      onClick={() => removerItem(i)}
                      className="text-xs text-red-500 hover:text-red-700 px-1"
                      title="Remover do import"
                    >x</button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] text-slate-400">
              Você pode editar siglas e nomes antes de confirmar. Quem não quiser importar, clica no x. A descrição completa (vidro, dimensões, acabamento) vai pro card automaticamente.
            </div>

            {erro && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{erro}</div>}
          </div>
        )}

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-2 justify-end bg-slate-50">
          {modo === 'preview' && (
            <button className="btn-ghost" onClick={voltarParaEscolha}>Voltar</button>
          )}
          {(modo === 'alumisoft' || modo === 'planilha') && (
            <button className="btn-ghost" onClick={() => setModo('escolha-origem')}>Voltar</button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          {modo === 'preview' && (
            <button
              className="btn-primary"
              onClick={confirmar}
              disabled={importando || itens.length === 0}
            >{importando ? 'Importando...' : `Importar ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`}</button>
          )}
        </div>
      </div>
    </div>
  )
}
