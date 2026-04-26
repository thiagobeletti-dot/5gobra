// Logo provisorio do G Obra. Sera substituido pela arte oficial quando o designer entregar.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-mark" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#cc5500" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="10" fill="url(#lg-mark)" />
      <text x="24" y="32" textAnchor="middle" fill="#fff" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="22">G</text>
    </svg>
  )
}

export function LogoFull({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={small ? 32 : 40} />
      <div className="flex flex-col leading-none">
        <span className={small ? 'text-base font-extrabold tracking-tight' : 'text-lg font-extrabold tracking-tight'}>G OBRA</span>
        <span className="text-[11px] text-slate-500 font-medium mt-0.5">5G Gerenciamento</span>
      </div>
    </div>
  )
}
