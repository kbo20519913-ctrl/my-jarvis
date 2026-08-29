import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'
import { supabase } from '../lib/supabase.ts'
import { api, type YoutubeVideo } from '../lib/types.ts'

export function YoutubeStrip() {
  const { session, user, profile } = useAuth()
  const [videos, setVideos] = useState<YoutubeVideo[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function buildQuery() {
      const [{ data: topics }, { data: holdings }] = await Promise.all([
        supabase
          .from('question_topics')
          .select('topic')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('holdings').select('name, symbol, kind').eq('user_id', user!.id).limit(8),
      ])
      if (cancelled) return
      const topicWords = (topics ?? []).map((row) => row.topic as string).filter(Boolean)
      const holdingWords = (holdings ?? [])
        .flatMap((row) => [row.name as string, row.symbol as string])
        .filter(Boolean)
      const parts = [
        ...topicWords.slice(0, 3),
        ...holdingWords.slice(0, 3),
        profile?.one_liner,
        '한국 경제 주식 시황',
      ].filter((part): part is string => Boolean(part && part.trim()))
      setQuery(Array.from(new Set(parts)).join(' ').slice(0, 120))
    }
    void buildQuery()
    return () => {
      cancelled = true
    }
  }, [profile?.one_liner, user])

  const token = session?.access_token
  useEffect(() => {
    if (!token || !query) return
    let cancelled = false
    setLoading(true)
    api<{ videos: YoutubeVideo[]; error?: string }>(
      `/api/youtube?q=${encodeURIComponent(query)}`,
      token,
    )
      .then((res) => {
        if (cancelled) return
        setVideos(res.videos ?? [])
        setError(res.error ?? null)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query, token])

  return (
    <section className="border-b border-line bg-white">
      <div className="flex items-end justify-between gap-4 px-4 pt-3">
        <p className="text-[13px] font-semibold text-body">
          {nameFromQuery(query)} 맞춤 영상
        </p>
        {error ? <p className="text-[12px] text-down">{error}</p> : null}
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 py-3">
        {loading && !videos.length
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[200px] shrink-0">
                <div className="aspect-video rounded-[12px] bg-panel" />
                <div className="mt-2 h-3 w-4/5 bg-line" />
              </div>
            ))
          : null}
        {videos.map((video) => (
          <a
            key={video.id}
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="group w-[200px] shrink-0"
          >
            <div className="relative aspect-video overflow-hidden rounded-[12px] bg-panel">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-mute">
                  <Play size={22} strokeWidth={1.5} />
                </div>
              )}
              <span className="absolute bottom-1 right-1 rounded-[6px] bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-white">
                재생
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-paper group-hover:text-gold">
              {video.title}
            </p>
            <p className="mt-1 text-[11px] text-mute">{video.channel}</p>
          </a>
        ))}
      </div>
    </section>
  )
}

function nameFromQuery(query: string) {
  const first = query.split(/\s+/).filter(Boolean)[0]
  return first && first !== '한국' ? first : '당신'
}
