import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { ABAS } from '../types/obra'
import type { AbaId, Card } from '../types/obra'
import { diasAte, formataData, statusSemantico } from '../lib/helpers'
import { useObraData } from '../hooks/useObraData'
import GaleriaFotos from '../components/GaleriaFotos'

export default function ObraCliente() {
  const { token = '' } = useParams<{ token: string }>()
  const data = useObraData(token, 'token')

  const [abaAtiva, setAbaAtiva] = useState<AbaId>('cliente')
  const [cardAbertoId, setCardAbertoId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function toast(msg: string) {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 2400)
  }

  const cardAberto = useMemo(
    () => data.dados?.cards.find((c) => c.id === cardAbertoId) ?? null,
    [data.dados, cardAbertoId]
  )

  if (data.carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando obra...</div>
  }
  if (data.erro || !data.dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600 px-6 text-center">
        <LogoFull />
        <p className="mt-6">Link invalido ou obra encerrada.</p>
        <p className="text-sm text-slate-400">Se voce acredita que isso e um erro, fale com a empresa.</p>
      </div>
    )
  }

  const dados = data.dados
  const cardsDaAba = dados.cards.filter((c) => c.aba === abaAtiva)
  const contagem = (a: AbaId) => dados.cards.filter((c) => c.aba === a).length

  const meusPendentes = dados.cards.filter((c) =>
    !c.encerrado && (c.aba === 'cliente' || (c.aba === 'conclusao' && !c.aceiteFinal))
  ).length

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/"><LogoFull small /></Link>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-4 md:px-7 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg md:text-xl font-bold">{dados.obra.nome}</h1>
            <span className="bg-laranja-soft text-laranja-dark border border-laranja-border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Sua obra</span>
          </div>
          <div className="text-xs md:text-sm text-slate-500">{dados.obra.endereco}</div>
          {meusPendentes > 0 && (
            <div className="mt-3 bg-laranja-soft border border-laranja-border rounded-lg px-3 py-2 text-xs md:text-sm text-laranja-dark font-semibold">
              Voce tem {meusPendentes} {meusPendentes === 1 ? 'item aguardando' : 'itens aguardando'} sua acao.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 px-4 md:px-7 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAbaAtiva(a.id)}
              className={'py-3 px-3 md:px-4 text-xs md:text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap inline-flex items-center gap-2 transition ' + (abaAtiva === a.id ? 'text-laranja border-laranja' : 'text-slate-500 border-transparent hover:text-slate-900')}
            >
              {a.rotulo}
              <span className={'px-1.5 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center ' + (abaAtiva === a.id ? 'bg-laranja-soft text-laranja-dark' : 'bg-slate-100 text-slate-500')}>
                {contagem(a.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white px-4 md:px-7 py-3 text-xs text-slate-500 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          {abaAtiva === 'cliente' && 'Itens aguardando voce - confirme, responda ou pergunte.'}
          {abaAtiva === 'empresa' && 'Itens com a empresa - aguardando resposta deles.'}
          {abaAtiva === 'emandamento' && 'Itens em fabricacao ou instalacao.'}
          {abaAtiva === 'conclusao' && 'Itens instalados aguardando seu aceite final.'}
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 md:px-7 py-5">
          {cardsDaAba.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Nada nesta aba no momento.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {cardsDaAba.map((c) => (
                <CardClienteView key={c.id} card={c} onClick={() => setCardAbertoId(c.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-4 md:px-7 py-4 text-[11px] text-slate-400 text-center">
        Tudo que voce registra aqui fica documentado, com data e hora, como prova oficial.
        <br />Acesso seguro pelo seu link unico.
      </footer>

      {cardAberto && (
        <ModalCardCliente
          card={cardAberto}
          podeFotos={data.modo === 'banco'}
          onClose={() => setCardAbertoId(null)}
          onConfirmar={async () => {
            await data.registrar(cardAberto.id, 'Cliente confirmou o item.', 'cliente', true)
            setCardAbertoId(null)
            toast('Item confirmado - enviado pra empresa')
          }}
          onRegistrar={async (texto, mover) => {
            if (!texto.trim()) { toast('Escreva algo antes de registrar'); return }
            await data.registrar(cardAberto.id, texto, 'cliente', mover)
            setCardAbertoId(null)
            toast('Mensagem enviada pra empresa')
          }}
          onAceitar={async () => {
            await data.darAceite(cardAberto.id)
            toast('Aceite confirmado - garantia iniciada')
          }}
          onReabrir={async (texto) => {
            if (!texto.trim()) { toast('Descreva o problema'); return }
            await data.reabrir(cardAberto.id, texto, 'cliente')
            setCardAbertoId(null)
            toast('Problema enviado pra empresa')
          }}
          onAdicionarFotos={async (arquivos) => {
            const n = await data.adicionarFotos(cardAberto.id, arquivos)
            toast(n + (n === 1 ? ' foto adicionada' : ' fotos adicionadas'))
          }}
          onRemoverFoto={async (fotoId) => {
            await data.removerFoto(cardAberto.id, fotoId)
            toast('Foto removida')
          }}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-slate-300 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2.5 text-sm z-50">
          <span className="text-status-andamento font-bold">OK</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}

function CardClienteView({ card, onClick }: { card: Card; onClick: () => void }) {
  const s = statusSemantico(card)
  const tipoLabel = { peca: 'Peca', acordo: 'Acordo', reclamacao: 'Reclamacao' }[card.tipo]
  const labelStatus =
    s === 'aguarda' ? (card.aba === 'cliente' ? 'Aguardando sua acao' : card.aba === 'empresa' ? 'Aguardando empresa' : 'Aguardando')
    : s === 'andamento' ? 'Em andamento na fabrica'
    : s === 'instalado' ? 'Instalado'
    : s === 'concluido' ? (card.aceiteFinal ? 'Aceite concluido' : 'Aguardando seu aceite')
    : 'Atencao'
  const statusTxt = card.aba === 'emandamento' && card.statusEmAndamento ? card.statusEmAndamento : labelStatus

  let prazoNode: React.ReactNode = null
  if (card.aba === 'emandamento' && card.prazoContrato) {
    const dias = diasAte(card.prazoContrato)
    if (dias !== null) {
      let cls = 'text-[11px] font-medium text-slate-400'
      let txt = 'Prazo ' + formataData(card.prazoContrato)
      if (dias < 0) { cls = 'text-[11px] font-semibold text-red-600'; txt = 'Atrasado ' + Math.abs(dias) + 'd' }
      else if (dias <= 7) { cls = 'text-[11px] font-semibold text-red-600'; txt = 'Em ' + dias + 'd' }
      else if (dias <= 30) { cls = 'text-[11px] text-status-andamento font-medium'; txt = dias + 'd restantes' }
      prazoNode = <span className={cls}>{txt}</span>
    }
  }

  const aguardandoCliente = (card.aba === 'cliente' || (card.aba === 'conclusao' && !card.aceiteFinal)) && !card.encerrado
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
      {aguardandoCliente && (
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

function ModalCardCliente({
  card, podeFotos, onClose, onConfirmar, onRegistrar, onAceitar, onReabrir, onAdicionarFotos, onRemoverFoto,
}: {
  card: Card
  podeFotos: boolean
  onClose: () => void
  onConfirmar: () => Promise<void>
  onRegistrar: (texto: string, moveAba: boolean) => Promise<void>
  onAceitar: () => Promise<void>
  onReabrir: (texto: string) => Promise<void>
  onAdicionarFotos: (arquivos: File[]) => Promise<void>
  onRemoverFoto: (fotoId: string) => Promise<void>
}) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const tipoLabel = { peca: 'Peca', acordo: 'Acordo', reclamacao: 'Reclamacao' }[card.tipo]
  const abaLabel = ABAS.find((a) => a.id === card.aba)?.rotulo
  const siglaCls = card.tipo === 'peca'
    ? 'bg-peca-soft text-peca-dark border-peca-border'
    : 'bg-acordo-soft text-acordo-dark border-acordo-border'

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm grid place-items-end md:place-items-center p-0 md:p-5 z-40" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-t-2xl md:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 md:px-6 py-4 md:py-5 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <span className={'inline-block px-2.5 py-1 rounded-md text-xs font-bold border mb-2 ' + siglaCls}>{card.sigla} | {tipoLabel}</span>
            <div className="text-base md:text-lg font-bold mb-1">{card.nome}</div>
            <div className="text-sm text-slate-500">{card.descricao}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200 hover:text-slate-900 transition">x</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-4 md:py-5 space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Situacao</div>
              <div className="text-sm text-slate-900 font-medium">{abaLabel ?? '-'}</div>
            </div>
            {card.aba === 'emandamento' && (
              <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-md">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Prazo</div>
                <div className="text-sm text-slate-900 font-medium">{formataData(card.prazoContrato)}</div>
              </div>
            )}
          </div>

          {card.aba === 'conclusao' && (
            <div>
              {card.aceiteFinal ? (
                <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg text-xs text-slate-700">
                  <span className="text-emerald-700 font-bold">OK Aceite confirmado</span> em {card.aceiteFinal}. Garantia iniciada.
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 px-4 py-4 rounded-lg">
                  <div className="font-bold text-sm text-emerald-700 mb-1">Confirmar aceite final</div>
                  <p className="text-xs text-slate-600 mb-3">A peca foi instalada. Ao confirmar, voce aceita oficialmente a entrega e a garantia comeca a contar a partir desta data e hora.</p>
                  <button
                    className="btn-primary w-full md:w-auto"
                    disabled={salvando}
                    onClick={async () => { setSalvando(true); try { await onAceitar() } finally { setSalvando(false) } }}
                  >Confirmar aceite</button>
                </div>
              )}
            </div>
          )}

          {card.aba === 'cliente' && !card.encerrado && (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-4 rounded-lg">
              <div className="font-bold text-sm text-emerald-700 mb-1">Está tudo certo com este item?</div>
              <p className="text-xs text-slate-600 mb-3">Se este item está como combinado, é só confirmar. Sua confirmação fica registrada com data e hora — vale como prova oficial.</p>
              <button
                className="btn-primary w-full md:w-auto"
                disabled={salvando}
                onClick={async () => { setSalvando(true); try { await onConfirmar() } finally { setSalvando(false) } }}
              >Confirmar item</button>
            </div>
          )}

          {!card.encerrado && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                {card.aba === 'cliente' ? 'Ou tem algo a dizer?' : 'Registrar mensagem pra empresa'}
              </div>
              <textarea
                className="input min-h-[100px]"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={card.aba === 'cliente'
                  ? 'Pergunte, peca uma mudanca, ou descreva algo especifico...'
                  : 'Confirme, pergunte, ou descreva alguma coisa que aconteceu na obra...'}
              />
              <div className="flex gap-2 flex-wrap mt-2.5">
                <button
                  className="btn-ghost"
                  disabled={salvando}
                  onClick={async () => { setSalvando(true); try { await onRegistrar(texto, true) } finally { setSalvando(false) } }}
                >Enviar mensagem</button>
                {card.aba === 'conclusao' && !card.aceiteFinal && (
                  <button
                    className="btn bg-transparent text-red-600 border border-red-200 hover:bg-red-50"
                    disabled={salvando}
                    onClick={async () => { setSalvando(true); try { await onReabrir(texto) } finally { setSalvando(false) } }}
                  >Tem problema - reabrir</button>
                )}
              </div>
            </div>
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
                  className={'bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-md text-xs ' + (
                    h.tipo === 'empresa' ? 'border-l-2 border-l-laranja' :
                    h.tipo === 'cliente' ? 'border-l-2 border-l-peca' : 'border-l-2 border-l-slate-300 opacity-90'
                  )}
                >
                  <div className="flex justify-between items-center mb-1 gap-2.5">
                    <span className={'font-bold text-[11px] uppercase tracking-wider ' + (
                      h.tipo === 'empresa' ? 'text-laranja-dark' :
                      h.tipo === 'cliente' ? 'text-peca-dark' : 'text-slate-400'
                    )}>{h.autor}</span>
                    <span className="text-[11px] text-slate-400">{h.data}</span>
                  </div>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{h.texto}</div>
                </div>
              ))}
              {(card.historico ?? []).length === 0 && (
                <div className="bg-slate-50 px-3 py-2.5 rounded-md text-xs text-slate-400">Nenhum registro ainda.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
