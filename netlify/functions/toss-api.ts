import type { Config } from '@netlify/functions'
import { requireUser } from './_shared/auth.ts'
import { errorResponse, HttpError, json } from './_shared/env.ts'
import { upbitTickers } from './_shared/market-data.ts'
import {
  MARKET_COUNTRIES,
  num,
  RANKING_DURATIONS,
  RANKING_TYPES,
  tossCandles,
  tossConfigured,
  tossGet,
  tossPrices,
  tossStocks,
  type RankingItem,
  type RankingResult,
} from './_shared/toss.ts'

const MARKET_LABEL: Record<string, string> = {
  KOSPI: '코스피',
  KOSDAQ: '코스닥',
  NYSE: 'NYSE',
  NASDAQ: '나스닥',
  AMEX: 'AMEX',
  KR_ETC: '국내 기타',
  US_ETC: '해외 기타',
}

function requireToss() {
  if (!tossConfigured()) {
    throw new HttpError(
      500,
      '토스증권 API 키가 없습니다. TOSSINVEST_CLIENT_ID와 TOSSINVEST_CLIENT_SECRET을 설정하세요.',
    )
  }
}

function spark(candles: Array<{ timestamp: string; closePrice: string }>) {
  return candles.slice(-48).map((c) => ({
    t: new Date(c.timestamp).getTime(),
    c: num(c.closePrice) ?? 0,
  }))
}

function changeFromSpark(points: Array<{ c: number }>) {
  if (points.length < 2) return null
  const first = points[0].c
  const last = points[points.length - 1].c
  if (!first) return null
  return (last - first) / first
}

async function rankings(req: Request) {
  const url = new URL(req.url)
  const typeRaw = url.searchParams.get('type') ?? 'TOSS_SECURITIES_TRADING_AMOUNT'
  const durationRaw = url.searchParams.get('duration') ?? 'realtime'
  const countryRaw = url.searchParams.get('marketCountry') ?? 'KR'
  const count = Math.min(Math.max(Number(url.searchParams.get('count') ?? '30') || 30, 1), 100)

  const type = RANKING_TYPES.includes(typeRaw as (typeof RANKING_TYPES)[number])
    ? typeRaw
    : 'TOSS_SECURITIES_TRADING_AMOUNT'
  let duration = RANKING_DURATIONS.includes(durationRaw as (typeof RANKING_DURATIONS)[number])
    ? durationRaw
    : 'realtime'
  if ((type === 'TOP_GAINERS' || type === 'TOP_LOSERS') && duration === 'realtime') {
    duration = '1d'
  }

  const countries =
    countryRaw === 'ALL'
      ? [...MARKET_COUNTRIES]
      : MARKET_COUNTRIES.includes(countryRaw as (typeof MARKET_COUNTRIES)[number])
        ? [countryRaw]
        : ['KR']

  const batches = await Promise.all(
    countries.map(async (marketCountry) => {
      const result = await tossGet<RankingResult>('/api/v1/rankings', {
        type,
        marketCountry,
        duration,
        count: String(count),
      })
      return { marketCountry, result }
    }),
  )

  const merged: Array<RankingItem & { marketCountry: string }> = []
  for (const batch of batches) {
    for (const row of batch.result.rankings ?? []) {
      merged.push({ ...row, marketCountry: batch.marketCountry })
    }
  }
  if (countries.length > 1) {
    const key =
      type.includes('GAINERS') || type.includes('LOSERS')
        ? (row: RankingItem) => Math.abs(num(row.price.changeRate) ?? 0)
        : (row: RankingItem) => num(row.tradingAmount) ?? 0
    merged.sort((a, b) => key(b) - key(a))
    merged.forEach((row, i) => {
      row.rank = i + 1
    })
  }

  const sliced = merged.slice(0, count)
  const infos = await tossStocks(sliced.map((row) => row.symbol))
  const infoMap = new Map(infos.map((info) => [info.symbol, info]))

  const rows = sliced.map((row) => {
    const info = infoMap.get(row.symbol)
    const last = num(row.price.lastPrice)
    const shares = num(info?.sharesOutstanding)
    const changeRate = num(row.price.changeRate)
    const tradingAmount = num(row.tradingAmount)
    const market = info?.market ?? ''
    return {
      rank: row.rank,
      symbol: row.symbol,
      name: info?.name ?? row.symbol,
      market,
      marketLabel: MARKET_LABEL[market] ?? market ?? row.marketCountry,
      marketCountry: row.marketCountry,
      currency: row.currency,
      lastPrice: last,
      basePrice: num(row.price.basePrice),
      changeRate,
      tradingVolume: num(row.tradingVolume),
      tradingAmount,
      marketCap: last != null && shares != null ? last * shares : null,
      summary: summaryLine(info?.name ?? row.symbol, changeRate, tradingAmount, row.currency),
    }
  })

  return json({
    rankedAt: batches[0]?.result.rankedAt ?? null,
    type,
    duration,
    marketCountry: countryRaw,
    rows,
  })
}

function summaryLine(name: string, changeRate: number | null, amount: number | null, currency: string) {
  const pct = changeRate == null ? null : changeRate * 100
  const dir = pct == null ? '' : pct >= 0 ? '상승' : '하락'
  const pctText = pct == null ? '' : `${Math.abs(pct).toFixed(2)}% ${dir}`
  const amt = amount == null ? '' : `거래대금 ${formatCompact(amount, currency)}`
  return [name, pctText, amt].filter(Boolean).join(' · ')
}

