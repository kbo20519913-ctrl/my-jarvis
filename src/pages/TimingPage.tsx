import { useState, type FormEvent } from 'react'
import { Disclaimer } from '../components/Disclaimer.tsx'
import { PriceChart } from '../components/PriceChart.tsx'
import { SourceCards } from '../components/SourceCards.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { api, type Source } from '../lib/types.ts'

type TimingRes = {
  symbol: string
  kind: string
  price: number | null
  changePct: number | null
  currency: string
  candles: Array<{ t: number; c: number }>
  summary: string
  bias: string
  scenarios: Array<{ name: string; condition: string; note: string }>
  invalidation: string
  sources: Source[]
}

export function TimingPage() {
  const { session } = useAuth()
  const [symbol, setSymbol] = useState('005930')
  const [kind, setKind] = useState<'stock' | 'fund' | 'coin'>('stock')
  const [data, setData] = useState<TimingRes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(e: FormEvent) {
    e.preventDefault()
    const token = session?.access_token
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const res = await api<TimingRes>('/api/timing', token, {
        method: 'POST',
        body: JSON.stringify({ symbol, kind }),
      })
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">매수·매도 시나리오</h1>
      <Disclaimer className="mt-2" />
      <form className="mt-6 flex flex-wrap gap-2" onSubmit={(e) => void run(e)}>
        <label className="sr-only" htmlFor="symbol">
          종목
        </label>
        <input
          id="symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="005930 또는 AAPL 또는 KRW-BTC"
          className="field-box min-w-[12rem] flex-1"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'stock' | 'fund' | 'coin')}
          className="field-box w-auto"
        >
          <option value="stock">주식</option>
          <option value="fund">펀드</option>
          <option value="coin">코인</option>
        </select>
        <button type="submit" disabled={busy} className="btn-fill btn-fill-lg">
          {busy ? '분석 중' : '분석'}
        </button>
      </form>
      <p className="mt-2 text-[12px] text-mute">한국 주식은 6자리 코드, 미국은 티커, 코인은 Upbit 마켓(KRW-BTC).</p>
      {error ? <p className="mt-4 text-sm text-down">{error}</p> : null}
      {data ? (
        <div className="mt-8 space-y-6 rounded-[16px] bg-white p-5">
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-[36px] font-bold leading-[54px] tracking-tight">{formatNum(data.price)}</p>
            <p className={data.changePct != null && data.changePct >= 0 ? 'text-[17px] font-semibold text-up' : 'text-[17px] font-semibold text-down'}>
              {data.changePct != null ? `${data.changePct.toFixed(2)}%` : ''}
            </p>
            <p className="text-sm text-mute">{data.currency}</p>
          </div>
          <PriceChart candles={data.candles} label={data.symbol} />
          <p className="text-sm leading-relaxed">{data.summary}</p>
          <p className="text-[12px] text-gold">현재 기울기: {biasLabel(data.bias)}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {data.scenarios.map((s) => (
              <article key={s.name} className="surface-card p-4">
                <h2 className="text-[15px] font-semibold text-gold">{s.name}</h2>
                <p className="mt-2 text-sm">{s.condition}</p>
                <p className="mt-2 text-[13px] text-mute">{s.note}</p>
              </article>
            ))}
          </div>
          <p className="text-sm text-mute">깨지는 조건: {data.invalidation}</p>
          <SourceCards sources={data.sources} />
        </div>
      ) : null}
    </div>
  )
}

function formatNum(n: number | null) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

function biasLabel(bias: string) {
  if (bias === 'bull') return '강세 시나리오 비중'
  if (bias === 'bear') return '약세 시나리오 비중'
  return '중립'
}
