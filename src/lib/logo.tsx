// Logo do G Obra — pacote oficial de 5 versões entregue pelo designer (06/05/2026).
//
// Versões disponíveis em /public:
//   - logo-gobra-tagline.png    → fundo claro, com "Diário de Obra" embaixo (uso principal: hero, headers grandes)
//   - logo-gobra-circulo.jpeg   → fundo claro, empilhada (uso: favicon, OG image, avatar)
//   - logo-gobra.jpeg           → fundo claro, horizontal (uso: header compacto)
//   - logo-gobra-circulo-laranja.png → fundo laranja, empilhada (contexto colorido)
//   - logo-gobra-laranja.png    → fundo laranja, horizontal (contexto colorido)

interface FullProps {
  small?: boolean
}

// Logo principal usado no header — versão horizontal com o nome
// "G Obra" + "Diário de Obra" embutidos na arte.
//
// Tamanhos: small=56px (lista de obras, headers compactos),
//           normal=72px (cadastro, login, telas centralizadas).
export function LogoFull({ small = false }: FullProps) {
  const altura = small ? 56 : 72
  return (
    <img
      src="/logo-gobra-tagline.png"
      alt="G Obra — Diário de Obra"
      style={{
        height: altura,
        width: 'auto',
        display: 'block',
      }}
    />
  )
}

// Logo só com o "G" — versão empilhada/quadrada. Usado em favicons,
// OG images, avatares (Instagram, etc) — qualquer contexto que peça quadrado.
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <img
      src="/logo-gobra-circulo.jpeg"
      alt="G Obra"
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  )
}

// Versão grande empilhada — usado em telas centralizadas (cadastro, login)
// onde queremos mais peso visual.
export function LogoStack({ size = 240 }: { size?: number }) {
  return (
    <img
      src="/logo-gobra-tagline.png"
      alt="G Obra — Diário de Obra"
      style={{ width: size, height: 'auto', display: 'block' }}
    />
  )
}
