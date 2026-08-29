import type { Config } from '@netlify/functions'
import { requireUser, userClient } from './_shared/auth.ts'
import { askClaude, DISCLAIMER, parseJsonObject } from './_shared/claude.ts'
import { errorResponse, json } from './_shared/env.ts'
import { FOREIGN_INVESTORS } from './_shared/investors.ts'
import { formatSources, webSearch } from './_shared/search.ts'

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const { token, user } = await requireUser(req)
    const supabase = userClient(token)
    const { data: holdings } = await supabase
      .from('holdings')
      .select('symbol, name, kind')
      .eq('user_id', user.id)

    const holdingText = (holdings ?? [])
      .map((h) => `${h.name} (${h.symbol ?? '-'})`)
      .join(', ')

    const cards = await Promise.all(
      FOREIGN_INVESTORS.map(async (investor) => {
        const sources = await webSearch(`${investor.query} 한국 증시 의견`, 5)
        const raw = await askClaude({
          system: `해외 투자자/기관의 공개된 발언만 한국어로 정리. ${DISCLAIMER}
없는 발언을 만들지 마라. JSON만:
{"summary":"3-6문장","stance":"한국 증시에 대한 톤","relatedHoldings":["사용자 보유와 겹치면 종목명"]}`,
          maxTokens: 900,
          user: `인물/기관: ${investor.name}
사용자 보유: ${holdingText || '(없음)'}
검색:
${formatSources(sources)}`,
        })
        const parsed = parseJsonObject<{
          summary: string
          stance: string
          relatedHoldings?: string[]
        }>(raw)
        return {
          name: investor.name,
          summary: parsed.summary,
          stance: parsed.stance,
          relatedHoldings: parsed.relatedHoldings ?? [],
          sources,
        }
      }),
    )

    return json({ cards, disclaimer: DISCLAIMER })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: '/api/foreign',
  method: 'GET',
}
