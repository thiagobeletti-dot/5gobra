// Logo G OBRA - usa os SVGs em /public como fonte unica
// Tres variantes:
//   - LogoMark: so o G (compacto)
//   - LogoFull: G + texto OBRA (horizontal, ideal pra header)
//   - LogoStack: G em cima de OBRA (vertical, ideal pra splash/landing)

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo-mark.svg"
      alt="G Obra"
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  )
}

export function LogoFull({ small = false }: { small?: boolean }) {
  const altura = small ? 32 : 40
  return (
    <img
      src="/logo-horizontal.svg"
      alt="G Obra - 5G Gerenciamento"
      style={{ height: altura, width: 'auto', display: 'block' }}
    />
  )
}

export function LogoStack({ size = 200 }: { size?: number }) {
  return (
    <img
      src="/logo-vertical.svg"
      alt="G Obra - 5G Gerenciamento"
      style={{ width: size, height: 'auto', display: 'block' }}
    />
  )
}
