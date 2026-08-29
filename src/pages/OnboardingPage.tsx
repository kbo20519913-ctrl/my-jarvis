import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { supabase } from '../lib/supabase.ts'

const MBTI = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ']
const BLOOD = ['A', 'B', 'O', 'AB', '모름']

export function OnboardingPage() {
  const { user, onboarded, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthday, setBirthday] = useState('')
  const [mbti, setMbti] = useState('INTJ')
  const [bloodType, setBloodType] = useState('모름')
  const [oneLiner, setOneLiner] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (onboarded) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        nickname: nickname.trim(),
        birthday: birthday || null,
        mbti,
        blood_type: bloodType,
        one_liner: oneLiner.trim(),
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await refreshProfile()
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-xl px-6 py-12">
      <h1 className="page-title">입장 전 소개</h1>
      <p className="mt-2 text-[16px] leading-6 text-body">이름과 한 줄 소개를 남겨야 MY JARVIS를 쓸 수 있습니다.</p>
      <form className="mt-8 space-y-5" onSubmit={(e) => void submit(e)}>
        <Field label="이름" htmlFor="displayName">
          <input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field-box" />
        </Field>
        <Field label="별명" htmlFor="nickname">
          <input id="nickname" required value={nickname} onChange={(e) => setNickname(e.target.value)} className="field-box" />
        </Field>
        <Field label="생일" htmlFor="birthday">
          <input id="birthday" type="date" required value={birthday} onChange={(e) => setBirthday(e.target.value)} className="field-box" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="MBTI" htmlFor="mbti">
            <select id="mbti" value={mbti} onChange={(e) => setMbti(e.target.value)} className="field-box">
              {MBTI.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="혈액형" htmlFor="blood">
            <select id="blood" value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="field-box">
              {BLOOD.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="나를 표현하는 한 문장" htmlFor="oneLiner">
          <input
            id="oneLiner"
            required
            maxLength={80}
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="예: 실적보다 수급을 먼저 본다"
            className="field-box placeholder:text-mute"
          />
        </Field>
        {error ? <p className="text-sm text-down">{error}</p> : null}
        <button type="submit" disabled={busy} className="btn-fill w-full">
          {busy ? '저장 중' : '시작하기'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm">
        {label}
      </label>
      {children}
    </div>
  )
}
