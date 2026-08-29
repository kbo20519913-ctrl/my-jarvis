import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'
import { supabase } from '../lib/supabase.ts'
import type { Comment, Post, Reaction } from '../lib/types.ts'

const EMOJIS = ['👍', '🔥', '👀', '❓', '📉', '📈']

type PostView = Post & { author?: string }

export function CommunityPage() {
  const { postId } = useParams()
  if (postId) return <PostDetail postId={postId} />
  return <PostList />
}

function PostList() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostView[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [ticker, setTicker] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: loadError } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(loadError.message)
      return
    }
    const list = (data as Post[]) ?? []
    const ids = [...new Set(list.map((p) => p.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, nickname, display_name').in('id', ids)
    const map = new Map((profiles ?? []).map((p) => [p.id as string, (p.nickname || p.display_name) as string]))
    setPosts(list.map((p) => ({ ...p, author: map.get(p.user_id) || '익명' })))
  }

  useEffect(() => {
    void load()
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const { error: insertError } = await supabase.from('posts').insert({
      user_id: user.id,
      title: title.trim(),
      body: body.trim(),
      ticker: ticker.trim() || null,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTitle('')
    setBody('')
    setTicker('')
    await load()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="page-title">종목 이야기</h1>
      <p className="mt-2 text-[16px] leading-6 text-body">주식 종목에 대해 자유롭게 남깁니다. 관리자는 글 수정·삭제와 답글을 할 수 있습니다.</p>
      <form className="surface-card mt-6 space-y-2 p-4" onSubmit={(e) => void create(e)}>
        <input required placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className="field-box" />
        <input placeholder="종목 코드 (선택)" value={ticker} onChange={(e) => setTicker(e.target.value)} className="field-box" />
        <textarea required rows={4} placeholder="본문" value={body} onChange={(e) => setBody(e.target.value)} className="field-box" />
        <button type="submit" className="btn-fill btn-fill-lg">글쓰기</button>
      </form>
      {error ? <p className="mt-3 text-sm text-down">{error}</p> : null}
      <ul className="mt-8 space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="surface-card p-4">
            <Link to={`/community/${post.id}`} className="block hover:text-gold">
              <p className="text-[12px] text-mute">
                {post.author}
                {post.ticker ? ` · ${post.ticker}` : ''}
                {post.edited_by_admin ? ' · 관리자 수정' : ''}
              </p>
              <h2 className="mt-1 text-lg">{post.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-mute">{post.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PostDetail({ postId }: { postId: string }) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState<PostView | null>(null)
  const [comments, setComments] = useState<(Comment & { author?: string })[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data: postRow, error: postError } = await supabase.from('posts').select('*').eq('id', postId).single()
    if (postError || !postRow) {
      setError(postError?.message ?? '글을 찾을 수 없습니다.')
      return
    }
    const p = postRow as Post
    const { data: author } = await supabase.from('profiles').select('nickname, display_name').eq('id', p.user_id).maybeSingle()
    setPost({ ...p, author: (author?.nickname || author?.display_name) as string | undefined })
    setEditTitle(p.title)
    setEditBody(p.body)

    const { data: commentRows } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at')
    const list = (commentRows as Comment[]) ?? []
    const ids = [...new Set(list.map((c) => c.user_id))]
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, nickname, display_name').in('id', ids)
      : { data: [] }
    const map = new Map((profiles ?? []).map((row) => [row.id as string, (row.nickname || row.display_name) as string]))
    setComments(list.map((c) => ({ ...c, author: map.get(c.user_id) || '익명' })))

    const { data: reactionRows } = await supabase.from('reactions').select('*').eq('post_id', postId)
    setReactions((reactionRows as Reaction[]) ?? [])
  }

  useEffect(() => {
    void load()
  }, [postId])

  async function addComment(adminReply = false) {
    if (!user || !body.trim()) return
    const { error: insertError } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      body: body.trim(),
      is_admin_reply: adminReply && isAdmin,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setBody('')
    await load()
  }

  async function saveEdit() {
    if (!post) return
    const payload: Partial<Post> = { title: editTitle, body: editBody }
    if (isAdmin && user?.id !== post.user_id) payload.edited_by_admin = true
    const { error: updateError } = await supabase.from('posts').update(payload).eq('id', postId)
    if (updateError) setError(updateError.message)
    else {
      setEditing(false)
      await load()
    }
  }

  async function removePost() {
    const { error: delError } = await supabase.from('posts').delete().eq('id', postId)
    if (delError) setError(delError.message)
    else navigate('/community')
  }

  async function removeComment(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    await load()
  }

  async function toggleEmoji(emoji: string) {
    if (!user) return
    const existing = reactions.find((r) => r.user_id === user.id && r.emoji === emoji)
    if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
    else await supabase.from('reactions').insert({ post_id: postId, user_id: user.id, emoji })
    await load()
  }

  if (!post) return <p className="text-sm text-mute">{error || '불러오는 중'}</p>
  const canModerate = isAdmin || user?.id === post.user_id

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/community" className="text-sm text-gold">목록</Link>
      {editing ? (
        <div className="mt-4 space-y-2">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="field-box" />
          <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} className="field-box" />
          <button type="button" onClick={() => void saveEdit()} className="btn-fill btn-fill-lg">저장</button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[12px] text-mute">
            {post.author}
            {post.ticker ? ` · ${post.ticker}` : ''}
            {post.edited_by_admin ? ' · 관리자 수정' : ''}
          </p>
          <h1 className="page-title mt-1">{post.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>
        </>
      )}
      {canModerate ? (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="btn-weak">
            <Pencil size={14} /> 수정
          </button>
          <button type="button" onClick={() => void removePost()} className="inline-flex h-10 items-center gap-1 rounded-[7px] px-4 text-[15px] font-semibold text-down hover:bg-panel">
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {EMOJIS.map((emoji) => {
          const count = reactions.filter((r) => r.emoji === emoji).length
          const mine = reactions.some((r) => r.emoji === emoji && r.user_id === user?.id)
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => void toggleEmoji(emoji)}
              className={`rounded-[8px] px-2 py-1 text-sm ${mine ? 'bg-weak text-weak-fg' : 'bg-panel'}`}
            >
              {emoji} {count || ''}
            </button>
          )
        })}
      </div>

      <h2 className="mt-10 text-lg">댓글</h2>
      <ul className="mt-3 space-y-3">
        {comments.map((c) => (
          <li key={c.id} className={`rounded-[16px] p-3 ${c.is_admin_reply ? 'bg-weak' : 'bg-white'}`}>
            <p className="text-[12px] text-mute">
              {c.author}
              {c.is_admin_reply ? ' · 관리자 답글' : ''}
            </p>
            <p className="mt-1 text-sm">{c.body}</p>
            {isAdmin || c.user_id === user?.id ? (
              <button type="button" className="mt-2 text-[12px] text-down" onClick={() => void removeComment(c.id)}>
                삭제
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          void addComment(false)
        }}
      >
        <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="field-box" placeholder="댓글" />
        <div className="flex gap-2">
          <button type="submit" className="btn-fill btn-fill-lg">댓글</button>
          {isAdmin ? (
            <button type="button" onClick={() => void addComment(true)} className="btn-weak">
              관리자 답글
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-down">{error}</p> : null}
    </div>
  )
}
