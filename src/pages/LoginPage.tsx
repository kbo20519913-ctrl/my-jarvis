import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo.tsx'
import { SupabaseDashboardHint } from '../components/SupabaseDashboardHint.tsx'
import { useAuth } from '../context/AuthContext.tsx'

export function LoginPage() {
  const { session, configured, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="page-title">MY JARVIS</h1>
        <p className="mt-4 text-[16px] leading-6 text-body">
          프론트 환경 변수 <code className="font-mono text-gold">VITE_SUPABASE_URL</code>,{' '}
          <code className="font-mono text-gold">VITE_SUPABASE_ANON_KEY</code>를 .env에 넣고
          개발 서버를 다시 시작해 주세요.
        </p>
        <SupabaseDashboardHint />
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'in') await signIn(email, password)
      else setMessage(await signUp(email, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : '실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
      <div className="mb-10">
        <BrandLogo />
      </div>
      <h1 className="text-[36px] font-bold leading-[54px] tracking-tight">들어가기</h1>
      <p className="mt-2 text-[16px] leading-6 text-body">
        세계·한국 경제와 주식, 펀드, 코인을 근거와 함께 봅니다.
      </p>
      <form className="mt-10 space-y-5" onSubmit={(e) => void submit(e)}>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-[15px] font-semibold">
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="field-box"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-[15px] font-semibold">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="field-box"
          />
        </div>
        {error ? <p className="text-sm text-down">{error}</p> : null}
        {message ? <p className="text-sm text-up">{message}</p> : null}
        <button type="submit" disabled={busy} className="btn-fill w-full">
          {busy ? '확인 중' : mode === 'in' ? '들어가기' : '가입하기'}
        </button>
      </form>
      <button
        type="button"
        className="btn-weak mt-4 w-full"
        onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
      >
        {mode === 'in' ? '계정이 없으면 가입' : '이미 있으면 로그인'}
      </button>
      <SupabaseDashboardHint />
    </div>
  )
}
