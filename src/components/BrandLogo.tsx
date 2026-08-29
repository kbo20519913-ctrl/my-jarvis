import { Link } from 'react-router-dom'

type BrandLogoProps = {
  compact?: boolean
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="MY JARVIS">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gold text-[12px] font-bold tracking-tight text-white">
        MJ
      </span>
      {compact ? null : (
        <span className="leading-none text-paper">
          <span className="block text-[11px] font-semibold tracking-[0.08em] text-body">MY</span>
          <span className="block text-[18px] font-bold tracking-tight">JARVIS</span>
        </span>
      )}
    </Link>
  )
}
