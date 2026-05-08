import { useState, useRef, ChangeEvent } from 'react'
import type { FotoCard } from '../types/obra'
import { useConfirm } from '../hooks/useConfirm'
import { mensagemDeErro } from '../lib/erros'

interface GaleriaFotosProps {
  fotos: FotoCard[]
  podeEditar: boolean
  onAdicionar: (arquivos: File[]) => Promise<void>
  onRemover: (foto: FotoCard) => Promise<void>
}

export default function GaleriaFotos({ fotos, podeEditar, onAdicionar, onRemover }: GaleriaFotosProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subindo, setSubindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [removendoId, setRemovendoId] = useState<string | null>(null)
  const { confirmar, dialog: confirmDialog } = useConfirm()

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    if (arquivos.length === 0) return
    setErro(null)
    setSubindo(true)
    try {
      await onAdicionar(arquivos)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSubindo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remover(foto: FotoCard) {
    const ok = await confirmar({
      titulo: 'Remover essa foto?',
      descricao: 'Essa ação não pode ser desfeita.',
      labelConfirmar: 'Remover',
      destrutivo: true,
    })
    if (ok === null) return
    setRemovendoId(foto.id)
    try {
      await onRemover(foto)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setRemovendoId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Fotos {fotos.length > 0 && <span className="text-slate-500">({fotos.length})</span>}
        </div>
        {podeEditar && (
          <button
            type="button"
            disabled={subindo}
            onClick={() => inputRef.current?.click()}
            className="text-xs font-semibold text-laranja-dark hover:text-laranja inline-flex items-center gap-1"
          >
            {subindo ? 'Subindo...' : '+ Adicionar foto'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}

      {fotos.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-md px-3 py-5 text-center text-xs text-slate-400">
          Nenhuma foto ainda. {podeEditar && 'Toque em "+ Adicionar foto" pra subir do celular ou tirar agora.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {fotos.map((f, i) => (
            <div key={f.id} className="relative aspect-square bg-slate-100 rounded-md overflow-hidden group">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="block w-full h-full"
                aria-label="Abrir foto"
              >
                <img
                  src={f.url}
                  alt={f.nome ?? 'Foto'}
                  loading="lazy"
                  className="w-full h-full object-cover hover:scale-105 transition"
                />
              </button>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => remover(f)}
                  disabled={removendoId === f.id}
                  className="absolute top-1 right-1 w-6 h-6 bg-white/90 hover:bg-white text-red-600 rounded-full text-xs font-bold grid place-items-center shadow opacity-0 group-hover:opacity-100 transition"
                  title="Remover"
                >x</button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && fotos[lightboxIndex] && (
        <Lightbox
          fotos={fotos}
          indexInicial={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {confirmDialog}
    </div>
  )
}

function Lightbox({ fotos, indexInicial, onClose }: { fotos: FotoCard[]; indexInicial: number; onClose: () => void }) {
  const [index, setIndex] = useState(indexInicial)
  const foto = fotos[index]
  if (!foto) return null

  function anterior() {
    setIndex((i) => (i > 0 ? i - 1 : fotos.length - 1))
  }
  function proxima() {
    setIndex((i) => (i < fotos.length - 1 ? i + 1 : 0))
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl grid place-items-center"
        >x</button>
      </div>
      <div className="absolute top-4 left-4 z-10 text-white text-sm">
        {index + 1} de {fotos.length}
      </div>

      {fotos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); anterior() }}
            className="absolute left-2 md:left-6 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl grid place-items-center"
          >&lt;</button>
          <button
            onClick={(e) => { e.stopPropagation(); proxima() }}
            className="absolute right-2 md:right-6 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl grid place-items-center"
          >&gt;</button>
        </>
      )}

      <img
        src={foto.url}
        alt={foto.nome ?? 'Foto'}
        className="max-w-full max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
