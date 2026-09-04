import { getEnv, HttpError } from './env.ts'

const TOSS_BASE = 'https://openapi.tossinvest.com'

type TokenCache = { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

type TossErrorBody = {
  error?: { message?: string; code?: string }
  message?: string
}

type TossEnvelope<T> = {
  result?: T
  error?: { message?: string; code?: string }
}

export function tossConfigured(): boolean {
  return Boolean(getEnv('TOSSINVEST_CLIENT_ID') && getEnv('TOSSINVEST_CLIENT_SECRET'))
}

export async function tossAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token

  const clientId = getEnv('TOSSINVEST_CLIENT_ID')
  const clientSecret = getEnv('TOSSINVEST_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new HttpError(
      500,
      'TOSSINVEST_CLIENT_ID / TOSSINVEST_CLIENT_SECRET가 없습니다. Netlify 환경 변수에 넣어 주세요.',
    )
  }

  const res = await fetch(`${TOSS_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new HttpError(
      502,
      data.error_description || data.error || '토스증권 인증에 실패했습니다.',
    )
  }
  const expiresIn = Number(data.expires_in) || 3600
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresIn * 1000,
  }
  return tokenCache.token
}

function tossErrorMessage(body: TossErrorBody, fallback: string): string {
  return body.error?.message || body.message || fallback
}

export async function tossGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const token = await tossAccessToken()
  const url = new URL(path, TOSS_BASE)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') url.searchParams.set(key, value)
    }
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => ({}))) as TossEnvelope<T> & TossErrorBody
  if (!res.ok) {
    throw new HttpError(res.status === 429 ? 429 : 502, tossErrorMessage(data, '토스증권 API 호출에 실패했습니다.'))
  }
  if (data.result === undefined) {
    throw new HttpError(502, tossErrorMessage(data, '토스증권 응답에 result가 없습니다.'))
  }
  return data.result
}

export function num(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

type StockInfo = {
  symbol: string
  name: string
  englishName?: string
  market?: string
  currency?: string
  sharesOutstanding?: string
  securityType?: string
}

const stockCache = new Map<string, { at: number; info: StockInfo }>()
const STOCK_TTL_MS = 60 * 60 * 1000

export async function tossStocks(symbols: string[]): Promise<StockInfo[]> {
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))]
  if (!unique.length) return []
  const now = Date.now()
  const missing: string[] = []
  const found: StockInfo[] = []
  for (const symbol of unique) {
    const hit = stockCache.get(symbol)
    if (hit && now - hit.at < STOCK_TTL_MS) found.push(hit.info)
    else missing.push(symbol)
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100)
    const rows = await tossGet<StockInfo[]>('/api/v1/stocks', { symbols: chunk.join(',') })
    for (const row of rows ?? []) {
      stockCache.set(row.symbol, { at: now, info: row })
      found.push(row)
    }
  }
  return found
}

export type TossPrice = {
  symbol: string
  lastPrice: string
  currency: string
  timestamp?: string | null
}

export async function tossPrices(symbols: string[]): Promise<TossPrice[]> {
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))]
  if (!unique.length) return []
  const out: TossPrice[] = []
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const rows = await tossGet<TossPrice[]>('/api/v1/prices', { symbols: chunk.join(',') })
    out.push(...(rows ?? []))
  }
  return out
}

export type TossCandle = {
  timestamp: string
  openPrice: string
  highPrice: string
  lowPrice: string
  closePrice: string
  volume: string
  currency?: string
}

export async function tossCandles(
  symbol: string,
  interval: '1m' | '1d',
  count = 100,
): Promise<TossCandle[]> {
  const wanted = Math.min(Math.max(count, 1), 400)
  const candles: TossCandle[] = []
  let before: string | undefined
  while (candles.length < wanted) {
    const page = await tossGet<{ candles: TossCandle[]; nextBefore?: string | null }>('/api/v1/candles', {
      symbol,
      interval,
      count: String(Math.min(200, wanted - candles.length)),
      before,
    })
    const rows = page.candles ?? []
    candles.push(...rows)
    if (!page.nextBefore || rows.length === 0) break
    before = page.nextBefore
  }
  return candles
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-wanted)
}

export type RankingItem = {
  rank: number
  symbol: string
  currency: string
  price: { lastPrice: string; basePrice: string; changeRate?: string | null }
  tradingVolume: string
  tradingAmount: string
}

export type RankingResult = {
  rankedAt?: string | null
  rankings: RankingItem[]
}

export const RANKING_TYPES = [
  'MARKET_TRADING_AMOUNT',
  'MARKET_TRADING_VOLUME',
  'TOP_GAINERS',
  'TOP_LOSERS',
  'TOSS_SECURITIES_TRADING_AMOUNT',
  'TOSS_SECURITIES_TRADING_VOLUME',
] as const

export const RANKING_DURATIONS = ['realtime', '1d', '1w', '1mo', '3mo', '6mo', '1y'] as const
export const MARKET_COUNTRIES = ['KR', 'US'] as const
