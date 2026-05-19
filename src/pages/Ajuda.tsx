// Pagina de Ajuda do G Obra — rota /app/ajuda
//
// Layout em 4 blocos (revisado 18/05/2026 — Natan entregou os tutoriais):
//   1. Tour interativo  — botoes que reativam Tour 1 (lista) e Tour 2 (obra)
//   2. Videos rapidos   — grade 3x3 com os 7 tutoriais gravados pelo Natan
//   3. Perguntas frequentes (FAQ de Uso)
//   4. Falar com a gente — WhatsApp do Thiago com prefixo [SUPORTE]
//
// Revisao 18/05/2026:
//   - Corrigidos acentos em todos os textos visiveis pro usuario
//   - Slot 5 renomeado de "Historico como dossie" pra "Geracao de documentos PDF"
//   - Slot 7 renomeado de "Tour pelas 5 abas" pra "Visao geral do G Obra"
//
// O atalho do WhatsApp dentro de /ajuda (e nao no header) e proposital:
// forca o cliente a passar pelos videos/FAQ antes, reduz volume de
// duvida boba e protege o tempo do Thiago.

import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { LogoFull } from '../lib/logo'
import { sair, useAuth } from '../lib/auth'
import { pegarMinhaEmpresa, listarObras } from '../lib/api'
import FaqUso from '../components/FaqUso'

interface VideoTutorial {
  id: string
  titulo: string
  descricao: string
  youtubeId?: string // a preencher quando subir no YouTube
}

const videos: VideoTutorial[] = [
  {
    id: 'criar-primeira-obra',
    titulo: 'Criar a primeira obra',
    descricao: 'Manual ou via importação do CEM (Alumisoft).',
    youtubeId: '2_XuGudRn20',
  },
  {
    id: 'convidar-tecnico',
    titulo: 'Convidar técnico',
    descricao: 'Link mágico no celular, sem cadastro.',
    youtubeId: 'D2SJRDdUvnY',
  },
  {
    id: 'tecnico-aponta-m1',
    titulo: 'Técnico aponta a Medição',
    descricao: 'Visão do celular do técnico em obra.',
    youtubeId: 'gFVuC62jdY0',
  },
  {
    id: 'cliente-acessa-link',
    titulo: 'Cliente acessa o link mágico',
    descricao: 'Visão do celular do cliente final.',
    youtubeId: '5g_YCoOmKGw',
  },
  {
    id: 'historico-dossie',
    titulo: 'Geração de documentos PDF',
    descricao: 'Como gerar PDFs da medição e do dossiê pro cliente.',
    youtubeId: 'VPezps5F10w',
  },
  {
    id: 'aceite-final',
    titulo: 'Aceite final + audit trail',
    descricao: 'Encerramento da obra com prova legal.',
    youtubeId: 'AGt1Vi2Z-W4',
  },
  {
    id: 'tour-5-abas',
    titulo: 'Visão geral do G Obra',
    descricao: 'Tour completo do sistema em poucos minutos.',
    youtubeId: '5gp2ukS2AeE',
  },
]

