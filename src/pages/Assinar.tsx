// Assinar — tela de conversão do trial pra pago (e paywall do dia 15).
//
// Dois modos, mesma tela:
//   - bloqueado=true  → RotaProtegida renderiza ESTA tela no lugar do app
//                       quando minha_situacao().acesso = false (trial vencido,
//                       suspenso ou cancelado). A pessoa não vê obra nenhuma.
//   - bloqueado=false → rota /app/assinar, aberta pelo "Assinar agora" do
//                       BannerTrial durante os 14 dias.
//
// O botão abre o checkout do Asaas direto (criar-assinatura-asaas, a mesma
// função do "Ativar plano" em Configurações). WhatsApp é a saída secundária —
// estratégia rep-free: ninguém precisa falar com ninguém pra pagar.
//
// CNPJ/CPF é pedido AQUI (na conversão), não no trial — decisão 31/08.
// Cravado 02/09/2026.

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, sair } from '../lib/auth'
import { LogoFull } from '../lib/logo'
import { pegarMinhaEmpresa, atualizarMinhaEmpresa, type Situacao } from '../lib/api'
import { ativarAssinatura, pegarMinhaAssinatura, type AssinaturaRow } from '../lib/asaas'
import { mensagemDeErro } from '../lib/erros'

const WHATSAPP_LINK =
  'https://wa.me/5511933969913?text=' +
  encodeURIComponent('Olá! Estou assinando o G Obra e preciso de ajuda com o pagamento.')

interface Props {
  situacao: Situacao | null
  bloqueado?: boolean
}

export default function Assinar({ situacao, bloqueado = false }: Props) {
  const { user } = useAuth()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [assinatura, setAssinatura] = useState<AssinaturaRow | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [faturaUrl, setFaturaUrl] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const [emp, ass] = await Promise.all([pegarMinhaEmpresa(), pegarMinhaAssinatura()])
        if (!ativo) return
        if (emp) {
          setEmpresaId(emp.id)
          setNomeEmpresa(emp.nome ?? '')
          setCnpj((emp as { cnpj?: string }).cnpj ?? '')
          setTelefone((emp as { telefone?: string }).telefone ?? '')
        }
        setAssinatura(ass)
        // Já tem fatura em aberto (criou e não pagou): mostra o link direto.
        if (ass && (ass.status === 'pendente' || ass.status === 'atrasada') && ass.fatura_atual_url) {
          setFaturaUrl(ass.fatura_atual_url)
        }
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  async function assinar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!empresaId || !user?.email) {
      setErro('Não consegui identificar sua empresa. Saia e entre de novo.')
      return
    }
    const doc = cnpj.replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 14) {
      setErro('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }
    if (nomeEmpresa.trim().length < 2) {
      setErro('Informe o nome da empresa.')
      return
    }
    setEnviando(true)
    try {
      // Guarda CNPJ/telefone na empresa (best-effort — o que importa é o Asaas).
      try {
        await atualizarMinhaEmpresa({ nome: nomeEmpresa.trim(), cnpj: doc, telefone: telefone || undefined })
      } catch (err) {
        console.warn('[assinar] não salvou dados da empresa:', err)
      }
      const r = await ativarAssinatura({
        empresaId,
        cpfCnpj: doc,
        nomeCompleto: nomeEmpresa.trim(),
        email: user.email,
        telefone: telefone || undefined,
      })
      if (!r.ok) {
        setErro(r.error ?? 'Não consegui criar sua assinatura. Tenta de novo.')
        return
      }
      const ass = await pegarMinhaAssinatura()
      setAssinatura(ass)
      const url = r.invoiceUrl ?? ass?.fatura_atual_url ?? null
      if (url) {
        setFaturaUrl(url)
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setErro('Assinatura criada, mas não recebi o link de pagamento. Atualize a página.')
      }
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  const status = situacao?.status ?? 'trial'
  const titulo = !bloqueado
    ? 'Garanta seu acesso ao G Obra'
    : status === 'suspenso'
    ? 'Sua assinatura está suspensa'
    : status === 'cancelado'
    ? 'Sua assinatura foi cancelada'
    : 'Seus 14 dias de teste acabaram'

  const subtitulo = !bloqueado
    ? `Faltam ${situacao?.diasRestantes ?? 0} ${situacao?.diasRestantes === 1 ? 'dia' : 'dias'} do seu teste. Assine agora e não perca o ritmo.`
    : status === 'suspenso' || status === 'cancelado'
    ? 'Regularize o pagamento pra voltar a acessar suas obras. Nada foi apagado.'
    : 'Suas obras, peças e fotos ficam guardadas por 30 dias. Assine pra continuar exatamente de onde parou.'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 md:px-7 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {bloqueado ? <LogoFull small /> : <Link to="/app/obras"><LogoFull small /></Link>}
          <div className="flex items-center gap-3 text-sm">
            {!bloqueado && (
              <Link to="/app/obras" className="text-slate-500 hover:text-slate-900">Voltar pro app</Link>
            )}
            <button type="button" onClick={() => void sair()} className="text-slate-500 hover:text-slate-900">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
            <p className="mt-2 text-slate-600">{subtitulo}</p>

            <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-800">G Obra</span>
                <span className="text-slate-900">
                  <span className="text-2xl font-bold">R$ 349</span>
                  <span className="text-slate-500 text-sm">/mês</span>
                </span>
              </div>
              <ul className="mt-3 text-sm text-slate-600 space-y-1">
                <li>Usuários, obras e fotos sem limite</li>
                <li>Sem fidelidade, cancela quando quiser</li>
                <li>G Instalação incluso, sem custo</li>
                <li>14 dias de garantia com devolução no Pix</li>
              </ul>
            </div>

            {carregando ? (
              <p className="mt-6 text-sm text-slate-500">Carregando...</p>
            ) : faturaUrl ? (
              <div className="mt-6">
                <p className="text-sm text-slate-700">
                  Sua fatura está pronta. Pague por Pix, boleto ou cartão. Assim que o pagamento
                  confirmar, o acesso libera sozinho.
                </p>
                <a
                  href={faturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full mt-4"
                >
                  Abrir página de pagamento
                </a>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-ghost w-full mt-2"
                >
                  Já paguei, atualizar
                </button>
                {assinatura?.status === 'pendente' && (
                  <p className="mt-3 text-xs text-slate-500">
                    Aguardando confirmação do primeiro pagamento.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={assinar} className="mt-6 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa</label>
                  <input
                    className="input"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder="Razão social ou nome fantasia"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CNPJ ou CPF</label>
                  <input
                    className="input"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-400">Vai na nota fiscal e na cobrança.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone (opcional)</label>
                  <input
                    className="input"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                  />
                </div>
                {erro && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</p>
                )}
                <button type="submit" className="btn-primary w-full" disabled={enviando || !empresaId}>
                  {enviando ? 'Gerando cobrança...' : 'Assinar por R$ 349/mês'}
                </button>
                <p className="text-xs text-slate-400 text-center">
                  Pagamento pelo Asaas: Pix, boleto ou cartão. Acesso libera na confirmação.
                </p>
              </form>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Ficou com dúvida?{' '}
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">
              Fala com a gente no WhatsApp
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
