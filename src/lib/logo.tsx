// Logo do G Obra — pacote oficial de 5 versões entregue pelo designer (06/05/2026).
//
// Versões disponíveis em /public:
//   - logo-gobra-tagline.png    → fundo claro, com "Diário de Obra" embaixo (uso principal)
//   - logo-gobra-circulo.jpeg   → fundo claro, empilhada (uso: favicon, OG, avatar)
//   - logo-gobra.jpeg           → fundo claro, horizontal
//   - logo-gobra-circulo-laranja.png → fundo laranja, empilhada
//   - logo-gobra-laranja.png    → fundo laranja, horizontal

interface FullProps {
  small?: boolean
}

// Logo principal usado no header.
// Tamanhos aumentados em 06/05 (versão 2): small=120, normal=160 — Thiago
// pediu "mais que dobrar" depois do tamanho anterior (56/72) ainda parecer pequeno.
export function LogoFull({ small = false }: FullProps) {
  const altura = small ? 120 : 160
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
// OG images, avatares, qualquer contexto que peça quadrado.
export function LogoMark({ size = 80 }: { size?: number }) {
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

// Versão grande empilhada — usado em telas centralizadas (cadastro, login).
export function LogoStack({ size = 320 }: { size?: number }) {
  return (
    <img
      src="/logo-gobra-tagline.png"
      alt="G Obra — Diário de Obra"
      style={{ width: size, height: 'auto', display: 'block' }}
    />
  )
}