export default function Ajuda() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [empresaNome, setEmpresaNome] = useState('')
  const [videoAberto, setVideoAberto] = useState<VideoTutorial | null>(null)
  // Se chegou aqui de dentro de uma obra, pega o id pra mostrar botao "Voltar pra obra"
  const fromObra = (location.state as { fromObra?: string; fromObraNome?: string } | null)?.fromObra
  const fromObraNome = (location.state as { fromObra?: string; fromObraNome?: string } | null)?.fromObraNome

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const e = await pegarMinhaEmpresa()
      if (ativo && e) setEmpresaNome(e.nome)
    })()
    return () => { ativo = false }
  }, [])

  async function logout() {
    await sair()
    navigate('/')
  }

  function abrirWhatsApp() {
    const empresa = empresaNome || 'minha empresa'
    const texto = `[SUPORTE G OBRA - ${empresa}] Olá, preciso de ajuda com:`
    const url = `https://wa.me/5511995400050?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function reiniciarTour() {
    // Se ja tem obra criada, vai direto pra dentro com ?tour=1 — o Tour 2 (fluxo das 5 abas
    // e adicionar item) dispara la, que e o que tem informacoes importantes.
    // Se nao tem obra ainda (caso raro pos-cadastro), vai pra lista com Tour 1.
    try {
      const obras = await listarObras()
      if (obras.length > 0) {
        navigate(`/app/obra/${obras[0].id}?tour=1`)
      } else {
        navigate('/app/obras?tour=1')
      }
    } catch {
      navigate('/app/obras?tour=1')
    }
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
            <Link to="/app/obras" className="text-sm text-slate-500 hover:text-slate-900">
              Obras
            </Link>
            <Link to="/app/ajuda" className="text-sm font-semibold text-laranja-dark">
              Ajuda
            </Link>
            <Link to="/app/configuracoes" className="text-sm text-slate-500 hover:text-slate-900">
              Configurações
            </Link>
            <span className="text-sm text-slate-500 hidden md:inline">{user?.email}</span>
            <button onClick={logout} className="btn-ghost text-xs">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Central de ajuda</h1>
        <p className="text-sm text-slate-500 mb-10">
          Tudo que você precisa pra usar o G Obra: tour, vídeos, perguntas
          frequentes e contato direto comigo.
        </p>

        {/* 1) Tour interativo */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">1. Tour interativo</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold mb-1">Refazer tour do sistema</div>
              <p className="text-sm text-slate-500">
                Reabre o passo a passo de uma obra: como adicionar itens, e o que cada uma das 5 fases (Cliente → Empresa → Técnica → Em Andamento → Conclusão) significa.
              </p>
            </div>
            <button onClick={reiniciarTour} className="btn-primary flex-shrink-0">
              Iniciar tour
            </button>
          </div>
        </section>

        {/* 2) Videos rapidos */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">2. Vídeos rápidos</h2>
          <p className="text-sm text-slate-500 mb-4">
            Sete tutoriais curtos (até 3 minutos cada) cobrindo o que você
            precisa saber pra rodar uma obra completa.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => setVideoAberto(v)}
                disabled={!v.youtubeId}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden text-left hover:border-laranja transition group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="aspect-video bg-slate-900 flex items-center justify-center text-white relative overflow-hidden">
                  {v.youtubeId ? (
                    <>
                      <img
                        src={`https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`}
                        alt={v.titulo}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition flex items-center justify-center">
                        <div className="bg-laranja text-white w-12 h-12 rounded-full flex items-center justify-center text-xl">
                          ▶
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Em breve</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm">{v.titulo}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{v.descricao}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 3) FAQ de Uso */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">3. Perguntas frequentes</h2>
          <FaqUso />
        </section>

        {/* 4) Falar com a gente */}
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">4. Falar com a gente</h2>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
            <div className="font-semibold text-emerald-900 mb-1">
              Travou em algo que não está acima?
            </div>
            <p className="text-sm text-emerald-800 mb-4">
              Manda no WhatsApp direto. Sou eu (Thiago) que respondo —
              normalmente em até algumas horas no horário comercial.
            </p>
            <button onClick={abrirWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg transition">
              Abrir WhatsApp
            </button>
          </div>
        </section>
      </main>

      {/* Modal de video */}
      {videoAberto && videoAberto.youtubeId && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setVideoAberto(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Vídeo tutorial"
        >
          <div
            className="bg-black rounded-xl overflow-hidden w-full max-w-4xl aspect-video relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoAberto(null)}
              className="absolute top-3 right-3 text-white/80 hover:text-white text-2xl z-10 bg-black/50 w-8 h-8 rounded-full flex items-center justify-center"
              aria-label="Fechar"
            >
              ×
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${videoAberto.youtubeId}?autoplay=1`}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={videoAberto.titulo}
            />
          </div>
        </div>
      )}
    </div>
  )
}
