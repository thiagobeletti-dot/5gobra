// Logo do G Obra — usa o logo 3D oficial da 5G Gerenciamento
// (mesmo arquivo do site institucional gerenciamento5g.com.br pra
// manter consistência visual entre marketing e produto).
//
// O fundo branco do PNG some sobre fundos claros graças ao
// mix-blend-mode: multiply.

interface FullProps {
  small?: boolean
}

export function LogoFull({ small = false }: FullProps) {
  const altura = small ? 40 : 56
  return (
    <div className="inline-flex items-center gap-3">
      <img
        src="/logo-5g.png"
        alt="5G Gerenciamento"
        style={{
          height: altura,
          width: altura,
          display: 'block',
          mixBlendMode: 'multiply',
        }}
      />
      <span
        className="font-extrabold tracking-tight leading-none text-slate-900"
        style={{ fontSize: small ? '1.1rem' : '1.4rem' }}
      >
        Diário de Obra
      </span>
    </div>
  )
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo-5g.png"
      alt="5G Gerenciamento"
      width={size}
      height={size}
      style={{ display: 'block', mixBlendMode: 'multiply' }}
    />
  )
}

export function LogoStack({ size = 200 }: { size?: number }) {
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <img
        src="/logo-5g-circulo.png"
        alt="5G Gerenciamento"
        width={size}
        height={size}
        style={{ display: 'block' }}
      />
      <span className="font-extrabold tracking-tight text-2xl text-slate-900">
        Diário de Obra
      </span>
    </div>
  )
}
