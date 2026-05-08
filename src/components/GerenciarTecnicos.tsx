import { useEffect, useState } from 'react'
import type { TecnicoObra } from '../types/tecnico'
import { listarTecnicosDaObra, criarTecnico, revogarTecnico, reativarTecnico } from '../lib/tecnico'
import { useConfirm } from '../hooks/useConfirm'
import { useEscClose } from '../hooks/useEscClose'
import { mensagemDeErro } from '../lib/erros'

interface Props {
  obraId: string
  onClose: () => void
}

export default function GerenciarTecnicos({ obraId, onClose }: Props) {
  const [tecnicos, setTecnicos] = useState<TecnicoObra[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [novoPapel, setNovoPapel] = useState('')
  const [criando, setCriando] = useState(false)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const { confirmar, dialog: confirmDialog } = useConfirm()
  useEscClose(true, onClose)

  async function recarregar() {
    setCarregando(true)
    setErro(null)
    try {
      const lista = await listarTecnicosDaObra(obraId)
      setTecnicos(lista)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { recarregar() }, [obraId])

  async function adicionar() {
    if (!novoNome.trim()) { setErro('Nome obrigatório'); return }
    setCriando(true)
    setErro(null)
    try {
      await criarTecnico({ obraId, nome: novoNome.trim(), papel: novoPapel.trim() || undefined })
      setNovoNome('')
      setNovoPapel('')
      await recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setCriando(false)
    }
  }

  async function copiarLink(token: string, id: string) {
    const url = window.location.origin + '/tec/' + token
    try {
      await navigator.clipboard.writeText(url)
      setCopiadoId(id)
      setTimeout(() => setCopiadoId(null), 2000)
    } catch {
      // fallback: pelo menos selecionar pra copiar manual
      setErro('Não consegui copiar automaticamente. Link: ' + url)
    }
  }

  async function toggleAtivo(t: TecnicoObra) {
    try {
      if (t.ativo) {
        const ok = await confirmar({
          titulo: 'Revogar acesso de ' + t.nome + '?',
          descricao: 'O link vai parar de funcionar imediatamente. Ele não conseguirá mais entrar com o link atual.',
          labelConfirmar: 'Revogar acesso',
          destrutivo: true,
        })
        if (ok === null) return
        await revogarTecnico(t.id)
      } else {
        await reativarTecnico(t.id)
      }
      await recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start gap-4">
          <div className="flex-1">
            <div className="text-lg font-bold mb-1">Técnicos da obra</div>
            <div className="text-sm text-slate-500">Cadastre técnicos pra essa obra. Cada um recebe um link mágico pra preencher checklists e fotos no celular.</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {erro && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg text-sm text-red-700">{erro}</div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Adicionar técnico</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Nome</label>
                <input className="input text-sm" placeholder="Ex: Edson" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Papel (opcional)</label>
                <input className="input text-sm" placeholder="Ex: medidor, instalador" value={novoPapel} onChange={(e) => setNovoPapel(e.target.value)} />
              </div>
            </div>
            <button className="btn-primary text-xs px-4 py-2" disabled={criando} onClick={adicionar}>
              {criando ? 'Criando...' : '+ Adicionar técnico'}
            </button>
          </div>

          {carregando ? (
            <div className="text-center text-slate-400 text-sm py-6">Carregando técnicos...</div>
          ) : tecnicos.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-6">Nenhum técnico cadastrado ainda.</div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cadastrados</div>
              {tecnicos.map((t) => {
                const url = window.location.origin + '/tec/' + t.token
                const copiado = copiadoId === t.id
                return (
                  <div key={t.id} className={'border rounded-lg px-4 py-3 ' + (t.ativo ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300 opacity-70')}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="font-semibold text-sm">
                          {t.nome}
                          {t.papel && <span className="text-slate-500 font-normal"> · {t.papel}</span>}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Criado em {new Date(t.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          {!t.ativo && ' · REVOGADO'}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAtivo(t)}
                        className={'text-xs font-semibold px-3 py-1.5 rounded-md border transition ' + (t.ativo
                          ? 'text-red-600 border-red-200 hover:bg-red-50'
                          : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50')}
                      >
                        {t.ativo ? 'Revogar' : 'Reativar'}
                      </button>
                    </div>
                    {t.ativo && (
                      <div className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 flex items-center gap-2">
                        <code className="flex-1 text-[11px] text-slate-600 truncate" title={url}>{url}</code>
                        <button
                          onClick={() => copiarLink(t.token, t.id)}
                          className="text-xs font-semibold text-laranja hover:text-laranja-dark whitespace-nowrap"
                        >
                          {copiado ? '✓ Copiado' : 'Copiar link'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-[11px] text-slate-400">
            <strong>Dica:</strong> mande o link via WhatsApp pro técnico. Ele abre no celular, preenche o checklist em obra e tira foto sem precisar baixar app nem fazer login.
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  )
}
