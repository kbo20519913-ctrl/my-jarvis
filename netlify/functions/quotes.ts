import type { Config } from '@netlify/functions'
import { requireUser } from './_shared/auth.ts'
import { errorResponse, json } from './_shared/env.ts'
import { upbitTickers, yahooChart } from './_shared/market-data.ts'
import { num, tossConfigured, tossPrices } from './_shared/toss.ts'

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(req)
    const url = new URL(req.url)
    const stocks = (url.searchParams.get('stocks') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const coins = (url.searchParams.get('coins') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const tossMap = new Map<string, { price: number | null; currency: string }>()
    if (tossConfigured() && stocks.length) {
      try {
        const toss = await tossPrices(stocks)
        for (const row of toss) {
          tossMap.set(row.symbol, { price: num(row.lastPrice), currency: row.currency })
        }
      } catch {
        /* fall back to Yahoo per symbol */
      }
    }

    const stockQuotes = await Promise.all(
      stocks.map(async (raw) => {
        const tossHit = tossMap.get(raw)
        if (tossHit?.price != null) {
          return {
            symbol: raw,
            resolved: raw,
            kind: 'equity' as const,
            price: tossHit.price,
            changePct: null as number | null,
            currency: tossHit.currency,
          }
        }
        const symbol = /^\d{6}$/.test(raw) ? `${raw}.KS` : raw
        try {
          const chart = await yahooChart(symbol, '5d')
          const changePct =
            chart.regularMarketPrice != null && chart.previousClose
              ? ((chart.regularMarketPrice - chart.previousClose) / chart.previousClose) * 100
              : null
          return {
            symbol: raw,
            resolved: chart.symbol,
            kind: 'equity' as const,
            price: chart.regularMarketPrice,
            changePct,
            currency: chart.currency,
          }
        } catch (error) {
          return {
            symbol: raw,
            kind: 'equity' as const,
            price: null,
            changePct: null,
            currency: 'KRW',
            error: error instanceof Error ? error.message : '시세 실패',
          }
        }
      }),
    )

    const coinMarkets = coins.map((c) => (c.includes('-') ? c : `KRW-${c}`))
    const coinTickers = coinMarkets.length ? await upbitTickers(coinMarkets) : []
    const coinQuotes = coins.map((raw, i) => {
      const market = coinMarkets[i]
      const t = coinTickers.find((row) => row.market === market)
      return {
        symbol: raw,
        resolved: market,
        kind: 'coin' as const,
        price: t?.trade_price ?? null,
        changePct: t ? t.signed_change_rate * 100 : null,
        currency: 'KRW',
      }
    })

    return json({ quotes: [...stockQuotes, ...coinQuotes] })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: '/api/quotes',
  method: 'GET',
}
