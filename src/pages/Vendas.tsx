// Máquina de venda — /app/vendas
//
// O requisito, nas palavras do Thiago (10/09/2026): "não tenho cabeça, braço
// e ferramenta para acompanhar e controlar isso e com certeza vou abandonar
// leads e perder oportunidades se não tiver isso".
//
// Daí as três decisões que mandam nesta tela:
//   1. Ela ABRE NO TRABALHO, não num menu. O bloco "Hoje" já vem selecionado.
//   2. Registrar um toque é UM toque de dedo. Formulário mata a ferramenta.
//   3. "Hoje" puxa tudo que está parado, de QUALQUER estado — inclusive
//      conversa que esfriou, que é como negócio morre.
//
// Não existe botão "Adiar" de propósito: empurrar sem decidir é o
// comportamento que faz perder lead.
//
// O quadro do computador não tem arrastar-e-soltar: a marcação acontece no
// celular, onde arrastar não funciona. O quadro é pra enxergar, não pra
// operar.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import {
  ADIANTE, ESTADOS, avancarEstado, criarLead, diasDeParado, encerrar, linkWhats,
  migrouProWhats, pegarCadencia, pegarConfig, pegarLeads, personalizar, registrarConversa,
  registrarEnvio, registrarResposta,
  type EstadoLead, type Lead, type PassoCadencia,
} from '../lib/vendas'

type Aba = 'fila' | 'funil' | 'lista'
type Bloco = 'hoje' | EstadoLead

const BLOCOS: { id: Bloco; t: string }[] = [
  { id: 'hoje', t: 'Hoje' },
  ...ESTADOS.map((e) => ({ id: e.id as Bloco, t: e.t })),
]

const RESUMOS: Record<Bloco, [string, string]> = {
  hoje:        ['Pra falar agora', 'Tudo que está parado, de qualquer estado — inclusive conversa que esfriou.'],
  novo:        ['Nunca falei com essas pessoas', 'Cadastradas na mão ou vindas do site. O primeiro toque ainda não saiu.'],
  cadencia:    ['Mandei e não responderam', 'A sequência corre aqui. Quem responde sai sozinho.'],
  conversando: ['Responderam', 'A cadência para. Aqui é conversa, não perseguição.'],
  testando:    ['Criaram conta de teste', 'Os 14 dias correm. Quem não subiu obra na primeira semana precisa de você.'],
  decidindo:   ['Viram o preço', 'É onde o acompanhamento vale mais.'],
  cliente:     ['Assinaram', 'Daqui pra frente quem cuida é o painel de clientes.'],
  gelado:      ['Não era a hora', 'Terminou a sequência sem responder. Volta pra fila em 90 dias.'],
  perdido:     ['Disseram não', 'Fica registrado. O motivo do não é o que importa.'],
}

/* ---------------------------------------------------------------- peças */