function formatCompact(value: number, currency: string) {
  if (currency === 'USD') {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`
  if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

async function indicators() {
  const [indexPrices, kospiCandles, kosdaqCandles, usPrices, qqqCandles, spyCandles, btc] = await Promise.all([
    tossGet<Array<{ symbol: string; lastPrice: string; timestamp?: string | null }>>(
      '/api/v1/market-indicators/prices',
      { symbols: 'KOSPI,KOSDAQ' },
    ),
    tossGet<{ candles: Array<{ timestamp: string; closePrice: string }> }>(
      '/api/v1/market-indicators/KOSPI/candles',
      { interval: '1m', count: '60' },
    ).catch(() => ({ candles: [] })),
    tossGet<{ candles: Array<{ timestamp: string; closePrice: string }> }>(
      '/api/v1/market-indicators/KOSDAQ/candles',
      { interval: '1m', count: '60' },
    ).catch(() => ({ candles: [] })),
    tossPrices(['QQQ', 'SPY']).catch(() => []),
    tossCandles('QQQ', '1d', 40).catch(() => []),
    tossCandles('SPY', '1d', 40).catch(() => []),
    upbitTickers(['KRW-BTC']).catch(() => []),
  ])

  const kospiSpark = spark(kospiCandles.candles ?? [])
  const kosdaqSpark = spark(kosdaqCandles.candles ?? [])
  const qqqSpark = spark(qqqCandles)
  const spySpark = spark(spyCandles)
  const kospi = indexPrices.find((row) => row.symbol === 'KOSPI')
  const kosdaq = indexPrices.find((row) => row.symbol === 'KOSDAQ')
  const qqq = usPrices.find((row) => row.symbol === 'QQQ')
  const spy = usPrices.find((row) => row.symbol === 'SPY')
  const bitcoin = btc[0]

  const cards = [
    {
      id: 'KOSPI',
      name: '코스피',
      price: num(kospi?.lastPrice),
      changeRate: changeFromSpark(kospiSpark),
      spark: kospiSpark,
      currency: 'KRW',
    },
    {
      id: 'KOSDAQ',
      name: '코스닥',
      price: num(kosdaq?.lastPrice),
      changeRate: changeFromSpark(kosdaqSpark),
      spark: kosdaqSpark,
      currency: 'KRW',
    },
    {
      id: 'QQQ',
      name: '나스닥 100',
      price: num(qqq?.lastPrice),
      changeRate: changeFromSpark(qqqSpark),
      spark: qqqSpark,
      currency: 'USD',
    },
    {
      id: 'SPY',
      name: 'S&P 500',
      price: num(spy?.lastPrice),
      changeRate: changeFromSpark(spySpark),
      spark: spySpark,
      currency: 'USD',
    },
    {
      id: 'BTC',
      name: '비트코인',
      price: bitcoin?.trade_price ?? null,
      changeRate: bitcoin?.signed_change_rate ?? null,
      spark: [],
      currency: 'KRW',
    },
  ]

  const investor = await Promise.all(
    (['KOSPI', 'KOSDAQ'] as const).map(async (symbol) => {
      const data = await tossGet<{
        records: Array<{
          date: string
          individual: { buyAmount: string; sellAmount: string }
          foreigner: { buyAmount: string; sellAmount: string }
          institution: { buyAmount: string; sellAmount: string }
        }>
      }>(`/api/v1/market-indicators/${symbol}/investor-trading`, { interval: '1d' }).catch(() => ({
        records: [],
      }))
      const latest = data.records?.[0]
      return {
        symbol,
        date: latest?.date ?? null,
        individual: latest
          ? { buy: num(latest.individual.buyAmount), sell: num(latest.individual.sellAmount) }
          : null,
        foreigner: latest
          ? { buy: num(latest.foreigner.buyAmount), sell: num(latest.foreigner.sellAmount) }
          : null,
        institution: latest
          ? { buy: num(latest.institution.buyAmount), sell: num(latest.institution.sellAmount) }
          : null,
      }
    }),
  )

  return json({ cards, investor })
}

async function prices(req: Request) {
  const symbols = (new URL(req.url).searchParams.get('symbols') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const rows = await tossPrices(symbols)
  return json({
    quotes: rows.map((row) => ({
      symbol: row.symbol,
      price: num(row.lastPrice),
      currency: row.currency,
      timestamp: row.timestamp ?? null,
    })),
  })
}

async function candles(req: Request) {
  const url = new URL(req.url)
  const symbol = url.searchParams.get('symbol')?.trim()
  if (!symbol) throw new HttpError(400, 'symbol이 필요합니다.')
  const interval = url.searchParams.get('interval') === '1d' ? '1d' : '1m'
  const count = Math.min(Math.max(Number(url.searchParams.get('count') ?? '120') || 120, 1), 400)
  const rows = await tossCandles(symbol, interval, count)
  const mapped = rows.map((c) => ({
    t: new Date(c.timestamp).getTime(),
    o: num(c.openPrice),
    h: num(c.highPrice),
    l: num(c.lowPrice),
    c: num(c.closePrice),
    v: num(c.volume),
  }))
  const last = mapped.at(-1)
  return json({
    symbol,
    interval,
    candles: mapped,
    ohlc: last
      ? { open: last.o, high: last.h, low: last.l, close: last.c, volume: last.v }
      : null,
  })
}

async function stocks(req: Request) {
  const symbols = (new URL(req.url).searchParams.get('symbols') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const rows = await tossStocks(symbols)
  return json({ stocks: rows })
}

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(req)
    requireToss()
    const path = new URL(req.url).pathname
    if (path.endsWith('/rankings')) return await rankings(req)
    if (path.endsWith('/indicators')) return await indicators()
    if (path.endsWith('/prices')) return await prices(req)
    if (path.endsWith('/candles')) return await candles(req)
    if (path.endsWith('/stocks')) return await stocks(req)
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: ['/api/toss/rankings', '/api/toss/indicators', '/api/toss/prices', '/api/toss/candles', '/api/toss/stocks'],
  method: 'GET',
}
