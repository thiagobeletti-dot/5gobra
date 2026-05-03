// Carrossel das telas do sistema na Landing do G Obra.
// 4 slides em rotacao automatica (5s) com pause-on-hover + navegacao manual.

import { useEffect, useState } from 'react'
import MockupDashboard from './MockupDashboard'
import MockupCardHistorico from './MockupCardHistorico'
import MockupTecnicoMobile from './MockupTecnicoMobile'
import MockupAceiteFinal from './MockupAceiteFinal'

const SLIDES = [
  {
    Component: MockupDashboard,
    eyebrow: 'Painel da obra',
    titulo: 'Cada peca vira um card que atravessa a obra.',
  },
  {
    Component: MockupCardHistorico,
    eyebrow: 'Historico oficial',
    titulo: 'Cada movimento gravado: data, hora, autor, prova.',
  },
  {
    Component: MockupTecnicoMobile,
    eyebrow: 'Equipe em obra',
    titulo: 'Tecnico preenche checklist no celular, sem login.',
  },
  {
    Component: MockupAceiteFinal,
    eyebrow: 'Aceite final',
    titulo: 'Trilha de auditoria com peso juridico.',
  },
]

const INTERVALO_MS = 5000

export default function CarrosselSistema() {
  const [idx, setIdx] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (pausado) return
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % SLIDES.length)
    }, INTERVALO_MS)
    return () => window.clearInterval(id)
  }, [pausado])

  const Atual = SLIDES[idx].Component

  return (
    <div
      className="w-full max-w-full"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {/* Eyebrow + titulo do slide atual (altura fixa pra nao dar pulo) */}
      <div className="text-center mb-3 min-h-[56px] flex flex-col justify-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-laranja-dark">
          {SLIDES[idx].eyebrow}
        </p>
        <p className="text-sm md:text-base font-semibold text-slate-900 mt-1.5 leading-snug">
          {SLIDES[idx].titulo}
        </p>
      </div>

      {/* Slide com transicao suave (key={idx} forca remount -> re-anima) */}
      <div className="relative">
        <div key={idx} className="animate-fade-slide">
          <Atual />
        </div>
      </div>

      {/* Indicadores (dots) */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Ir pro slide ${i + 1}`}
            className={
              'h-2 rounded-full transition-all ' +
              (i === idx
                ? 'bg-laranja w-8'
                : 'bg-slate-200 hover:bg-slate-400 w-2')
            }
          />
        ))}
      </div>
    </div>
  )
}
