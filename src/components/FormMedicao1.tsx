import { useState } from 'react'
import type { DadosMedicao1, Tipologia } from '../types/checklist'
import { VAZIO_MEDICAO1, ROTULOS_TIPOLOGIA } from '../types/checklist'

interface Props {
  inicial?: DadosMedicao1 | null
  onSalvar: (dados: DadosMedicao1) => Promise<void>
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

// ===== Form principal com progressive disclosure =====
//
// Fluxo:
//   1. Cabeçalho + Identificação (sempre)
//   2. Conseguimos executar a tipologia? (sempre)
//      → SIM segue, NÃO encerra com motivo
//   3. Contra-marco? SIM/NÃO
//      → SIM: só medida do contra-marco (form minimal)
//      → NÃO: continua perguntando vão acabado?
//   4. Vão acabado? SIM/NÃO (só quando CM=NÃO)
//      → NÃO: lista de pendências (form minimal)
//      → SIM: tipologia + specs + estrutura completa + medida final

export default function FormMedicao1({ inicial, onSalvar, onCancelar }: Props) {
  const [d, setD] = useState<DadosMedicao1>(inicial ?? VAZIO_MEDICAO1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function up<K extends keyof DadosMedicao1>(k: K, v: DadosMedicao1[K]) {
    setD((s) => ({ ...s, [k]: v }))
  }

  // Estados do progressive disclosure
  const naoExecutavel = d.tipologia_executavel === 'nao'
  const cmDecidido = !!d.contra_marco
  const cmSim = d.contra_marco === 'sim'
  const cmNao = d.contra_marco === 'nao'
  const vaoDecidido = !!d.vao_pronto
  const vaoNao = d.vao_pronto === 'nao'
  const vaoSim = d.vao_pronto === 'sim'

  // Mostrar form completo (tipologia + specs + acabamento + medida final) só se CM=NÃO + vão=SIM
  const mostraFormCompleto = cmNao && vaoSim

  // Regra: meia cana interna só vale se sem contra-marco + montagem no eixo
  const podeMeiaCanaInterna = cmNao && d.instalacao === 'eixo'

  async function salvar() {
    setErro(null)
    if (!d.tipologia_executavel) {
      setErro('Confirme se conseguimos executar a tipologia contratada.')
      return
    }
    if (naoExecutavel) {
      if (!d.tipologia_problema.trim()) {
        setErro('Descreva o problema da tipologia pra empresa avaliar.')
        return
      }
    } else {
      if (!d.contra_marco) {
        setErro('Decida se vai ter contra-marco antes de salvar (essa decisão define o próximo passo da obra).')
        return
      }
      if (cmSim) {
        if (!d.medida_largura.trim() || !d.medida_altura.trim()) {
          setErro('Preencha a medida do vão pra fabricar o contra-marco.')
          return
        }
      } else if (cmNao) {
        if (!d.vao_pronto) {
          setErro('Responda se o vão está acabado.')
          return
        }
        if (vaoNao) {
          if (!d.precisa_correcao.trim()) {
            setErro('Liste o que falta no vão pra ele ficar pronto. Empresa vai usar essa lista pra orientar o cliente.')
            return
          }
        } else if (vaoSim) {
          if (!d.tipologia) {
            setErro('Escolha a tipologia da peça antes de salvar.')
            return
          }
          if (!d.medida_largura.trim() || !d.medida_altura.trim()) {
            setErro('Preencha a medida final (largura e altura) pra fabricação.')
            return
          }
        }
      }
    }

    // Limpa campos não preenchidos baseado no caminho escolhido
    const dadosFinais: DadosMedicao1 = {
      ...d,
      meia_cana_interna: podeMeiaCanaInterna ? d.meia_cana_interna : false,
      precisa_correcao: vaoNao ? d.precisa_correcao : '',
      // Se não chegou no form completo, zera tipologia e specs
      ...(mostraFormCompleto ? {} : {
        tipologia: '' as const,
        giro_macaneta_lado: '' as const,
        giro_chave_posicao: '' as const,
        giro_somente_puxador: false,
        giro_abertura_lado: '' as const,
        giro_abertura_posicao: '' as const,
        correr_abertura_lado: '' as const,
        correr_fecho: '' as const,
        correr_trilho: '' as const,
        soleira: '' as const,
        tem_motor: false,
        motor_lado: '' as const,
        motor_tensao: '' as const,
        instalacao: '' as const,
        arremate_externo: false,
        arremate_externo_tipo: '' as const,
        meia_cana_interna: false,
      }),
      // Se não chegou em vão pronto, zera vao_pronto pra evitar dados stale
      ...(cmSim ? { vao_pronto: '' as const } : {}),
      ...(d.tipologia !== 'giro' ? {
        giro_macaneta_lado: '' as const,
        giro_chave_posicao: '' as const,
        giro_somente_puxador: false,
        giro_abertura_lado: '' as const,
        giro_abertura_posicao: '' as const,
      } : {}),
      ...(d.tipologia !== 'correr' ? {
        correr_abertura_lado: '' as const,
        correr_fecho: '' as const,
        correr_trilho: '' as const,
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
            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold border mb-2 bg-laranja-soft text-laranja-dark border-laranja-border">Medição 1 — Visita técnica</span>
            <div className="text-base md:text-lg font-bold">Triagem da obra</div>
            <div className="text-xs text-slate-500 mt-0.5">Decide se vai ter contra-marco e se o vão tá pronto pra tirar medida final.</div>
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

          <Secao titulo="Identificação do item (do contrato)">
            <div className="bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-md text-sm text-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Descrição (do contrato)</div>
              <div className="font-medium leading-snug whitespace-pre-wrap">{d.descricao || <span className="text-slate-400 italic">Sem descrição</span>}</div>
            </div>
            <Campo label="Observação do técnico"><TextoArea valor={d.observacao} onChange={(v) => up('observacao', v)} placeholder="Observação livre sobre a peça (cor diferente, vidro, peculiaridades vistas em obra)" /></Campo>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <GrupoRadio
                label="Conseguimos executar a tipologia contratada?"
                valor={d.tipologia_executavel}
                opcoes={[{ v: 'sim', l: 'Sim, executável' }, { v: 'nao', l: 'NÃO — reportar empresa' }]}
                onChange={(v) => up('tipologia_executavel', v)}
              />
              {naoExecutavel && (
                <div className="mt-3">
                  <Campo label="O que impede a execução?">
                    <TextoArea valor={d.tipologia_problema} onChange={(v) => up('tipologia_problema', v)} placeholder="Descreva o problema (medida fora, vão impossível, conflito com outra obra, etc). A empresa receberá o card pra decidir." />
                  </Campo>
                </div>
              )}
            </div>
          </Secao>

          {/* SE EXECUTÁVEL: pergunta contra-marco */}
          {!naoExecutavel && d.tipologia_executavel === 'sim' && (
            <Secao titulo="Decisão crítica" destaque>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 mb-2">
                Contra-marco SIM ou NÃO define o próximo passo do fluxo da obra.
              </div>
              <GrupoRadio
                label="Contra-marco?"
                valor={d.contra_marco}
                opcoes={[{ v: 'sim', l: 'SIM' }, { v: 'nao', l: 'NÃO' }]}
                onChange={(v) => up('contra_marco', v)}
              />
            </Secao>
          )}

          {/* SE CM=SIM: só medida do contra-marco */}
          {!naoExecutavel && cmSim && (
            <Secao titulo="Medida do contra-marco">
              <div className="text-xs text-slate-500 mb-2">
                Tira a medida do vão para fabricar o contra-marco. Não precisa preencher tipologia/especificações agora — vai ser feito na Medição 2, depois do contra-marco instalado.
              </div>
              <div className="grid md:grid-cols-2 gap-3 max-w-md">
                <Campo label="Largura"><Texto valor={d.medida_largura} onChange={(v) => up('medida_largura', v)} placeholder="Ex: 1200" /></Campo>
                <Campo label="Altura"><Texto valor={d.medida_altura} onChange={(v) => up('medida_altura', v)} placeholder="Ex: 1000" /></Campo>
              </div>
            </Secao>
          )}

          {/* SE CM=NÃO: pergunta vão pronto */}
          {!naoExecutavel && cmNao && (
            <Secao titulo="Estado do vão (triagem)">
              <div className="text-xs text-slate-500 mb-2">
                Sem contra-marco, precisa avaliar se o vão tá pronto pra tirar medida final.
              </div>
              <GrupoRadio
                label="Vão está acabado?"
                valor={d.vao_pronto}
                opcoes={[{ v: 'sim', l: 'Sim, pronto' }, { v: 'nao', l: 'Não, falta acabar' }]}
                onChange={(v) => up('vao_pronto', v)}
              />
              {vaoNao && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                  <Campo label="Lista de pendências (orientação pra obra)">
                    <TextoArea valor={d.precisa_correcao} onChange={(v) => up('precisa_correcao', v)} placeholder="Ex: nivelar contra-piso, instalar soleira, requadrar vão, deixar ponto de energia. Empresa vai usar essa lista pra orientar o cliente." />
                  </Campo>
                  <div className="text-[11px] text-red-700 mt-1.5">
                    Vão NÃO está pronto. Card vai pra Empresa redigir orientação ao cliente.
                  </div>
                </div>
              )}
            </Secao>
          )}

          {/* SE CM=NÃO + vão=SIM: form completo (tipologia + specs + acabamento + medida final) */}
          {mostraFormCompleto && (
            <>
              <Secao titulo="Tipologia">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Selecione</span>
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
              </Secao>

              {d.tipologia === 'giro' && (
                <Secao titulo="Especificações da Porta de Giro">
                  <div className="grid md:grid-cols-2 gap-3">
                    <GrupoRadio label="Maçaneta — lado" valor={d.giro_macaneta_lado} opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]} onChange={(v) => up('giro_macaneta_lado', v)} />
                    <GrupoRadio label="Chave — posição" valor={d.giro_chave_posicao} opcoes={[{ v: 'interna', l: 'Interna' }, { v: 'externa', l: 'Externa' }]} onChange={(v) => up('giro_chave_posicao', v)} />
                  </div>
                  <Check label="Somente puxador (sem chave)" valor={d.giro_somente_puxador} onChange={(v) => up('giro_somente_puxador', v)} />
                  <div className="grid md:grid-cols-2 gap-3">
                    <GrupoRadio label="Abertura — lado" valor={d.giro_abertura_lado} opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]} onChange={(v) => up('giro_abertura_lado', v)} />
                    <GrupoRadio label="Abertura — posição" valor={d.giro_abertura_posicao} opcoes={[{ v: 'interna', l: 'Interna' }, { v: 'externa', l: 'Externa' }]} onChange={(v) => up('giro_abertura_posicao', v)} />
                  </div>
                </Secao>
              )}

              {d.tipologia === 'correr' && (
                <Secao titulo="Especificações do Item de Correr">
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
                </Secao>
              )}

              {d.tipologia === 'maxim_ar' && (
                <Secao titulo="Maxim-ar / Basculante">
                  <div className="text-xs text-slate-500">
                    Sem campos específicos por enquanto — use o campo "Observação" da identificação pra detalhes.
                  </div>
                </Secao>
              )}

              <Secao titulo="Estrutura e acabamento">
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

                <GrupoRadio
                  label="Instalação — orientação do trilho"
                  valor={d.instalacao}
                  opcoes={[{ v: 'face_interna', l: 'Face Interna' }, { v: 'face_externa', l: 'Face Externa' }, { v: 'eixo', l: 'Eixo' }]}
                  onChange={(v) => up('instalacao', v)}
                />

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
                    {podeMeiaCanaInterna && (
                      <Check label="Meia Cana Interna (só vale sem contra-marco + eixo)" valor={d.meia_cana_interna} onChange={(v) => up('meia_cana_interna', v)} />
                    )}
                  </div>
                </div>
              </Secao>

              <Secao titulo="Medida final pra fabricação">
                <div className="grid md:grid-cols-2 gap-3 max-w-md">
                  <Campo label="Largura"><Texto valor={d.medida_largura} onChange={(v) => up('medida_largura', v)} placeholder="Ex: 1200" /></Campo>
                  <Campo label="Altura"><Texto valor={d.medida_altura} onChange={(v) => up('medida_altura', v)} placeholder="Ex: 1000" /></Campo>
                </div>
              </Secao>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 md:px-6 py-3 md:py-4 flex gap-2 justify-end bg-slate-50">
          <button type="button" onClick={onCancelar} className="btn-ghost" disabled={salvando}>Cancelar</button>
          <button type="button" onClick={salvar} className={naoExecutavel ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'} disabled={salvando}>
            {salvando
              ? 'Salvando...'
              : naoExecutavel
                ? 'Reportar problema à empresa'
                : (inicial ? 'Atualizar checklist' : 'Salvar checklist')}
          </button>
        </div>
      </div>
    </div>
  )
}
