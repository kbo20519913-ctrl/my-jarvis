import { claudeClient, CLAUDE_MODEL, type Source } from './claude.ts'
import { customSearchApiKey, geminiApiKey, getEnv, HttpError } from './env.ts'

export async function webSearch(query: string, num = 8): Promise<Source[]> {
  const cx = getEnv('GOOGLE_CSE_ID')
  const cseKey = customSearchApiKey()
  const errors: string[] = []

  if (cseKey && cx) {
    const cse = await customSearch(cseKey, cx, query, num)
    if (cse.sources?.length) return cse.sources
    if (cse.message) errors.push(cse.message)
  }

  const geminiKey = geminiApiKey()
  if (geminiKey) {
    const gemini = await geminiGroundedSearch(geminiKey, query, num)
    if (gemini.sources.length) return gemini.sources
    if (gemini.message) errors.push(gemini.message)
  }

  const anthropic = await claudeWebSearch(query, num)
  if (anthropic.sources.length) return anthropic.sources
  if (anthropic.message) errors.push(anthropic.message)

  const joined = errors.filter(Boolean).join(' / ')
  if (isCseBlocked(joined)) {
    throw new HttpError(
      502,
      '이 API 키는 Custom Search가 막혀 있습니다. 유튜브 전용 키는 검색에 쓰지 마세요.',
    )
  }
  if (/quota|rate-limit|429/i.test(joined)) {
    throw new HttpError(
      502,
      'Gemini 검색 할당량이 끝났습니다. AI Studio 결제/한도를 확인하거나 잠시 뒤 다시 시도해 주세요.',
    )
  }
  throw new HttpError(502, joined || '웹 검색에 실패했습니다.')
}

function isCseBlocked(message: string): boolean {
  return /customsearch.*are blocked|Requests to this API customsearch/i.test(message)
}

async function customSearch(
  key: string,
  cx: string,
  query: string,
  num: number,
): Promise<{ sources: Source[] | null; message: string }> {
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(Math.min(num, 10)))
  url.searchParams.set('hl', 'ko')
  url.searchParams.set('gl', 'kr')

  const res = await fetch(url)
  const data = (await res.json()) as {
    error?: { message?: string }
    items?: Array<{ title?: string; link?: string; snippet?: string }>
  }
  if (res.ok) {
    return {
      sources: (data.items ?? [])
        .filter((item) => item.link && item.title)
        .map((item) => ({
          title: item.title as string,
          url: item.link as string,
          snippet: item.snippet,
        })),
      message: '',
    }
  }
  return { sources: null, message: data.error?.message || 'Google Custom Search 실패' }
}

async function geminiGroundedSearch(
  key: string,
  query: string,
  num: number,
): Promise<{ sources: Source[]; message: string }> {
  const models = ['gemini-3.6-flash', 'gemini-flash-latest']
  let lastError = ''
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
        }),
      },
    )
    const data = (await res.json()) as {
      error?: { message?: string; status?: string }
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string }
            retrievedContext?: { uri?: string; title?: string }
          }>
        }
      }>
    }
    if (!res.ok) {
      lastError = data.error?.message || lastError
      if (res.status === 429) break
      continue
    }
    const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') ?? ''
    const sources = chunks
      .map((chunk) => {
        const web = chunk.web || chunk.retrievedContext
        return {
          title: web?.title?.trim() || web?.uri || '',
          url: web?.uri || '',
          snippet: text.slice(0, 180) || undefined,
        }
      })
      .filter((item) => item.url)
      .slice(0, num)
    if (sources.length) return { sources, message: '' }
    if (text.trim()) {
      return {
        sources: [{ title: 'Gemini 웹 근거', url: 'https://google.com/search?q=' + encodeURIComponent(query), snippet: text.slice(0, 180) }],
        message: '',
      }
    }
  }
  return { sources: [], message: lastError }
}

async function claudeWebSearch(
  query: string,
  num: number,
): Promise<{ sources: Source[]; message: string }> {
  try {
    const client = claudeClient()
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      tools: [
        {
          type: 'web_search_20260318',
          name: 'web_search',
          max_uses: 2,
          user_location: { type: 'approximate', country: 'KR' },
        },
      ],
      messages: [{ role: 'user', content: `최신 한국어 웹 자료를 찾아라: ${query}` }],
    })
    const sources: Source[] = []
    for (const block of message.content) {
      if (block.type !== 'web_search_tool_result') continue
      if (!Array.isArray(block.content)) continue
      for (const item of block.content) {
        if (item.type === 'web_search_result' && item.url) {
          sources.push({
            title: item.title || item.url,
            url: item.url,
          })
        }
      }
    }
    return { sources: sources.slice(0, num), message: sources.length ? '' : 'Claude 웹 검색 결과가 비었습니다.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Claude 웹 검색 실패'
    return { sources: [], message }
  }
}

export function formatSources(sources: Source[]): string {
  if (sources.length === 0) return '(검색 결과 없음)'
  return sources
    .map((s, i) => `${i + 1}. ${s.title}\n   URL: ${s.url}\n   ${s.snippet ?? ''}`)
    .join('\n')
}
