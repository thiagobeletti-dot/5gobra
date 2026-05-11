import { useEffect, useMemo, useReducer, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { ABAS, STATUS_EM_ANDAMENTO } from '../types/obra'
import type { AbaId, Card, Perfil, TipoCard } from '../types/obra'
import { diasAte, formataData, formataDataHora, statusSemantico } from '../lib/helpers'
import { useObraData } from '../hooks/useObraData'
import { sair, useAuth } from '../lib/auth'
import ImportarItens from '../components/ImportarItens'
import GaleriaFotos from '../components/GaleriaFotos'
import FormMedicao1 from '../components/FormMedicao1'
import FormMedicao2 from '../components/FormMedicao2'
import GerenciarTecnicos from '../components/GerenciarTecnicos'
import type { DadosMedicao1, DadosMedicao2 } from '../types/checklist'
import { resumoMedicao1, resumoMedicao2, VAZIO_MEDICAO1, VAZIO_MEDICAO2, ROTULOS_TIPOLOGIA } from '../types/checklist'
import TourObra from '../components/TourObra'
import ModalDocumentos from '../components/ModalDocumentos'
import { useConfirm } from '../hooks/useConfirm'
import { useEscClose } from '../hooks/useEscClose'
import { useOnboarding } from '../hooks/useOnboarding'
import { pegarMinhaEmpresa } from '../lib/api'

// Modal "global" da página — tipo discriminado pra evitar 4 booleans separados.
// Cards, FormM1 e FormM2 mantêm seus state separados pq podem co-existir
// (ex: card aberto + M1 aberto sobre ele). Audit Sprint C item D1.
type ModalGlobal = 'nenhum' | 'novo' | 'importar' | 'tecnicos' | 'documentos'

export default function Obra() {
  const { obraId = 'demo' } = useParams<{ obraId: string }>()
  const navigate = useNavigate()
  const { habilitado, user } = useAuth()
  const data = useObraData(obraId)

  const [searchParams, setSearchParams] = useSearchParams()
  const [tourObraAtivo, setTourObraAtivo] = useState(false)
  const { status: onboarding, marcar: marcarOnb } = useOnboarding()
  // Hardcoded 'empresa': o toggle "Visão Cliente" foi removido em 10/05/2026
  // (preservar integridade do histórico). State mantido pra continuar passando
  // perfil pras funções de useObraData (registrar/reabrir/criarNovo) que aceitam
  // 'empresa' | 'cliente' como arg. Branches `perfil === 'cliente'` foram limpos em 11/05.
  const [perfil] = useState<Perfil>('empresa')
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('cliente')
  const [cardAbertoId, setCardAbertoId] = useState<string | null>(null)
  const [formM1Aberto, setFormM1Aberto] = useState<string | null>(null)
  const [formM2Aberto, setFormM2Aberto] = useState<string | null>(null)
  // Modal "global" da página — só 1 desses 4 fica aberto por vez. useReducer
  // consolida 4 booleans em 1 state, evitando bugs de "2 modais abertos juntos".
  // Audit Sprint C item D1.
  const [modalGlobal, setModalGlobal] = useReducer(
    (_estado: ModalGlobal, novo: ModalGlobal) => novo,
    'nenhum' as ModalGlobal,
  )
  const novoAberto = modalGlobal === 'novo'
  const importarAberto = modalGlobal === 'importar'
  const tecnicosAberto = modalGlobal === 'tecnicos'
  const documentosAberto = modalGlobal === 'documentos'
  const [empresaInfo, setEmpresaInfo] = useState<{ nome: string; cnpj?: string | null } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const { confirmar, dialog: confirmDialog } = useConfirm()

  // Tour 2 — busca onboarding status do banco e decide se dispara o tour.
  // IMPORTANTE: estes hooks tem que ficar ANTES dos early returns abaixo,
  // senao quebra as Regras dos Hooks do React (hooks chamados em ordem
  // diferente entre renders -> tela branca).
  // useOnboarding ja carrega o status sozinho. Aqui só carregamos a empresa.
  useEffect(() => {
    if (data.modo !== 'banco') return
    pegarMinhaEmpresa().then((e) => {
      if (e) setEmpresaInfo({ nome: e.nome, cnpj: (e as { cnpj?: string }).cnpj })
    }).catch((e) => console.warn('[Obra] pegarMinhaEmpresa falhou:', e))
  }, [data.modo])

  // Quando temos o onboarding, decidimos se o tour dispara:
  //   - Se ?tour=1 esta na URL (vindo do redirect apos criar obra OU do botao Refazer tour da pagina /ajuda) → dispara
  //   - Se nunca viu o tour da obra (tour_obra_visto=false) → dispara automatico tambem
  //
  // EXCETO em mobile (<768px): react-joyride pode crashar em viewports pequenos
  // e os elementos com data-tour-aba ficam apertados na barra de abas com
  // overflow-x. Em mobile o tour eh inutil (sidebar nao existe) entao bloqueamos.
  useEffect(() => {
    if (data.carregando || data.modo !== 'banco' || tourObraAtivo) return
    if (!onboarding) return
    const ehMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (ehMobile) return
    const force = searchParams.get('tour') === '1'
    const naoViu = !onboarding.tour_obra_visto
    if (force || naoViu) {
      setTourObraAtivo(true)
      if (force) {
        searchParams.delete('tour')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [data.carregando, data.modo, searchParams, onboarding, setSearchParams, tourObraAtivo])

  async function tourObraTerminado(_dispensado: boolean) {
    setTourObraAtivo(false)
    // marcarOnb ja faz update otimista do state local + persiste no banco.
    // Sem o update otimista, haveria janela onde tourObraAtivo=false e
    // onboarding.tour_obra_visto ainda eh false → useEffect reativa o tour.
    await marcarOnb('tour_obra_visto')
  }

  function toast(msg: string) {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 4000)
  }

  async function logout() {
    await sair()
    navigate('/')
  }

  // CRITICAL: hooks (useMemo, useCallback, useEffect, useState) precisam ser chamados
  // SEMPRE na mesma ordem em todo render, antes de qualquer early return. Caso contrario
  // o React quebra com erro #310 ("Rendered more hooks than during the previous render").
  // Use optional chaining + fallbacks pra lidar com data.dados=null durante carregamento.
  const cardAberto = useMemo(
    () => data.dados?.cards.find((c) => c.id === cardAbertoId) ?? null,
    [data.dados, cardAbertoId]
  )
  const cardsDaAba = useMemo(
    () => (data.dados?.cards ?? []).filter((c) => c.aba === abaAtiva),
    [data.dados, abaAtiva],
  )
  const contagensPorAba = useMemo(() => {
    const m = new Map<AbaId, number>()
    for (const c of data.dados?.cards ?? []) m.set(c.aba, (m.get(c.aba) ?? 0) + 1)
    return m
  }, [data.dados])
  const contagem = (a: AbaId) => contagensPorAba.get(a) ?? 0

  if (data.carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando obra...</div>
  }
  if (data.erro || !data.dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600 px-6 text-center">
        <p>Não foi possível carregar essa obra.</p>
        <p className="text-sm text-slate-400">{data.erro ?? 'Obra inexistente'}</p>
        <Link to="/app/obras" className="btn-primary">Voltar pras obras</Link>
      </div>
    )
  }

  const dados = data.dados

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] min-h-screen">
      {/* Wrapper invisivel — tira o TourObra do flow do grid (Joyride usa position fixed internamente) */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <TourObra ativo={tourObraAtivo} onTerminado={tourObraTerminado} />
      </div>
      <aside className="hidden md:flex flex-col gap-1 bg-white border-r border-slate-200 p-3">
        <div className="px-2.5 pb-4 mb-3 border-b border-slate-200">
          <Link to={data.modo === 'banco' && habilitado ? '/app/obras' : '/'}><LogoFull /></Link>
        </div>
        <SidebarSec titulo="Obra" />
        <NavItem ativo>Painel da obra</NavItem>
        <NavItem
          onClick={() => setModalGlobal('documentos')}
          title="Exportar PDFs: Ficha de Medição (M1+M2 das peças) ou Dossiê (timeline de eventos)."
        >
          Documentos
        </NavItem>
        <NavItem emBreve title="Linha do tempo da obra: prazos, milestones, status. Em breve.">Cronograma</NavItem>
        <div className="h-px bg-slate-200 my-2 mx-1" />
        <SidebarSec titulo="Sistema" />
        {data.modo === 'banco' && habilitado ? (
          <Link to="/app/obras" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <span className="w-4 inline-flex items-center justify-center">@</span>
            Minhas obras
          </Link>
        ) : (
          <NavItem>Perfil</NavItem>
        )}
        {data.modo === 'banco' && habilitado && (
          <Link to="/app/ajuda" state={{ fromObra: obraId, fromObraNome: dados.obra.nome }} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <span className="w-4 inline-flex items-center justify-center">?</span>
            Ajuda
          </Link>
        )}
        {data.modo === 'banco' && habilitado && (
          <Link to="/app/configuracoes" state={{ fromObra: obraId, fromObraNome: dados.obra.nome }} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <span className="w-4 inline-flex items-center justify-center">⚙</span>
            Configurações
          </Link>
        )}
        {data.modo === 'demo' && (
          <NavItem onClick={async () => {
            const ok = await confirmar({
              titulo: 'Reiniciar a demo?',
              descricao: 'Tudo que você adicionou no protótipo vai voltar aos dados de exemplo. Essa ação não afeta dados reais.',
              labelConfirmar: 'Reiniciar',
            })
            if (ok === null) return
            data.resetar()
            toast('Demo reiniciada')
          }}>Reiniciar demo</NavItem>
        )}
        <div className="mt-auto pt-4 border-t border-slate-200">
          {data.modo === 'banco' && habilitado && user ? (
            <button onClick={logout} className="block w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-slate-900">Sair ({user.email})</button>
          ) : (
            <Link to="/" className="block px-3 py-2 text-xs text-slate-500 hover:text-slate-900">Voltar</Link>
          )}
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5 flex items-center gap-3 md:gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 font-bold text-[15px]">
              {dados.obra.nome}
              {data.modo === 'demo' && (
                <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Demo</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {dados.obra.endereco}
              {dados.obra.cliente && <> | Cliente: {dados.obra.cliente}</>}
              {dados.obra.empresa && <> | Empresa: {dados.obra.empresa}</>}
            </div>
          </div>
          {/* Toggle "Visão Cliente" REMOVIDO em 10/05/2026 por decisão de produto.
              Permitia que a empresa registrasse mensagens, desse aceite final e
              reabrisse cards atuando como cliente — comprometia a integridade do
              histórico (prova oficial). Pra ver o que o cliente vê, abrir o link
              do cliente em outra aba. State `perfil` ficou hardcoded 'empresa'. */}
        </div>

        {/* Faixa de ações: fica acima das abas pra não competir com a descrição
            da aba (que é texto longo em mobile). Some na aba "Conclusão" porque
            registrar/importar não fazem sentido lá. */}
        {abaAtiva !== 'conclusao' && (
          <div className="bg-white border-b border-slate-200 px-4 md:px-7 py-2.5 flex items-center justify-end gap-2 flex-wrap">
            {data.modo === 'banco' && data.obraReal && (
              <button className="btn-ghost text-xs px-3.5 py-2" onClick={() => setModalGlobal('tecnicos')}>Técnicos</button>
            )}
            {data.modo === 'banco' && (
              <button className="btn-ghost text-xs px-3.5 py-2" onClick={() => setModalGlobal('importar')}>+ Importar lista</button>
            )}
            <button data-tour="adicionar-item" className="btn-primary text-xs px-3.5 py-2" onClick={() => setModalGlobal('novo')}>+ Registrar</button>
          </div>
        )}

        <div className="bg-white border-b border-slate-200 px-4 md:px-7 flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <button
              key={a.id}
              data-tour-aba={a.id}
              onClick={() => setAbaAtiva(a.id)}
              className={'py-3.5 px-4 text-xs md:text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap inline-flex items-center gap-2 transition ' + (abaAtiva === a.id ? 'text-laranja border-laranja' : 'text-slate-500 border-transparent hover:text-slate-900')}
            >
              {a.rotulo}
              <span className={'px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center ' + (abaAtiva === a.id ? 'bg-laranja-soft text-laranja-dark' : 'bg-slate-100 text-slate-500')}>
                {contagem(a.id)}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5 text-xs text-slate-500">
          {ABAS.find((a) => a.id === abaAtiva)?.descricao}
        </div>

        <div className="flex-1">
          {cardsDaAba.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              {dados.cards.length === 0 ? 'Nenhum item cadastrado ainda. Clique em "+ Registrar" pra criar o primeiro, ou "+ Importar lista" pra carregar via Alumisoft.' : 'Nada nesta aba no momento.'}
            </div>
          ) : (
            <div className="grid gap-3.5 p-7" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {cardsDaAba.map((c) => (
                <CardView key={c.id} card={c} perfil={perfil} onClick={() => setCardAbertoId(c.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-400 text-center py-4 border-t border-slate-200 bg-white">
          {data.modo === 'demo'
            ? 'Modo demo - dados salvos localmente no navegador.'
            : 'Conectado ao banco. Dados sincronizados em tempo real.'}
        </div>
      </main>

      {cardAberto && (
        <ModalCard
          card={cardAberto}
          perfil={perfil}
          podeFotos={data.modo === 'banco'}
          onClose={() => setCardAbertoId(null)}
          onAlterarStatus={async (s) => {
            await data.alterarStatus(cardAberto.id, s)
            if (s === 'Concluido' || s === 'Concluído') toast('Item concluído - aguardando aceite do cliente')
            else toast('Status atualizado')
          }}
          onRegistrar={async (t, mover) => {
            if (!t.trim()) { toast('Escreva algo antes de registrar'); return }
            await data.registrar(cardAberto.id, t, perfil, mover)
            setCardAbertoId(null)
            toast('Registro salvo')
          }}
          onAceitar={async () => {
            await data.darAceite(cardAberto.id)
            toast('Aceite confirmado - garantia iniciada')
          }}
          onReabrir={async (t) => {
            if (!t.trim()) { toast('Descreva o problema antes de reabrir'); return }
            await data.reabrir(cardAberto.id, t, perfil)
            setCardAbertoId(null)
            toast('Card reaberto para a empresa')
          }}
          onAdicionarFotos={async (arquivos) => {
            const n = await data.adicionarFotos(cardAberto.id, arquivos)
            toast(n + (n === 1 ? ' foto adicionada' : ' fotos adicionadas'))
          }}
          onRemoverFoto={async (fotoId) => {
            await data.removerFoto(cardAberto.id, fotoId)
            toast('Foto removida')
          }}
          podeChecklist={data.modo === 'banco'}
          onAbrirMedicao1={() => setFormM1Aberto(cardAberto.id)}
          onAbrirMedicao2={() => setFormM2Aberto(cardAberto.id)}
          onMarcarContraMarcoEntregue={async () => {
            const ok = await confirmar({
              titulo: 'Marcar contra-marco como entregue em obra?',
              descricao: 'O card vai pro cliente esperar a instalação.',
              labelConfirmar: 'Marcar como entregue',
            })
            if (ok === null) return
            await data.marcarContraMarcoEntregue(cardAberto.id)
            setCardAbertoId(null)
            toast('Contra-marco marcado como entregue')
          }}
          onMarcarVaoPronto={async () => {
            const ok = await confirmar({
              titulo: 'Marcar vão como pronto?',
              descricao: 'O card vai pra Técnica aguardando a Medição 2 (M2).',
              labelConfirmar: 'Marcar como pronto',
            })
            if (ok === null) return
            await data.marcarVaoPronto(cardAberto.id, 'empresa')
            setCardAbertoId(null)
            toast('Vão marcado como pronto — aguardando M2')
          }}
          onEncerrar={async () => {
            const motivo = await confirmar({
              titulo: 'Encerrar este item?',
              descricao: 'O item sai do fluxo ativo. O motivo aparece pro cliente no histórico.',
              pedirMotivo: true,
              placeholderMotivo: 'Conte o motivo do encerramento (aparece pro cliente)',
              labelConfirmar: 'Encerrar item',
              destrutivo: true,
            })
            if (motivo === null) return
            if (!motivo.trim()) { toast('Encerramento cancelado — sem motivo informado'); return }
            await data.encerrarCard(cardAberto.id, motivo)
            setCardAbertoId(null)
            toast('Item encerrado')
          }}
          onResolverApontamento={async () => {
            const resolucao = await confirmar({
              titulo: 'Marcar este apontamento como resolvido?',
              descricao: 'A descrição do que foi feito aparece pro cliente no histórico.',
              pedirMotivo: true,
              placeholderMotivo: 'O que foi feito pra resolver (aparece pro cliente)',
              labelConfirmar: 'Marcar como resolvido',
            })
            if (resolucao === null) return
            if (!resolucao.trim()) { toast('Resolução cancelada — sem descrição'); return }
            await data.marcarApontamentoResolvido(cardAberto.id, resolucao)
            setCardAbertoId(null)
            toast('Apontamento resolvido')
          }}
          onMarcarCorrigido={async () => {
            const ok = await confirmar({
              titulo: 'Marcar como corrigido?',
              descricao: 'O card volta pra Conclusão e o cliente pode dar aceite novamente.',
              labelConfirmar: 'Marcar como corrigido',
            })
            if (ok === null) return
            await data.marcarCorrigido(cardAberto.id)
            setCardAbertoId(null)
            toast('Marcado como corrigido — aguardando novo aceite')
          }}
          onApagar={async () => {
            const ok = await confirmar({
              titulo: 'Apagar este item permanentemente?',
              descricao: 'Toda informação (histórico, fotos, checklists) será apagada do banco. O cliente NÃO vai ver nenhum registro disso. Essa ação não pode ser desfeita.',
              digitacaoExigida: 'APAGAR',
              destrutivo: true,
              labelConfirmar: 'Apagar item permanentemente',
            })
            if (ok === null) return
            await data.apagarCard(cardAberto.id)
            setCardAbertoId(null)
            toast('Item apagado')
          }}
        />
      )}

      {formM1Aberto && (() => {
        const cardId = formM1Aberto
        const card = dados.cards.find((c) => c.id === cardId)
        const m1 = card?.checklists.find((c) => c.tipo === 'medicao1')
        // Pré-popula com descrição do card quando ainda não tem M1 salva
        const inicial: DadosMedicao1 | null = m1
          ? (m1.dados as DadosMedicao1)
          : card
            ? { ...VAZIO_MEDICAO1, descricao: card.descricao || card.nome }
            : null
        return (
          <FormMedicao1
            inicial={inicial}
            onCancelar={() => setFormM1Aberto(null)}
            onSalvar={async (dadosForm) => {
              await data.salvarMedicao1Card(cardId, dadosForm, user?.email ?? 'Empresa')
              setFormM1Aberto(null)
              if (dadosForm.tipologia_executavel === 'nao') {
                toast('Reportado pra empresa — card devolvido')
              } else {
                toast('Medição 1 salva')
              }
            }}
          />
        )
      })()}

      {formM2Aberto && (() => {
        const cardId = formM2Aberto
        const card = dados.cards.find((c) => c.id === cardId)
        const m1 = card?.checklists.find((c) => c.tipo === 'medicao1')
        const m2 = card?.checklists.find((c) => c.tipo === 'medicao2')
        const m1Dados = (m1?.dados as DadosMedicao1) ?? null
        const inicial: DadosMedicao2 | null = m2
          ? (m2.dados as DadosMedicao2)
          : VAZIO_MEDICAO2
        return (
          <FormMedicao2
            inicial={inicial}
            m1={m1Dados}
            onCancelar={() => setFormM2Aberto(null)}
            onSalvar={async (dadosForm) => {
              await data.salvarMedicao2Card(cardId, dadosForm, user?.email ?? 'Empresa')
              setFormM2Aberto(null)
              if (dadosForm.liberado_producao === 'sim') {
                toast('Medição 2 aprovada — card movido para produção')
              } else {
                toast('Medição 2 reprovada — card devolvido pra empresa')
              }
            }}
          />
        )
      })()}

      {novoAberto && (
        <ModalNovo
          abaAtiva={abaAtiva}
          onClose={() => setModalGlobal('nenhum')}
          onCriar={async (input) => {
            if (!input.sigla.trim() || !input.nome.trim()) { toast('Preencha sigla e nome'); return }
            if (input.destino === 'emandamento' && !input.prazoContrato) { toast('Informe o prazo contratual'); return }
            const destino = await data.criarNovo(input, perfil)
            setModalGlobal('nenhum')
            setAbaAtiva(destino)
            toast('Registro criado')
          }}
        />
      )}

      {importarAberto && data.obraReal && (
        <ImportarItens
          obraId={data.obraReal.id}
          onClose={() => setModalGlobal('nenhum')}
          onImportar={async (itens) => {
            const n = await data.importarItens(itens, perfil)
            setModalGlobal('nenhum')
            setAbaAtiva('cliente')
            toast(n + (n === 1 ? ' item importado' : ' itens importados'))
          }}
        />
      )}

      {tecnicosAberto && data.obraReal && (
        <GerenciarTecnicos
          obraId={data.obraReal.id}
          onClose={() => setModalGlobal('nenhum')}
        />
      )}

      <ModalDocumentos
        obra={dados}
        empresa={empresaInfo ?? { nome: dados.obra.empresa || 'Empresa', cnpj: null }}
        aberto={documentosAberto}
        onFechar={() => setModalGlobal('nenhum')}
      />

      {confirmDialog}


      {toastMsg && (
        <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-white border border-slate-300 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2.5 text-sm z-50" role="status" aria-live="polite">
          <span className="text-status-andamento font-bold">OK</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}

function SidebarSec({ titulo }: { titulo: string }) {
  return <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">{titulo}</div>
}

function NavItem({ children, ativo, onClick, emBreve, title }: { children: React.ReactNode; ativo?: boolean; onClick?: () => void; emBreve?: boolean; title?: string }) {
  // Estilo: ativo (laranja preenchido) > emBreve (cinza claro com badge) > normal
  const base = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition text-left w-full'
  let styles = ''
  if (ativo) styles = 'bg-laranja text-white font-semibold'
  else if (emBreve) styles = 'text-slate-400 cursor-default'
  else styles = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  return (
    <button
      onClick={emBreve ? undefined : onClick}
      title={title}
      disabled={emBreve}
      className={base + ' ' + styles}
    >
      <span className="w-4 inline-flex items-center justify-center">.</span>
      <span className="flex-1">{children}</span>
      {emBreve && (
        <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
          Em breve
        </span>
      )}
    </button>
  )
}

function CardView({ card, perfil, onClick }: { card: Card; perfil: Perfil; onClick: () => void }) {
  const s = statusSemantico(card)
  const tipoLabel = { peca: 'Item', acordo: 'Acordo', reclamacao: 'Apontamento' }[card.tipo]
  const labelStatus =
    card.subStatus
    ? card.subStatus
    : s === 'aguarda' ? (card.aba === 'cliente' ? 'Aguardando cliente' : card.aba === 'empresa' ? 'Aguardando empresa' : card.aba === 'tecnica' ? 'Aguardando visita técnica' : 'Aguardando')
    : s === 'andamento' ? 'Em andamento'
    : s === 'instalado' ? 'Instalado'
    : s === 'concluido' ? (card.aceiteFinal ? 'Aceite concluido' : 'Aguardando aceite')
    : 'Atencao'
  const statusTxt = card.aba === 'emandamento' && card.statusEmAndamento ? card.statusEmAndamento : labelStatus

  let prazoNode: React.ReactNode = null
  if (card.aba === 'emandamento' && card.prazoContrato) {
    const dias = diasAte(card.prazoContrato)
    if (dias !== null) {
      let cls = 'text-[11px] font-medium text-slate-400'
      let txt = 'Prazo ' + formataData(card.prazoContrato)
      if (dias < 0) { cls = 'text-[11px] font-semibold text-red-600'; txt = 'Atrasado ' + Math.abs(dias) + 'd' }
      else if (dias <= 7) { cls = 'text-[11px] font-semibold text-red-600'; txt = 'Vence em ' + dias + 'd' }
      else if (dias <= 30) { cls = 'text-[11px] text-status-andamento font-medium'; txt = dias + 'd restantes' }
      prazoNode = <span className={cls}>{txt}</span>
    }
  }

  // Como o toggle "Visão Cliente" foi removido (10/05/2026), perfil sempre é 'empresa'.
  // Mantida só a condição que ainda se aplica.
  const novoParaVoce = card.aba === 'empresa'

  const corLado = card.tipo === 'peca' ? 'bg-peca' : 'bg-acordo'
  const siglaCls = card.tipo === 'peca'
    ? 'bg-peca-soft text-peca-dark border-peca-border'
    : 'bg-acordo-soft text-acordo-dark border-acordo-border'
  const dotCls = {
    aguarda: 'bg-status-aguarda',
    andamento: 'bg-status-andamento',
    instalado: 'bg-status-instalado',
    concluido: 'bg-status-concluido',
    erro: 'bg-status-erro',
  }[s]

  return (
    <div onClick={onClick} className={'card-base ' + (card.encerrado ? 'opacity-60' : '')}>
      <span className={'absolute left-0 top-0 bottom-0 w-1 ' + corLado} />
      {novoParaVoce && !card.encerrado && (
        <span className="absolute top-2.5 right-2.5 bg-laranja text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
          Pra voce
        </span>
      )}
      <div className="flex items-center justify-between gap-2.5 mb-2">
        <span className={'px-2 py-0.5 rounded-md text-[11px] font-bold border ' + siglaCls}>{card.sigla}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{tipoLabel}</span>
      </div>
      <div className={'text-sm font-semibold mb-1 leading-snug ' + (card.encerrado ? 'line-through' : '')}>{card.nome}</div>
      <div className="text-xs text-slate-500 leading-snug mb-2.5 line-clamp-2">{card.descricao}</div>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2.5 border-t border-slate-200">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <span className={'w-2 h-2 rounded-full ' + dotCls} />
          {statusTxt}
        </span>
        {prazoNode}
      </div>
    </div>
  )
}

function ModalCard({
  card, perfil, podeFotos, onClose, onAlterarStatus, onRegistrar, onAceitar, onReabrir, onAdicionarFotos, onRemoverFoto, podeChecklist, onAbrirMedicao1, onAbrirMedicao2, onMarcarContraMarcoEntregue, onMarcarVaoPronto, onEncerrar, onResolverApontamento, onMarcarCorrigido, onApagar,
}: {
  card: Card; perfil: Perfil; podeFotos: boolean; onClose: () => void
  onAlterarStatus: (s: string) => Promise<void>
  onRegistrar: (texto: string, moveAba: boolean) => Promise<void>
  onAceitar: () => Promise<void>
  onReabrir: (texto: string) => Promise<void>
  onAdicionarFotos: (arquivos: File[]) => Promise<void>
  onRemoverFoto: (fotoId: string) => Promise<void>
  podeChecklist: boolean
  onAbrirMedicao1: () => void
  onAbrirMedicao2: () => void
  onMarcarContraMarcoEntregue: () => Promise<void>
  onMarcarVaoPronto: () => Promise<void>
  onEncerrar: () => Promise<void>
  onResolverApontamento: () => Promise<void>
  onMarcarCorrigido: () => Promise<void>
  onApagar: () => Promise<void>
}) {
  const [texto, setTexto] = useState('')
  useEscClose(true, onClose)
  const tipoLabel = { peca: 'Item', acordo: 'Acordo', reclamacao: 'Apontamento' }[card.tipo]
  const abaLabel = ABAS.find((a) => a.id === card.aba)?.rotulo
  const siglaCls = card.tipo === 'peca'
    ? 'bg-peca-soft text-peca-dark border-peca-border'
    : 'bg-acordo-soft text-acordo-dark border-acordo-border'

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <span className={'inline-block px-2.5 py-1 rounded-md text-xs font-bold border mb-2 ' + siglaCls}>{card.sigla} | {tipoLabel}</span>
            <div className="text-lg font-bold mb-1">{card.nome}</div>
            <div className="text-sm text-slate-500">{card.descricao}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-2.5">
            <Info label="Aba atual" valor={abaLabel ?? '-'} />
            <Info label="Tipo" valor={tipoLabel} />
            {card.aba === 'emandamento' && (
              <>
                <Info label="Prazo contratual" valor={formataData(card.prazoContrato)} />
                <Info label="Status" valor={card.statusEmAndamento ?? '-'} />
              </>
            )}
          </div>

          {/* Card reaberto pelo cliente — destaque o motivo + botão Corrigido */}
          {!card.encerrado && card.subStatus === 'Reaberto pelo cliente — aguardando correção' && (() => {
            // Pega a última mensagem do cliente (motivo da reabertura)
            const ultimaCliente = (card.historico ?? []).slice().reverse().find((h) => h.tipo === 'cliente')
            return (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-4">
                <div className="font-bold text-sm text-red-800 mb-1">⚠ Card reaberto pelo cliente</div>
                {ultimaCliente && (
                  <div className="bg-white border border-red-200 rounded-md px-3 py-2 mb-3">
                    <div className="text-[10px] text-red-700 font-bold uppercase tracking-wider mb-0.5">Motivo (cliente)</div>
                    <div className="text-sm text-slate-800">{ultimaCliente.texto}</div>
                  </div>
                )}
                <p className="text-xs text-slate-700 mb-3">Quando empresa atender o problema apontado, marque como corrigido. Card volta pra Conclusão pra cliente dar novo aceite.</p>
                <button className="btn-primary" onClick={onMarcarCorrigido}>Marcar como corrigido →</button>
              </div>
            )
          })()}

          {/* Apontamento aberto — empresa pode marcar como resolvido */}
          {!card.encerrado && card.tipo === 'reclamacao' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-4">
              <div className="font-bold text-sm text-amber-800 mb-1">📌 Apontamento aberto</div>
              <p className="text-xs text-slate-700 mb-3">Quando a empresa atender o que foi pedido, marque como resolvido. O item vai pra Conclusão e o cliente é notificado.</p>
              <button className="btn-primary" onClick={onResolverApontamento}>Marcar como resolvido</button>
            </div>
          )}

          {/* Botões contextuais de transição (só Visão Empresa) */}
          {!card.encerrado && card.subStatus === 'Fabricando contra-marco' && (
            <div className="bg-laranja-soft border border-laranja-border rounded-lg px-4 py-4">
              <div className="font-bold text-sm text-laranja-dark mb-1">🛠 Em fabricação do contra-marco</div>
              <p className="text-xs text-slate-700 mb-3">Quando o contra-marco for fabricado e entregue na obra, marque abaixo. O card vai pra cliente esperar a instalação.</p>
              <button className="btn-primary" onClick={onMarcarContraMarcoEntregue}>Marcar como entregue →</button>
            </div>
          )}

          {!card.encerrado && (card.subStatus === 'Aguardando instalação do contra-marco e vão pronto' || card.subStatus === 'Aguardando finalizar vão') && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-4">
              <div className="font-bold text-sm text-emerald-700 mb-1">📋 {card.subStatus}</div>
              <p className="text-xs text-slate-700 mb-3">Se o cliente já confirmou que o vão tá pronto pra próxima medição, você pode marcar em nome dele:</p>
              <button className="btn-primary" onClick={onMarcarVaoPronto}>Marcar vão pronto → vai pra Técnica (M2)</button>
            </div>
          )}

          {card.aba === 'conclusao' && (
            <div>
              {card.encerrado ? (
                // Card encerrado (acordo aceito/recusado, apontamento resolvido,
                // empresa cancelou o item). Nesses casos NÃO há aceite a aguardar.
                <div className="bg-slate-100 border border-slate-300 px-4 py-3 rounded-lg text-xs text-slate-700">
                  <div className="font-bold text-sm text-slate-800 mb-0.5">⊘ Item encerrado{card.subStatus ? ' — ' + card.subStatus : ''}</div>
                  <p className="text-slate-500">Veja o motivo e o histórico completo abaixo.</p>
                </div>
              ) : card.aceiteFinal ? (
                <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg text-xs text-slate-700">
                  <span className="text-emerald-700 font-bold">✓ Aceite confirmado</span> pelo cliente em {formataDataHora(card.aceiteFinal)}. Garantia iniciada nesta data.
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 px-4 py-4 rounded-lg">
                  <div className="font-bold text-sm text-emerald-700 mb-1">Aguardando aceite do cliente</div>
                  <p className="text-xs text-slate-600">O cliente precisa abrir este card e confirmar o aceite para iniciar a garantia.</p>
                </div>
              )}
            </div>
          )}

          {card.aba === 'emandamento' && !card.encerrado && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Status do processo (empresa)</div>
              <select
                className="input"
                value={card.statusEmAndamento ?? ''}
                onChange={(e) => onAlterarStatus(e.target.value)}
              >
                {STATUS_EM_ANDAMENTO.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {!card.encerrado && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Registrar novo movimento</div>
              <textarea
                className="input min-h-[90px]"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Descreva o que aconteceu, a confirmacao, pedido, combinado..."
              />
              <div className="flex gap-2 flex-wrap mt-2.5">
                <button className="btn-primary" onClick={() => onRegistrar(texto, true)}>
                  Registrar (joga pro cliente)
                </button>
                {card.aba === 'emandamento' && (
                  <button className="btn-ghost" onClick={() => onRegistrar(texto, false)}>Registrar sem mover</button>
                )}
              </div>
            </div>
          )}

          {podeChecklist && card.tipo === 'peca' && !card.encerrado && (
            <ChecklistTecnico card={card} onAbrirMedicao1={onAbrirMedicao1} onAbrirMedicao2={onAbrirMedicao2} />
          )}

          {podeFotos && (
            <GaleriaFotos
              fotos={card.fotos}
              podeEditar={!card.encerrado}
              onAdicionar={onAdicionarFotos}
              onRemover={async (foto) => onRemoverFoto(foto.id)}
            />
          )}

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Historico</div>
            <div className="space-y-2.5">
              {(card.historico ?? []).slice().reverse().map((h, i) => (
                <div
                  key={i}
                  className={'border px-3 py-2.5 rounded-md text-xs ' + (
                    h.interno ? 'bg-slate-100 border-slate-300 border-dashed' : 'bg-slate-50 border-slate-200'
                  ) + ' ' + (
                    h.tipo === 'empresa' ? 'border-l-2 border-l-laranja' :
                    h.tipo === 'cliente' ? 'border-l-2 border-l-peca' :
                    h.tipo === 'tecnico' ? 'border-l-2 border-l-blue-500' :
                    'border-l-2 border-l-slate-300 opacity-90'
                  )}
                >
                  <div className="flex justify-between items-center mb-1 gap-2.5">
                    <span className={'font-bold text-[11px] uppercase tracking-wider ' + (
                      h.tipo === 'empresa' ? 'text-laranja-dark' :
                      h.tipo === 'cliente' ? 'text-peca-dark' :
                      h.tipo === 'tecnico' ? 'text-blue-700' :
                      'text-slate-400'
                    )}>{h.autor}</span>
                    <div className="flex items-center gap-1.5">
                      {h.interno && (
                        <span className="bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Só empresa</span>
                      )}
                      <span className="text-[11px] text-slate-400">{h.data}</span>
                    </div>
                  </div>
                  <div className="text-slate-700 leading-relaxed">{h.texto}</div>
                </div>
              ))}
              {(card.historico ?? []).length === 0 && (
                <div className="bg-slate-50 px-3 py-2.5 rounded-md text-xs text-slate-400">Nenhum registro ainda.</div>
              )}
            </div>
          </div>

          {(
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              {!card.encerrado && (
                <button
                  onClick={onEncerrar}
                  className="text-xs text-slate-400 hover:text-red-600 underline-offset-2 hover:underline transition"
                >Encerrar este item</button>
              )}
              <button
                onClick={onApagar}
                className="text-xs text-slate-400 hover:text-red-600 underline-offset-2 hover:underline transition"
              >Apagar este item (irreversível)</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChecklistTecnico({ card, onAbrirMedicao1, onAbrirMedicao2 }: { card: Card; onAbrirMedicao1: () => void; onAbrirMedicao2: () => void }) {
  const m1 = card.checklists.find((c) => c.tipo === 'medicao1')
  const m2 = card.checklists.find((c) => c.tipo === 'medicao2')
  const dadosM1 = m1?.dados as DadosMedicao1 | undefined
  const dadosM2 = m2?.dados as DadosMedicao2 | undefined
  const resumo = dadosM1 ? resumoMedicao1(dadosM1) : null
  const resumoM2 = dadosM2 ? resumoMedicao2(dadosM2) : null
  const tipologiaKey = dadosM1?.tipologia ? dadosM1.tipologia : null
  const tipologiaLabel = tipologiaKey ? ROTULOS_TIPOLOGIA[tipologiaKey] : null
  const naoExecutavel = dadosM1?.tipologia_executavel === 'nao'

  // M2 só faz sentido se M1 existe + tipologia executável + (contra-marco SIM ou vão NÃO pronto na M1)
  const m2Aplicavel = !!dadosM1 && !naoExecutavel && (dadosM1.contra_marco === 'sim' || dadosM1.vao_pronto === 'nao')
  const m2Reprovado = dadosM2?.liberado_producao === 'nao'

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Checklist técnico (só empresa enxerga)
      </div>

      {/* Medição 1 */}
      {m1 && dadosM1 ? (
        <div className={'border rounded-lg p-3.5 space-y-2.5 ' + (naoExecutavel ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Medição 1</span>
                {tipologiaLabel && (
                  <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{tipologiaLabel}</span>
                )}
                <span className="text-[11px] text-slate-400">{m1.autor} · {new Date(m1.preenchidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div className={'text-sm font-medium ' + (naoExecutavel ? 'text-red-700' : 'text-slate-800')}>{resumo}</div>
              {naoExecutavel ? (
                <div className="text-xs text-red-700 mt-1">
                  <strong>Motivo:</strong> {dadosM1.tipologia_problema || '(sem detalhes)'}
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-1">
                  Contra-marco: <strong>{dadosM1.contra_marco === 'sim' ? 'SIM' : dadosM1.contra_marco === 'nao' ? 'NÃO' : '-'}</strong>
                  {dadosM1.medida_largura && dadosM1.medida_altura && (
                    <> · Medida: {dadosM1.medida_largura} x {dadosM1.medida_altura}</>
                  )}
                </div>
              )}
            </div>
            <button onClick={onAbrirMedicao1} className="btn-ghost text-xs px-3 py-1.5">Editar</button>
          </div>
        </div>
      ) : (
        <button onClick={onAbrirMedicao1} className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-sm text-slate-600 hover:border-laranja hover:text-laranja-dark hover:bg-laranja-soft transition">
          + Preencher Medição 1 (visita técnica)
        </button>
      )}

      {/* Medição 2 — só aparece se aplicável */}
      {m2Aplicavel && (
        m2 && dadosM2 ? (
          <div className={'border rounded-lg p-3.5 space-y-2.5 ' + (m2Reprovado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Medição 2</span>
                  <span className="text-[11px] text-slate-400">{m2.autor} · {new Date(m2.preenchidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className={'text-sm font-medium ' + (m2Reprovado ? 'text-red-700' : 'text-slate-800')}>{resumoM2}</div>
                {m2Reprovado && (
                  <div className="text-xs text-red-700 mt-1">
                    <strong>Pendências:</strong> {dadosM2.pendencias || '(sem detalhes)'}
                  </div>
                )}
              </div>
              <button onClick={onAbrirMedicao2} className="btn-ghost text-xs px-3 py-1.5">Editar</button>
            </div>
          </div>
        ) : (
          <button onClick={onAbrirMedicao2} className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-sm text-slate-600 hover:border-laranja hover:text-laranja-dark hover:bg-laranja-soft transition">
            + Preencher Medição 2 (conferência final do vão)
          </button>
        )
      )}
    </div>
  )
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-md">
      <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">{label}</div>
      <div className="text-sm text-slate-900 font-medium">{valor}</div>
    </div>
  )
}

function ModalNovo({
  abaAtiva, onClose, onCriar,
}: {
  abaAtiva: AbaId
  onClose: () => void
  onCriar: (input: { tipo: TipoCard; sigla: string; nome: string; descricao: string; destino: AbaId; prazoContrato: string }) => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoCard>('peca')
  const [sigla, setSigla] = useState('')
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [destino, setDestino] = useState<AbaId>(abaAtiva === 'conclusao' ? 'cliente' : abaAtiva)
  const [prazoContrato, setPrazoContrato] = useState('')
  const [salvando, setSalvando] = useState(false)
  useEscClose(true, onClose)

  // Bug fix (07/05/2026): so 'peca' tem aba 'em andamento' (com prazo de producao).
  // Acordo e apontamento nao tem essa aba — se o usuario abre o modal estando
  // em 'em andamento' (que vira destino default) e troca o tipo pra acordo/apontamento,
  // o destino fica preso em 'emandamento' (option some, mas state nao reseta), e o
  // card fica orfao numa aba que nao tem botoes de acao pra ele.
  useEffect(() => {
    if (tipo !== 'peca' && destino === 'emandamento') {
      setDestino('cliente')
      setPrazoContrato('')
    }
  }, [tipo, destino])

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-5 z-40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start gap-4">
          <div className="flex-1">
            <div className="text-lg font-bold mb-1">+ Novo registro</div>
            <div className="text-sm text-slate-500">Crie um item, acordo ou apontamento nesta obra.</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition" aria-label="Fechar">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Tipo</div>
            <div className="flex gap-2 flex-wrap">
              {(['peca', 'acordo', 'reclamacao'] as TipoCard[]).map((t) => {
                const sel = tipo === t
                const cls = sel
                  ? t === 'peca'
                    ? 'bg-peca-soft border-peca-border text-peca-dark'
                    : 'bg-acordo-soft border-acordo-border text-acordo-dark'
                  : 'bg-white border-slate-200 text-slate-500'
                return (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={'flex-1 min-w-[100px] border px-3 py-2.5 rounded-md font-semibold text-xs text-center transition ' + cls}
                  >
                    {t === 'peca' ? 'Item' : t === 'acordo' ? 'Acordo' : 'Apontamento'}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2.5 flex-col md:flex-row">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sigla/ID</label>
              <input className="input" value={sigla} onChange={(e) => setSigla(e.target.value)} placeholder="J1" />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Destino inicial</label>
              <select className="input" value={destino} onChange={(e) => setDestino(e.target.value as AbaId)}>
                <option value="cliente">Cliente (espera algo do cliente)</option>
                <option value="empresa">Empresa (espera algo da empresa)</option>
                {tipo === 'peca' && <option value="emandamento">Em andamento (ja com prazo)</option>}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nome</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Janela sala 2 / Cor da porta suite / Vidro trincado" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descricao</label>
            <textarea className="input min-h-[90px]" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes da peca, termos do acordo ou descricao do problema" />
          </div>

          {destino === 'emandamento' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Prazo contratual</label>
              <input className="input" type="date" value={prazoContrato} onChange={(e) => setPrazoContrato(e.target.value)} />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-2.5 justify-end bg-slate-50">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            disabled={salvando}
            onClick={async () => {
              setSalvando(true)
              try { await onCriar({ tipo, sigla, nome, descricao, destino, prazoContrato }) } finally { setSalvando(false) }
            }}
          >{salvando ? 'Criando...' : 'Criar'}</button>
        </div>
      </div>
    </div>
  )
}
