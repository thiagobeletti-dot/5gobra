// Cadastro do G Obra — fluxo em 3 etapas (Phase 9, 05/05/2026)
//
//   Etapa 1: Dados basicos (nome empresa, e-mail, senha)
//   Etapa 2: Aceite contratual obrigatorio (Termos de Uso + Politica de Privacidade)
//   Etapa 3: Confirmacao + criacao da conta + redirecionamento
//
// IMPORTANTE: os textos contratuais aqui sao PLACEHOLDERS. A versao final
// vai ser redigida por advogado especializado em direito digital. Quando
// chegarem os textos finais:
//   - substituir DOC_TERMOS_USO e DOC_POLITICA_PRIVACIDADE
//   - bumpar TERMOS_VERSAO e PRIVACIDADE_VERSAO
//   - o hash recalcula automaticamente

import { Link, useNavigate } from 'react-router-dom'
import { useState, FormEvent } from 'react'
import { LogoFull } from '../lib/logo'
import { cadastrar } from '../lib/auth'
import { criarEmpresa, gravarAceite, hashSha256 } from '../lib/api'

const TERMOS_VERSAO = '1.0-placeholder'
const PRIVACIDADE_VERSAO = '1.0-placeholder'

const DOC_TERMOS_USO = `TERMOS DE USO DO G OBRA — versao ${TERMOS_VERSAO}

[ATENCAO: documento provisorio. Sera substituido por versao redigida por advogado.]

1. OBJETO. O G Obra (5gobra.com.br) e um sistema de comunicacao formal entre fabrica de esquadria e cliente final, mantido pela 5G Gerenciamento.

2. PLANO E PAGAMENTO. A assinatura mensal e R$ 349 por mes, sem fidelidade, sem multa, sem carencia. O pagamento e processado por gateway parceiro (Asaas).

3. GARANTIA DE 14 DIAS. Em caso de insatisfacao nos primeiros 14 dias do pagamento, basta solicitar reembolso por WhatsApp e o valor pago e devolvido integralmente, sem necessidade de justificativa.

4. CANCELAMENTO. A assinatura pode ser cancelada a qualquer momento, com efeito no proximo ciclo de cobranca. Os dados ficam preservados por 90 dias apos o cancelamento, podendo ser exportados ou removidos a pedido.

5. RESPONSABILIDADES. A 5G fornece a plataforma. A empresa contratante e responsavel pelos dados que insere no sistema (clientes finais, obras, fotos, acordos).

6. LIMITES. Sem limite de obras ou cards. Cada assinatura inclui 1 usuario administrador.

7. ATUALIZACOES. A 5G pode atualizar o sistema sem aviso previo. Mudancas que afetem materialmente o servico contratado serao comunicadas por e-mail com antecedencia minima de 30 dias.

8. SUPORTE. Suporte oferecido via WhatsApp do canal oficial em horario comercial.

9. FORO. Foro da comarca de Jundiai/SP, Brasil.

(versao final sera mais detalhada e revisada juridicamente)`

const DOC_POLITICA_PRIVACIDADE = `POLITICA DE PRIVACIDADE DO G OBRA — versao ${PRIVACIDADE_VERSAO}

[ATENCAO: documento provisorio. Sera substituido por versao redigida por advogado.]

1. PAPEIS NA LGPD. A 5G Gerenciamento atua como OPERADOR dos dados pessoais que circulam pelo sistema. A empresa contratante e a CONTROLADORA dos dados que ela coleta dos seus clientes finais (nome, telefone, endereco da obra, fotos). Cabe a empresa contratante definir a finalidade e a base legal do tratamento desses dados.

2. DADOS COLETADOS DIRETAMENTE PELA 5G. Cadastrais da empresa contratante (CNPJ, nome, e-mail, telefone), de pagamento (gerenciados pelo Asaas — a 5G nao armazena dados de cartao), e de uso (logs, metricas).

3. FINALIDADE. Operar o sistema, processar pagamentos, fornecer suporte tecnico, melhorar o produto.

4. ARMAZENAMENTO. Os dados ficam no Supabase (infraestrutura AWS), com criptografia em transito (TLS) e em repouso (AES-256). Backups diarios automaticos.

5. SEGURANCA. Senhas armazenadas com bcrypt. RLS (Row-Level Security) garante isolamento entre empresas — empresas diferentes nunca acessam dados umas das outras.

6. DIREITOS DO TITULAR. Voce pode solicitar acesso, retificacao, exclusao ou portabilidade dos seus dados. Solicite por WhatsApp; processamos em ate 15 dias uteis.

7. DPO (ENCARREGADO). Thiago Beletti — thiago@gerenciamento5g.com.br

8. COMPARTILHAMENTO. Nao compartilhamos dados pessoais com terceiros, exceto provedores de infraestrutura essencial (Supabase, Asaas) e quando exigido por lei.

(versao final sera mais detalhada e revisada juridicamente)`

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
      const empresa = await criarEmpresa(nomeEmpresa.trim())
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
                Le abaixo os dois documentos. Pra continuar, marca o checkbox de aceite e clica em "Aceitar e criar conta". Vamos enviar copia em PDF pro seu e-mail apos o cadastro.
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
              <p className="text-sm text-slate-600 mb-6">
                Bem-vindo ao G Obra. Vamos criar tua primeira obra. Voce vai receber por e-mail uma copia dos contratos aceitos.
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
