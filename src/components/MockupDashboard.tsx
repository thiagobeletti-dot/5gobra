// Slide 1 do carrossel - Painel da obra com abas + cards.
// Comunica: cada peca vira um card que atravessa a obra.

export default function MockupDashboard() {
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

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white">
          <div className="text-sm font-bold text-slate-900 leading-tight">Residencial Vila Bela</div>
          <div className="text-[10px] text-slate-500">Rua das Palmeiras, 450 - Cliente: João Silva</div>
        </div>

        {/* Abas */}
        <div className="flex gap-4 px-5 border-b border-slate-200 text-[11px] font-semibold overflow-x-auto whitespace-nowrap">
          {[
            { l: 'Cliente', n: 4, a: true },
            { l: 'Empresa', n: 2, a: false },
            { l: 'Tecnica', n: 3, a: false },
            { l: 'Em andamento', n: 8, a: false },
            { l: 'Conclusao', n: 3, a: false },
          ].map((t) => (
            <div
              key={t.l}
              className={
                'py-3 flex items-center gap-1.5 border-b-2 -mb-px flex-shrink-0 ' +
                (t.a ? 'text-laranja-dark border-laranja' : 'text-slate-500 border-transparent')
              }
            >
              {t.l}
              <span
                className={
                  'text-[10px] font-bold px-1.5 rounded-full ' +
                  (t.a ? 'bg-laranja-soft text-laranja-dark' : 'bg-slate-100 text-slate-500')
                }
              >
                {t.n}
              </span>
            </div>
          ))}
        </div>

        {/* Cards (grid de 2) */}
        <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50">
          {/* Card 1 - Item */}
          <div className="bg-white border border-slate-200 rounded-md p-3 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-peca" />
            <div className="flex items-center justify-between mb-1">
              <span className="bg-peca-soft text-peca-dark border border-peca-border px-1.5 py-0.5 rounded text-[9px] font-bold">
                J1
              </span>
              <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Item</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-900 leading-tight">Janela sala 1</div>
            <div className="text-[9px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
              Janela aluminio 1,20 x 1,00m, 2 folhas de correr.
            </div>
            <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[9px] text-slate-500 font-medium">Aguardando confirmacao</span>
            </div>
          </div>

          {/* Card 2 - Acordo */}
          <div className="bg-white border border-slate-200 rounded-md p-3 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-acordo" />
            <div className="flex items-center justify-between mb-1">
              <span className="bg-acordo-soft text-acordo-dark border border-acordo-border px-1.5 py-0.5 rounded text-[9px] font-bold">
                A1
              </span>
              <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Acordo</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-900 leading-tight">Cor da janela master</div>
            <div className="text-[9px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
              Cliente optou por preto fosco. Acrescimo R$ 480,00.
            </div>
            <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] text-slate-500 font-medium">Aprovado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
