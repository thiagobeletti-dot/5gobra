import { useState } from 'react'
import type { DadosMedicao1 } from '../types/checklist'
import { VAZIO_MEDICAO1 } from '../types/checklist'

interface Props {
  inicial?: DadosMedicao1 | null
  onSalvar: (dados: DadosMedicao1) => Promise<void>
  onCancelar: () => void
}

// Componentes auxiliares de UI

function Secao({ titulo, children, aberta = true }: { titulo: string; children: any; aberta?: boolean }) {
  return (
    <details open={aberta} className="border border-slate-200 rounded-lg overflow-hidden">
      <summary className="bg-slate-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-100">
        {titulo}
      </summary>
      <div className="p-4 space-y-3">
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
  const ehNao = valor === 'nao'
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
          placeholder="O que esta errado?"
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

// Formulario principal

export default function FormMedicao1({ inicial, onSalvar, onCancelar }: Props) {
  const [d, setD] = useState<DadosMedicao1>(inicial ?? VAZIO_MEDICAO1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function up<K extends keyof DadosMedicao1>(k: K, v: DadosMedicao1[K]) {
    setD((s) => ({ ...s, [k]: v }))
  }

  async function salvar() {
    setErro(null)
    if (!d.contra_marco) {
      setErro('Decida se vai ter contra-marco antes de salvar (essa decisao define o proximo passo da obra).')
      return
    }
    setSalvando(true)
    try {
      await onSalvar(d)
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
            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold border mb-2 bg-laranja-soft text-laranja-dark border-laranja-border">Medicao 1 - Visita tecnica</span>
            <div className="text-base md:text-lg font-bold">Preencher checklist</div>
            <div className="text-xs text-slate-500 mt-0.5">Esta medicao define se vai ter contra-marco e as primeiras especificacoes.</div>
          </div>
          <button onClick={onCancelar} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition">x</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 md:py-5 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg text-sm text-red-700">{erro}</div>
          )}

          <Secao titulo="Cabecalho">
            <div className="grid md:grid-cols-2 gap-3">
              <Campo label="Numero do orcamento"><Texto valor={d.numero_orcamento} onChange={(v) => up('numero_orcamento', v)} placeholder="Ex: 2026-0451" /></Campo>
              <Campo label="Data"><Texto valor={d.data} onChange={(v) => up('data', v)} type="date" /></Campo>
              <Campo label="Tecnico (quem mediu)"><Texto valor={d.tecnico} onChange={(v) => up('tecnico', v)} placeholder="Nome do tecnico" /></Campo>
              <Campo label="Responsavel da obra (cliente)"><Texto valor={d.responsavel_obra} onChange={(v) => up('responsavel_obra', v)} placeholder="Quem recebeu na obra" /></Campo>
            </div>
          </Secao>

          <Secao titulo="Identificacao do item">
            <div className="grid md:grid-cols-2 gap-3">
              <Campo label="Descricao"><Texto valor={d.descricao} onChange={(v) => up('descricao', v)} placeholder="Janela 2 folhas, etc." /></Campo>
              <Campo label="Linha (perfil)"><Texto valor={d.linha} onChange={(v) => up('linha', v)} placeholder="Ex: Suprema" /></Campo>
              <Campo label="Cor"><Texto valor={d.cor} onChange={(v) => up('cor', v)} placeholder="Ex: RAL9005F" /></Campo>
              <Campo label="Vidro"><Texto valor={d.vidro} onChange={(v) => up('vidro', v)} placeholder="Ex: Temperado 6mm" /></Campo>
            </div>
            <Campo label="Observacao"><TextoArea valor={d.observacao} onChange={(v) => up('observacao', v)} placeholder="Observacao livre sobre o item" /></Campo>
          </Secao>

          <Secao titulo="Especificacoes da peca">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 mb-2">
              <strong>Decisao critica:</strong> contra-marco SIM ou NAO define o proximo passo do fluxo da obra.
            </div>

            <GrupoRadio
              label="Contra-marco"
              valor={d.contra_marco}
              opcoes={[{ v: 'sim', l: 'SIM' }, { v: 'nao', l: 'NAO' }]}
              onChange={(v) => up('contra_marco', v)}
            />

            <GrupoRadio
              label="Soleira"
              valor={d.soleira}
              opcoes={[{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Nao' }]}
              onChange={(v) => up('soleira', v)}
            />

            <Check label="Esquadria motorizada" valor={d.tem_motor} onChange={(v) => up('tem_motor', v)} />
            {d.tem_motor && (
              <div className="grid md:grid-cols-2 gap-3 pl-3 border-l-2 border-laranja-soft">
                <GrupoRadio label="Motor - lado" valor={d.motor_lado} opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]} onChange={(v) => up('motor_lado', v)} />
                <GrupoRadio label="Motor - tensao" valor={d.motor_tensao} opcoes={[{ v: '110V', l: '110V' }, { v: '220V', l: '220V' }]} onChange={(v) => up('motor_tensao', v)} />
              </div>
            )}

            <GrupoRadio
              label="Instalacao - orientacao do trilho"
              valor={d.instalacao}
              opcoes={[{ v: 'face_interna', l: 'Face Interna' }, { v: 'face_externa', l: 'Face Externa' }, { v: 'eixo', l: 'Eixo' }]}
              onChange={(v) => up('instalacao', v)}
            />

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Acabamento</span>
              <div className="flex gap-2 flex-wrap">
                <Check label="Arremate Interno" valor={d.arremate_interno} onChange={(v) => up('arremate_interno', v)} />
                <Check label="Arremate Externo" valor={d.arremate_externo} onChange={(v) => up('arremate_externo', v)} />
                <Check label="Meia Cana" valor={d.meia_cana} onChange={(v) => up('meia_cana', v)} />
                <Check label="Meia Cana Interna" valor={d.meia_cana_interna} onChange={(v) => up('meia_cana_interna', v)} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <GrupoRadio label="Macaneta - lado" valor={d.maçaneta_lado} opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]} onChange={(v) => up('maçaneta_lado', v)} />
              <GrupoRadio label="Macaneta - posicao" valor={d.maçaneta_posicao} opcoes={[{ v: 'externa', l: 'Externa' }, { v: 'interna_externa', l: 'Interna-Externa' }]} onChange={(v) => up('maçaneta_posicao', v)} />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <GrupoRadio label="Chave - posicao" valor={d.chave_posicao} opcoes={[{ v: 'interna', l: 'Interna' }, { v: 'externa', l: 'Externa' }]} onChange={(v) => up('chave_posicao', v)} />
              <div className="flex items-end pb-1">
                <Check label="Somente puxador (sem chave)" valor={d.chave_somente_puxador} onChange={(v) => up('chave_somente_puxador', v)} />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <GrupoRadio label="Abertura - lado" valor={d.abertura_lado} opcoes={[{ v: 'esquerda', l: 'Esquerda' }, { v: 'direita', l: 'Direita' }]} onChange={(v) => up('abertura_lado', v)} />
              <GrupoRadio label="Abertura - posicao" valor={d.abertura_posicao} opcoes={[{ v: 'interna', l: 'Interna' }, { v: 'externa', l: 'Externa' }]} onChange={(v) => up('abertura_posicao', v)} />
              <GrupoRadio label="Abertura - tipo" valor={d.abertura_tipo} opcoes={[
                { v: 'convencional', l: 'Convencional' },
                { v: 'embutido_u', l: 'Embutido U' },
                { v: 'embutido_concavo', l: 'Embutido concavo' },
                { v: 'na', l: 'N.A.' },
              ]} onChange={(v) => up('abertura_tipo', v)} />
            </div>
          </Secao>

          <Secao titulo="Diagnostico do vao">
            <GrupoRadio
              label="Trilho"
              valor={d.vao_trilho_ok}
              opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Nao' }]}
              onChange={(v) => up('vao_trilho_ok', v)}
              obs={d.vao_trilho_obs}
              onChangeObs={(v) => up('vao_trilho_obs', v)}
            />
            <GrupoRadio
              label="Esquadro"
              valor={d.vao_esquadro_ok}
              opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Nao' }]}
              onChange={(v) => up('vao_esquadro_ok', v)}
              obs={d.vao_esquadro_obs}
              onChangeObs={(v) => up('vao_esquadro_obs', v)}
            />
            <GrupoRadio
              label="Nivel"
              valor={d.vao_nivel_ok}
              opcoes={[{ v: 'sim', l: 'OK' }, { v: 'nao', l: 'Nao' }]}
              onChange={(v) => up('vao_nivel_ok', v)}
              obs={d.vao_nivel_obs}
              onChangeObs={(v) => up('vao_nivel_obs', v)}
            />
            <Campo label="Precisa correcao? (descrever)">
              <TextoArea valor={d.precisa_correcao} onChange={(v) => up('precisa_correcao', v)} placeholder="O que cliente precisa corrigir antes da medicao fina" />
            </Campo>
          </Secao>

          <Secao titulo="Medidas">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Contra-marco</span>
                <div className="flex gap-2">
                  <Texto valor={d.contra_marco_largura} onChange={(v) => up('contra_marco_largura', v)} placeholder="Largura" />
                  <Texto valor={d.contra_marco_altura} onChange={(v) => up('contra_marco_altura', v)} placeholder="Altura" />
                </div>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Producao</span>
                <div className="flex gap-2">
                  <Texto valor={d.producao_largura} onChange={(v) => up('producao_largura', v)} placeholder="Largura" />
                  <Texto valor={d.producao_altura} onChange={(v) => up('producao_altura', v)} placeholder="Altura" />
                </div>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Medida final</span>
                <div className="flex gap-2">
                  <Texto valor={d.medida_final_largura} onChange={(v) => up('medida_final_largura', v)} placeholder="Largura" />
                  <Texto valor={d.medida_final_altura} onChange={(v) => up('medida_final_altura', v)} placeholder="Altura" />
                </div>
              </div>
            </div>
          </Secao>
        </div>

        <div className="border-t border-slate-200 px-5 md:px-6 py-3 md:py-4 flex gap-2 justify-end bg-slate-50">
          <button type="button" onClick={onCancelar} className="btn-ghost" disabled={salvando}>Cancelar</button>
          <button type="button" onClick={salvar} className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : (inicial ? 'Atualizar checklist' : 'Salvar checklist')}
          </button>
        </div>
      </div>
    </div>
  )
}
