import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bitcoin,
  CandlestickChart,
  Earth,
  Globe2,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Timer,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'
import { AlertBell } from './AlertBell.tsx'
import { BrandLogo } from './BrandLogo.tsx'
import { YoutubeStrip } from './YoutubeStrip.tsx'

const NAV = [
  { to: '/', label: '홈', icon: LayoutDashboard, end: true },
  { to: '/market/world', label: '세계', icon: Earth },
  { to: '/market/korea', label: '한국', icon: Landmark },
  { to: '/market/stocks', label: '주식·펀드', icon: CandlestickChart },
  { to: '/market/crypto', label: '코인', icon: Bitcoin },
  { to: '/timing', label: '타이밍', icon: Timer },
  { to: '/assets', label: '자산', icon: Wallet },
  { to: '/community', label: '커뮤니티', icon: MessageSquare },
  { to: '/foreign', label: '해외 의견', icon: Globe2 },
]

export function AppShell() {
  const { profile, signOut, isAdmin } = useAuth()
  const name = profile?.nickname || profile?.display_name || '사용자'
  const home = useLocation().pathname === '/'

  return (
    <div className="flex min-h-[100dvh] bg-ink text-paper">
      <aside className="flex w-16 shrink-0 flex-col border-r border-line bg-white md:w-56">
        <div className="flex h-[4.5rem] items-center justify-center border-b border-line px-2 md:justify-start md:px-4">
          <span className="md:hidden">
            <BrandLogo compact />
          </span>
          <span className="hidden md:block">
            <BrandLogo />
          </span>
        </div>
        <nav className="flex flex-1 flex-col items-stretch gap-1 p-2">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-2 rounded-[16px] px-2 py-3 md:justify-start md:px-3 ${
                    isActive
                      ? 'bg-gold text-white'
                      : 'text-body hover:bg-panel'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.7} />
                <span className="hidden text-[15px] font-semibold md:inline">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-line p-3">
          <p className="hidden truncate px-1 text-[13px] font-semibold text-paper md:block">{name}</p>
          {isAdmin ? (
            <p className="badge-status mt-2 hidden md:inline-flex">관리자</p>
          ) : null}
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] px-2 py-2 text-[15px] font-semibold text-body hover:bg-panel md:justify-start"
            title="나가기"
          >
            <LogOut size={18} strokeWidth={1.7} />
            <span className="hidden md:inline">나가기</span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-ink">
        {home ? null : <YoutubeStrip />}
        <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4">
          <p className="truncate text-[15px] text-body">
            {profile?.one_liner || '오늘의 시황을 근거와 함께'}
          </p>
          <AlertBell />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-panel p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
