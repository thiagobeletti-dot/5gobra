// Raio-X da gestão — página de venda interativa (rota /raio-x).
//
// Ideia do Thiago (31/08/2026): em vez de folheto, um "game" que faz perguntas
// e, conforme a resposta, MOSTRA o sistema resolvendo aquele problema — já
// quebrando a objeção no caminho. Termina num diagnóstico com ROI e 2 botões.
//
// Fundamento (pesquisa, ver Vault "Estratégia — Página de venda self-service"):
//   - 67% dos compradores B2B preferem comprar SEM vendedor (Gartner 2026)
//   - quem interage com demo converte 24,35% vs 3,05% de quem não interage
//   - demos personalizadas convertem 40%+ melhor que genéricas
//
// Princípios de design aplicados:
//   1. Valor na PRIMEIRA resposta (nada de pedágio de 5 perguntas)
//   2. Máximo 3 perguntas
//   3. "Pular e ver o sistema" sempre visível — pro cara que já se decidiu
//   4. Nada de e-mail obrigatório; captura só no fim, opcional

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { supabase } from '../lib/supabase'
import MockupAceiteFinal from '../components/MockupAceiteFinal'
import MockupCardHistorico from '../components/MockupCardHistorico'
import MockupDashboard from '../components/MockupDashboard'
import MockupTecnicoMobile from '../components/MockupTecnicoMobile'

// Custo conservador de uma ida à obra só pra conferir (combustível + o tempo
// do técnico + o seu). Exposto na tela de propósito — número escondido cheira
// a pegadinha, e o público é desconfiado de vendedor.
const CUSTO_VIAGEM_REAIS = 120
const PRECO_MENSAL = 349

type DorId = 'cliente' | 'visibilidade' | 'tecnico' | 'digitacao'
type ControleId = 'planilha' | 'whatsapp' | 'caderno' | 'sistema'
type Etapa = 'q1' | 'q2' | 'q3' | 'resultado'

interface OpcaoDor {
  id: DorId
  rotulo: string
  frase: string
  titulo: string
  texto: string
  mockup: 'historico' | 'aceite' | 'dashboard' | 'tecnico' | 'import'
}

// As dores são as que os clientes REALMENTE verbalizaram nas demos —
// não inventadas. Ver Vault: "Playbook de Vendas V2".
const DORES: OpcaoDor[] = [
  {
    id: 'cliente',
    rotulo: 'O cliente cobra coisa que não foi combinada',
    frase: '"Cliente jura que combinou outra coisa"',
    titulo: 'Cada peça vira um processo com prova',
    texto:
      'Todo movimento fica registrado com data, hora e autor — e o aceite do cliente é gravado com data, hora e dispositivo. Quando ele disser que combinou diferente, você não discute: você mostra. No fim sai um dossiê em PDF com o histórico e as fotos.',
    mockup: 'historico',
  },
  {
    id: 'visibilidade',
    rotulo: 'Não sei o que está acontecendo em cada obra',
    frase: '"Tá tudo na minha cabeça" / "tenho que ir atrás"',
    titulo: 'Abre de manhã e vê o que está pegando fogo',
    texto:
      'As obras aparecem ordenadas por criticidade — atrasada primeiro. Olha sua parede física e me diz em 5 segundos qual é o caso mais crítico. Não dá. Aqui dá. E se você sumir uma semana, a informação não some com você.',
    mockup: 'dashboard',
  },
  {
    id: 'tecnico',
    rotulo: 'Cada técnico mede de um jeito e dá retrabalho',
    frase: '"Vários técnicos sem padrão, gera erro de fabricação"',
    titulo: 'O técnico recebe um link e segue o mesmo roteiro',
    texto:
      'Ele abre no celular, sem instalar app e sem criar senha. Preenche o checklist da medição na ordem certa e a foto é obrigatória. Todo mundo mede do mesmo jeito — e fica registrado quem mediu, quando e com que medida.',
    mockup: 'tecnico',
  },
  {
    id: 'digitacao',
    rotulo: 'Perco tempo redigitando o orçamento peça por peça',
    frase: '"Trabalho duplo de digitar tudo de novo"',
    titulo: 'Sobe o PDF do orçamento e as peças aparecem',
    texto:
      'O sistema lê o orçamento do seu programa de cálculo (Wvetro, CEM/Alumisoft, Invictos) e cria as peças sozinho — uma por unidade, com medida, vidro e cor. Um orçamento de 108 peças vira 108 registros em segundos.',
    mockup: 'import',
  },
]

