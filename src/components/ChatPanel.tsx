import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'
import { supabase } from '../lib/supabase.ts'
import { api, type AskResponse, type Message, type Source } from '../lib/types.ts'
import { Disclaimer } from './Disclaimer.tsx'
import { SourceCards } from './SourceCards.tsx'

type ChatPanelProps = {
  domain: string
  placeholder: string
}

export function ChatPanel({ domain, placeholder }: ChatPanelProps) {
  const { session, user } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function boot() {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user!.id)
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let id = existing?.id as string | undefined
      if (!id) {
        const { data: created, error: createError } = await supabase
          .from('conversations')
          .insert({ user_id: user!.id, domain, title: domain })
          .select('id')
          .single()
        if (createError) {
          setError(createError.message)
          return
        }
        id = created.id as string
      }
      if (cancelled || !id) return
      setConversationId(id)
      const { data: rows } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
      if (!cancelled) setMessages((rows as Message[]) ?? [])
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [domain, user])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  async function send() {
    const question = input.trim()
    const token = session?.access_token
    if (!question || !token || !user || !conversationId || pending) return
    setInput('')
    setPending(true)
    setError(null)

    const { data: userRow, error: userErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: question,
        sources: [],
      })
      .select('*')
      .single()
    if (userErr || !userRow) {
      setError(userErr?.message ?? '메시지를 저장하지 못했습니다.')
      setPending(false)
      return
    }
    setMessages((prev) => [...prev, userRow as Message])

    try {
      const history = [...messages, userRow as Message].slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await api<AskResponse>('/api/search-ask', token, {
        method: 'POST',
        body: JSON.stringify({ question, domain, history }),
      })
      const { data: botRow, error: botErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: res.answer,
          sources: res.sources ?? [],
        })
        .select('*')
        .single()
      if (botErr || !botRow) throw botErr ?? new Error('답변 저장 실패')
      setMessages((prev) => [...prev, botRow as Message])

      const topics = res.topics ?? []
      if (topics.length) {
        await supabase.from('question_topics').insert(
          topics.map((topic) => ({ user_id: user.id, topic })),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 요청에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Disclaimer className="px-1 pb-3" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && !pending ? (
          <p className="text-sm text-mute">질문을 남기면 웹 검색과 Claude가 출처와 함께 정리합니다. 나갔다가 돌아와도 이 대화는 유지됩니다.</p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-8 rounded-[16px] bg-gold p-4 text-white'
                : 'mr-8 rounded-[16px] bg-white p-4 text-paper'
            }
          >
            <p className={`text-[12px] font-semibold ${message.role === 'user' ? 'text-white/80' : 'text-mute'}`}>
              {message.role === 'user' ? '나' : 'MY JARVIS'}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[16px] leading-6">{message.content}</p>
            <SourceCards sources={(message.sources as Source[]) ?? []} />
          </article>
        ))}
        {pending ? <p className="text-[15px] font-semibold text-gold">검색하고 정리하는 중</p> : null}
        {error ? <p className="text-sm text-down">{error}</p> : null}
        <div ref={endRef} />
      </div>
      <form
        className="mt-4 flex gap-2 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <label className="sr-only" htmlFor={`ask-${domain}`}>
          질문
        </label>
        <input
          id={`ask-${domain}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="field-box min-w-0 flex-1 text-paper placeholder:text-mute"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-fill-lg btn-fill shrink-0"
        >
          <Send size={14} strokeWidth={1.75} />
          질문
        </button>
      </form>
    </div>
  )
}
