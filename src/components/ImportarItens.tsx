import { useState, ChangeEvent } from 'react'
import {
  parseXmlBuffer,
  parseXmlString,
  tipologiasParaItens,
  type ItemImportado,
  type AlumisoftObra,
} from '../lib/alumisoft'

interface ImportarItensProps {
  obraId: string  // pra log/debug, e pra criar os cards depois
  onClose: () => void
  onImportar: (itens: ItemImportado[]) => Promise<void>
}

type Modo = 'alumisoft' | 'preview'

export default function ImportarItens({ obraId, onClose, onImportar }: ImportarItensProps) {
  const [modo, setModo] = useState<Modo>('alumisoft')
  const [textoXml, setTextoXml] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [obraAlumisoft, setObraAlumisoft] = useState<AlumisoftObra | null>(null)
  const [itens, setItens] = useState<ItemImportado[]>([])
  const [importando, setImportando] = useState(false)

  async function processarArquivo(e: ChangeEvent<HTMLInputElement>) {
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
    } catch (err: any) {
      setErro(err?.message ?? 'Nao consegui ler o arquivo')
    }
  }

  function processarTexto() {
    setErro(null)
    if (!textoXml.trim()) { setErro('Cola o XML antes de processar'); return }
    try {
      const obra = parseXmlString(textoXml)
      const lista = tipologiasParaItens(obra)
      setObraAlumisoft(obra)
      setItens(lista)
      setModo('preview')
    } catch (err: any) {
      setErro(err?.message ?? 'Nao consegui interpretar o XML')
    }
  }

  function alterarItem(index: number, campo: keyof ItemImportado, valor: string) {
    setItens((cur) => cur.map((it, i) => i === index ? { ...it, [campo]: valor } : it))
  }

  function removerItem(index: number) {
    setItens((cur) => cur.filter((_, i) => i !== index))
  }

  async function confirmar() {
    if (itens.length === 0) { setErro('Nao tem itens pra importar'); return }
    setImportando(true)
    try {
      await onImportar(itens)
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao importar')
      setImportando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold mb-1">Importar itens em massa</div>
            <div className="text-sm text-slate-500">
              {modo === 'alumisoft' && 'Use o XML exportado do Alumisoft (SmartCEM). Em breve outras opcoes.'}
              {modo === 'preview' && `${itens.length} ${itens.length === 1 ? 'item detectado' : 'itens detectados'}. Confira e ajuste antes de importar.`}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition">x</button>
        </div>

        {modo === 'alumisoft' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-700 mb-1">Como exportar do Alumisoft</div>
              No SmartCEM/Alumisoft, exporta a obra em formato XML (geralmente "Exportar VDA"). O arquivo vem com nome tipo <code className="bg-white border border-slate-200 px-1 rounded">25-03-005_VDA.xml</code>. Pode anexar aqui ou colar o conteudo no campo abaixo.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Anexar arquivo XML</label>
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={processarArquivo}
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

        {modo === 'preview' && obraAlumisoft && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Resumo da obra detectada */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detectado no XML</div>
              <div className="text-sm text-slate-700">
                <div><span className="text-slate-500">Codigo da OS:</span> <strong>{obraAlumisoft.codigo || '-'}</strong></div>
                <div><span className="text-slate-500">Nome:</span> <strong>{obraAlumisoft.nome || '-'}</strong></div>
                <div><span className="text-slate-500">Cliente:</span> <strong>{obraAlumisoft.cliente.nome || '-'}</strong> {obraAlumisoft.cliente.telefone && <>({obraAlumisoft.cliente.telefone})</>}</div>
              </div>
            </div>

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Itens a importar</div>

            {itens.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">Nenhum item. Volte e escolha outro XML.</div>
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
                    <span className="text-[10px] text-slate-400 hidden md:inline whitespace-nowrap">{it.larguraMm}x{it.alturaMm}mm</span>
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
              Voce pode editar siglas e nomes antes de confirmar. Quem nao quiser importar, clica no x. A descricao completa (vidro, dimensoes, acabamento) vai pro card automaticamente.
            </div>

            {erro && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{erro}</div>}
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200 flex gap-2 justify-end bg-slate-50">
          {modo === 'preview' && (
            <button className="btn-ghost" onClick={() => { setModo('alumisoft'); setItens([]); setObraAlumisoft(null); setErro(null) }}>Voltar</button>
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
