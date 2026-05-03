// Slide 4 do carrossel - Aceite final do cliente com peso juridico.
// Comunica: cada peca tem aceite formal com timestamp, IP e dispositivo.

export default function MockupAceiteFinal() {
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
            5gobra.com.br/obra/c2f7e1...
          </div>
        </div>

        {/* Conteudo */}
        <div className="p-5 bg-white">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-2">
              <span className="text-emerald-600 text-xl font-bold">✓</span>
            </div>
            <h4 className="text-base font-extrabold text-slate-900 leading-snug">
              Aceite registrado com peso juridico
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Janela sala 1 - J1 - instalacao aprovada pelo cliente
            </p>
          </div>

          {/* Bloco de auditoria */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Trilha de auditoria
            </div>
            <div className="space-y-2 text-[11px]">
              <LinhaAudit campo="Aceite por" valor="Joao Silva (cliente)" />
              <LinhaAudit campo="Data e hora" valor="03/05/2026 as 16:42:18" />
              <LinhaAudit campo="IP" valor="201.45.x.x" mono />
              <LinhaAudit campo="Dispositivo" valor="Android - Chrome 124" />
              <LinhaAudit campo="Localizacao" valor="Sao Paulo, SP" />
              <LinhaAudit campo="Hash do registro" valor="a3f7c2e1...d894" mono />
            </div>
          </div>

          {/* Garantia */}
          <div className="mt-3 bg-laranja/10 border border-laranja/30 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-laranja-dark">Garantia iniciada</div>
                <div className="text-[11px] font-semibold text-slate-900 mt-0.5">5 anos - termina em 03/05/2031</div>
              </div>
              <button className="bg-white border border-slate-200 text-slate-900 font-bold text-[10px] rounded-md px-3 py-1.5 flex-shrink-0">
                Exportar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LinhaAudit({ campo, valor, mono }: { campo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 font-medium">{campo}</span>
      <span className={'text-slate-900 font-semibold text-right ' + (mono ? 'font-mono text-[10px]' : '')}>{valor}</span>
    </div>
  )
}
