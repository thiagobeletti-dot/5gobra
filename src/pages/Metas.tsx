// G Obra — Página Metas (gamificação) · /app/metas
//
// Feature cravada pelo Thiago 14-15/07/2026, layout v3.1 validado em mockup:
// duas colunas independentes (Calendário+Ranking | Metas+Placar), streak em
// faixa full-width com 3 ESTADOS CONDICIONAIS (verde ativo / cinza quebrado /
// vermelho crítico 3+ dias), períodos Hoje/Semana/Mês dinâmicos, ⚙️ config
// de alvos e pontos. Placar = reflexo dos registros reais (lib/metas.ts).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sair, useAuth } from '../lib/auth'
import { LogoFull } from '../lib/logo'
import {
  calcularMetas,
  salvarMetasConfig,
  alvoDe,
  type DadosMetas,
  type MetasConfig,
  type Periodo,
} from '../lib/metas'

const ROTULO_PERIODO: Record<Periodo, string> = { dia: 'hoje', semana: 'da semana', mes: 'do mês' }

export default function Metas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  async function logout() {
    await sair()
    navigate('/login')
  }
  const [dados, setDados] = useState<DadosMetas | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('dia')
  const [configAberta, setConfigAberta] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await calcularMetas())
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  function mostrarToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const hoje = useMemo(() => new Date(), [])

  return (
    <div className="min-h-screen">
      {/* ===== header padrão do app ===== */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/app/dashboard"><LogoFull /></Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/app/dashboard" className="text-slate-500 hover:text-slate-900">Dashboard</Link>
            <Link to="/app/obras" className="text-slate-500 hover:text-slate-900">Obras</Link>
            <Link to="/app/metas" className="font-semibold text-laranja-dark">Metas</Link>
            <Link to="/app/ajuda" className="text-slate-500 hover:text-slate-900">Ajuda</Link>
            <Link to="/app/configuracoes" className="text-slate-500 hover:text-slate-900">Configurações</Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden lg:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🎯 Metas</h1>
            <p className="text-sm text-slate-500">O placar da sua produção — direto dos registros reais.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-full p-0.5">
              {(['dia', 'semana', 'mes'] as Periodo[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                    periodo === p ? 'bg-laranja text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p === 'dia' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setConfigAberta(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ⚙️ Configurar
            </button>
          </div>
        </div>

        {carregando && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            Calculando o placar…
          </div>
        )}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
            Erro ao carregar: {erro}
          </div>
        )}

        {dados && !carregando && (
          <>
            <FaixaStreak dados={dados} />

            <div className="grid md:grid-cols-2 gap-4 items-start">
              {/* ===== coluna esquerda: calendário + ranking ===== */}
              <div className="flex flex-col gap-4">
                <CardCalendario dados={dados} hoje={hoje} />
                <CardRanking dados={dados} periodo={periodo} />
              </div>

              {/* ===== coluna direita: metas + placar ===== */}
              <div className="flex flex-col gap-4">
                <CardMetas dados={dados} periodo={periodo} />
                <CardPlacar dados={dados} />
              </div>
            </div>
          </>
        )}
      </main>

      {configAberta && dados && (
        <ModalConfig
          config={dados.config}
          onFechar={() => setConfigAberta(false)}
          onSalvo={() => {
            setConfigAberta(false)
            mostrarToast('Configuração salva — placar recalculado. ✓')
            recarregar()
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// ============================================================
// STREAK — 3 estados condicionais (cravado 15/07: a cor É informação)
// ============================================================
function FaixaStreak({ dados }: { dados: DadosMetas }) {
  const estado = dados.estadoStreak
  const classes =
    estado === 'ativo'
      ? 'from-emerald-600 to-emerald-500'
      : estado === 'critico'
        ? 'from-red-600 to-red-500'
        : 'from-slate-500 to-slate-400'
  return (
    <div className={`bg-gradient-to-br ${classes} text-white rounded-2xl px-5 py-4 mb-4 flex items-center gap-4`}>
      <span className="text-3xl">
        {estado === 'ativo' ? '🔥' : estado === 'critico' ? '🚨' : '😐'}
      </span>
      <div className="flex-1">
        {estado === 'ativo' && (
          <>
            <p className="text-xl font-bold">
              {dados.streakDias} {dados.streakDias === 1 ? 'dia' : 'dias'} seguidos
            </p>
            <p className="text-sm opacity-90">batendo a meta diária de produção</p>
          </>
        )}
        {estado === 'quebrado' && (
          <>
            <p className="text-xl font-bold">Sequência reiniciada</p>
            <p className="text-sm opacity-90">a meta não fechou — hoje recomeça do zero</p>
          </>
        )}
        {estado === 'critico' && (
          <>
            <p className="text-xl font-bold">{dados.diasSemBater} dias sem bater a meta</p>
            <p className="text-sm opacity-90">produção abaixo do alvo — vale conversar com a equipe</p>
          </>
        )}
      </div>
      <div className="text-right">
        <p className="font-bold">Recorde: {dados.streakRecorde}</p>
        <p className="text-xs opacity-80">últimos 90 dias</p>
      </div>
    </div>
  )
}

// ============================================================
// METAS DO PERÍODO
// ============================================================
function BarraMeta({
  nome,
  atual,
  alvo,
  fonte,
}: {
  nome: string
  atual: number
  alvo: number
  fonte: string
}) {
  const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0
  const ok = alvo > 0 && atual >= alvo
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-semibold text-slate-800">{nome}</span>
        <span className="text-slate-500 tabular-nums">
          <b className="text-slate-900">{atual}</b> / {alvo}
          {ok ? ' ✓' : ''}
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : 'bg-laranja'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{fonte}</p>
    </div>
  )
}

function CardMetas({ dados, periodo }: { dados: DadosMetas; periodo: Periodo }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold text-slate-900 mb-4">
        📊 Metas {ROTULO_PERIODO[periodo]}{' '}
        <span className="text-xs font-normal text-slate-400">— tempo real</span>
      </h2>
      <BarraMeta
        nome="Fabricar peças"
        atual={dados.fabricadas[periodo]}
        alvo={alvoDe(dados.config, 'fabricar', periodo)}
        fonte='Conta quando a peça chega a "Pronto pra instalação"'
      />
      <BarraMeta
        nome="Instalar peças"
        atual={dados.instaladas[periodo]}
        alvo={alvoDe(dados.config, 'instalar', periodo)}
        fonte='Conta quando a peça chega a "Concluído"'
      />
      <div className="mb-0 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Aceites do cliente</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{dados.concluidas[periodo]}</p>
        </div>
        <div>
          <p className="text-slate-500">Apontamentos abertos</p>
          <p className={`text-lg font-bold tabular-nums ${dados.reclamacoes[periodo] > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {dados.reclamacoes[periodo]}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// RANKING POR OBRA
// ============================================================
function CardRanking({ dados, periodo }: { dados: DadosMetas; periodo: Periodo }) {
  const linhas = dados.ranking[periodo]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold text-slate-900 mb-3">
        🏆 Ranking por obra{' '}
        <span className="text-xs font-normal text-slate-400">— pontos {ROTULO_PERIODO[periodo]}</span>
      </h2>
      {linhas.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">
          Sem pontos no período ainda — o ranking nasce dos registros das peças.
        </p>
      ) : (
        <ul>
          {linhas.slice(0, 6).map((l, i) => (
            <li
              key={l.obraId}
              className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 text-sm"
            >
              <span
                className={`w-7 h-7 rounded-full grid place-items-center font-bold text-xs ${
                  i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate font-medium text-slate-800">{l.obraNome}</span>
              <span className={`font-bold tabular-nums ${l.pontos < 0 ? 'text-red-600' : 'text-laranja-dark'}`}>
                {l.pontos} pts
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400 mt-3">
        Pontos configuráveis no ⚙️. Apontamentos descontam (anti-gaming).
      </p>
    </div>
  )
}

// ============================================================
// CALENDÁRIO DE DATAS-LIMITE (o quadrante mais importante)
// ============================================================
function CardCalendario({ dados, hoje }: { dados: DadosMetas; hoje: Date }) {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const primeiroDia = new Date(ano, mes, 1)
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const offset = primeiroDia.getDay() // 0=dom

  const deadlinesDoMes = new Map<number, { fase: string; obra: string }[]>()
  for (const d of dados.deadlines) {
    if (d.data.getFullYear() === ano && d.data.getMonth() === mes) {
      const dia = d.data.getDate()
      ;(deadlinesDoMes.get(dia) ?? deadlinesDoMes.set(dia, []).get(dia)!).push(d)
    }
  }

  const proximos = dados.deadlines
    .filter((d) => d.data >= new Date(ano, mes, hoje.getDate()))
    .slice(0, 4)

  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long' })

  const celulas: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold text-slate-900 mb-3 capitalize">📅 {nomeMes} · datas-limite</h2>
      <div className="grid grid-cols-7 text-center text-xs text-slate-400 font-semibold mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className="py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((dia, i) => {
          if (dia === null) return <span key={`v${i}`} />
          const ehHoje = dia === hoje.getDate()
          const tem = deadlinesDoMes.get(dia)
          return (
            <div
              key={dia}
              title={tem?.map((t) => `${t.fase} — ${t.obra}`).join('\n')}
              className={`h-10 rounded-lg grid place-items-center text-sm ${
                ehHoje
                  ? 'bg-laranja text-white font-bold'
                  : tem
                    ? 'bg-amber-100 font-semibold text-slate-800'
                    : 'text-slate-600'
              }`}
            >
              {dia}
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 text-xs text-slate-400 mt-2">
        <span><i className="inline-block w-2.5 h-2.5 rounded bg-laranja mr-1" />hoje</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded bg-amber-100 border border-amber-200 mr-1" />data-limite</span>
      </div>
      {proximos.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          {proximos.map((d, i) => {
            const dias = Math.ceil((d.data.getTime() - hoje.getTime()) / 86400000)
            return (
              <p key={i} className="flex justify-between gap-2 py-1.5 text-sm border-b border-slate-50 last:border-0">
                <span className="truncate text-slate-700">{d.fase} — {d.obra}</span>
                <span className={`font-semibold whitespace-nowrap ${dias <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                  {d.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {dias <= 0 ? 'hoje' : `${dias}d`}
                </span>
              </p>
            )
          })}
        </div>
      )}
      {dados.deadlines.length === 0 && (
        <p className="text-sm text-slate-400 mt-3">
          Sem datas-limite — crie cronogramas nas obras pra alimentar o calendário.
        </p>
      )}
    </div>
  )
}

// ============================================================
// PLACAR DO MÊS
// ============================================================
function CardPlacar({ dados }: { dados: DadosMetas }) {
  const alvoMes = dados.config.alvo_fabricar_mes
  const alvoInstMes = dados.config.alvo_instalar_mes
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="font-bold text-slate-900 mb-4">💰 Placar do mês</h2>
      <BarraMeta nome="Peças fabricadas" atual={dados.fabricadas.mes} alvo={alvoMes} fonte="" />
      <BarraMeta nome="Peças instaladas" atual={dados.instaladas.mes} alvo={alvoInstMes} fonte="" />
      <div className="flex justify-between text-sm py-2 border-t border-slate-100">
        <span className="font-semibold text-slate-800">Peças concluídas (aceite)</span>
        <span className="font-bold text-slate-900 tabular-nums">{dados.concluidas.mes}</span>
      </div>
      <div className="py-2 border-t border-slate-100">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-slate-800">Obras concluídas</span>
          <span className="font-bold text-slate-900 tabular-nums">
            {dados.obrasConcluidasMes.length} no mês{dados.obrasConcluidasMes.length > 0 ? ' ✓' : ''}
          </span>
        </div>
        {dados.obrasConcluidasMes.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            {dados.obrasConcluidasMes
              .map((o) => `${o.nome} (${o.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`)
              .join(' · ')}
          </p>
        )}
      </div>
      <div className="mt-3 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-xl px-4 py-3">
        <p className="font-bold">♻️ Economia de sobras</p>
        <p className="text-xs opacity-90">
          chega aqui na integração com o G Estoque — as barras que suas sobras já cobriram
        </p>
      </div>
    </div>
  )
}

// ============================================================
// MODAL DE CONFIGURAÇÃO (alvos + pontos)
// ============================================================
function ModalConfig({
  config,
  onFechar,
  onSalvo,
}: {
  config: MetasConfig
  onFechar: () => void
  onSalvo: () => void
}) {
  const [c, setC] = useState<MetasConfig>({ ...config })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function campo(chave: keyof MetasConfig) {
    return (
      <input
        type="number"
        value={c[chave]}
        onChange={(e) => setC((prev) => ({ ...prev, [chave]: Number(e.target.value) }))}
        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-center text-sm"
      />
    )
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      await salvarMetasConfig(c)
      onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900 mb-1">⚙️ Configurar metas e pontos</h2>
        <p className="text-sm text-slate-500 mb-4">
          Você define o alvo e o valor de cada ação — o sistema conta sozinho, a partir dos registros reais.
        </p>

        <div className="grid grid-cols-[1fr_64px_64px_64px_70px] gap-2 items-center text-xs font-semibold text-slate-400 uppercase tracking-wide border-b-2 border-slate-100 pb-2">
          <span>Ação</span><span className="text-center">Dia</span><span className="text-center">Semana</span><span className="text-center">Mês</span><span className="text-center">Pontos</span>
        </div>
        <div className="grid grid-cols-[1fr_64px_64px_64px_70px] gap-2 items-center text-sm py-2.5 border-b border-slate-100">
          <span className="text-slate-800">Fabricar peças</span>
          {campo('alvo_fabricar_dia')}{campo('alvo_fabricar_semana')}{campo('alvo_fabricar_mes')}{campo('pts_fabricar')}
        </div>
        <div className="grid grid-cols-[1fr_64px_64px_64px_70px] gap-2 items-center text-sm py-2.5 border-b border-slate-100">
          <span className="text-slate-800">Instalar peças</span>
          {campo('alvo_instalar_dia')}{campo('alvo_instalar_semana')}{campo('alvo_instalar_mes')}{campo('pts_instalar')}
        </div>
        <div className="grid grid-cols-[1fr_64px_64px_64px_70px] gap-2 items-center text-sm py-2.5 border-b border-slate-100">
          <span className="text-slate-800">Aceite do cliente</span>
          <span className="text-center text-slate-300">—</span><span className="text-center text-slate-300">—</span><span className="text-center text-slate-300">—</span>
          {campo('pts_concluir')}
        </div>
        <div className="grid grid-cols-[1fr_64px_64px_64px_70px] gap-2 items-center text-sm py-2.5">
          <span className="text-slate-800">Apontamento (desconta)</span>
          <span className="text-center text-slate-300">—</span><span className="text-center text-slate-300">—</span><span className="text-center text-slate-300">—</span>
          {campo('pts_reclamacao')}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Anti-gaming: apontamento desconta ponto. Prazos (medições/entregas) são acompanhados pelo
          calendário e pelo Dashboard — não se configura "atrasar".
        </p>

        {erro && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onFechar} disabled={salvando} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-laranja hover:bg-laranja-dark text-white font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
      </div>
    </div>
  )
}