const CONTROLES: { id: ControleId; rotulo: string; resposta: string }[] = [
  {
    id: 'planilha',
    rotulo: 'Planilha do Excel',
    resposta:
      'Planilha não avisa quando algo atrasa, e só você entende ela. Não precisa migrar nada de uma vez: comece pela obra mais simples, rode ela por 14 dias em paralelo com sua planilha e compare. Se não valer, você não perdeu nada.',
  },
  {
    id: 'whatsapp',
    rotulo: 'Grupos de WhatsApp',
    resposta:
      'WhatsApp é ótimo pra conversar e péssimo pra provar. A mensagem some no meio de 300 outras e ninguém acha a foto de três meses atrás. Aqui a conversa fica presa à peça — e continua sendo pelo celular, sem app pra instalar.',
  },
  {
    id: 'caderno',
    rotulo: 'Caderno, papel, na cabeça',
    resposta:
      'Funciona até a obra em que dá problema. Comece por uma obra só: você digita ou importa as peças uma vez e passa a ver tudo de qualquer lugar — inclusive o que o técnico registrou na obra, na hora.',
  },
  {
    id: 'sistema',
    rotulo: 'Já uso outro sistema',
    resposta:
      'Então não troque nada. Wvetro, CEM e Invictos são sistemas de CÁLCULO — resolvem o ANTES da obra. O G Obra resolve o DEPOIS: o que hoje está no WhatsApp e na sua cabeça. Inclusive ele importa o orçamento que você já faz lá, sem redigitar.',
  },
]