function Tag({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span className={'text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ' + cor}>{children}</span>
}

function tagPrazo(l: Lead) {
  if (!l.situacao) return null
  const n = Math.abs(l.dias ?? 0)
  const d = n === 1 ? ' dia' : ' dias'
  // "atrasado" é toque que não saiu. "parado" é conversa que esfriou.
  if (l.situacao === 'atrasado') {
    return { cor: 'bg-red-100 text-red-800', txt: (l.e_conversa_fria ? 'parado há ' : 'atrasado ') + n + d }
  }
  if (l.situacao === 'hoje') return { cor: 'bg-amber-100 text-amber-800', txt: 'é hoje' }
  return { cor: 'bg-emerald-100 text-emerald-800', txt: 'em ' + n + d }
}

function faixa(l: Lead) {
  if (l.situacao === 'atrasado') return 'bg-status-erro'
  if (l.situacao === 'hoje') return 'bg-status-aguarda'
  if (l.situacao === 'em_dia') return 'bg-status-andamento'
  return 'bg-slate-300'
}

/* ---------------------------------------------------------------- card */

function Card({
  l, cadencia, cfg, aoAgir, aoFechar,
}: {
  l: Lead
  cadencia: PassoCadencia[]
  cfg: Record<string, number>
  aoAgir: (fn: () => Promise<void>) => void
  aoFechar: () => void
}) {
  const p = tagPrazo(l)
  const emCadencia = l.estado === 'novo' || l.estado === 'cadencia'
  const prox = l.toque + 1
  const passo = cadencia.find((c) => c.numero === prox)
  const temZap = !!l.telefone && l.canal === 'whatsapp'
  // Quem já respondeu não está na cadência, mas PRECISA de texto: era o
  // caso do Petterson, que abria sem nada pra mandar. A mensagem sob medida
  // vem primeiro e serve qualquer estado; a da cadência é o padrão.
  const bruto = l.mensagem_proxima ?? (emCadencia ? passo?.mensagem : null)
  const corpo = personalizar(bruto, l, passo?.link)
  const temLink = !!bruto && bruto.includes('{link}')
  const texto = corpo
    ? [corpo, !temLink && passo?.link ? passo.link : null].filter(Boolean).join('\n\n')
    : undefined

  return (
    <div className={'relative bg-white border rounded-2xl p-4 overflow-hidden ' +
      (l.situacao === 'atrasado' ? 'border-red-200 shadow-[0_0_0_3px_rgba(220,38,38,.07)]' : 'border-slate-200')}>
      <span className={'absolute left-0 top-0 bottom-0 w-1 ' + faixa(l)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[16px] font-bold leading-tight text-slate-900">{l.nome}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">
            {[l.empresa, l.cidade].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <button onClick={aoFechar} className="text-[11px] text-slate-400 flex-none">fechar ▴</button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {emCadencia
          ? <Tag cor="bg-laranja-soft text-laranja-dark border border-laranja-border">toque {prox} de {cadencia.length}</Tag>
          : <Tag cor="bg-laranja-soft text-laranja-dark border border-laranja-border">{ESTADOS.find((e) => e.id === l.estado)?.t}</Tag>}
        {p && <Tag cor={p.cor}>{p.txt}</Tag>}
        <Tag cor="bg-slate-100 text-slate-500">{l.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram'}</Tag>
        {l.origem && <Tag cor="bg-slate-100 text-slate-500">{l.origem.replace(/_/g, ' ')}</Tag>}
        {l.passou_pela_giulia && <Tag cor="bg-sky-100 text-sky-800">falou com a Giulia</Tag>}
        {l.foi_pro_whatsapp && <Tag cor="bg-emerald-100 text-emerald-800">migrou pro zap</Tag>}
      </div>

      <div className="text-[12.5px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100 leading-relaxed">
        {l.telefone && (
          <><b className="text-slate-600">Contato:</b> {l.telefone}{' · '}
          <a href={'tel:+55' + l.telefone.replace(/\D/g, '')} className="text-laranja-dark font-semibold">ligar</a><br /></>
        )}
        {l.instagram && <><b className="text-slate-600">Instagram:</b> @{l.instagram}<br /></>}
        {l.resumo && <><b className="text-slate-600">Último:</b> {l.resumo}</>}
      </div>

      {l.gancho && (
        <div className="mt-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2.5">
          <span className="block font-mono text-[10px] tracking-[.12em] uppercase text-slate-400 mb-1">gancho</span>
          <p className="text-[13.5px] text-slate-600 leading-snug">{l.gancho}</p>
        </div>
      )}

      <div className="mt-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2.5">
        <span className="block font-mono text-[10px] tracking-[.12em] uppercase text-slate-400 mb-1">
          {l.mensagem_proxima
            ? 'o que mandar'
            : emCadencia && passo ? 'toque ' + prox + ' — ' + passo.titulo : 'o que mandar'}
        </span>
        {corpo
          ? <p className="text-[13.5px] text-slate-700 whitespace-pre-line leading-relaxed">{corpo}</p>
          : <p className="text-[13px] text-slate-400 italic">
              Sem texto pronto pra esse. Escreve na hora, ou me pede que eu escrevo e carrego.
            </p>}
        {corpo && temZap && (
          <a href={linkWhats(l, texto)} target="_blank" rel="noopener noreferrer"
             className="btn-primary w-full mt-2.5 text-[13px] py-2">
            Abrir no WhatsApp com o texto
          </a>
        )}
      </div>

      <div className="grid grid-cols-[1.25fr_1fr] gap-2 mt-3">
        {emCadencia ? (
          <>
            <button onClick={() => aoAgir(() => registrarEnvio(l, cadencia))}
                    className="btn-primary py-3">Mandei</button>
            <button onClick={() => aoAgir(() => registrarResposta(l, cfg))}
                    className="btn py-3 bg-emerald-100 text-emerald-900 hover:bg-emerald-200">Respondeu</button>
          </>
        ) : (
          <>
            <button onClick={() => aoAgir(() => registrarConversa(l, cfg))}
                    className="btn-primary py-3">Falei hoje</button>
            <button
              onClick={() => {
                // Antes era só "Avançar →": ninguém sabia pra onde, não pedia
                // confirmação e não dava pra desfazer. Mandou o Petterson pra
                // Testando sem ele ter criado conta (14/09/2026).
                const destino = ADIANTE[l.estado]
                if (!destino) return
                const nome = ESTADOS.find((e) => e.id === destino)?.t ?? destino
                if (window.confirm('Mover ' + l.nome + ' para "' + nome + '"?')) {
                  aoAgir(() => avancarEstado(l, cfg))
                }
              }}
              className="btn py-3 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 text-[13px]">
              {(() => {
                const d = ADIANTE[l.estado]
                return d ? '→ ' + (ESTADOS.find((e) => e.id === d)?.t ?? d) : 'Avançar'
              })()}
            </button>
          </>
        )}
      </div>

      {l.canal === 'instagram' && !l.foi_pro_whatsapp && (
        <button
          onClick={() => {
            const tel = window.prompt('Telefone dele no WhatsApp (só números com DDD):')
            if (tel && tel.replace(/\D/g, '').length >= 10) aoAgir(() => migrouProWhats(l, tel.replace(/\D/g, '')))
          }}
          className="btn-ghost w-full mt-2 text-[13px] py-2">
          Passou pro WhatsApp
        </button>
      )}

      {l.estado !== 'perdido' && l.estado !== 'cliente' && (
        <button
          onClick={() => {
            const m = window.prompt('O que ele disse? (fica registrado)')
            if (m !== null) aoAgir(() => encerrar(l, 'perdido', m || 'sem motivo informado'))
          }}
          className="w-full mt-2 text-[12px] font-semibold text-slate-400 hover:text-status-erro underline underline-offset-4 py-2">
          Marcar como perdido
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- página */

export default function Vendas() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [cadencia, setCadencia] = useState<PassoCadencia[]>([])
  const [cfg, setCfg] = useState<Record<string, number>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('fila')
  const [bloco, setBloco] = useState<Bloco>('hoje')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setErro(null)
      const [ls, cd, cf] = await Promise.all([pegarLeads(), pegarCadencia(), pegarConfig()])
      setLeads(ls); setCadencia(cd); setCfg(cf)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar os leads.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  // Toda ação recarrega: são poucas dezenas de linhas e assim a tela nunca
  // mostra um estado que o banco não tem.
  const agir = useCallback((fn: () => Promise<void>) => {
    setSalvando(true)
    void fn()
      .then(() => carregar())
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui salvar.'))
      .finally(() => setSalvando(false))
  }, [carregar])

  const doBloco = useCallback(
    (b: Bloco) => b === 'hoje' ? leads.filter((l) => l.na_fila) : leads.filter((l) => l.estado === b),
    [leads],
  )

  const lista = useMemo(() => doBloco(bloco), [doBloco, bloco])

  const grupos = useMemo(() => ([
    { t: 'passou do prazo',     v: true,  itens: lista.filter((l) => l.situacao === 'atrasado') },
    { t: 'é hoje',              v: false, itens: lista.filter((l) => l.situacao === 'hoje') },
    { t: 'em dia — aguardando', v: false, itens: lista.filter((l) => l.situacao === 'em_dia') },
    { t: 'sem prazo correndo',  v: false, itens: lista.filter((l) => !l.situacao) },
  ].filter((g) => g.itens.length)), [lista])

  const naFila = leads.filter((l) => l.na_fila)
  const atrasados = naFila.filter((l) => l.situacao === 'atrasado').length
  const teto = cfg.teto_por_dia ?? 15

  function alternar(id: string) {
    setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function novoLead() {
    const nome = window.prompt('Nome do lead:')
    if (!nome) return
    const empresa = window.prompt('Empresa (pode deixar vazio):') ?? ''
    const telefone = window.prompt('Telefone com DDD (só números):') ?? ''
    try {
      await criarLead({
        nome, empresa: empresa || null,
        telefone: telefone.replace(/\D/g, '') || null,
        canal: telefone ? 'whatsapp' : 'instagram',
        origem: 'manual',
      })
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui cadastrar.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link to="/app/obras"><LogoFull small /></Link>
          <span className="text-sm font-bold text-slate-700">Vendas</span>
          <Link to="/app/admin" className="ml-auto text-xs text-slate-500 hover:text-laranja">
            Clientes →
          </Link>
        </div>
      </header>

      {/* abas */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-7 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex gap-6">
          {([['fila', 'Fila'], ['funil', 'Funil'], ['lista', 'Lista']] as [Aba, string][]).map(([id, t]) => (
            <button key={id} onClick={() => setAba(id)}
              className={'py-3 text-sm font-semibold border-b-2 -mb-px ' +
                (aba === id ? 'text-laranja-dark border-laranja' : 'text-slate-500 border-transparent')}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-7 py-5 pb-24">
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm mb-4">
            {erro}
          </div>
        )}
        {carregando && <p className="text-sm text-slate-500">Carregando…</p>}

        {!carregando && aba === 'fila' && (
          <>
            {/* blocos */}
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {BLOCOS.map((b) => {
                const dentro = doBloco(b.id)
                const atr = dentro.filter((l) => l.situacao === 'atrasado').length
                const on = bloco === b.id
                return (
                  <button key={b.id} onClick={() => { setBloco(b.id); setAbertos(new Set()) }}
                    className={'relative flex-none text-left rounded-xl border px-3 py-2 min-w-[84px] ' +
                      (on ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200')}>
                    {atr > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-status-erro text-white text-[9.5px] font-bold grid place-items-center ring-2 ring-slate-50">
                        {atr}
                      </span>
                    )}
                    <div className={'text-[11.5px] font-bold whitespace-nowrap ' + (on ? 'text-white' : 'text-slate-700')}>{b.t}</div>
                    <div className={'font-mono text-[15px] ' + (on ? 'text-white' : 'text-slate-900')}>{dentro.length}</div>
                  </button>
                )
              })}
            </div>

            <div className="max-w-[620px]">
              <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-3 mb-3.5">
                <b className="block text-[14px] text-slate-900">{RESUMOS[bloco][0]} · {lista.length}</b>
                <span className="block text-[12.5px] text-slate-500 leading-snug mt-0.5">
                  {bloco === 'hoje' && atrasados > 0 && (
                    <b className="text-status-erro">{atrasados} passou do prazo. </b>
                  )}
                  {RESUMOS[bloco][1]}
                </span>
                {bloco === 'hoje' && naFila.length > teto && (
                  <span className="block text-[12px] text-laranja-dark mt-1.5">
                    Manda no máximo {teto} hoje. Acima disso o Instagram começa a limitar sua conta.
                  </span>
                )}
              </div>

              {bloco === 'novo' && (
                <button onClick={() => void novoLead()} className="btn-primary w-full py-3.5 mb-3.5">
                  + Cadastrar lead
                </button>
              )}

              {!grupos.length && (
                <div className="text-center text-slate-400 text-sm py-10">
                  <b className="block text-slate-500 text-[15px] mb-1">Nada aqui.</b>
                  {bloco === 'hoje' ? 'Fila limpa — ninguém pra falar hoje.' : 'Nenhum lead nesse estado.'}
                </div>
              )}

              {grupos.map((g) => (
                <div key={g.t}>
                  <div className={'font-mono text-[10.5px] tracking-[.12em] uppercase mt-4 mb-2 flex items-center gap-2 ' +
                    (g.v ? 'text-status-erro' : 'text-slate-400')}>
                    {g.t} · {g.itens.length}
                    <span className={'flex-1 h-px ' + (g.v ? 'bg-red-200' : 'bg-slate-200')} />
                  </div>
                  {g.itens.map((l) => {
                    if (abertos.has(l.id)) {
                      return <div key={l.id} className="mb-2.5">
                        <Card l={l} cadencia={cadencia} cfg={cfg} aoAgir={agir} aoFechar={() => alternar(l.id)} />
                      </div>
                    }
                    const p = tagPrazo(l)
                    return (
                      <button key={l.id} onClick={() => alternar(l.id)}
                        className="relative w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-2.5 mb-2 grid grid-cols-[1fr_auto] gap-2.5 items-center overflow-hidden">
                        <span className={'absolute left-0 top-0 bottom-0 w-1 ' + faixa(l)} />
                        <div>
                          <div className="text-[14.5px] font-semibold text-slate-900 leading-tight">{l.nome}</div>
                          <div className="text-[11.5px] text-slate-500 mt-0.5">{l.empresa ?? '—'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {(l.estado === 'cadencia' || l.estado === 'novo') && (
                            <Tag cor="bg-laranja-soft text-laranja-dark">toque {l.toque}/{cadencia.length}</Tag>
                          )}
                          {p && <Tag cor={p.cor}>{p.txt}</Tag>}
                          <span className="text-[11px] text-slate-400">abrir ▾</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {!carregando && aba === 'funil' && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ESTADOS.map((s) => {
              const dentro = leads.filter((l) => l.estado === s.id)
              return (
                <div key={s.id} className="flex-none w-[250px] bg-slate-100 border border-slate-200 rounded-xl p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2.5 px-0.5">
                    <div>
                      <div className="text-[12.5px] font-bold text-slate-800">{s.t}</div>
                      <div className="text-[10px] text-slate-400">{s.s}</div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 bg-white border border-slate-200 rounded-full px-2">
                      {dentro.length}
                    </span>
                  </div>
                  {dentro.map((l) => {
                    const p = tagPrazo(l)
                    return (
                      <button key={l.id} onClick={() => { setAba('fila'); setBloco(l.estado); setAbertos(new Set([l.id])) }}
                        className="relative w-full text-left bg-white border border-slate-200 rounded-lg p-2.5 mb-2 overflow-hidden">
                        <span className={'absolute left-0 top-0 bottom-0 w-1 ' + faixa(l)} />
                        <div className="text-[13px] font-semibold text-slate-900 leading-tight">{l.nome}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{l.empresa ?? '—'}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.id === 'cadencia' && <Tag cor="bg-laranja-soft text-laranja-dark">toque {l.toque}/{cadencia.length}</Tag>}
                          {p && <Tag cor={p.cor}>{p.txt}</Tag>}
                        </div>
                      </button>
                    )
                  })}
                  {!dentro.length && <div className="text-[11.5px] text-slate-400 px-0.5 py-1">vazio</div>}
                </div>
              )
            })}
          </div>
        )}

        {!carregando && aba === 'lista' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Lead', 'Estado', 'Toque', 'Próximo', 'Canal', 'Origem', 'Último'].map((h) => (
                      <th key={h} className="text-left font-mono text-[10px] tracking-[.08em] uppercase text-slate-400 font-semibold px-3 py-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const p = tagPrazo(l)
                    return (
                      <tr key={l.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2.5 align-top">
                          <div className="text-[13.5px] font-semibold text-slate-900">{l.nome}</div>
                          <div className="text-[11.5px] text-slate-500">{l.empresa ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 align-top"><Tag cor="bg-slate-100 text-slate-600">{ESTADOS.find((e) => e.id === l.estado)?.t}</Tag></td>
                        <td className="px-3 py-2.5 align-top font-mono text-[12.5px] text-slate-600">
                          {l.estado === 'cadencia' ? l.toque + '/' + cadencia.length : '—'}
                        </td>
                        <td className="px-3 py-2.5 align-top">{p ? <Tag cor={p.cor}>{p.txt}</Tag> : <span className="text-slate-400 text-[12.5px]">—</span>}</td>
                        <td className="px-3 py-2.5 align-top text-[12.5px] text-slate-500">{l.canal}</td>
                        <td className="px-3 py-2.5 align-top text-[12.5px] text-slate-500">{l.origem?.replace(/_/g, ' ') ?? '—'}</td>
                        <td className="px-3 py-2.5 align-top text-[12.5px] text-slate-500 max-w-[240px]">{l.resumo ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {salvando && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[13px] px-4 py-2 rounded-full z-50">
          salvando…
        </div>
      )}
    </div>
  )
}
