import type { Config } from '@netlify/functions'
import { requireUser } from './_shared/auth.ts'
import { askClaude, DISCLAIMER, parseJsonObject, type Source } from './_shared/claude.ts'
import { errorResponse, json, readJson } from './_shared/env.ts'
import { formatSources, webSearch } from './_shared/search.ts'

type Body = {
  question?: string
  domain?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

const DOMAIN_HINT: Record<string, string> = {
  home: '세계·한국 경제, 주식, 펀드, 코인을 폭넓게 다루되 질문 범위 안에서만 답한다.',
  world: '세계 경제(금리, 달러, 원자재, 미·중, 유럽)만 다룬다.',
  korea: '한국 경제(금리, 환율, 부동산, 수출, 정책, 코스피/코스닥 매크로)만 다룬다.',
  stocks: '주식과 펀드(개별 종목, 지수, ETF, 공모펀드)만 다룬다.',
  crypto: '암호화폐와 온체인·규제·거래소 이슈만 다룬다.',
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(req)
    const body = await readJson<Body>(req)
    const question = body.question?.trim()
    if (!question) return json({ error: '질문을 입력해 주세요.' }, 400)

    const domain = body.domain && DOMAIN_HINT[body.domain] ? body.domain : 'home'
    const sources = await webSearch(question)
    const history = (body.history ?? []).slice(-8)
      .map((m) => `${m.role === 'user' ? '사용자' : '비서'}: ${m.content}`)
      .join('\n')

    const raw = await askClaude({
      system: `당신은 한국어로 답하는 경제 시황 분석가다. ${DISCLAIMER}
${DOMAIN_HINT[domain]}
검색 결과에 없는 사실을 지어내지 마라. 숫자는 출처와 함께.
미래는 시나리오로만 말하고 확정하지 마라.
반드시 JSON만 출력:
{"answer":"본문","topics":["유튜브 검색용 짧은 키워드 1-3개"],"citations":[{"title":"","url":"","note":""}]}`,
      user: `이전 대화:\n${history || '(없음)'}\n\n질문:\n${question}\n\n웹 검색 결과:\n${formatSources(sources)}`,
    })

    const parsed = parseJsonObject<{
      answer: string
      topics?: string[]
      citations?: Array<{ title?: string; url?: string; note?: string }>
    }>(raw)

    const citations: Source[] = (parsed.citations ?? [])
      .filter((c) => c.url)
      .map((c) => ({
        title: c.title || c.url || '출처',
        url: c.url as string,
        snippet: c.note,
      }))

    const merged = citations.length > 0 ? citations : sources

    return json({
      answer: parsed.answer,
      sources: merged,
      topics: (parsed.topics ?? []).filter(Boolean).slice(0, 3),
      disclaimer: DISCLAIMER,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: '/api/search-ask',
  method: 'POST',
}