export default function RaioX() {
  const [etapa, setEtapa] = useState<Etapa>('q1')
  const [dor, setDor] = useState<DorId | null>(null)
  const [controle, setControle] = useState<ControleId | null>(null)
  const [obrasMes, setObrasMes] = useState('')
  const [viagensMes, setViagensMes] = useState('')
  const [email, setEmail] = useState('')
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [registroId, setRegistroId] = useState<string | null>(null)

  const dorEscolhida = DORES.find((d) => d.id === dor) ?? null
  const controleEscolhido = CONTROLES.find((c) => c.id === controle) ?? null

  const viagens = Math.max(0, parseInt(viagensMes || '0', 10) || 0)
  const obras = Math.max(0, parseInt(obrasMes || '0', 10) || 0)
  const economia = viagens * CUSTO_VIAGEM_REAIS
  const sobra = economia - PRECO_MENSAL

  const passo = etapa === 'q1' ? 1 : etapa === 'q2' ? 2 : etapa === 'q3' ? 3 : 4

  // Grava o diagnóstico (best-effort — se falhar, a experiência continua).
  useEffect(() => {
    if (etapa !== 'resultado' || !supabase || registroId) return
    void supabase
      .from('diagnosticos')
      .insert({
        dor,
        controle,
        obras_mes: obras || null,
        viagens_mes: viagens || null,
        economia_estimada_centavos: economia * 100,
        chegou_ao_fim: true,
        origem: 'raio-x',
      })
      .select('id')
      .single()
      .then(({ data }) => {
        if (data?.id) setRegistroId(data.id as string)
      })
  }, [etapa, dor, controle, obras, viagens, economia, registroId])

  async function marcarClique(campo: 'clicou_trial' | 'clicou_assinar') {
    if (!supabase || !registroId) return
    await supabase.from('diagnosticos').update({ [campo]: true }).eq('id', registroId)
  }

  async function salvarEmail() {
    if (!email.trim() || !supabase || !registroId) return
    await supabase.from('diagnosticos').update({ email: email.trim().toLowerCase() }).eq('id', registroId)
    setEmailEnviado(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/">
            <LogoFull small />
          </Link>
          {/* Escape pra quem já se decidiu — nunca prender ninguém no quiz */}
          <Link
            to="/teste-gratis"
            className="ml-auto text-xs font-semibold text-slate-500 hover:text-laranja"
          >
            Pular e testar o sistema →
          </Link>
        </div>
      </header>

      {/* Progresso */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-7 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={
                'h-1.5 flex-1 rounded-full transition ' + (n <= passo ? 'bg-laranja' : 'bg-slate-200')
              }
            />
          ))}
          <span className="text-[11px] text-slate-400 ml-2 whitespace-nowrap">
            {passo === 4 ? 'resultado' : `${passo} de 3`}
          </span>
        </div>
      </div>

      <main className="flex-1 px-4 md:px-7 py-8">
        <div className="max-w-4xl mx-auto">
          {/* ================= PERGUNTA 1 ================= */}
          {etapa === 'q1' && (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                O que mais te tira o sono na gestão das obras?
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Escolha o que mais dói. Eu te mostro na hora como o G Obra resolve — sem cadastro,
                sem reunião.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 mt-6">
                {DORES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDor(d.id)}
                    className={
                      'text-left border rounded-xl p-4 transition ' +
                      (dor === d.id
                        ? 'border-laranja bg-laranja-soft'
                        : 'border-slate-200 bg-white hover:border-slate-300')
                    }
                  >
                    <div className="font-semibold text-slate-900">{d.rotulo}</div>
                    <div className="text-xs text-slate-500 mt-1 italic">{d.frase}</div>
                  </button>
                ))}
              </div>

              {dorEscolhida && (
                <BlocoSolucao item={dorEscolhida} onContinuar={() => setEtapa('q2')} />
              )}
            </>
          )}

          {/* ================= PERGUNTA 2 ================= */}
          {etapa === 'q2' && (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                E hoje, como você controla isso?
              </h1>
              <p className="text-sm text-slate-500 mt-2">Sem julgamento — só pra te mostrar o caminho certo.</p>

              <div className="grid gap-3 sm:grid-cols-2 mt-6">
                {CONTROLES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setControle(c.id)}
                    className={
                      'text-left border rounded-xl p-4 transition font-semibold text-slate-900 ' +
                      (controle === c.id
                        ? 'border-laranja bg-laranja-soft'
                        : 'border-slate-200 bg-white hover:border-slate-300')
                    }
                  >
                    {c.rotulo}
                  </button>
                ))}
              </div>

              {controleEscolhido && (
                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-bold uppercase tracking-wide text-laranja mb-2">
                    Como fica pra você
                  </div>
                  <p className="text-slate-700 leading-relaxed">{controleEscolhido.resposta}</p>
                  <button onClick={() => setEtapa('q3')} className="btn-primary mt-5">
                    Continuar →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ================= PERGUNTA 3 (ROI) ================= */}
          {etapa === 'q3' && (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Última: quanto isso te custa hoje?
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Dois números e eu te mostro a conta. Chute por cima mesmo.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 mt-6">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Obras por mês
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="input mt-2"
                    value={obrasMes}
                    onChange={(e) => setObrasMes(e.target.value)}
                    placeholder="Ex.: 12"
                  />
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Idas à obra por mês só pra conferir
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="input mt-2"
                    value={viagensMes}
                    onChange={(e) => setViagensMes(e.target.value)}
                    placeholder="Ex.: 8"
                  />
                </div>
              </div>

              <button
                onClick={() => setEtapa('resultado')}
                disabled={!viagensMes && !obrasMes}
                className="btn-primary mt-6 disabled:opacity-50"
              >
                Ver meu raio-x →
              </button>
            </>
          )}

          {/* ================= RESULTADO ================= */}
          {etapa === 'resultado' && (
            <>
              <div className="text-xs font-bold uppercase tracking-wide text-laranja">Seu raio-x</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
                {dorEscolhida
                  ? dorEscolhida.titulo
                  : 'Veja o que o G Obra resolve pra você'}
              </h1>

              {viagens > 0 && (
                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-sm text-slate-600">
                    Você faz <strong>{viagens}</strong> {viagens === 1 ? 'ida' : 'idas'} à obra por mês só
                    pra conferir
                    {obras > 0 && <> e toca <strong>{obras}</strong> {obras === 1 ? 'obra' : 'obras'}</>}.
                  </div>
                  <div className="mt-3 flex items-end gap-3 flex-wrap">
                    <div>
                      <div className="text-3xl font-bold text-slate-900">
                        R$ {economia.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs text-slate-500">custo dessas idas por mês</div>
                    </div>
                    <div className="text-slate-300 text-2xl">vs</div>
                    <div>
                      <div className="text-3xl font-bold text-laranja">R$ {PRECO_MENSAL}</div>
                      <div className="text-xs text-slate-500">o G Obra por mês</div>
                    </div>
                  </div>
                  {sobra > 0 && (
                    <div className="mt-3 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
                      Se o sistema evitar só metade dessas idas, ele já se paga —
                      e ainda sobram <strong>R$ {Math.round(economia / 2 - PRECO_MENSAL).toLocaleString('pt-BR')}</strong> no mês.
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-3">
                    Conta estimada a R$ {CUSTO_VIAGEM_REAIS} por ida (combustível + o tempo do técnico +
                    o seu). Ajuste pela sua realidade — a ideia é dar ordem de grandeza, não vender ilusão.
                  </p>
                </div>
              )}

              {dorEscolhida && (
                <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-slate-700 leading-relaxed">{dorEscolhida.texto}</p>
                </div>
              )}

              {/* CTAs */}
              <div className="mt-6 bg-gradient-to-r from-laranja-soft to-amber-50 border border-laranja/30 rounded-xl p-5">
                <div className="font-bold text-slate-900 text-lg">Veja funcionando com uma obra sua</div>
                <p className="text-sm text-slate-600 mt-1">
                  14 dias grátis, sem cartão, sem fidelidade. Você mesmo importa um orçamento e testa.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <Link
                    to="/teste-gratis"
                    onClick={() => void marcarClique('clicou_trial')}
                    className="btn-primary"
                  >
                    Testar 14 dias grátis →
                  </Link>
                  <Link
                    to="/?comprar=1"
                    onClick={() => void marcarClique('clicou_assinar')}
                    className="btn-ghost border border-slate-300"
                  >
                    Já quero assinar (R$ 349/mês)
                  </Link>
                </div>
              </div>

              {/* E-mail opcional */}
              <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
                {emailEnviado ? (
                  <p className="text-sm text-green-700 font-semibold">
                    ✓ Anotado. Te mando o raio-x e não encho seu saco.
                  </p>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-900">
                      Quer receber esse raio-x por e-mail pra ver com calma?
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <input
                        type="email"
                        className="input flex-1 min-w-[220px]"
                        placeholder="seu@email.com.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <button onClick={() => void salvarEmail()} className="btn-ghost border border-slate-300">
                        Enviar
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Opcional. Sem ligação de vendedor — prometo.
                    </p>
                  </>
                )}
              </div>

              {/* Escape humano — 69% dos compradores querem validar com alguém */}
              <p className="text-center text-sm text-slate-500 mt-6">
                Prefere que eu te mostre ao vivo?{' '}
                <a
                  href={
                    'https://wa.me/5511933969913?text=' +
                    encodeURIComponent('Oi! Fiz o raio-x no site e queria tirar uma dúvida sobre o G Obra.')
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-laranja font-semibold hover:underline"
                >
                  Chama no WhatsApp
                </a>
                .
              </p>

              <button
                onClick={() => {
                  setEtapa('q1')
                  setDor(null)
                  setControle(null)
                  setObrasMes('')
                  setViagensMes('')
                }}
                className="block mx-auto mt-6 text-xs text-slate-400 hover:text-slate-600"
              >
                Refazer o raio-x
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

/** Bloco que aparece logo depois da 1ª resposta — o "valor imediato". */
function BlocoSolucao({ item, onContinuar }: { item: OpcaoDor; onContinuar: () => void }) {
  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-laranja mb-1">
        No G Obra isso funciona assim
      </div>
      <h2 className="text-xl font-bold text-slate-900">{item.titulo}</h2>
      <p className="text-slate-700 leading-relaxed mt-2">{item.texto}</p>

      <div className="mt-5">
        {item.mockup === 'historico' && <MockupCardHistorico />}
        {item.mockup === 'aceite' && <MockupAceiteFinal />}
        {item.mockup === 'dashboard' && <MockupDashboard />}
        {item.mockup === 'tecnico' && <MockupTecnicoMobile />}
        {item.mockup === 'import' && <MockupImportacao />}
      </div>

      <button onClick={onContinuar} className="btn-primary mt-5">
        Continuar →
      </button>
    </div>
  )
}

/** Mockup simples da importação — não existia componente pronto pra esse. */
function MockupImportacao() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
          <div className="font-bold text-slate-700">📄 orcamento.pdf</div>
          <div className="text-slate-400">Wvetro · 9 tipos</div>
        </div>
        <div className="text-laranja font-bold text-lg">→</div>
        <div className="flex-1 min-w-[180px] grid grid-cols-3 gap-1.5">
          {['CA01', 'CA02', 'CA03', 'CA04', 'CA05', 'CA06'].map((s) => (
            <div
              key={s}
              className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] font-mono font-bold text-slate-600 text-center"
            >
              {s}
            </div>
          ))}
        </div>
      </div>
      <div className="text-xs text-slate-500 mt-3">
        <strong className="text-slate-700">108 peças</strong> criadas em segundos — uma por unidade, com
        medida, vidro e cor.
      </div>
    </div>
  )
}
