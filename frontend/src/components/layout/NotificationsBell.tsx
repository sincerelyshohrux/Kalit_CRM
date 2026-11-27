import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bell, CheckCheck, Globe } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { IconButton } from '@/components/ui'
import { api } from '@/lib/api'

interface Notification {
  id: number
  kind: 'lead' | 'lead_repeat'
  title: string
  text: string
  client: number | null
  read: boolean
  created_at: string
}

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'hozirgina'
  if (min < 60) return `${min} daq oldin`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} soat oldin`
  return `${Math.round(h / 24)} kun oldin`
}

/** Saytdan kelgan arizalar haqida bildirishnomalar (har 60 soniyada yangilanadi). */
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ unread: number; results: Notification[] }>('/notifications/'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const readOne = useMutation({ mutationFn: (id: number) => api(`/notifications/${id}/read/`, { method: 'POST' }), onSuccess: refresh })
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all/', { method: 'POST' }), onSuccess: refresh })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = q.data?.unread ?? 0
  const items = q.data?.results ?? []

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <IconButton
        icon={Bell}
        label={unread ? `Bildirishnomalar: ${unread} ta yangi` : 'Bildirishnomalar'}
        dot={unread > 0}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="dropdown notif" role="dialog" aria-label="Bildirishnomalar">
          <div className="notif__head">
            <b>Bildirishnomalar</b>
            {unread > 0 && (
              <button type="button" className="notif__all" onClick={() => readAll.mutate()}>
                <CheckCheck size={14} /> Hammasini o'qildi
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="notif__empty muted">Hozircha yangi ariza yo'q</div>
          ) : (
            <ul className="notif__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={clsx('notif__item', !n.read && 'is-unread')}
                    onClick={() => {
                      if (!n.read) readOne.mutate(n.id)
                      setOpen(false)
                      if (n.client) navigate(`/app/clients?client=${n.client}`)
                    }}
                  >
                    <span className="notif__icon"><Globe size={14} /></span>
                    <span className="notif__body">
                      <b>{n.title}</b>
                      {n.text && <span className="muted">{n.text}</span>}
                      <small className="muted">{ago(n.created_at)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
