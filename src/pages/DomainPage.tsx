import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bitcoin, CandlestickChart, Earth, Landmark } from 'lucide-react'
import { ChatPanel } from '../components/ChatPanel.tsx'
import { Disclaimer } from '../components/Disclaimer.tsx'
import { SourceCards } from '../components/SourceCards.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { api, type Source } from '../lib/types.ts'

const META: Record<
  string,
  { title: string; blurb: string; icon: typeof Earth; placeholder: string }
> = {
  world: {
    title: '세계 경제',
    blurb: '금리, 달러, 원자재, 주요국 성장만 다룹니다.',
    icon: Earth,
    placeholder: '예: 연준 동결과 신흥국 자금 흐름',
  },
  korea: {
    title: '한국 경제',
    blurb: '한은, 환율, 수출, 내수, 국내 증시 매크로만 다룹니다.',
    icon: Landmark,
    placeholder: '예: 원달러가 수출 기업에 미치는 영향',
  },
  stocks: {
    title: '주식 · 펀드',
    blurb: '지수, 수급, 개별 종목, ETF와 펀드만 다룹니다.',
    icon: CandlestickChart,
    placeholder: '예: 반도체 ETF와 외국인 수급',
  },
  crypto: {
    title: '코인',
    blurb: 'BTC·ETH, 규제, 거래소, 온체인 이슈만 다룹니다.',
    icon: Bitcoin,
    placeholder: '예: 비트코인 현물 ETF 이후 수급',
  },
}

type Brief = {
  headline: string
  bullets: string[]
  watch: string[]
  sources: Source[]
}

export function DomainPage() {
  const { domain = 'world' } = useParams()
  const meta = META[domain]
  const { session } = useAuth()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = session?.access_token
    if (!token || !meta) return
    setLoading(true)
    setError(null)
    api<Brief>(`/api/market/${domain}`, token)
      .then(setBrief)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [domain, meta, session?.access_token])

  if (!meta) return <p>없는 메뉴입니다.</p>
  const Icon = meta.icon

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section>
        <div className="flex items-center gap-3">
          <Icon size={22} className="text-gold" strokeWidth={1.6} />
          <h1 className="page-title">{meta.title}</h1>
        </div>
        <p className="mt-2 text-[16px] leading-6 text-body">{meta.blurb}</p>
        <Disclaimer className="mt-3" />
        {loading ? <p className="mt-6 text-sm text-mute">브리핑을 가져오는 중</p> : null}
        {error ? <p className="mt-6 text-sm text-down">{error}</p> : null}
        {brief ? (
          <div className="mt-6 rounded-[16px] bg-white p-5">
            <p className="text-[22px] font-semibold leading-[33px]">{brief.headline}</p>
            <ul className="mt-4 space-y-3 text-[16px] leading-6 text-body">
              {brief.bullets.map((b) => (
                <li key={b} className="pl-0">
                  {b}
                </li>
              ))}
            </ul>
            {brief.watch.length ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold text-gold">앞으로 볼 것</p>
                <ul className="mt-2 space-y-1 text-sm text-mute">
                  {brief.watch.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <SourceCards sources={brief.sources} />
          </div>
        ) : null}
      </section>
      <section className="flex min-h-[28rem] flex-col rounded-[16px] bg-white p-4 md:p-5">
        <ChatPanel domain={domain} placeholder={meta.placeholder} />
      </section>
    </div>
  )
}
