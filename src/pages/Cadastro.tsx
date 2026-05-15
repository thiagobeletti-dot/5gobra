// Cadastro do G Obra — dois fluxos:
//
//   A. Cadastro tradicional (sem token na URL)
//      Etapa 1: Dados (nome empresa, CNPJ?, telefone?, email, senha)
//      Etapa 2: Aceite contratual
//      Etapa 3: Confirmação
//
//   B. Cadastro pós-pagamento (com ?token=X na URL)
//      Cliente comprou pela landing, pagou, recebeu email com link.
//      Já temos email/nome do pre_cadastro — pede só senha + nome empresa
//      + CNPJ opcional + aceite. Chama ativar-pre-cadastro (que cria
//      empresa + assinatura ATIVA vinculada à subscription paga no Asaas).
//
// Os textos dos contratos vivem em src/lib/contratos.ts — fonte única de verdade.

import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { cadastrar, entrar } from '../lib/auth'
import { criarEmpresa, gravarAceite, hashSha256 } from '../lib/api'
import { enviarPdfsDeAceite } from '../lib/email-aceites'
import {
  ativarPreCadastro,
  buscarPreCadastroPorToken,
  type PreCadastroResumo,
} from '../lib/asaas'
import {
  TERMOS_VERSAO,
  PRIVACIDADE_VERSAO,
  DOC_TERMOS_USO,
  DOC_POLITICA_PRIVACIDADE,
} from '../lib/contratos'
import { trackPurchase, trackCompleteRegistration } from '../lib/meta-pixel'

type Etapa = 1 | 2 | 3

