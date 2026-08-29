export type YahooChart = {
  symbol: string
  currency: string
  regularMarketPrice: number | null
  previousClose: number | null
  candles: Array<{ t: number; c: number }>
}

export async function yahooChart(symbol: string, range = '6mo'): Promise<YahooChart> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`)
  url.searchParams.set('range', range)
  url.searchParams.set('interval', '1d')
  url.searchParams.set('includePrePost', 'false')

  const res = await fetch(url, {
    headers: { 'User-Agent': 'sihwangsil/1.0' },
  })
  if (!res.ok) {
    throw new Error(`${symbol} 시세를 가져오지 못했습니다.`)
  }
  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: { currency?: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; symbol?: string }
        timestamp?: number[]
        indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      }>
    }
  }
  const result = data.chart?.result?.[0]
  if (!result) throw new Error(`${symbol} 데이터가 없습니다. 티커를 확인해 주세요.`)

  const closes = result.indicators?.quote?.[0]?.close ?? []
  const stamps = result.timestamp ?? []
  const candles = stamps
    .map((t, i) => ({ t: t * 1000, c: closes[i] ?? null }))
    .filter((row): row is { t: number; c: number } => typeof row.c === 'number')

  return {
    symbol: result.meta?.symbol ?? symbol,
    currency: result.meta?.currency ?? 'KRW',
    regularMarketPrice: result.meta?.regularMarketPrice ?? candles.at(-1)?.c ?? null,
    previousClose: result.meta?.previousClose ?? result.meta?.chartPreviousClose ?? null,
    candles,
  }
}

export type CoinTicker = {
  market: string
  trade_price: number
  signed_change_rate: number
  acc_trade_price_24h: number
}

export async function upbitTickers(markets: string[]): Promise<CoinTicker[]> {
  if (markets.length === 0) return []
  const url = new URL('https://api.upbit.com/v1/ticker')
  url.searchParams.set('markets', markets.join(','))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Upbit 시세를 가져오지 못했습니다.')
  return (await res.json()) as CoinTicker[]
}

export async function upbitCandles(market: string): Promise<Array<{ t: number; c: number }>> {
  const url = new URL('https://api.upbit.com/v1/candles/days')
  url.searchParams.set('market', market)
  url.searchParams.set('count', '120')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${market} 캔들을 가져오지 못했습니다.`)
  const rows = (await res.json()) as Array<{ timestamp: number; trade_price: number }>
  return rows
    .slice()
    .reverse()
    .map((row) => ({ t: row.timestamp, c: row.trade_price }))
}
