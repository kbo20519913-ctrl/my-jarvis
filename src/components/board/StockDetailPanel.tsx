import { Link } from 'react-router-dom'
import { PriceChart } from '../PriceChart.tsx'
import {
  formatAmount,
  formatPct,
  formatPrice,
  initial,
  isDown,
  isUp,
  type RankingRow,
} from '../../lib/board.ts'

type Candle = { t: number; c: number; o?: number | null; h?: number | null; l?: number | null; v?: number | null }

export function StockDetailPanel({
  row,
  candles,
  range,
  onRange,
}: {
  row: RankingRow | null
  candles: Candle[]
  range: '1m' | '1d'
  onRange: (next: '1m' | '1d') => void
}) {
  if (!row) {
    return (
      <aside className="flex min-h-[20rem] flex-col rounded-2xl border border-line bg-white p-4">
        <p className="text-[15px] font-semibold">종목 상세</p>
        <p className="mt-2 text-[14px] leading-5 text-body">표에서 종목을 고르면 차트와 시세가 열립니다.</p>
      </aside>
    )
  }

  const up = isUp(row.changeRate)
  const down = isDown(row.changeRate)
  const last = candles.at(-1)

  return (
    <aside className="flex min-h-[20rem] flex-col rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel text-[15px] font-bold">
          {initial(row.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold">{row.name}</p>
          <p className="text-[13px] text-mute">
            {row.symbol} · {row.marketLabel}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-8 tracking-tight">
        {formatPrice(row.lastPrice, row.currency)}
      </p>
      <p className={`mt-1 text-[15px] font-semibold ${up ? 'price-up' : down ? 'price-down' : 'text-mute'}`}>
        {formatPct(row.changeRate)}
      </p>

      <div className="mt-3 flex gap-1">
        <button type="button" className="board-chip" data-on={range === '1m'} onClick={() => onRange('1m')}>
          당일
        </button>
        <button type="button" className="board-chip" data-on={range === '1d'} onClick={() => onRange('1d')}>
          일봉
        </button>
      </div>
      <div className="mt-2 h-40">
        <PriceChart candles={candles} label={row.symbol} convention="kr" compact={range === '1m'} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-panel px-3 py-3 text-[13px]">
        <div>
          <dt className="text-mute">시가</dt>
          <dd className="font-semibold">{formatPrice(last?.o ?? null, row.currency)}</dd>
        </div>
        <div>
          <dt className="text-mute">고가</dt>
          <dd className="font-semibold">{formatPrice(last?.h ?? null, row.currency)}</dd>
        </div>
        <div>
          <dt className="text-mute">저가</dt>
          <dd className="font-semibold">{formatPrice(last?.l ?? null, row.currency)}</dd>
        </div>
        <div>
          <dt className="text-mute">거래량</dt>
          <dd className="font-semibold">{formatAmount(last?.v ?? row.tradingVolume, row.currency)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[13px] leading-5 text-body">{row.summary}</p>
      <Link to="/community" className="mt-4 text-[14px] font-semibold text-gold">
        커뮤니티에서 이야기하기
      </Link>
    </aside>
  )
}
