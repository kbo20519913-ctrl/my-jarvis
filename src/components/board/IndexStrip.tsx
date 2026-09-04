import type { IndexCard } from '../../lib/board.ts'
import { formatPct, formatPrice, isDown, isUp } from '../../lib/board.ts'

function MiniSpark({ points, up }: { points: Array<{ c: number }>; up: boolean }) {
  if (points.length < 2) return <div className="h-8 w-24" />
  const w = 96
  const h = 32
  const values = points.map((p) => p.c)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const color = up ? '#f04452' : '#3182f6'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function IndexStrip({ cards }: { cards: IndexCard[] }) {
  if (!cards.length) {
    return (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl bg-panel" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {cards.map((card) => {
        const up = isUp(card.changeRate)
        const down = isDown(card.changeRate)
        return (
          <article key={card.id} className="rounded-xl border border-line bg-white px-3 py-2.5">
            <p className="text-[13px] font-semibold text-body">{card.name}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div>
                <p className="text-[18px] font-bold leading-6 tracking-tight">
                  {formatPrice(card.price, card.currency)}
                </p>
                <p className={`mt-0.5 text-[13px] font-semibold ${up ? 'price-up' : down ? 'price-down' : 'text-mute'}`}>
                  {formatPct(card.changeRate)}
                </p>
              </div>
              <MiniSpark points={card.spark} up={up} />
            </div>
          </article>
        )
      })}
    </div>
  )
}
