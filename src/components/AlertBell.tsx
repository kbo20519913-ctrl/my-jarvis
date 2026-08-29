import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'
import { supabase } from '../lib/supabase.ts'
import type { AlertRow } from '../lib/types.ts'

export function AlertBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertRow[]>([])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setAlerts((data as AlertRow[]) ?? [])
    }
    void load()
    const channel = supabase
      .channel('alerts-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AlertRow
          setAlerts((prev) => [row, ...prev])
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(row.title, { body: row.body })
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  const unread = alerts.filter((a) => !a.read_at).length

  async function markAllRead() {
    if (!user) return
    const ids = alerts.filter((a) => !a.read_at).map((a) => a.id)
    if (!ids.length) return
    await supabase.from('alerts').update({ read_at: new Date().toISOString() }).in('id', ids)
    setAlerts((prev) => prev.map((a) => ({ ...a, read_at: a.read_at ?? new Date().toISOString() })))
  }

  async function enablePush() {
    if (typeof Notification === 'undefined') return
    await Notification.requestPermission()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          void markAllRead()
        }}
        className="relative rounded-[12px] border border-line p-2 text-paper hover:border-gold hover:text-gold"
        aria-label="알림"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-[6px] bg-gold px-1 text-center text-[10px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-[16px] border border-line bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] text-mute">보유 종목 관련 해외 발언</p>
            <button type="button" className="text-[11px] text-gold" onClick={() => void enablePush()}>
              브라우저 알림
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-mute">아직 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                  <p className="text-[13px] font-medium">{alert.title}</p>
                  <p className="mt-1 text-[12px] text-mute">{alert.body}</p>
                  {alert.source_url ? (
                    <a
                      href={alert.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[12px] text-gold"
                    >
                      원문
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
