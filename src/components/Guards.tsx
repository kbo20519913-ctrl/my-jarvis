import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'

export function RequireAuth() {
  const { loading, session, configured } = useAuth()
  if (!configured) return <Navigate to="/login" replace />
  if (loading) return <p className="p-8 text-sm text-mute">세션 확인 중</p>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireOnboarding() {
  const { loading, onboarded, session } = useAuth()
  if (loading) return <p className="p-8 text-sm text-mute">프로필 확인 중</p>
  if (session && !onboarded) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
