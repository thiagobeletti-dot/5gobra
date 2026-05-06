// Cadastro do G Obra — fluxo em 3 etapas (Phase 9, atualizado 06/05/2026)
//
//   Etapa 1: Dados basicos (nome empresa, CNPJ opcional, telefone opcional, e-mail, senha)
//   Etapa 2: Aceite contratual obrigatorio (Termos de Uso v1.0 + Politica de Privacidade v1.0)
//   Etapa 3: Confirmacao + criacao da conta + redirecionamento
//
// Os textos dos contratos vivem em src/lib/contratos.ts — fonte unica de verdade
// usada tambem em /termos e /privacidade publicas.

import { Link, useNavigate } from 'react-router-dom'
import { useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { cadastrar } from '../lib/auth'
import { criarEmpresa, gravarAceite, hashSha256 } from '../lib/api'
import { enviarPdfsDeAceite } from '../lib/email-aceites'
import {
  TERMOS_VERSAO,
  PRIVACIDADE_VERSAO,
  DOC_TERMOS_USO,
  DOC_POLITICA_PRIVACIDADE,
} from '../lib/contratos'

type Etapa = 1 | 2 | 3

export default function Cadastro() {
  const navigate = useNavigate()

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

  function avancarParaEtapa2(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nomeEmpresa.trim()) return setErro('Informe o nome da empresa.')
    if (!email.trim()) return setErro('Informe o e-mail.')
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.')
    setEtapa(2)
  }

  async function aceitarEFinalizar() {
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
      const empresa = await criarEmpresa(nomeEmpresa.trim(), { cnpj: cnpj.trim() || undefined, telefone: telefone.trim() || undefined })
      const hashTermos = await hashSha256(DOC_TERMOS_USO)
      const hashPriv = await hashSha256(DOC_POLITICA_PRIVACIDADE)
      await Promise.all([
        gravarAceite({
          tipo: 'termos_uso',
          documentoVersao: TERMOS_VERSAO,
          documentoHash: hashTermos,
          documentoSnapshot: { texto: DOC_TERMOS_USO, versao: TERMOS_VERSAO },
          empresaId: empresa.id,
          contatoTipo: 'admin_empresa',
          contatoIdentificador: email,
        }),
        gravarAceite({
          tipo: 'politica_privacidade',
          documentoVersao: PRIVACIDADE_VERSAO,
          documentoHash: hashPriv,
          documentoSnapshot: { texto: DOC_POLITICA_PRIVACIDADE, versao: PRIVACIDADE_VERSAO },
          empresaId: empresa.id,
          contatoTipo: 'admin_empresa',
          contatoIdentificador: email,
        }),
      ])
      // Dispara envio dos PDFs por e-mail em background (fire-and-forget).
      // Se a edge function nao estiver deployada ou der erro, nao bloqueia
      // a UX do cadastro — o usuario pode reenviar depois em /app/configuracoes.
      enviarPdfsDeAceite(empresa.id).catch((err) => {
        console.warn('[cadastro] envio de PDFs falhou silenciosamente:', err)
      })
      setEtapa(3)
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao finalizar cadastro')
    } finally {
      setCarregando(false)
    }
  }

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
          {etapa === 1 && (
            <>
              <h1 className="text-xl font-bold mb-1">Criar conta da empresa</h1>
              <p className="text-sm text-slate-500 mb-6">
                Comecemos pelos dados basicos. Em seguida voce le e aceita os contratos.
              </p>
              <form onSubmit={avancarParaEtapa2} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome da empresa</label>
                  <input className="input" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Esquadrias 5G" autoFocus required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">CNPJ (opcional)</label>
                    <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Telefone (opcional)</label>
                    <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Seu e-mail</label>
                  <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Senha</label>
                  <input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="minimo 6 caracteres" required />
                </div>
                {erro && <div className="text-sm text-red-600">{erro}</div>}
                <button type="submit" className="btn-primary w-full">Continuar — ler contratos</button>
              </form>
              <div className="mt-5 pt-5 border-t border-slate-200 text-center text-sm">
                <Link to="/login" className="text-slate-500 hover:text-slate-900">Ja tenho conta — entrar</Link>
              </div>
            </>
          )}

          {etapa === 2 && (
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
                <button type="button" onClick={aceitarEFinalizar} className="btn-primary flex-1" disabled={!aceitouTermos || carregando}>
                  {carregando ? 'Criando conta...' : 'Aceitar e criar conta'}
                </button>
              </div>
            </>
          )}

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
