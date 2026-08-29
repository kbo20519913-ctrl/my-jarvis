import Anthropic from '@anthropic-ai/sdk'
import { getEnv, HttpError } from './env.ts'

export const CLAUDE_MODEL = 'claude-sonnet-5'

export type Source = {
  title: string
  url: string
  snippet?: string
}

export function claudeClient(): Anthropic {
  const apiKey = getEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new HttpError(500, 'ANTHROPIC_API_KEY가 없습니다. Netlify 환경 변수에 넣어 주세요.')
  }
  return new Anthropic({ apiKey })
}

export async function askClaude(options: {
  system: string
  user: string
  maxTokens?: number
}): Promise<string> {
  const client = claudeClient()
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 2500,
    system: options.system,
    messages: [{ role: 'user', content: options.user }],
  })
  const block = message.content.find((part) => part.type === 'text')
  if (!block || block.type !== 'text') {
    throw new HttpError(502, 'Claude가 텍스트 응답을 주지 않았습니다.')
  }
  return block.text
}

export function parseJsonObject<T>(raw: string): T {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const text = fenced?.[1] ?? raw
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new HttpError(502, 'Claude 응답을 JSON으로 읽지 못했습니다.')
  }
  return JSON.parse(text.slice(start, end + 1)) as T
}

export const DISCLAIMER =
  '이 내용은 투자 자문이 아닙니다. 시세 예측을 보장하지 않으며, 매수·매도 결정은 본인 책임입니다.'
