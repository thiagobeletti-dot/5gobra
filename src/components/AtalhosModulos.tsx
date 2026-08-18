// Atalhos pros outros módulos da 5G (G Instalação e G Estoque).
// Cada um abre o sistema respectivo em NOVA ABA — o Thiago gosta de manter as
// 3 telas abertas. Logos menores que o do G Obra (que é a base).
//
// IMPORTANTE: coloque os arquivos de logo em `public/`:
//   - public/logo-ginstalacao.png
//   - public/logo-gestoque.png
// Enquanto os arquivos não existirem, aparece o nome do módulo (fallback).

const MODULOS = [
  {
    nome: 'G Instalação',
    url: 'https://5ginstalacao.com.br',
    logo: '/logo-instalacao.png',
    cor: '#2563EB', // azul do G Instalação
  },
  {
    nome: 'G Estoque',
    url: 'https://5gestoque.com.br',
    logo: '/logo-gestoque.png',
    cor: '#DC2626', // vermelho do G Estoque
  },
]

export default function AtalhosModulos({ altura = 40 }: { altura?: number }) {
  return (
    <div className="flex items-center gap-3 pl-3 ml-1 border-l border-slate-200">
      {MODULOS.map((m) => (
        <a
          key={m.nome}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Abrir ${m.nome} em nova aba`}
          className="flex items-center opacity-85 hover:opacity-100 transition"
        >
          <img
            src={m.logo}
            alt={m.nome}
            style={{ height: altura, width: 'auto', display: 'block' }}
            onError={(e) => {
              // Fallback enquanto o PNG do logo não estiver em /public: mostra
              // um "chip" com a cor e o nome do módulo, no lugar da imagem quebrada.
              const img = e.currentTarget
              const span = img.nextElementSibling as HTMLElement | null
              img.style.display = 'none'
              if (span) span.style.display = 'inline-flex'
            }}
          />
          <span
            style={{ display: 'none', color: m.cor, borderColor: m.cor }}
            className="items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-sm font-extrabold"
          >
            <span
              style={{ background: m.cor }}
              className="w-4 h-4 rounded grid place-items-center text-white text-[10px]"
            >
              G
            </span>
            {m.nome.replace('G ', '')}
          </span>
        </a>
      ))}
    </div>
  )
}
