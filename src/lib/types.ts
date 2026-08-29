export type Source = {
  title: string
  url: string
  snippet?: string
}

export type Profile = {
  id: string
  display_name: string | null
  nickname: string | null
  birthday: string | null
  mbti: string | null
  blood_type: string | null
  one_liner: string | null
  onboarded_at: string | null
}

export type Message = {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[]
  created_at: string
}

export type Holding = {
  id: string
  user_id: string
  kind: 'stock' | 'fund' | 'coin' | 'deposit' | 'savings'
  symbol: string | null
  name: string
  quantity: number
  avg_price: number
  cash_balance: number
  currency: string
}

export type Post = {
  id: string
  user_id: string
  title: string
  body: string
  ticker: string | null
  edited_by_admin: boolean
  created_at: string
  updated_at: string
}

export type Comment = {
  id: string
  post_id: string
  user_id: string
  body: string
  is_admin_reply: boolean
  created_at: string
}

export type Reaction = {
  id: string
  post_id: string
  user_id: string
  emoji: string
}

export type AlertRow = {
  id: string
  title: string
  body: string
  source_url: string | null
  investor_name: string | null
  symbol: string | null
  read_at: string | null
  created_at: string
}

export type YoutubeVideo = {
  id: string
  title: string
  channel: string
  thumbnail: string
  url: string
}

export type AskResponse = {
  answer: string
  sources: Source[]
  topics: string[]
  disclaimer: string
}

export async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `요청 실패 (${res.status})`)
  }
  return data
}
