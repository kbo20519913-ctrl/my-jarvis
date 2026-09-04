import { formatAmount, formatPct, formatPrice, initial, isDown, isUp, type RankingRow } from '../../lib/board.ts'

export function RankingTable({
  rows,
  selected,
  onSelect,
  loading,
}: {
  rows: RankingRow[]
  selected: string | null
  onSelect: (symbol: string) => void
  loading: boolean
}) {
  if (loading && !rows.length) {
    return <p className="px-4 py-10 text-center text-[15px] text-mute">시세를 불러오는 중</p>
  }
  if (!rows.length) {
    return <p className="px-4 py-10 text-center text-[15px] text-mute">이 조건의 랭킹이 없습니다.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line text-[12px] font-semibold text-mute">
            <th className="w-10 px-3 py-2 font-semibold">#</th>
            <th className="px-2 py-2 font-semibold">종목</th>
            <th className="px-2 py-2 text-right font-semibold">현재가</th>
            <th className="px-2 py-2 text-right font-semibold">등락률</th>
            <th className="px-2 py-2 text-right font-semibold">거래대금</th>
            <th className="hidden px-2 py-2 text-right font-semibold xl:table-cell">시가총액</th>
            <th className="hidden px-2 py-2 font-semibold lg:table-cell">시장</th>
            <th className="hidden px-2 py-2 font-semibold 2xl:table-cell">요약</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const up = isUp(row.changeRate)
            const down = isDown(row.changeRate)
            const on = selected === row.symbol
            return (
              <tr
                key={`${row.marketCountry}-${row.symbol}`}
                onClick={() => onSelect(row.symbol)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(row.symbol)
                  }
                }}
                tabIndex={0}
                className={`cursor-pointer border-b border-line last:border-0 ${on ? 'bg-panel' : 'hover:bg-panel/70'}`}
              >
                <td className="px-3 py-2.5 tabular-nums text-mute">{row.rank}</td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel text-[13px] font-bold text-paper">
                      {initial(row.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-paper">{row.name}</span>
                      <span className="block text-[12px] text-mute">{row.symbol}</span>
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums font-semibold">
                  {formatPrice(row.lastPrice, row.currency)}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span
                    className={`inline-flex h-6 min-w-[4.5rem] items-center justify-center rounded-md px-1.5 text-[13px] font-semibold ${
                      up ? 'price-up-pill' : down ? 'price-down-pill' : 'bg-panel text-mute'
                    }`}
                  >
                    {formatPct(row.changeRate)}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-body">
                  {formatAmount(row.tradingAmount, row.currency)}
                </td>
                <td className="hidden px-2 py-2.5 text-right tabular-nums text-body xl:table-cell">
                  {formatAmount(row.marketCap, row.currency)}
                </td>
                <td className="hidden px-2 py-2.5 text-body lg:table-cell">{row.marketLabel}</td>
                <td className="hidden max-w-[16rem] truncate px-2 py-2.5 text-[13px] text-mute 2xl:table-cell">
                  {row.summary}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
