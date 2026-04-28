import { useState } from 'react'
import type { DadosMedicao1, Tipologia } from '../types/checklist'
import { VAZIO_MEDICAO1, ROTULOS_TIPOLOGIA } from '../types/checklist'

interface Props {
  inicial?: DadosMedicao1 | null
  onSalvar: (dados: DadosMedicao1) => Promise<void>
  onCancelar: () => void
}

// Componentes auxiliares de UI

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
  return (
    <input type={type} className="input text-sm" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
  )
}

function TextoArea({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea className="input text-sm min-h-[60px]" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
  )
}

const TIPOLOGIAS: Exclude<Tipologia, ''>[] = ['fixo', 'correr', 'giro', 'maxim_ar']

// Formulário principal

export default function FormMedicao1({ inicial, onSalvar, onCancelar }: Props) {
  const [d, setD] = useState<DadosMedicao1>(inicial ?? VAZIO_MEDICAO1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function up<K extends keyof DadosMedicao1>(k: K, v: DadosMedicao1[K]) {
    setD((s) => ({ ...s, [k]: v }))
  }

  // Regra: meia cana interna só vale se sem contra-marco + montagem no eixo
  const podeMeiaCanaInterna = d.contra_marco === 'nao' && d.instalacao === 'eixo'
  // Mantém estado coerente — se a regra mudou e a flag tava ligada, desliga
  if (d.meia_cana_interna && !podeMeiaCanaInterna) {
    // Não disparo setState dentro do render — só ignoro no salvamento (a regra é aplicada lá também)
  }

  async function salvar() {
    setErro(null)
    if (!d.tipologia) {
      setErro('Escolha a tipologia da peça antes de salvar.')
      return
    }
    if (!d.tipologia_executavel) {
      setErro('Confirme se conseguimos executar a tipologia contratada.')
      return
    }
    if (d.tipologia_executavel === 'nao' && !d.tipologia_problema.trim()) {
      setErro('Descreva o problema da tipologia pra empresa avaliar.')
      return
    }
    if (d.tipologia_executavel === 'sim' && !d.contra_marco) {
      setErro('Decida se vai ter contra-marco antes de salvar (essa decisão define o próximo passo da obra).')
      return
    }
    // Aplica a regra de meia cana interna antes de salvar
    const dadosFinais: DadosMedicao1 = {
      ...d,
      meia_cana_interna: podeMeiaCanaInterna ? d.meia_cana_interna : false,
      // Limpa campos da tipologia não escolhida
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

  const labelMedida = d.contra_marco === 'sim'
    ? 'Medida do contra-marco'
    : d.contra_marco === 'nao'
      ? 'Medida para fabricação (vão pronto)'
      : 'Medidas'

  const naoExecutavel = d.tipologia_executavel === 'nao'

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm grid place-items-end md:place-items-center p-0 md:p-5 z-50" onClick={onCancelar}>
      <div className="bg-white border border-slate-200 rounded-t-2xl md:rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 md:px-6 py-4 md:py-5 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold border mb-2 bg-laranja-soft text-laranja-dark border-laranja-border">Medição 1 — Visita técnica</span>
            <div className="text-base md:text-lg font-bold">Preencher checklist</div>
            <div className="text-xs text-slate-500 mt-0.5">Esta medição define se vai ter contra-marco e as primeiras especificações da peça.</div>
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
            <Campo label="Descrição"><Texto valor={d.descricao} onChange={(v) => up('descricao', v)} placeholder="O que foi confirmado pelo cliente" /></Campo>
            <div className="grid md:grid-cols-3 gap-3">
              <Campo label="Linha (perfil)"><Texto valor={d.linha} onChange={(v) => up('linha', v)} placeholder="Ex: Suprema" /></Campo>
              <Campo label="Cor"><Texto valor={d.cor} onChange={(v) => up('cor', v)} placeholder="Ex: RAL9005F" /></Campo>
              <Campo label="Vidro"><Texto valor={d.vidro} onChange={(v) => up('vidro', v)} placeholder="Ex: Temperado 6mm" /></Campo>
            </div>
            <Campo label="Observação"><TextoArea valor={d.observacao} onChange={(v) => up('observacao', v)} placeholder="Observação livre sobre o item" /></Campo>

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

          {!naoExecutavel && (
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
                    Sem campos específicos por enquanto — use o campo "Observação" da identificação pra detalhes (lado de abertura, motor, etc). Conforme você usar, a gente especializa.
                  </div>
                </Secao>
              )}

              <Secao titulo="Estrutura e instalação" destaque>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 mb-2">
                  <strong>Decisão crítica:</strong> contra-marco SIM ou NÃO define o próximo passo do fluxo da obra.
                </div>

                <GrupoRadio
                  label="Contra-marco"
                  valor={d.contra_marco}
                  opcoes={[{ v: 'sim', l: 'SIM' }, { v: 'nao', l: 'NÃO' }]}
                  onChange={(v) => up('contra_marco', v)}
                />

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

                {d.contra_marco === 'sim' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-600">
                    <strong>Instalação:</strong> com contra-marco, alinhamento é interno (regra fixa).
                  </div>
                ) : d.contra_marco === 'nao' ? (
                  <GrupoRadio
                    label="Instalação — orientação do trilho"
                    valor={d.instalacao}
                    opcoes={[{ v: 'face_interna', l: 'Face Interna' }, { v: 'face_externa', l: 'Face Externa' }, { v: 'eixo', l: 'Eixo' }]}
                    onChange={(v) => up('instalacao', v)}
                  />
                ) : null}

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

              <Secao titulo="Diagnóstico do vão">
                <GrupoRadio
                  label="Chão"
                  valor={d.vao_chao_ok}
                  opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Não' }]}
                  onChange={(v) => up('vao_chao_ok', v)}
                  obs={d.vao_chao_obs}
                  onChangeObs={(v) => up('vao_chao_obs', v)}
                />
                <GrupoRadio
                  label="Esquadro"
                  valor={d.vao_esquadro_ok}
                  opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Não' }]}
                  onChange={(v) => up('vao_esquadro_ok', v)}
                  obs={d.vao_esquadro_obs}
                  onChangeObs={(v) => up('vao_esquadro_obs', v)}
                />
                <GrupoRadio
                  label="Nível"
                  valor={d.vao_nivel_ok}
                  opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Não' }]}
                  onChange={(v) => up('vao_nivel_ok', v)}
                  obs={d.vao_nivel_obs}
                  onChangeObs={(v) => up('vao_nivel_obs', v)}
                />
                <Campo label="Precisa correção? (descrever)">
                  <TextoArea valor={d.precisa_correcao} onChange={(v) => up('precisa_correcao', v)} placeholder="O que cliente precisa corrigir antes da medição final" />
                </Campo>
              </Secao>

              <Secao titulo={labelMedida}>
                <div className="text-xs text-slate-500 mb-2">
                  {d.contra_marco === 'sim'
                    ? 'Tira a medida do vão para fabricar o contra-marco. A medida final pra fabricação da peça vem depois, na Medição 2.'
                    : d.contra_marco === 'nao'
                      ? 'Tira a medida final pra fabricação. Só faz sentido se o vão já estiver pronto (chão, nível, prumo). Caso contrário, deixa em branco e termina na Medição 2.'
                      : 'Define se vai ter contra-marco para o sistema saber qual medida pedir.'}
                </div>
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
