import { useEffect, useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatPanel } from '../components/ChatPanel.tsx'
import { HoldingsRail } from '../components/board/HoldingsRail.tsx'
import { IndexStrip } from '../components/board/IndexStrip.tsx'
import { RankingTable } from '../components/board/RankingTable.tsx'
import { StockDetailPanel } from '../components/board/StockDetailPanel.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import {
  DURATION_LABEL,
  rankingQuery,
  type BoardTab,
  type DurationFilter,
  type IndexCard,
  type InvestorFlow,
  type MarketFilter,
  type MetricFilter,
  type RankingRow,
} from '../lib/board.ts'
import { formatAmount } from '../lib/board.ts'
import { supabase } from '../lib/supabase.ts'
import { api, type Holding } from '../lib/types.ts'

type Quote = { symbol: string; price: number | null; changePct: number | null; currency: string }
type Candle = { t: number; c: number; o?: number | null; h?: number | null; l?: number | null; v?: number | null }

const DURATIONS: DurationFilter[] = ['realtime', '1d', '1w', '1mo', '3mo', '1y']

function netFlow(side: { buy: number | null; sell: number | null } | null) {
  if (!side || side.buy == null || side.sell == null) return null
  return side.buy - side.sell
}

export function HomePage() {
  const { session, user } = useAuth()
  const token = session?.access_token
  const [tab, setTab] = useState<BoardTab>('realtime')
  const [market, setMarket] = useState<MarketFilter>('KR')
  const [metric, setMetric] = useState<MetricFilter>('amount')
  const [duration, setDuration] = useState<DurationFilter>('realtime')
  const [cards, setCards] = useState<IndexCard[]>([])
  const [investor, setInvestor] = useState<InvestorFlow[]>([])
  const [rows, setRows] = useState<RankingRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [chartRange, setChartRange] = useState<'1m' | '1d'>('1m')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [askOpen, setAskOpen] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message)
        else setHoldings((data as Holding[]) ?? [])
      })
  }, [user])

  useEffect(() => {
    if (!token) return
    const stocks = holdings.filter((r) => r.kind === 'stock' || r.kind === 'fund').map((r) => r.symbol).filter(Boolean) as string[]
    const coins = holdings.filter((r) => r.kind === 'coin').map((r) => r.symbol).filter(Boolean) as string[]
    if (!stocks.length && !coins.length) {
      setQuotes([])
      return
    }
    const qs = new URLSearchParams()
    if (stocks.length) qs.set('stocks', stocks.join(','))
    if (coins.length) qs.set('coins', coins.join(','))
    api<{ quotes: Quote[] }>(`/api/quotes?${qs.toString()}`, token)
      .then((res) => setQuotes(res.quotes))
      .catch((err: Error) => setError(err.message))
  }, [holdings, token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function loadIndicators() {
      try {
        const res = await api<{ cards: IndexCard[]; investor: InvestorFlow[] }>('/api/toss/indicators', token!)
        if (!cancelled) {
          setCards(res.cards)
          setInvestor(res.investor)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '지수를 불러오지 못했습니다.')
      }
    }
    void loadIndicators()
    const id = window.setInterval(() => void loadIndicators(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const query = rankingQuery({ tab, market, metric, duration })
    async function loadRankings() {
      try {
        const params = new URLSearchParams({
          type: query.type,
          duration: query.duration,
          marketCountry: query.marketCountry,
          count: '30',
        })
        const res = await api<{ rows: RankingRow[]; rankedAt: string | null }>(
          `/api/toss/rankings?${params.toString()}`,
          token!,
        )
        if (cancelled) return
        setRows(res.rows)
        setUpdatedAt(res.rankedAt)
        setLoading(false)
        setSelected((prev) => prev ?? res.rows[0]?.symbol ?? null)
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        setError(err instanceof Error ? err.message : '랭킹을 불러오지 못했습니다.')
      }
    }
    setLoading(true)
    void loadRankings()
    const pollMs = duration === 'realtime' && tab === 'realtime' ? 8000 : 60_000
    const id = window.setInterval(() => void loadRankings(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [token, tab, market, metric, duration])

  useEffect(() => {
    if (!token || !selected) {
      setCandles([])
      return
    }
    let cancelled = false
    const count = chartRange === '1m' ? 80 : 120
    api<{ candles: Candle[] }>(
      `/api/toss/candles?symbol=${encodeURIComponent(selected)}&interval=${chartRange}&count=${count}`,
      token,
    )
      .then((res) => {
        if (!cancelled) setCandles(res.candles)
      })
      .catch(() => {
        if (!cancelled) setCandles([])
      })
    return () => {
      cancelled = true
    }
  }, [token, selected, chartRange])

  const selectedRow = useMemo(
    () => rows.find((row) => row.symbol === selected) ?? null,
    [rows, selected],
  )

  const industryGroups = useMemo(() => {
    const map = new Map<string, { label: string; rows: RankingRow[]; avg: number; amount: number }>()
    for (const row of rows) {
      const key = row.market || row.marketCountry
      const cur = map.get(key) ?? { label: row.marketLabel || key, rows: [], avg: 0, amount: 0 }
      cur.rows.push(row)
      map.set(key, cur)
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        avg: g.rows.reduce((s, r) => s + (r.changeRate ?? 0), 0) / (g.rows.length || 1),
        amount: g.rows.reduce((s, r) => s + (r.tradingAmount ?? 0), 0),
      }))
      .sort((a, b) => b.avg - a.avg)
  }, [rows])

  return (
    <div className="-m-4 flex min-h-full flex-col gap-3 bg-panel p-3 md:-m-6 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">홈</h1>
          <p className="text-[13px] text-mute">
            토스증권 시세 · HOT 종목
            {updatedAt ? ` · ${new Date(updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <button type="button" className="btn-weak h-9 gap-1.5 px-3 text-[13px]" onClick={() => setAskOpen((v) => !v)}>
          <MessageSquare size={16} />
          시황 질문
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-[#e42939]">{error}</p>
      ) : null}

      {askOpen ? (
        <div className="rounded-2xl border border-line bg-white p-3">
          <ChatPanel domain="home" placeholder="오늘 코스피와 반도체 수급을 같이 보면?" />
        </div>
      ) : null}

      <IndexStrip cards={cards} />

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px_260px]">
        <section className="min-w-0 rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-end gap-4 border-b border-line px-4 pt-3">
            {(
              [
                ['realtime', '실시간 차트'],
                ['industry', '지금 뜨는 산업'],
                ['flow', '외국인·기관 매매'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className="board-tab" data-on={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab !== 'flow' ? (
            <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
              {(
                [
                  ['ALL', '전체'],
                  ['KR', '국내'],
                  ['US', '해외'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className="board-chip" data-on={market === id} onClick={() => setMarket(id)}>
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-line" />
              {(
                [
                  ['amount', '거래대금'],
                  ['gainers', '등락률↑'],
                  ['losers', '등락률↓'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className="board-chip" data-on={metric === id} onClick={() => setMetric(id)}>
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-line" />
              {DURATIONS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="board-chip"
                  data-on={duration === id}
                  onClick={() => setDuration(id)}
                >
                  {DURATION_LABEL[id]}
                </button>
              ))}
            </div>
          ) : null}

          {tab === 'flow' ? (
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {investor.map((item) => (
                <article key={item.symbol} className="rounded-xl bg-panel p-4">
                  <p className="text-[16px] font-bold">{item.symbol === 'KOSPI' ? '코스피' : '코스닥'}</p>
                  <p className="mt-1 text-[12px] text-mute">{item.date ?? '집계 대기'}</p>
                  {(
                    [
                      ['개인', item.individual],
                      ['외국인', item.foreigner],
                      ['기관', item.institution],
                    ] as const
                  ).map(([label, side]) => {
                    const net = netFlow(side)
                    const up = (net ?? 0) > 0
                    return (
                      <div key={label} className="mt-3 flex items-center justify-between text-[14px]">
                        <span className="text-body">{label}</span>
                        <span className={`font-semibold ${up ? 'price-up' : net ? 'price-down' : 'text-mute'}`}>
                          {net == null ? '—' : `${up ? '+' : ''}${formatAmount(net, 'KRW')}`}
                        </span>
                      </div>
                    )
                  })}
                </article>
              ))}
            </div>
          ) : tab === 'industry' ? (
            <div className="p-3">
              <p className="mb-3 px-1 text-[13px] text-mute">
                업종 분류는 Open API에 없어 코스피·코스닥·나스닥 등 시장 세그먼트로 묶었습니다.
              </p>
              <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {industryGroups.map((g) => (
                  <article key={g.label} className="rounded-xl border border-line px-3 py-3">
                    <p className="text-[14px] font-bold">{g.label}</p>
                    <p className={`mt-1 text-[18px] font-bold ${(g.avg ?? 0) >= 0 ? 'price-up' : 'price-down'}`}>
                      {((g.avg ?? 0) * 100).toFixed(2)}%
                    </p>
                    <p className="mt-1 text-[12px] text-mute">
                      {g.rows.length}종목 · {formatAmount(g.amount, g.rows[0]?.currency ?? 'KRW')}
                    </p>
                  </article>
                ))}
              </div>
              <RankingTable rows={rows} selected={selected} onSelect={setSelected} loading={loading} />
            </div>
          ) : (
            <RankingTable rows={rows} selected={selected} onSelect={setSelected} loading={loading} />
          )}
        </section>

        <StockDetailPanel row={selectedRow} candles={candles} range={chartRange} onRange={setChartRange} />
        <HoldingsRail rows={holdings} quotes={quotes} />
      </div>
    </div>
  )
}
