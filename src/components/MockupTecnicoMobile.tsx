// Slide 3 do carrossel - Tecnico em obra preenchendo M1 pelo celular.
// Comunica: equipe em campo registra com foto e medidas, sem login, sem app.

export default function MockupTecnicoMobile() {
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
            5gobra.com.br/tec/celso-vila-bela
          </div>
        </div>

        {/* Conteudo: split entre explicacao e celular */}
        <div className="grid grid-cols-[1fr_auto] gap-4 p-5 bg-blue-50/40">
          {/* Lado explicacao */}
          <div className="flex flex-col justify-center min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-2">
              Link magico do tecnico
            </div>
            <h4 className="text-base font-extrabold text-slate-900 leading-snug mb-2">
              Equipe em obra preenche checklist no celular.
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
              Sem login, sem app. Voce manda o link, o tecnico abre e preenche M1/M2 com foto, medidas e tipologia.
            </p>
            <ul className="space-y-1.5 text-[11px] text-slate-600">
              <li className="flex items-start gap-1.5">
                <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
                <span>Camera do celular abre direto</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
                <span>Funciona offline e sincroniza</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
                <span>Cada tecnico tem seu link proprio</span>
              </li>
            </ul>
          </div>

          {/* Mockup do celular */}
          <div className="flex-shrink-0">
            <div className="w-[170px] bg-slate-900 rounded-[22px] p-1.5 shadow-lg">
              <div className="bg-white rounded-[16px] overflow-hidden">
                <div className="h-3 bg-slate-900 mx-8 rounded-b-md" />

                <div className="px-3 py-2.5 border-b border-slate-200">
                  <div className="text-[8px] text-slate-400 font-mono">Janela sala 1 - J1</div>
                  <div className="text-[11px] font-bold text-slate-900">Medicao 1</div>
                </div>

                <div className="px-3 py-3 space-y-2.5">
                  <CampoMobile label="Tipologia" valor="Correr" check />
                  <CampoMobile label="Vao pronto?" valor="Sim" check />
                  <CampoMobile label="Contra-marco" valor="Nao" check />

                  <div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1">Medida</div>
                    <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[10px] font-bold text-slate-900">
                      1700 x 1200 mm
                    </div>
                  </div>

                  <div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1">Foto do vao</div>
                    <div className="aspect-video rounded bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                      <span className="text-[8px] text-white/60 uppercase tracking-wider font-bold">Foto da obra</span>
                    </div>
                  </div>

                  <button className="w-full bg-laranja text-white font-bold text-[10px] rounded-md py-2 mt-1">
                    Salvar M1
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 text-center mt-2">Celso - 14:18</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CampoMobile({ label, valor, check }: { label: string; valor: string; check?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-slate-900">{valor}</span>
        {check && <span className="text-emerald-600 font-bold text-[10px]">✓</span>}
      </span>
    </div>
  )
}
