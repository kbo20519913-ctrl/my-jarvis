import { useEffect, useState } from 'react'
import { Disclaimer } from '../components/Disclaimer.tsx'
import { SourceCards } from '../components/SourceCards.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { api, type Source } from '../lib/types.ts'

type Card = {
  name: string
  summary: string
  stance: string
  relatedHoldings: string[]
  sources: Source[]
}

export function ForeignPage() {
  const { session } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    api<{ cards: Card[] }>('/api/foreign', token)
      .then((res) => setCards(res.cards))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session?.access_token])

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">국장에 대한 해외 의견</h1>
      <p className="mt-2 text-[16px] leading-6 text-body">
        버핏, 달리오, 우드, 버리, 골드만, 모건스탠리 등의 공개 발언을 검색해 정리합니다.
        보유 종목이 언급되면 상단 알림으로도 남습니다.
      </p>
      <Disclaimer className="mt-3" />
      {loading ? <p className="mt-6 text-sm text-mute">해외 의견을 모으는 중. 검색과 정리를 여러 건 하므로 시간이 걸릴 수 있습니다.</p> : null}
      {error ? <p className="mt-6 text-sm text-down">{error}</p> : null}
      <div className="mt-8 space-y-8">
        {cards.map((card) => (
          <article key={card.name} className="surface-card p-5">
            <h2 className="text-lg">{card.name}</h2>
            <p className="mt-1 text-[12px] text-gold">{card.stance}</p>
            <p className="mt-3 text-sm leading-relaxed">{card.summary}</p>
            {card.relatedHoldings.length ? (
              <p className="mt-3 text-[13px] text-mute">내 보유와 겹침: {card.relatedHoldings.join(', ')}</p>
            ) : null}
            <SourceCards sources={card.sources} />
          </article>
        ))}
      </div>
    </div>
  )
}
