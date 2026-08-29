import type { Config } from '@netlify/functions'
import { requireUser } from './_shared/auth.ts'
import { askClaude, DISCLAIMER, parseJsonObject } from './_shared/claude.ts'
import { errorResponse, json } from './_shared/env.ts'
import { formatSources, webSearch } from './_shared/search.ts'

const DOMAINS: Record<string, { query: string; focus: string }> = {
  world: {
    query: 'world economy outlook federal reserve inflation dollar oil today',
    focus: '세계 경제: 금리, 달러, 원자재, 주요국 성장과 리스크',
  },
  korea: {
    query: '한국 경제 전망 한국은행 금리 환율 코스피 수출',
    focus: '한국 경제: 금리, 환율, 수출, 내수, 증시 매크로',
  },
  stocks: {
    query: '코스피 코스닥 주식 펀드 ETF 외국인 수급 오늘',
    focus: '주식·펀드: 지수, 수급, 업종, 대표 ETF/펀드',
  },
  crypto: {
    query: 'bitcoin ethereum 비트코인 이더리움 암호화폐 규제 오늘',
    focus: '코인: BTC/ETH, 규제, 거래소, 온체인 흐름',
  },
}

export default async (req: Request, context: { params: Record<string, string> }) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(req)
    const domain = context.params.domain
    const spec = domain ? DOMAINS[domain] : undefined
    if (!spec) return json({ error: '알 수 없는 도메인입니다.' }, 404)

    const sources = await webSearch(spec.query)
    const raw = await askClaude({
      system: `한국어 시황 브리핑. ${DISCLAIMER}
주제: ${spec.focus}
검색에 근거하고 없는 수치는 쓰지 마라.
JSON만:
{"headline":"한 줄","bullets":["핵심 3-6개"],"watch":["앞으로 볼 이벤트"]}`,
      user: `검색 결과:\n${formatSources(sources)}`,
      maxTokens: 1800,
    })
    const parsed = parseJsonObject<{
      headline: string
      bullets: string[]
      watch: string[]
    }>(raw)

    return json({
      domain,
      headline: parsed.headline,
      bullets: parsed.bullets ?? [],
      watch: parsed.watch ?? [],
      sources,
      disclaimer: DISCLAIMER,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: '/api/market/:domain',
  method: 'GET',
}
