// Slide 2 do carrossel - Card aberto com historico oficial.
// Comunica: cada movimento gravado com data, hora e autor.

export default function MockupCardHistorico() {
  return (
    <div className="relative w-full max-w-full min-w-0">
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        {/* Barra do navegador */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 ml-2 bg-white border border-slate-200 rounded-md px-3 py-1 text-[10px] text-slate-400 font-mono truncate">
            5gobra.com.br/app/obra/vila-bela
          </div>
        </div>

        {/* Header do card aberto */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="bg-peca-soft text-peca-dark border border-peca-border px-2 py-1 rounded text-[11px] font-bold flex-shrink-0">
              J1
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-tight truncate">Janela sala 1</div>
              <div className="text-[10px] text-slate-500">Janela 1,20 x 1,00m, 2 folhas de correr</div>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex-shrink-0">
            Em producao
          </span>
        </div>

        {/* Timeline / historico */}
        <div className="p-5 bg-slate-50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
            Historico oficial
          </div>

          <div className="space-y-3 relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />

            <Evento
              cor="bg-laranja"
              autor="Empresa"
              quando="hoje, 14:32"
              titulo="Item enviado pra producao"
              detalhe="Apos M2 aprovado e contra-marco entregue."
            />
            <Evento
              cor="bg-blue-500"
              autor="Cliente"
              quando="ontem, 18:06"
              titulo="Vao pronto confirmado"
              detalhe="Foto enviada. Contra-marco instalado e nivelado."
            />
            <Evento
              cor="bg-amber-500"
              autor="Empresa"
              quando="29/04, 10:14"
              titulo="Contra-marco entregue na obra"
              detalhe="Celso (instalador). Entrega registrada com foto."
            />
            <Evento
              cor="bg-laranja"
              autor="Empresa"
              quando="28/04, 11:02"
              titulo="Medicao 1 realizada"
              detalhe="Sem contra-marco no vao. Medida 1700 x 1200mm."
              ultimo
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Evento({
  cor,
  autor,
  quando,
  titulo,
  detalhe,
  ultimo,
}: {
  cor: string
  autor: string
  quando: string
  titulo: string
  detalhe: string
  ultimo?: boolean
}) {
  return (
    <div className="flex gap-3 relative">
      <span className={'w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 z-10 ' + cor + (ultimo ? ' opacity-60' : '')} />
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">{autor}</span>
          <span className="text-[10px] text-slate-400">{quando}</span>
        </div>
        <div className="text-[12px] font-semibold text-slate-900 leading-snug">{titulo}</div>
        <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{detalhe}</div>
      </div>
    </div>
  )
}
