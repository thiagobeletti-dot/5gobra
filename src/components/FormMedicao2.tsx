import { useState } from 'react'
import type { DadosMedicao1, DadosMedicao2, Tipologia } from '../types/checklist'
import { VAZIO_MEDICAO2, ROTULOS_TIPOLOGIA } from '../types/checklist'

interface Props {
  inicial?: DadosMedicao2 | null
  // Dados do M1 pra condicionar campos (precisamos saber se contra-marco era SIM)
  m1?: DadosMedicao1 | null
  onSalvar: (dados: DadosMedicao2) => Promise<void>
  onCancelar: () => void
}

// ===== Helpers de UI =====

function Secao({ titulo, children, aberta = true, destaque = false }: { titulo: string; children: any; aberta?: boolean; destaque?: boolean }) {
  return (
    <details open={aberta} className={'border rounded-lg overflow-hidden ' + (destaque ? 'border-laranja-border' : 'border-slate-200')}>
      <summary className={'px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none ' + (destaque ? 'bg-laranja-soft text-laranja-dark hover:brightness-95' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}>
        {titulo}
      </summary>
      <div className="p-4 space-y-3 bg-white">
        {children}
      </div>
    </details>
  )
}

function Campo({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

function GrupoRadio<T extends string>({ label, valor, opcoes, onChange, obs, onChangeObs }: {
  label: string
  valor: T | ''
  opcoes: { v: T; l: string }[]
  onChange: (v: T) => void
  obs?: string
  onChangeObs?: (v: string) => void
}) {
  const ehNao = valor === ('nao' as T)
  return (
    <div>
      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{label}</span>
      <div className="flex gap-2 flex-wrap">
        {opcoes.map((o) => {
          const ativo = valor === o.v
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={'px-3 py-1.5 rounded-md text-xs font-semibold border transition ' + (ativo
                ? 'bg-laranja text-white border-laranja'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
            >
              {o.l}
            </button>
          )
        })}
      </div>
      {onChangeObs && ehNao && (
        <input
          type="text"
          className="input mt-2 text-sm"
          placeholder="O que está errado?"
          value={obs ?? ''}
          onChange={(e) => onChangeObs(e.target.value)}
        />
      )}
    </div>
  )
}

function Check({ label, valor, onChange }: { label: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-md border bg-white border-slate-200 hover:border-slate-400">
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-laranja focus:ring-laranja/30" />
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </label>
  )
}

function Texto({ valor, onChange, placeholder, type = 'text' }: { valor: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} className="input text-sm" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
}

function TextoArea({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea className="input text-sm min-h-[60px]" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
}

const TIPOLOGIAS: Exclude<Tipologia, ''>[] = ['fixo', 'correr', 'giro', 'maxim_ar']

// ===== Form principal =====

export default function FormMedicao2({ inicial, m1, onSalvar, onCancelar }: Props) {
  const [d, setD] = useState<DadosMedicao2>(inicial ?? VAZIO_MEDICAO2)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function up<K extends keyof DadosMedicao2>(k: K, v: DadosMedicao2[K]) {
    setD((s) => ({ ...s, [k]: v }))
  }

  // Condicionais baseadas no M1
  const m1Cm = m1?.contra_marco === 'sim'

  async function salvar() {
    setErro(null)
    if (!d.liberado_producao) {
      setErro('Decida se o vão está liberado pra produção (Sim ou Não).')
      return
    }
    if (d.liberado_producao === 'sim') {
      if (!d.tipologia) {
        setErro('Escolha a tipologia da peça antes de liberar pra produção.')
        return
      }
      if (!d.medida_largura.trim() || !d.medida_altura.trim()) {
        setErro('Preencha a medida final (largura e altura) pra liberar pra produção.')
        return
      }
    } else if (d.liberado_producao === 'nao') {
      if (!d.pendencias.trim()) {
        setErro('Liste as pendências pra empresa orientar o cliente.')
        return
      }
    }

    // Limpa campos da tipologia não escolhida
    const dadosFinais: DadosMedicao2 = {
      ...d,
      ...(d.tipologia !== 'giro' ? {
        giro_abertura: '' as const,
        giro_fechadura_lado: '' as const,
        giro_puxador: false,
      } : {}),
      ...(d.tipologia !== 'correr' ? {
        correr_abertura_lado: '' as const,
        correr_fecho: '' as const,
        correr_trilho: '' as const,
        correr_somente_puxador: false,
      } : {}),
    }

    setSalvando(true)
    try {
      await onSalvar(dadosFinais)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm grid place-items-end md:place-items-center p-0 md:p-5 z-50" onClick={onCancelar}>
      <div className="bg-white border border-slate-200 rounded-t-2xl md:rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 md:px-6 py-4 md:py-5 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold border mb-2 bg-laranja-soft text-laranja-dark border-laranja-border">Medição 2 — Conferência final</span>
            <div className="text-base md:text-lg font-bold">Vão pronto pra produção?</div>
            <div className="text-xs text-slate-500 mt-0.5">Confere o estado do vão e captura as especificações finais da peça pra fabricação.</div>
          </div>
          <button onClick={onCancelar} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition">x</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 md:py-5 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg text-sm text-red-700">{erro}</div>
          )}

          <Secao titulo="Cabeçalho">
            <div className="grid md:grid-cols-3 gap-3">
              <Campo label="Data"><Texto valor={d.data} onChange={(v) => up('data', v)} type="date" /></Campo>
              <Campo label="Técnico (quem mediu)"><Texto valor={d.tecnico} onChange={(v) => up('tecnico', v)} placeholder="Nome do técnico" /></Campo>
              <Campo label="Responsável da obra"><Texto valor={d.responsavel_obra} onChange={(v) => up('responsavel_obra', v)} placeholder="Quem recebeu na obra" /></Campo>
            </div>
          </Secao>

          <Secao titulo="Estado do vão">
            {m1Cm && (
              <GrupoRadio
                label="Contra-marco instalado corretamente"
                valor={d.contra_marco_instalado}
                opcoes={[{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }]}
                onChange={(v) => up('contra_marco_instalado', v)}
              />
            )}
            <GrupoRadio
              label="Piso acabado"
              valor={d.piso_acabado}
              opcoes={[{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }]}
              onChange={(v) => up('piso_acabado', v)}
            />
            <GrupoRadio
              label="Vão acabado (paredes/teto)"
              valor={d.vao_acabado}
              opcoes={[{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }]}
              onChange={(v) => up('vao_acabado', v)}
            />
            <GrupoRadio
              label="Nível"
              valor={d.nivel_ok}
              opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Não' }]}
              onChange={(v) => up('nivel_ok', v)}
              obs={d.nivel_obs}
              onChangeObs={(v) => up('nivel_obs', v)}
            />
            <GrupoRadio
              label="Prumo"
              valor={d.prumo_ok}
              opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Não' }]}
              onChange={(v) => up('prumo_ok', v)}
              obs={d.prumo_obs}
              onChangeObs={(v) => up('prumo_obs', v)}
            />
          </Secao>

          <Secao titulo="Especificações finais (pra fabricar a peça)">
            <div className="text-xs text-slate-500 mb-2">
              Captura as especificações da peça que serão fabricadas. Tipologia já decidida no contrato — confirma e detalha.
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Tipologia</span>
              <div className="flex gap-2 flex-wrap">
                {TIPOLOGIAS.map((t) => {
                  const ativo = d.tipologia === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => up('tipologia', t)}
                      className={'px-4 py-2 rounded-md text-sm font-semibold border transition ' + (ativo
                        ? 'bg-laranja text-white border-laranja'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
                    >
                      {ROTULOS_TIPOLOGIA[t]}
                    </button>
                  )
                })}
              </div>
            </div>

            {d.tipologia === 'giro' && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <GrupoRadio
                  label="Abertura"
                  valor={d.giro_abertura}
                  opcoes={[{ v: 'interna', l: 'Interna' }, { v: 'externa', l: 'Externa' }]}
                  onChange={(v) => up('giro_abertura', v)}
                />
                <GrupoRadio
                  label="Fechadura — lado (vista externa)"
                  valor={d.giro_fechadura_lado}
                  opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]}
                  onChange={(v) => up('giro_fechadura_lado', v)}
                />
                <Check label="Puxador" valor={d.giro_puxador} onChange={(v) => up('giro_puxador', v)} />
              </div>
            )}

            {d.tipologia === 'correr' && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <GrupoRadio
                  label="Lado de abertura"
                  valor={d.correr_abertura_lado}
                  opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }, { v: 'ambos', l: 'Ambos' }]}
                  onChange={(v) => up('correr_abertura_lado', v)}
                />
                <GrupoRadio
                  label="Fecho"
                  valor={d.correr_fecho}
                  opcoes={[{ v: 'fechadura', l: 'Fechadura' }, { v: 'cremona', l: 'Cremona' }, { v: 'concha', l: 'Concha' }]}
                  onChange={(v) => up('correr_fecho', v)}
                />
                <Check label="Somente puxador (sem chave)" valor={d.correr_somente_puxador} onChange={(v) => up('correr_somente_puxador', v)} />
                <GrupoRadio
                  label="Tipo de trilho"
                  valor={d.correr_trilho}
                  opcoes={[
                    { v: 'convencional', l: 'Convencional' },
                    { v: 'embutido_u', l: 'Embutido U' },
                    { v: 'embutido_concavo', l: 'Embutido côncavo' },
                    { v: 'na', l: 'N.A.' },
                  ]}
                  onChange={(v) => up('correr_trilho', v)}
                />
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-slate-200">
              <GrupoRadio
                label="Soleira"
                valor={d.soleira}
                opcoes={[{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }]}
                onChange={(v) => up('soleira', v)}
              />
              <Check label="Esquadria motorizada" valor={d.tem_motor} onChange={(v) => up('tem_motor', v)} />
              {d.tem_motor && (
                <div className="grid md:grid-cols-2 gap-3 pl-3 border-l-2 border-laranja-soft">
                  <GrupoRadio label="Motor — lado" valor={d.motor_lado} opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]} onChange={(v) => up('motor_lado', v)} />
                  <GrupoRadio label="Motor — tensão" valor={d.motor_tensao} opcoes={[{ v: '110V', l: '110V' }, { v: '220V', l: '220V' }]} onChange={(v) => up('motor_tensao', v)} />
                </div>
              )}

              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Acabamento</span>
                <div className="flex flex-col gap-2">
                  <Check label="Arremate Interno (guarnição) — padrão" valor={d.arremate_interno} onChange={(v) => up('arremate_interno', v)} />
                  <Check label="Arremate Externo" valor={d.arremate_externo} onChange={(v) => {
                    up('arremate_externo', v)
                    if (!v) up('arremate_externo_tipo', '')
                  }} />
                  {d.arremate_externo && (
                    <div className="pl-6">
                      <GrupoRadio
                        label="Tipo do externo"
                        valor={d.arremate_externo_tipo}
                        opcoes={[{ v: 'cantoneira', l: 'Cantoneira' }, { v: 'meia_cana', l: 'Meia Cana' }]}
                        onChange={(v) => up('arremate_externo_tipo', v)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Secao>

          <Secao titulo="Resultado" destaque>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 mb-2">
              <strong>Decisão final:</strong> liberar pra produção significa que a peça vai entrar na fila de fabricação. Se reprovado, card volta pra empresa redigir orientação ao cliente.
            </div>
            <GrupoRadio
              label="Vão liberado pra produção?"
              valor={d.liberado_producao}
              opcoes={[{ v: 'sim', l: 'SIM, liberado' }, { v: 'nao', l: 'NÃO, reprovado' }]}
              onChange={(v) => up('liberado_producao', v)}
            />

            {d.liberado_producao === 'sim' && (
              <div className="mt-3">
                <Campo label="Medida final pra produção">
                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    <Texto valor={d.medida_largura} onChange={(v) => up('medida_largura', v)} placeholder="Largura (ex: 1200)" />
                    <Texto valor={d.medida_altura} onChange={(v) => up('medida_altura', v)} placeholder="Altura (ex: 1000)" />
                  </div>
                </Campo>
              </div>
            )}

            {d.liberado_producao === 'nao' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                <Campo label="Lista de pendências (orientação pra obra)">
                  <TextoArea valor={d.pendencias} onChange={(v) => up('pendencias', v)} placeholder="Ex: nivelar contra-piso, ajustar requadro. Empresa vai usar essa lista pra orientar o cliente." />
                </Campo>
                <div className="text-[11px] text-red-700 mt-1.5">
                  Vão NÃO está liberado. Card vai voltar pra Empresa redigir orientação ao cliente.
                </div>
              </div>
            )}
          </Secao>
        </div>

        <div className="border-t border-slate-200 px-5 md:px-6 py-3 md:py-4 flex gap-2 justify-end bg-slate-50">
          <button type="button" onClick={onCancelar} className="btn-ghost" disabled={salvando}>Cancelar</button>
          <button type="button" onClick={salvar} className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : (inicial ? 'Atualizar M2' : 'Salvar M2')}
          </button>
        </div>
      </div>
    </div>
  )
}
