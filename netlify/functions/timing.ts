import type { Config } from '@netlify/functions'
import { requireUser } from './_shared/auth.ts'
import { askClaude, DISCLAIMER, parseJsonObject } from './_shared/claude.ts'
import { errorResponse, json, readJson } from './_shared/env.ts'
import { upbitCandles, upbitTickers, yahooChart } from './_shared/market-data.ts'
import { formatSources, webSearch } from './_shared/search.ts'

type Body = { symbol?: string; kind?: 'stock' | 'fund' | 'coin' }

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(req)
    const body = await readJson<Body>(req)
    const symbol = body.symbol?.trim().toUpperCase()
    if (!symbol) return json({ error: '종목 코드를 입력해 주세요.' }, 400)
    const kind = body.kind ?? inferKind(symbol)

    const [quote, sources] = await Promise.all([
      loadQuote(symbol, kind),
      webSearch(`${symbol} 주가 전망 뉴스 애널리스트 의견 매수 매도`),
    ])

    const raw = await askClaude({
      system: `한국어 종목 시나리오 분석. ${DISCLAIMER}
매수/매도를 지시하지 마라. 강세·중립·약세 시나리오와 근거만.
검색과 시세에 없는 숫자를 만들지 마라.
JSON만:
{"summary":"","bias":"bull|neutral|bear","scenarios":[{"name":"강세","condition":"","note":""},{"name":"중립","condition":"","note":""},{"name":"약세","condition":"","note":""}],"invalidation":"이 분석이 깨지는 조건","citations":[{"title":"","url":"","note":""}]}`,
      user: `종목: ${symbol} (${kind})
현재가: ${quote.price}
전일대비: ${quote.changePct ?? 'n/a'}
통화: ${quote.currency}
최근 종가 샘플(최근 10개): ${quote.candles.slice(-10).map((c) => c.c).join(', ')}

검색:
${formatSources(sources)}`,
    })

    const parsed = parseJsonObject<{
      summary: string
      bias: string
      scenarios: Array<{ name: string; condition: string; note: string }>
      invalidation: string
      citations?: Array<{ title?: string; url?: string; note?: string }>
    }>(raw)

    return json({
      symbol,
      kind,
      price: quote.price,
      changePct: quote.changePct,
      currency: quote.currency,
      candles: quote.candles,
      summary: parsed.summary,
      bias: parsed.bias,
      scenarios: parsed.scenarios ?? [],
      invalidation: parsed.invalidation,
      sources: (parsed.citations ?? [])
        .filter((c) => c.url)
        .map((c) => ({ title: c.title || c.url, url: c.url, snippet: c.note }))
        .concat(sources)
        .filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i)
        .slice(0, 10),
      disclaimer: DISCLAIMER,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function inferKind(symbol: string): 'stock' | 'coin' {
  if (symbol.includes('-') || symbol.startsWith('KRW') || ['BTC', 'ETH', 'XRP', 'SOL'].includes(symbol)) {
    return 'coin'
  }
  return 'stock'
}

async function loadQuote(symbol: string, kind: string) {
  if (kind === 'coin') {
    const market = symbol.includes('-') ? symbol : `KRW-${symbol.replace('KRW', '')}`
    const [tickers, candles] = await Promise.all([upbitTickers([market]), upbitCandles(market)])
    const t = tickers[0]
    return {
      price: t?.trade_price ?? candles.at(-1)?.c ?? null,
      changePct: t ? t.signed_change_rate * 100 : null,
      currency: 'KRW',
      candles,
    }
  }
  const chart = await yahooChart(normalizeEquity(symbol))
  const changePct =
    chart.regularMarketPrice != null && chart.previousClose
      ? ((chart.regularMarketPrice - chart.previousClose) / chart.previousClose) * 100
      : null
  return {
    price: chart.regularMarketPrice,
    changePct,
    currency: chart.currency,
    candles: chart.candles,
  }
}

function normalizeEquity(symbol: string): string {
  if (/^\d{6}$/.test(symbol)) return `${symbol}.KS`
  return symbol
}

export const config: Config = {
  path: '/api/timing',
  method: 'POST',
}
