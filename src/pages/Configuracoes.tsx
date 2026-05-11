// Pagina de Configuracoes do G Obra — rota /app/configuracoes
//
// 4 blocos:
//   1. Dados da empresa (nome, CNPJ, telefone) — editaveis com botao Salvar
//   2. Trocar senha — Supabase Auth updateUser
//   3. Plano e cobrança — assinatura Asaas (status, próximo vencimento, ativar/pagar)
//   4. Contratos aceitos — lista da tabela aceites com expandir pra ver texto

import { useEffect, useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import {
  pegarMinhaEmpresa,
  atualizarMinhaEmpresa,
  trocarSenha,
  listarMeusAceites,
  uploadLogoEmpresa,
  atualizarLogoEmpresa,
  type AceiteRow,
} from '../lib/api'
import { enviarPdfsDeAceite } from '../lib/email-aceites'
import {
  pegarMinhaAssinatura,
  ativarAssinatura,
  rotuloStatus,
  type AssinaturaRow,
} from '../lib/asaas'

export default function Configuracoes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const fromObra = (location.state as { fromObra?: string; fromObraNome?: string } | null)?.fromObra
  const fromObraNome = (location.state as { fromObra?: string; fromObraNome?: string } | null)?.fromObraNome

  // Bloco 1: Dados da empresa
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [salvandoLogo, setSalvandoLogo] = useState(false)
  const [msgLogo, setMsgLogo] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)
  const [msgEmpresa, setMsgEmpresa] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Bloco 2: Trocar senha
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Bloco 3: Plano e cobrança (Asaas)
  const [assinatura, setAssinatura] = useState<AssinaturaRow | null>(null)
  const [carregandoAssinatura, setCarregandoAssinatura] = useState(true)
  const [ativandoPlano, setAtivandoPlano] = useState(false)
  const [msgPlano, setMsgPlano] = useState<{ tipo: 'ok' | 'erro' | 'aviso'; texto: string } | null>(null)

  // Bloco 4: Contratos aceitos
  const [aceites, setAceites] = useState<AceiteRow[]>([])
  const [aceiteAberto, setAceiteAberto] = useState<string | null>(null)
  const [reenviando, setReenviando] = useState(false)
  const [msgReenvio, setMsgReenvio] = useState<{ tipo: 'ok' | 'erro' | 'aviso'; texto: string } | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const e = await pegarMinhaEmpresa()
      if (ativo && e) {
        setEmpresaId(e.id)
        setNomeEmpresa(e.nome ?? '')
        setCnpj((e as { cnpj?: string }).cnpj ?? '')
        setTelefone((e as { telefone?: string }).telefone ?? '')
        setLogoUrl((e as { logo_url?: string | null }).logo_url ?? null)
      }
      const lista = await listarMeusAceites()
      if (ativo) setAceites(lista)
      const ass = await pegarMinhaAssinatura()
      if (ativo) {
        setAssinatura(ass)
        setCarregandoAssinatura(false)
      }
    })()
    return () => { ativo = false }
  }, [])

  async function logout() {
    await sair()
    navigate('/')
  }

  async function salvarEmpresa(e: FormEvent) {
    e.preventDefault()
    setMsgEmpresa(null)
    if (!nomeEmpresa.trim()) {
      setMsgEmpresa({ tipo: 'erro', texto: 'O nome da empresa e obrigatorio.' })
      return
    }
    setSalvandoEmpresa(true)
    try {
      await atualizarMinhaEmpresa({
        nome: nomeEmpresa.trim(),
        cnpj: cnpj.trim() || undefined,
        telefone: telefone.trim() || undefined,
      })
      setMsgEmpresa({ tipo: 'ok', texto: 'Dados atualizados com sucesso.' })
    } catch (err: any) {
      setMsgEmpresa({ tipo: 'erro', texto: err?.message ?? 'Erro ao salvar.' })
    } finally {
      setSalvandoEmpresa(false)
    }
  }

  async function uploadLogo(arquivo: File) {
    setMsgLogo(null)
    if (!arquivo.type.startsWith('image/')) {
      setMsgLogo({ tipo: 'erro', texto: 'Selecione um arquivo de imagem (PNG ou JPG).' })
      return
    }
    // Limite 2MB pra logo (suficiente pra qualidade boa em PDF)
    if (arquivo.size > 2 * 1024 * 1024) {
      setMsgLogo({ tipo: 'erro', texto: 'Logo muito grande. Máximo 2MB.' })
      return
    }
    setSalvandoLogo(true)
    try {
      const url = await uploadLogoEmpresa(arquivo)
      await atualizarLogoEmpresa(url)
      setLogoUrl(url)
      setMsgLogo({ tipo: 'ok', texto: 'Logo atualizado. Vai aparecer nos próximos PDFs gerados.' })
    } catch (err: any) {
      setMsgLogo({ tipo: 'erro', texto: err?.message ?? 'Erro ao enviar logo.' })
    } finally {
      setSalvandoLogo(false)
    }
  }

  async function removerLogo() {
    setMsgLogo(null)
    if (!window.confirm('Remover o logo da empresa? Os PDFs voltam a sair sem ele.')) return
    setSalvandoLogo(true)
    try {
      await atualizarLogoEmpresa(null)
      setLogoUrl(null)
      setMsgLogo({ tipo: 'ok', texto: 'Logo removido.' })
    } catch (err: any) {
      setMsgLogo({ tipo: 'erro', texto: err?.message ?? 'Erro ao remover logo.' })
    } finally {
      setSalvandoLogo(false)
    }
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault()
    setMsgSenha(null)
    if (senhaNova.length < 6) {
      setMsgSenha({ tipo: 'erro', texto: 'A senha precisa de pelo menos 6 caracteres.' })
      return
    }
    if (senhaNova !== senhaConfirma) {
      setMsgSenha({ tipo: 'erro', texto: 'As senhas nao conferem.' })
      return
    }
    setSalvandoSenha(true)
    try {
      await trocarSenha(senhaNova)
      setSenhaNova('')
      setSenhaConfirma('')
      setMsgSenha({ tipo: 'ok', texto: 'Senha trocada com sucesso.' })
    } catch (err: any) {
      setMsgSenha({ tipo: 'erro', texto: err?.message ?? 'Erro ao trocar senha.' })
    } finally {
      setSalvandoSenha(false)
    }
  }

  async function ativarPlano(e: FormEvent) {
    e.preventDefault()
    if (!empresaId) return
    if (!nomeEmpresa.trim() || !cnpj.trim()) {
      setMsgPlano({ tipo: 'erro', texto: 'Preenche e salve nome e CNPJ no bloco 1 antes de ativar o plano.' })
      return
    }
    if (!user?.email) {
      setMsgPlano({ tipo: 'erro', texto: 'E-mail do administrador nao disponivel.' })
      return
    }
    setAtivandoPlano(true)
    setMsgPlano(null)
    try {
      const r = await ativarAssinatura({
        empresaId,
        cpfCnpj: cnpj,
        nomeCompleto: nomeEmpresa,
        email: user.email,
        telefone: telefone || undefined,
      })
      if (!r.ok) {
        setMsgPlano({ tipo: 'erro', texto: r.error ?? 'Erro ao ativar plano' })
        return
      }
      // Recarrega assinatura do banco e redireciona pro pagamento
      const ass = await pegarMinhaAssinatura()
      setAssinatura(ass)
      if (r.invoiceUrl) {
        window.open(r.invoiceUrl, '_blank', 'noopener,noreferrer')
        setMsgPlano({ tipo: 'ok', texto: 'Pagina de pagamento aberta em nova aba. Concluido o pagamento, o plano fica ativo automaticamente.' })
      } else {
        setMsgPlano({ tipo: 'aviso', texto: 'Assinatura criada, mas nao consegui obter o link de pagamento. Atualize a pagina.' })
      }
    } catch (err) {
      setMsgPlano({ tipo: 'erro', texto: (err as { message?: string })?.message ?? 'Erro inesperado' })
    } finally {
      setAtivandoPlano(false)
    }
  }

  async function reenviarPdfs() {
    if (!empresaId) return
    setReenviando(true)
    setMsgReenvio(null)
    try {
      const r = await enviarPdfsDeAceite(empresaId, true)
      if (!r.ok) {
        setMsgReenvio({ tipo: 'erro', texto: r.error ?? 'Erro ao reenviar' })
      } else if (r.dryRun) {
        setMsgReenvio({ tipo: 'aviso', texto: 'PDFs gerados em modo de teste — Resend ainda não foi configurado pelo administrador. Avise o suporte.' })
      } else {
        setMsgReenvio({ tipo: 'ok', texto: `PDFs reenviados pra ${r.destinatario}. Verifique a caixa de entrada (e o spam).` })
      }
    } catch (err: any) {
      setMsgReenvio({ tipo: 'erro', texto: err?.message ?? 'Erro inesperado' })
    } finally {
      setReenviando(false)
    }
  }

  function tituloAceite(tipo: string): string {
    const mapa: Record<string, string> = {
      termos_uso: 'Termos de Uso',
      politica_privacidade: 'Politica de Privacidade',
      aceite_final_obra: 'Aceite final de obra',
      mudanca_tipologia: 'Mudanca de tipologia',
      acordo_card: 'Acordo de item',
      liberacao_obra: 'Liberacao da obra',
      outro: 'Outro',
    }
    return mapa[tipo] ?? tipo
  }

  function formatarData(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function formatarDataPtBr(yyyymmdd: string): string {
    if (!yyyymmdd) return '-'
    const [y, m, d] = yyyymmdd.split('-')
    return d + '/' + m + '/' + y
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/app/obras"><LogoFull /></Link>
          <div className="flex items-center gap-4">
            {fromObra && (
              <Link to={`/app/obra/${fromObra}`} className="text-sm text-laranja-dark hover:text-laranja font-semibold inline-flex items-center gap-1">
                ← Voltar pra obra{fromObraNome ? ` "${fromObraNome}"` : ''}
              </Link>
            )}
            <Link to="/app/obras" className="text-sm text-slate-500 hover:text-slate-900">Obras</Link>
            <Link to="/app/ajuda" className="text-sm text-slate-500 hover:text-slate-900">Ajuda</Link>
            <span className="text-sm text-slate-500 hidden md:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Configurações</h1>
        <p className="text-sm text-slate-500 mb-10">
          Dados da empresa, troca de senha e contratos que você aceitou.
        </p>

        {/* Bloco 1: Dados da empresa */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">1. Dados da empresa</h2>
          <form onSubmit={salvarEmpresa} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome da empresa</label>
              <input className="input" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">CNPJ</label>
                <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Telefone</label>
                <input type="tel" inputMode="tel" autoComplete="tel" className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            {msgEmpresa && (
              <div className={msgEmpresa.tipo === 'ok'
                ? 'text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2'
                : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'}>
                {msgEmpresa.texto}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={salvandoEmpresa}>
              {salvandoEmpresa ? 'Salvando...' : 'Salvar dados'}
            </button>
          </form>

          {/* Logo da empresa — aparece no header dos PDFs gerados */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
            <h3 className="font-semibold text-sm mb-2">Logo da empresa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Faz parte da identidade visual dos PDFs (Ficha de Medição e Dossiê). PNG ou JPG, máximo 2MB.
            </p>
            <div className="flex items-start gap-4 flex-wrap">
              {logoUrl ? (
                <div className="flex-shrink-0">
                  <img src={logoUrl} alt="Logo da empresa" className="max-w-[160px] max-h-[120px] border border-slate-200 rounded-md p-2 bg-white" />
                </div>
              ) : (
                <div className="w-32 h-24 flex-shrink-0 border border-dashed border-slate-300 rounded-md grid place-items-center text-xs text-slate-400">
                  Sem logo
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <label className="btn-ghost text-sm cursor-pointer inline-block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={salvandoLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadLogo(f)
                      e.target.value = ''
                    }}
                  />
                  {salvandoLogo ? 'Enviando...' : (logoUrl ? 'Trocar logo' : 'Enviar logo')}
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={removerLogo}
                    disabled={salvandoLogo}
                    className="btn-ghost text-sm text-red-600 hover:text-red-700 ml-2"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
            {msgLogo && (
              <div className={'mt-3 text-sm rounded-md px-3 py-2 ' + (msgLogo.tipo === 'ok'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : 'text-red-700 bg-red-50 border border-red-200')}>
                {msgLogo.texto}
              </div>
            )}
          </div>
        </section>

        {/* Bloco 2: Trocar senha */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">2. Trocar senha</h2>
          <form onSubmit={salvarSenha} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nova senha</label>
              <input type="password" className="input" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} placeholder="mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Confirme a nova senha</label>
              <input type="password" className="input" value={senhaConfirma} onChange={(e) => setSenhaConfirma(e.target.value)} placeholder="repita a senha" />
            </div>
            {msgSenha && (
              <div className={msgSenha.tipo === 'ok'
                ? 'text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2'
                : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2'}>
                {msgSenha.texto}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={salvandoSenha || !senhaNova}>
              {salvandoSenha ? 'Trocando...' : 'Trocar senha'}
            </button>
          </form>
        </section>

        {/* Bloco 3: Plano e cobrança (Asaas) */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">3. Plano e cobrança</h2>
          {carregandoAssinatura ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
              Carregando dados do plano...
            </div>
          ) : assinatura?.status === 'ativa' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">{rotuloStatus(assinatura.status)}</span>
              </div>
              <p className="text-sm text-emerald-900 mb-1">
                Plano G Obra mensal: <strong>R$ {(assinatura.valor_centavos / 100).toFixed(2).replace('.', ',')}</strong>
              </p>
              {assinatura.proximo_vencimento && (
                <p className="text-xs text-emerald-800">
                  Próximo vencimento: {formatarDataPtBr(assinatura.proximo_vencimento)}
                </p>
              )}
              {assinatura.fatura_atual_url && (
                <a
                  href={assinatura.fatura_atual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-emerald-700 hover:text-emerald-900 underline"
                >
                  Ver fatura atual no Asaas →
                </a>
              )}
            </div>
          ) : assinatura?.status === 'pendente' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">{rotuloStatus(assinatura.status)}</span>
              </div>
              <p className="text-sm text-amber-900 mb-3">
                Sua assinatura foi criada mas ainda não recebemos a confirmação do primeiro pagamento. Pague pelo link abaixo pra liberar o sistema.
              </p>
              {assinatura.fatura_atual_url && (
                <a
                  href={assinatura.fatura_atual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm inline-block"
                >
                  Pagar agora →
                </a>
              )}
            </div>
          ) : assinatura?.status === 'atrasada' ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">{rotuloStatus(assinatura.status)}</span>
              </div>
              <p className="text-sm text-red-900 mb-3">
                Sua fatura está vencida. Você ainda tem acesso por mais alguns dias, mas regularize pra evitar bloqueio.
              </p>
              {assinatura.fatura_atual_url && (
                <a
                  href={assinatura.fatura_atual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm inline-block"
                >
                  Pagar agora →
                </a>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-sm text-slate-700 mb-1">
                Plano G Obra mensal: <strong>R$ 349,00</strong>
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Sem fidelidade. Garantia incondicional de 14 dias com reembolso integral. Cartão, boleto ou PIX.
              </p>
              <form onSubmit={ativarPlano}>
                <button type="submit" className="btn-primary text-sm" disabled={ativandoPlano || !empresaId || !cnpj.trim()}>
                  {ativandoPlano ? 'Criando assinatura...' : 'Ativar plano'}
                </button>
                {!cnpj.trim() && (
                  <p className="text-xs text-amber-700 mt-2">⚠ Preencha CNPJ no bloco 1 e salve antes de ativar o plano.</p>
                )}
              </form>
            </div>
          )}
          {msgPlano && (
            <div
              className={
                'mt-4 text-sm rounded-md px-3 py-2 ' +
                (msgPlano.tipo === 'ok'
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : msgPlano.tipo === 'aviso'
                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                    : 'text-red-700 bg-red-50 border border-red-200')
              }
            >
              {msgPlano.texto}
            </div>
          )}
        </section>

        {/* Bloco 4: Contratos aceitos */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">4. Contratos aceitos</h2>
          <p className="text-sm text-slate-500 mb-4">
            Histórico de tudo que você aceitou no sistema. Cada aceite tem data, hora, IP e hash do documento — prova jurídica.
          </p>
          {aceites.some((a) => a.tipo === 'termos_uso' || a.tipo === 'politica_privacidade') && (
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-slate-600">
                Quer uma cópia em PDF dos seus contratos por e-mail?
              </div>
              <button
                onClick={reenviarPdfs}
                disabled={reenviando || !empresaId}
                className="btn-ghost text-xs whitespace-nowrap"
              >
                {reenviando ? 'Gerando...' : 'Reenviar PDFs por e-mail'}
              </button>
            </div>
          )}
          {msgReenvio && (
            <div
              className={
                'mb-4 text-sm rounded-md px-3 py-2 ' +
                (msgReenvio.tipo === 'ok'
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : msgReenvio.tipo === 'aviso'
                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                    : 'text-red-700 bg-red-50 border border-red-200')
              }
            >
              {msgReenvio.texto}
            </div>
          )}
          {aceites.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
              Nenhum aceite registrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {aceites.map((a) => {
                const aberto = aceiteAberto === a.id
                return (
                  <div key={a.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setAceiteAberto(aberto ? null : a.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{tituloAceite(a.tipo)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Aceito em {formatarData(a.created_at)} · v{a.documento_versao}
                          {a.ip ? ` · IP ${a.ip}` : ''}
                        </div>
                      </div>
                      <span className={'text-slate-400 transition-transform flex-shrink-0 ' + (aberto ? 'rotate-180' : '')}>▼</span>
                    </button>
                    {aberto && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-200 bg-slate-50">
                        <div className="text-[10px] font-mono text-slate-500 mb-3 break-all">
                          Hash: {a.documento_hash}
                        </div>
                        {a.documento_snapshot?.texto ? (
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded p-4 max-h-64 overflow-y-auto font-sans">
                            {a.documento_snapshot.texto}
                          </pre>
                        ) : (
                          <div className="text-xs text-slate-500 italic">Sem snapshot do texto disponível pra esse aceite.</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