export default function Cadastro() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() || null

  const [etapa, setEtapa] = useState<Etapa>(1)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  // ===== Fluxo com token =====
  const [preCad, setPreCad] = useState<PreCadastroResumo | null>(null)
  const [carregandoToken, setCarregandoToken] = useState(!!token)
  const [tokenErro, setTokenErro] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let ativo = true
    setCarregandoToken(true)
    buscarPreCadastroPorToken(token)
      .then((dados) => {
        if (!ativo) return
        if (!dados) {
          setTokenErro('Link inválido ou expirado. Verifica o email que recebemos pagamento de.')
          setCarregandoToken(false)
          return
        }
        setPreCad(dados)
        setEmail(dados.email)
        setTelefone(dados.whatsapp ?? '')
        if (dados.status === 'convertido') {
          setTokenErro('Esse cadastro já foi concluído. Vai pra tela de login pra entrar com sua senha.')
        } else if (dados.status === 'aguardando_pagamento') {
          setTokenErro('Ainda não recebemos seu pagamento. Aguarde alguns minutos e recarregue a página.')
        } else if (dados.status === 'expirado') {
          setTokenErro('Esse link expirou. Refaz a compra na página inicial pra gerar um novo.')
        } else {
          // Status valido (pago, aguardando ativacao) — dispara Purchase no Pixel.
          // Idempotente: se a pagina recarregar, dados.status virara 'convertido' e nao dispara de novo.
          trackPurchase(349, 'BRL')
        }
        setCarregandoToken(false)
      })
      .catch(() => {
        if (!ativo) return
        setTokenErro('Não consegui carregar seus dados. Tenta de novo em alguns segundos.')
        setCarregandoToken(false)
      })
    return () => {
      ativo = false
    }
  }, [token])

  // =====================================================
  // Fluxo A — sem token (cadastro tradicional)
  // =====================================================

  function avancarParaEtapa2(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nomeEmpresa.trim()) return setErro('Informe o nome da empresa.')
    if (!email.trim()) return setErro('Informe o e-mail.')
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.')
    setEtapa(2)
  }

  async function aceitarEFinalizarFluxoA() {
    setErro(null)
    setInfo(null)
    if (!aceitouTermos) {
      return setErro('Voce precisa aceitar os Termos e a Politica de Privacidade pra continuar.')
    }
    setCarregando(true)
    try {
      const r = await cadastrar(email, senha)
      if (!r.session) {
        setInfo('Cadastro criado. Verifique seu e-mail pra confirmar a conta antes de entrar.')
        setCarregando(false)
        return
      }
      const empresa = await criarEmpresa(nomeEmpresa.trim(), {
        cnpj: cnpj.trim() || undefined,
        telefone: telefone.trim() || undefined,
      })
      await gravarAceitesEmpresa(empresa.id, email)
      enviarPdfsDeAceite(empresa.id).catch((err) => {
        console.warn('[cadastro] envio de PDFs falhou silenciosamente:', err)
      })
      // Dispara CompleteRegistration no Meta Pixel (fluxo A — sem token)
      trackCompleteRegistration()
      setEtapa(3)
    } catch (err: unknown) {
      setErro((err as { message?: string })?.message ?? 'Erro ao finalizar cadastro')
    } finally {
      setCarregando(false)
    }
  }

  // =====================================================
  // Fluxo B — com token (pós-pagamento)
  // =====================================================

  function avancarFluxoB(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nomeEmpresa.trim()) return setErro('Informe o nome da empresa.')
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.')
    setEtapa(2)
  }

  async function aceitarEFinalizarFluxoB() {
    setErro(null)
    setInfo(null)
    if (!aceitouTermos) {
      return setErro('Voce precisa aceitar os Termos e a Politica de Privacidade pra continuar.')
    }
    if (!token || !preCad) {
      return setErro('Token de cadastro inválido. Recarregue a página.')
    }
    setCarregando(true)
    try {
      // ===== Cria user + empresa + assinatura ativa via Edge Function =====
      const r = await ativarPreCadastro({
        token,
        senha,
        cnpj: cnpj.trim() || undefined,
        telefone: telefone.trim() || preCad.whatsapp || undefined,
        nome_empresa: nomeEmpresa.trim(),
      })
      if (!r.ok) {
        setErro(r.error ?? 'Não foi possível ativar seu cadastro.')
        setCarregando(false)
        return
      }
      // ===== Faz login (a Edge Function já confirmou o email) =====
      try {
        await entrar(preCad.email, senha)
      } catch (loginErr) {
        console.warn('[cadastro] signIn pós-ativação falhou:', loginErr)
        // Não é fatal — cliente pode entrar manualmente
      }
      // ===== Grava aceites (usando o user logado) =====
      if (r.empresa_id) {
        try {
          await gravarAceitesEmpresa(r.empresa_id, preCad.email)
          enviarPdfsDeAceite(r.empresa_id).catch((err) => {
            console.warn('[cadastro] envio de PDFs falhou silenciosamente:', err)
          })
        } catch (aceiteErr) {
          console.warn('[cadastro] gravacao de aceites falhou:', aceiteErr)
        }
      }
      // Dispara CompleteRegistration no Meta Pixel (fluxo B — pos-pagamento)
      trackCompleteRegistration()
      setEtapa(3)
    } catch (err: unknown) {
      setErro((err as { message?: string })?.message ?? 'Erro ao finalizar cadastro')
    } finally {
      setCarregando(false)
    }
  }

  async function gravarAceitesEmpresa(empresaId: string, emailAceite: string) {
    const hashTermos = await hashSha256(DOC_TERMOS_USO)
    const hashPriv = await hashSha256(DOC_POLITICA_PRIVACIDADE)
    await Promise.all([
      gravarAceite({
        tipo: 'termos_uso',
        documentoVersao: TERMOS_VERSAO,
        documentoHash: hashTermos,
        documentoSnapshot: { texto: DOC_TERMOS_USO, versao: TERMOS_VERSAO },
        empresaId,
        contatoTipo: 'admin_empresa',
        contatoIdentificador: emailAceite,
      }),
      gravarAceite({
        tipo: 'politica_privacidade',
        documentoVersao: PRIVACIDADE_VERSAO,
        documentoHash: hashPriv,
        documentoSnapshot: { texto: DOC_POLITICA_PRIVACIDADE, versao: PRIVACIDADE_VERSAO },
        empresaId,
        contatoTipo: 'admin_empresa',
        contatoIdentificador: emailAceite,
      }),
    ])
  }

  // =====================================================
  // Render
  // =====================================================

  const fluxoB = !!token

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-8">
          <Link to="/"><LogoFull /></Link>
        </div>

        <div className="flex items-center justify-center mb-6 gap-2 text-xs text-slate-500">
          <EtapaPip ativa={etapa >= 1} numero={1} label="Dados" />
          <div className="w-8 h-px bg-slate-300" />
          <EtapaPip ativa={etapa >= 2} numero={2} label="Aceite" />
          <div className="w-8 h-px bg-slate-300" />
          <EtapaPip ativa={etapa >= 3} numero={3} label="Pronto" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
          {/* Fluxo B: enquanto valida token */}
          {fluxoB && carregandoToken && (
            <div className="text-center py-8">
              <div className="text-sm text-slate-500">Carregando seus dados...</div>
            </div>
          )}

          {fluxoB && !carregandoToken && tokenErro && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠</div>
              <h1 className="text-lg font-bold mb-2">Não consegui ativar agora</h1>
              <p className="text-sm text-slate-600 mb-5">{tokenErro}</p>
              <Link to="/" className="btn-ghost text-sm">Voltar pra página inicial</Link>
            </div>
          )}

          {/* Etapa 1 */}
          {(!fluxoB || (fluxoB && !carregandoToken && !tokenErro && preCad)) && etapa === 1 && (
            <>
              {fluxoB && preCad ? (
                <>
                  <h1 className="text-xl font-bold mb-1">Pagamento confirmado, {preCad.nome_completo.split(/\s+/)[0]}!</h1>
                  <p className="text-sm text-slate-500 mb-6">
                    Falta só criar sua senha de acesso e o nome da empresa. Vamos lá.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold mb-1">Criar conta da empresa</h1>
                  <p className="text-sm text-slate-500 mb-6">
                    Comecemos pelos dados basicos. Em seguida voce le e aceita os contratos.
                  </p>
                </>
              )}

              <form onSubmit={fluxoB ? avancarFluxoB : avancarParaEtapa2} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Nome da empresa <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input className="input" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Esquadrias 5G" autoFocus required aria-required="true" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      CNPJ <span className="text-slate-400 font-normal normal-case">(opcional)</span>
                    </label>
                    <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Telefone {fluxoB ? '' : <span className="text-slate-400 font-normal normal-case">(opcional)</span>}
                    </label>
                    <input type="tel" inputMode="tel" autoComplete="tel" className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Seu e-mail <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    aria-required="true"
                    autoComplete="email"
                    disabled={fluxoB}
                  />
                  {fluxoB && (
                    <p className="text-xs text-slate-500 mt-1">
                      Email da compra — não pode ser alterado aqui.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Senha <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" required aria-required="true" autoComplete="new-password" />
                </div>

                {erro && <div className="text-sm text-red-600">{erro}</div>}
                <button type="submit" className="btn-primary w-full">Continuar — ler contratos</button>
              </form>

              {!fluxoB && (
                <div className="mt-5 pt-5 border-t border-slate-200 text-center text-sm">
                  <Link to="/login" className="text-slate-500 hover:text-slate-900">Ja tenho conta — entrar</Link>
                </div>
              )}
            </>
          )}

          {/* Etapa 2 */}
          {(!fluxoB || (fluxoB && !carregandoToken && !tokenErro && preCad)) && etapa === 2 && (
            <>
              <h1 className="text-xl font-bold mb-1">Termos e Privacidade</h1>
              <p className="text-sm text-slate-500 mb-5">
                Le abaixo os dois documentos. Pra continuar, marca o checkbox de aceite e clica em "Aceitar e criar conta". Voce sempre pode reler em <Link to="/termos" className="text-laranja-dark hover:underline" target="_blank">5gobra.com.br/termos</Link> e <Link to="/privacidade" className="text-laranja-dark hover:underline" target="_blank">/privacidade</Link>.
              </p>
              <DocumentoBox titulo="Termos de Uso" texto={DOC_TERMOS_USO} versao={TERMOS_VERSAO} />
              <DocumentoBox titulo="Politica de Privacidade" texto={DOC_POLITICA_PRIVACIDADE} versao={PRIVACIDADE_VERSAO} />
              <div className="mt-5 mb-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span className="text-sm text-slate-700">
                    Li e aceito os <strong>Termos de Uso</strong> e a <strong>Politica de Privacidade</strong> do G Obra acima.
                  </span>
                </label>
              </div>
              {erro && <div className="text-sm text-red-600 mt-2">{erro}</div>}
              {info && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mt-2">{info}</div>}
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setEtapa(1)} className="btn-ghost" disabled={carregando}>Voltar</button>
                <button
                  type="button"
                  onClick={fluxoB ? aceitarEFinalizarFluxoB : aceitarEFinalizarFluxoA}
                  className="btn-primary flex-1"
                  disabled={!aceitouTermos || carregando}
                >
                  {carregando ? (fluxoB ? 'Ativando seu acesso...' : 'Criando conta...') : 'Aceitar e criar conta'}
                </button>
              </div>
            </>
          )}

          {/* Etapa 3 */}
          {etapa === 3 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">✓</div>
              <h1 className="text-xl font-bold mb-2">Conta criada!</h1>
              <p className="text-sm text-slate-600 mb-2">
                Bem-vindo ao G Obra. Vamos criar tua primeira obra.
              </p>
              <p className="text-xs text-slate-500 mb-6">
                Em alguns minutos voce vai receber em <strong>{email}</strong> uma copia em PDF dos contratos aceitos, com cabecalho de auditoria (data, hora, IP, hash). Se nao chegar, da pra reenviar em <em>Configuracoes → Contratos aceitos</em>.
              </p>
              <button onClick={() => navigate('/app/obras')} className="btn-primary w-full">Entrar no sistema</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EtapaPip({ ativa, numero, label }: { ativa: boolean; numero: number; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${ativa ? 'text-laranja-dark' : 'text-slate-400'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ativa ? 'bg-laranja text-white' : 'bg-slate-200 text-slate-500'}`}>{numero}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

function DocumentoBox({ titulo, texto, versao }: { titulo: string; texto: string; versao: string }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-sm text-slate-800">{titulo}</span>
        <span className="text-[10px] text-slate-500 font-mono">v{versao}</span>
      </div>
      <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed p-4 max-h-56 overflow-y-auto bg-white font-sans">{texto}</pre>
    </div>
  )
}
