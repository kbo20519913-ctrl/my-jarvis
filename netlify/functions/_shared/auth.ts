import { createClient, type User } from '@supabase/supabase-js'
import { getEnv, HttpError } from './env.ts'

export function supabaseUrl(): string {
  return getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || ''
}

export function supabaseAnonKey(): string {
  return getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || ''
}

export function userClient(accessToken: string) {
  const url = supabaseUrl()
  const anon = supabaseAnonKey()
  if (!url || !anon) throw new HttpError(500, 'Supabase URL/anon key가 없습니다.')
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function serviceClient() {
  const url = supabaseUrl()
  const service = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) throw new HttpError(500, '서비스 롤 키가 없습니다.')
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireUser(req: Request): Promise<{ user: User; token: string }> {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, '로그인이 필요합니다.')

  const url = supabaseUrl()
  const anon = supabaseAnonKey()
  if (!url || !anon) {
    throw new HttpError(
      500,
      '서버에서 Supabase URL/anon 키를 읽지 못했습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY와 같은 값의 SUPABASE_URL, SUPABASE_ANON_KEY를 넣고 개발 서버를 재시작하세요.',
    )
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, '세션이 만료되었습니다. 다시 로그인해 주세요.')
  return { user: data.user, token }
}

export function isAdmin(user: User): boolean {
  const meta = user.app_metadata as { role?: string } | undefined
  return meta?.role === 'admin'
}
