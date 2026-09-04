import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import type { Holding } from '../../lib/types.ts'
import { formatPct, formatPrice, initial, isDown, isUp } from '../../lib/board.ts'

type Quote = { symbol: string; price: number | null; changePct: number | null; currency: string }

export function HoldingsRail({
  rows,
  quotes,
}: {
  rows: Holding[]
  quotes: Quote[]
}) {
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]))
  const stocks = rows.filter((r) => r.kind === 'stock' || r.kind === 'fund')

  function valueOf(row: Holding) {
    if (row.kind === 'deposit' || row.kind === 'savings') return Number(row.cash_balance)
    const q = row.symbol ? quoteMap.get(row.symbol) : undefined
    if (q?.price != null) return Number(row.quantity) * q.price
    return Number(row.quantity) * Number(row.avg_price)
  }

  const total = rows.reduce((sum, row) => sum + valueOf(row), 0)

  return (
    <aside className="flex min-h-[20rem] flex-col rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[15px] font-bold">내 투자</p>
        <Link to="/assets" className="text-[13px] font-semibold text-gold">
          관리
        </Link>
      </div>
      <div className="px-4 py-3">
        <p className="text-[12px] text-mute">평가액</p>
        <p className="text-[22px] font-bold tracking-tight">{total.toLocaleString('ko-KR')}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {stocks.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <Wallet size={36} strokeWidth={1.5} className="text-mute" />
            <p className="mt-3 text-[14px] font-semibold">보유 종목이 없어요</p>
            <p className="mt-1 text-[13px] text-body">자산 페이지에서 주식을 등록하면 여기에 시세가 붙습니다.</p>
            <Link to="/assets" className="btn-weak mt-4 h-9 text-[13px]">
              자산 등록
            </Link>
          </div>
        ) : (
          <ul>
            {stocks.map((row) => {
              const q = row.symbol ? quoteMap.get(row.symbol) : undefined
              const rate = q?.changePct != null ? q.changePct / 100 : null
              const up = isUp(rate)
              const down = isDown(rate)
              return (
                <li key={row.id} className="flex items-center gap-2 rounded-xl px-2 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel text-[12px] font-bold">
                    {initial(row.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{row.name}</span>
                    <span className="block text-[12px] text-mute">{row.symbol}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[14px] font-semibold tabular-nums">
                      {formatPrice(q?.price ?? Number(row.avg_price), q?.currency || row.currency)}
                    </span>
                    <span className={`block text-[12px] font-semibold ${up ? 'price-up' : down ? 'price-down' : 'text-mute'}`}>
                      {formatPct(rate)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
