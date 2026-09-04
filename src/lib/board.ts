export type BoardTab = 'realtime' | 'industry' | 'flow'
export type MarketFilter = 'ALL' | 'KR' | 'US'
export type MetricFilter = 'amount' | 'gainers' | 'losers'
export type DurationFilter = 'realtime' | '1d' | '1w' | '1mo' | '3mo' | '1y'

export type RankingRow = {
  rank: number
  symbol: string
  name: string
  market: string
  marketLabel: string
  marketCountry: string
  currency: string
  lastPrice: number | null
  basePrice: number | null
  changeRate: number | null
  tradingVolume: number | null
  tradingAmount: number | null
  marketCap: number | null
  summary: string
}

export type IndexCard = {
  id: string
  name: string
  price: number | null
  changeRate: number | null
  spark: Array<{ t: number; c: number }>
  currency: string
}

export type InvestorFlow = {
  symbol: string
  date: string | null
  individual: { buy: number | null; sell: number | null } | null
  foreigner: { buy: number | null; sell: number | null } | null
  institution: { buy: number | null; sell: number | null } | null
}

export function rankingQuery(opts: {
  tab: BoardTab
  market: MarketFilter
  metric: MetricFilter
  duration: DurationFilter
}) {
  const marketCountry = opts.market
  let type = 'TOSS_SECURITIES_TRADING_AMOUNT'
  let duration: DurationFilter | '1d' = opts.duration
  if (opts.tab === 'realtime' || opts.metric === 'amount') {
    type =
      opts.duration === 'realtime'
        ? 'TOSS_SECURITIES_TRADING_AMOUNT'
        : 'MARKET_TRADING_AMOUNT'
  }
  if (opts.metric === 'gainers') type = 'TOP_GAINERS'
  if (opts.metric === 'losers') type = 'TOP_LOSERS'
  if ((type === 'TOP_GAINERS' || type === 'TOP_LOSERS') && duration === 'realtime') {
    duration = '1d'
  }
  if (opts.tab === 'industry') {
    type = 'TOP_GAINERS'
    if (duration === 'realtime') duration = '1d'
  }
  return { type, duration, marketCountry }
}

export function formatPrice(value: number | null, currency: string) {
  if (value == null) return '—'
  if (currency === 'USD') {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (value >= 1000) return Math.round(value).toLocaleString('ko-KR')
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

export function formatPct(rate: number | null) {
  if (rate == null) return '—'
  const pct = rate * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function formatAmount(value: number | null, currency: string) {
  if (value == null) return '—'
  if (currency === 'USD') {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}조`
  if (abs >= 1e8) return `${(value / 1e8).toFixed(1)}억`
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

export function isUp(rate: number | null) {
  return (rate ?? 0) > 0
}

export function isDown(rate: number | null) {
  return (rate ?? 0) < 0
}

export function initial(name: string) {
  const ch = name.replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 1)
  return ch || '#'
}

export const DURATION_LABEL: Record<DurationFilter, string> = {
  realtime: '실시간',
  '1d': '1일',
  '1w': '1주일',
  '1mo': '1개월',
  '3mo': '3개월',
  '1y': '1년',
}
