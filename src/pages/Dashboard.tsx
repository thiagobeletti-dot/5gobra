// Página Dashboard — V2 (redesenho visual, 07/07/2026)
//
// Direção cravada pelo Thiago:
//   - Topo compacto: cartões de número justos + donut de situação da carteira
//   - Aviso de obras SEM CRONOGRAMA com destaque forte + ação
//   - 4 estágios lado a lado na 1ª dobra (Atraso / Atenção / Aguardando / No prazo)
//     cada um com até 3 cards enxutos ordenados da mais crítica pra menos
//   - Botão "Ver todas" abre modal com a lista completa do estágio
//   - Ícones (SVG inline) no lugar de emoji. "Obras ativas" é cartão CLARO.
//
// Sem mudança de regra de negócio — só a camada visual. Dados vêm de lib/dashboard.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import { pegarDashboard, type DashboardData, type ObraDashboard } from '../lib/dashboard'
import { pegarMinhaEmpresa } from '../lib/api'

// ============================================================
// ÍCONES (SVG inline — sem dependência nova)
// ============================================================
type IcProps = { className?: string }
const svgBase = (p: IcProps, path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" className={p.className ?? 'w-4 h-4'}>{path}</svg>
)
const IcAlerta = (p: IcProps) => svgBase(p, <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>)
const IcRelogio = (p: IcProps) => svgBase(p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
const IcCliente = (p: IcProps) => svgBase(p, <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>)
const IcCheck = (p: IcProps) => svgBase(p, <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></>)
const IcPredio = (p: IcProps) => svgBase(p, <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></>)
const IcChevron = (p: IcProps) => svgBase(p, <path d="M9 18l6-6-6-6" />)
const IcX = (p: IcProps) => svgBase(p, <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>)
const IcCalendario = (p: IcProps) => svgBase(p, <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)

// ============================================================
// DONUT (SVG inline)
// ============================================================
function Donut({ segments, total }: { segments: { value: number; color: string }[]; total: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  let acc = 0
  const base = Math.max(total, 1)
  return (
    <svg width={92} height={92} viewBox="0 0 108 108" style={{ flexShrink: 0 }} role="img" aria-label={`${total} obras ativas`}>
      <g transform="rotate(-90 54 54)" fill="none" strokeWidth={14}>
        <circle cx={54} cy={54} r={r} stroke="#f1f5f9" />
        {segments.filter((s) => s.value > 0).map((s, i) => {
          const len = (s.value / base) * c
          const off = -(acc / base) * c
          acc += s.value
          return <circle key={i} cx={54} cy={54} r={r} stroke={s.color} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={off} strokeLinecap="butt" />
        })}
      </g>
      <text x={54} y={50} textAnchor="middle" fontSize={24} fontWeight={800} fill="#0f172a">{total}</text>
      <text x={54} y={66} textAnchor="middle" fontSize={10} fontWeight={600} fill="#94a3b8">ativas</text>
    </svg>
  )
}

// ============================================================
// CONFIG DOS 4 ESTÁGIOS
// ============================================================
type StageKey = 'atraso' | 'atencao' | 'aguardando' | 'noprazo'
interface StageCfg {
  key: StageKey
  label: string
  Icon: (p: IcProps) => JSX.Element
  iconColor: string
  badge: string
  cardBorder: string
  chip: string
  verMais: string
  vazio: string
}
const STAGES: StageCfg[] = [
  { key: 'atraso', label: 'Em atraso', Icon: IcAlerta, iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700', cardBorder: 'border-red-200', chip: 'bg-red-100 text-red-700', verMais: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100', vazio: 'Nada atrasado' },
  { key: 'atencao', label: 'Atenção', Icon: IcRelogio, iconColor: 'text-orange-500', badge: 'bg-orange-100 text-orange-700', cardBorder: 'border-orange-200', chip: 'bg-orange-100 text-orange-700', verMais: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100', vazio: 'Nada vencendo' },
  { key: 'aguardando', label: 'Aguardando cliente', Icon: IcCliente, iconColor: 'text-yellow-500', badge: 'bg-yellow-100 text-yellow-800', cardBorder: 'border-yellow-200', chip: 'bg-yellow-100 text-yellow-800', verMais: 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100', vazio: 'Ninguém esperando' },
  { key: 'noprazo', label: 'No prazo', Icon: IcCheck, iconColor: 'text-green-500', badge: 'bg-green-100 text-green-700', cardBorder: 'border-green-200', chip: 'bg-green-100 text-green-700', verMais: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100', vazio: 'Nada em produção' },
]

function obrasDoEstagio(data: DashboardData, key: StageKey): ObraDashboard[] {
  if (key === 'atraso') return data.atrasadas
  if (key === 'atencao') return data.proximas
  if (key === 'aguardando') return data.aguardandoCliente
  return data.noPrazo
}

function chipTexto(key: StageKey, o: ObraDashboard): string {
  const d = o.diasRestantes
  if (key === 'atraso') return `Vencida há ${Math.abs(d ?? 0)} dia${Math.abs(d ?? 0) !== 1 ? 's' : ''}`
  if (key === 'atencao') return d === 0 ? 'Vence hoje' : `Restam ${d} dia${d !== 1 ? 's' : ''}`
  if (key === 'aguardando') return o.totalCards > 0 ? `${o.cardsConcluidos}/${o.totalCards} itens` : 'Aguardando ação'
  return d === null || d === undefined ? 'Em produção' : `Restam ${d} dias`
}

function faseTexto(key: StageKey, o: ObraDashboard): string {
  if (key === 'aguardando') return 'Aguardando ação do cliente'
  return o.faseAtiva?.nome ?? 'Sem fase ativa'
}

// ============================================================
// ENTREGAS (calendário)
// ============================================================
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Status da obra pra colorir a entrega (mais crítico = rank menor).
function statusEntrega(o: ObraDashboard): { cor: string; rank: number; label: string } {
  if (o.atrasada) return { cor: '#ef4444', rank: 0, label: 'Atrasada' }
  if (o.diasRestantes !== null && o.diasRestantes <= 3) return { cor: '#f97316', rank: 1, label: 'Atenção' }
  if (o.obraPausadaPorCliente) return { cor: '#eab308', rank: 2, label: 'Aguardando cliente' }
  return { cor: '#22c55e', rank: 3, label: 'No prazo' }
}

// ============================================================
// PÁGINA
// ============================================================
export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [empresaNome, setEmpresaNome] = useState<string>('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modal, setModal] = useState<StageKey | 'semcrono' | null>(null)
  const [diaModal, setDiaModal] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const [empresa, dashboard] = await Promise.all([pegarMinhaEmpresa(), pegarDashboard()])
        if (!ativo) return
        if (empresa) setEmpresaNome(empresa.nome)
        setData(dashboard)
      } catch (err: any) {
        if (ativo) setErro(err?.message ?? 'Erro ao carregar dashboard')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [])

  const donutSegs = useMemo(() => {
    if (!data) return []
    const m = data.metricas
    const stages = [
      { value: m.noPrazo, color: '#22c55e' },
      { value: m.aguardandoCliente, color: '#eab308' },
      { value: m.atencaoHoje, color: '#f97316' },
      { value: m.emAtraso, color: '#ef4444' },
    ]
    const soma = stages.reduce((a, s) => a + s.value, 0)
    const outras = Math.max(0, m.totalAtivas - soma)
    return [...stages, { value: outras, color: '#cbd5e1' }]
  }, [data])

  async function logout() {
    await sair()
    navigate('/')
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/app/dashboard"><LogoFull /></Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/app/dashboard" className="font-semibold text-laranja-dark">Dashboard</Link>
            <Link to="/app/obras" className="text-slate-500 hover:text-slate-900">Obras</Link>
            <Link to="/app/ajuda" className="text-slate-500 hover:text-slate-900">Ajuda</Link>
            <Link to="/app/configuracoes" className="text-slate-500 hover:text-slate-900">Configurações</Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden lg:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-7">
        <div className="mb-5 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {empresaNome && <p className="text-sm text-slate-500">{empresaNome}</p>}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">{erro}</div>
        )}

        {carregando ? (
          <SkeletonTopo />
        ) : !data ? (
          <div className="text-slate-500 py-12 text-center">Sem dados.</div>
        ) : data.totalObras === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ===== TOPO: métricas + donut ===== */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
              <div className="flex gap-4 items-stretch flex-wrap">
                <div className="flex-1 min-w-[280px] grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <TileMetrica valor={data.metricas.totalAtivas} rotulo="Ativas" acento="bg-slate-400" numeroCor="text-slate-900" Icon={IcPredio} iconCor="text-slate-400" />
                  <TileMetrica valor={data.metricas.emAtraso} rotulo="Atraso" acento="bg-red-500" numeroCor="text-red-700" borda="border-red-200" />
                  <TileMetrica valor={data.metricas.atencaoHoje} rotulo="Atenção" acento="bg-orange-500" numeroCor="text-orange-700" borda="border-orange-200" />
                  <TileMetrica valor={data.metricas.aguardandoCliente} rotulo="Aguard." acento="bg-yellow-500" numeroCor="text-yellow-700" borda="border-yellow-200" />
                  <TileMetrica valor={data.metricas.noPrazo} rotulo="No prazo" acento="bg-green-500" numeroCor="text-green-700" borda="border-green-200" />
                </div>
                <div className="w-full md:w-[240px] border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                  <Donut segments={donutSegs} total={data.metricas.totalAtivas} />
                  <div className="text-[11px] flex flex-col gap-1.5 flex-1">
                    <LegendaItem cor="#22c55e" rotulo="No prazo" valor={data.metricas.noPrazo} />
                    <LegendaItem cor="#eab308" rotulo="Aguardando" valor={data.metricas.aguardandoCliente} />
                    <LegendaItem cor="#f97316" rotulo="Atenção" valor={data.metricas.atencaoHoje} />
                    <LegendaItem cor="#ef4444" rotulo="Em atraso" valor={data.metricas.emAtraso} />
                  </div>
                </div>
              </div>

              {/* ===== Destaque: obras sem cronograma ===== */}
              {data.metricas.semCronograma > 0 && (
                <div className="mt-4 bg-amber-50 border-[1.5px] border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <IcAlerta className="w-[18px] h-[18px]" />
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-[13px] font-extrabold text-amber-800">
                      {data.metricas.semCronograma} obra{data.metricas.semCronograma !== 1 ? 's' : ''} ainda sem cronograma
                    </div>
                    <div className="text-[11.5px] text-amber-700 mt-0.5">
                      Sem cronograma elas ficam fora do controle de prazos — e invisíveis nos estágios abaixo.
                    </div>
                  </div>
                  <button onClick={() => setModal('semcrono')}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-lg px-4 py-2.5 inline-flex items-center gap-1.5 shadow-sm transition">
                    Resolver agora <IcChevron className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </section>

            {/* ===== CALENDÁRIO DE ENTREGAS ===== */}
            <MiniCalendario entregas={data.entregas} onDia={setDiaModal} />

            {/* ===== 4 ESTÁGIOS ===== */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STAGES.map((cfg) => (
                <ColunaEstagio key={cfg.key} cfg={cfg} obras={obrasDoEstagio(data, cfg.key)} onVerTodas={() => setModal(cfg.key)} />
              ))}
            </section>
          </>
        )}
      </main>

      {/* ===== MODAL "Ver todas" ===== */}
      {modal && data && (
        <ModalEstagio
          data={data}
          modal={modal}
          onClose={() => setModal(null)}
        />
      )}

      {/* ===== MODAL entregas do dia ===== */}
      {diaModal && data && (
        <ModalEntregasDia dia={diaModal} entregas={data.entregas} onClose={() => setDiaModal(null)} />
      )}
    </div>
  )
}

// ============================================================
// COMPONENTES
// ============================================================
function TileMetrica({ valor, rotulo, acento, numeroCor, borda, Icon, iconCor }: {
  valor: number; rotulo: string; acento: string; numeroCor: string; borda?: string; Icon?: (p: IcProps) => JSX.Element; iconCor?: string
}) {
  return (
    <div className={`relative overflow-hidden bg-white border ${borda ?? 'border-slate-200'} rounded-xl px-3 py-2.5`}>
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${acento}`} />
      {Icon && <Icon className={`w-3.5 h-3.5 mb-1 ${iconCor ?? ''}`} />}
      <div className={`text-[23px] leading-none font-extrabold ${numeroCor}`}>{valor}</div>
      <div className="text-[10px] text-slate-500 mt-1 font-medium">{rotulo}</div>
    </div>
  )
}

function LegendaItem({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: number }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cor }} />
      {rotulo}
      <b className="ml-auto text-slate-800">{valor}</b>
    </span>
  )
}

function ColunaEstagio({ cfg, obras, onVerTodas }: { cfg: StageCfg; obras: ObraDashboard[]; onVerTodas: () => void }) {
  const visiveis = obras.slice(0, 3)
  const resto = obras.length - visiveis.length
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <cfg.Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
        <span className="text-[12px] font-extrabold text-slate-700">{cfg.label}</span>
        <span className={`ml-auto text-[11px] font-extrabold rounded-full px-2 py-0.5 ${cfg.badge}`}>{obras.length}</span>
      </div>

      {obras.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center bg-white">
          <IcCheck className="w-[18px] h-[18px] text-green-400 mx-auto mb-1" />
          <div className="text-[11px] text-slate-400">{cfg.vazio}</div>
        </div>
      ) : (
        <>
          {visiveis.map((o) => <CardEnxuto key={o.obra.id} o={o} cfg={cfg} />)}
          {resto > 0 && (
            <button onClick={onVerTodas}
              className={`border-[1.5px] rounded-xl py-2 text-[11.5px] font-extrabold inline-flex items-center justify-center gap-1 transition ${cfg.verMais}`}>
              Ver todas ({obras.length}) <IcChevron className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </div>
  )
}

function CardEnxuto({ o, cfg }: { o: ObraDashboard; cfg: StageCfg }) {
  return (
    <Link to={`/app/obra/${o.obra.id}`}
      className={`block bg-white border ${cfg.cardBorder} rounded-xl p-2.5 shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:shadow-md hover:-translate-y-px transition`}>
      <div className="text-[12.5px] font-bold leading-tight text-slate-900 truncate">{o.obra.nome}</div>
      <div className="text-[11px] text-slate-400 mt-0.5 truncate">{faseTexto(cfg.key, o)}</div>
      <span className={`inline-block mt-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded ${cfg.chip}`}>
        {chipTexto(cfg.key, o)}
      </span>
    </Link>
  )
}

function ModalEstagio({ data, modal, onClose }: { data: DashboardData; modal: StageKey | 'semcrono'; onClose: () => void }) {
  const cfg = STAGES.find((s) => s.key === modal)
  const obras = modal === 'semcrono' ? data.semCronogramaObras : obrasDoEstagio(data, modal as StageKey)
  const titulo = modal === 'semcrono' ? 'Obras sem cronograma' : cfg!.label

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-2xl max-h-[88vh] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          {modal === 'semcrono' ? <IcAlerta className="w-4 h-4 text-amber-500" /> : cfg && <cfg.Icon className={`w-4 h-4 ${cfg.iconColor}`} />}
          <span className="font-bold text-base">{titulo}</span>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{obras.length}</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">
            <IcX className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2">
          {obras.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">Nenhuma obra neste estágio.</div>
          ) : (
            obras.map((o) => <LinhaObra key={o.obra.id} o={o} modal={modal} />)
          )}
        </div>
      </div>
    </div>
  )
}

function LinhaObra({ o, modal }: { o: ObraDashboard; modal: StageKey | 'semcrono' }) {
  const pct = o.totalCards > 0 ? Math.round((o.cardsConcluidos / o.totalCards) * 100) : 0
  const destino = modal === 'semcrono' ? `/app/obra/${o.obra.id}/cronograma` : `/app/obra/${o.obra.id}`
  const cfg = modal === 'semcrono' ? null : STAGES.find((s) => s.key === modal)!
  return (
    <Link to={destino} className="flex items-center gap-3 border border-slate-200 rounded-xl px-3.5 py-3 hover:border-slate-300 hover:shadow-sm transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-900 truncate">{o.obra.nome}</span>
          {cfg ? (
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${cfg.chip}`}>{chipTexto(modal as StageKey, o)}</span>
          ) : (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Sem cronograma</span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {o.obra.cliente_nome || 'Sem cliente'}{o.obra.endereco ? ` · ${o.obra.endereco}` : ''}
        </div>
        <div className="text-xs text-slate-500 mt-1">{cfg ? faseTexto(modal as StageKey, o) : 'Clique pra criar o cronograma'}</div>
        {o.totalCards > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[220px]">
              <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">{o.cardsConcluidos}/{o.totalCards} itens</span>
          </div>
        )}
      </div>
      {modal === 'semcrono'
        ? <IcCalendario className="w-[18px] h-[18px] text-amber-500 shrink-0" />
        : <IcChevron className="w-[18px] h-[18px] text-slate-300 shrink-0" />}
    </Link>
  )
}

function MiniCalendario({ entregas, onDia }: { entregas: ObraDashboard[]; onDia: (dia: string) => void }) {
  const hoje = new Date()
  const [ref, setRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const ano = ref.getFullYear()
  const mes = ref.getMonth()
  const hojeStr = ymd(hoje)

  const porDia = useMemo(() => {
    const m: Record<string, ObraDashboard[]> = {}
    for (const o of entregas) { if (o.dataEntrega) (m[o.dataEntrega] ??= []).push(o) }
    return m
  }, [entregas])

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d)
  while (celulas.length % 7 !== 0) celulas.push(null)

  const proximas = entregas.filter((o) => (o.dataEntrega ?? '') >= hojeStr).slice(0, 3)

  function corDoDia(dia: string): string | null {
    const listaDia = porDia[dia]
    if (!listaDia || listaDia.length === 0) return null
    let melhorRank = 99
    let cor: string | null = null
    for (const o of listaDia) {
      const s = statusEntrega(o)
      if (s.rank <= melhorRank) { melhorRank = s.rank; cor = s.cor }
    }
    return cor
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <IcCalendario className="w-4 h-4 text-laranja" />
        <span className="text-sm font-extrabold">Entregas</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setRef(new Date(ano, mes - 1, 1))} className="w-6 h-6 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="Mês anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="text-xs font-bold text-slate-600 w-28 text-center">{MESES[mes]} {ano}</span>
          <button onClick={() => setRef(new Date(ano, mes + 1, 1))} className="w-6 h-6 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="Próximo mês">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-slate-400 mb-1">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11.5px]">
            {celulas.map((d, i) => {
              if (d === null) return <div key={i} />
              const dia = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const cor = corDoDia(dia)
              const ehHoje = dia === hojeStr
              return (
                <button key={i} disabled={!cor} onClick={() => cor && onDia(dia)}
                  className={`py-1 rounded-md transition ${cor ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'}`}>
                  {ehHoje ? (
                    <span className="inline-flex w-[22px] h-[22px] items-center justify-center rounded-full border-2 border-laranja text-laranja font-extrabold">{d}</span>
                  ) : (
                    <span className={cor ? 'font-bold text-slate-800' : 'text-slate-500'}>{d}</span>
                  )}
                  <span className="block w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: cor ?? 'transparent' }} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="w-[220px] flex-grow">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-2">Próximas entregas</div>
          {proximas.length === 0 ? (
            <div className="text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg p-3 text-center">Nenhuma entrega prevista.</div>
          ) : (
            proximas.map((o) => {
              const s = statusEntrega(o)
              const partes = (o.dataEntrega ?? '--').split('-')
              const mm = partes[1] ?? '', dd = partes[2] ?? ''
              return (
                <button key={o.obra.id} onClick={() => o.dataEntrega && onDia(o.dataEntrega)}
                  className="w-full flex items-center gap-2.5 border border-slate-200 rounded-lg px-2.5 py-2 mb-1.5 hover:border-slate-300 transition text-left">
                  <div className="text-center shrink-0 w-7">
                    <div className="text-sm font-extrabold leading-none" style={{ color: s.cor }}>{dd}</div>
                    <div className="text-[9px] text-slate-400">{MESES_ABREV[(parseInt(mm) || 1) - 1]}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{o.obra.nome}</div>
                    <div className="text-[10px] text-slate-400">Entrega prevista</div>
                  </div>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.cor }} />
                </button>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

function ModalEntregasDia({ dia, entregas, onClose }: { dia: string; entregas: ObraDashboard[]; onClose: () => void }) {
  const lista = entregas.filter((o) => o.dataEntrega === dia).sort((a, b) => statusEntrega(a).rank - statusEntrega(b).rank)
  const partes = dia.split('-')
  const ano = partes[0] ?? '', mm = partes[1] ?? '', dd = partes[2] ?? ''
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-2xl max-h-[88vh] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <IcCalendario className="w-4 h-4 text-laranja" />
          <span className="font-bold text-base">Entregas · {dd}/{mm}/{ano}</span>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{lista.length}</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">
            <IcX className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2">
          {lista.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">Nenhuma entrega neste dia.</div>
          ) : (
            lista.map((o) => {
              const s = statusEntrega(o)
              const pct = o.totalCards > 0 ? Math.round((o.cardsConcluidos / o.totalCards) * 100) : 0
              return (
                <Link key={o.obra.id} to={`/app/obra/${o.obra.id}`} className="flex items-center gap-3 border border-slate-200 rounded-xl px-3.5 py-3 hover:border-slate-300 hover:shadow-sm transition">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">{o.obra.nome}</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: s.cor + '22', color: s.cor }}>{s.label}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{o.obra.cliente_nome || 'Sem cliente'}{o.obra.endereco ? ` · ${o.obra.endereco}` : ''}</div>
                    {o.totalCards > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[220px]"><div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="text-[11px] text-slate-400 font-semibold">{o.cardsConcluidos}/{o.totalCards} itens</span>
                      </div>
                    )}
                  </div>
                  <IcChevron className="w-[18px] h-[18px] text-slate-300 shrink-0" />
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonTopo() {
  return (
    <div className="animate-pulse">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="h-12 bg-slate-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl" />)}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
      <IcPredio className="w-9 h-9 text-slate-300 mx-auto mb-3" />
      <h2 className="font-semibold text-lg mb-1">Nenhuma obra cadastrada ainda</h2>
      <p className="text-sm text-slate-500 mb-5">Crie a primeira obra pra começar a acompanhar prazos, equipe e clientes aqui no dashboard.</p>
      <Link to="/app/obras" className="btn-primary">Criar primeira obra</Link>
    </div>
  )
}
