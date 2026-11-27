import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarPlus, MessageSquarePlus, Pencil, Phone, Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge, Button, IconButton, Select, Skeleton } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { ACTIVITY_KIND, BOOKING_STATUS, CLIENT_SOURCE, CLIENT_STATUS, formatDateTime, MANUAL_CLIENT_STATUSES, timeAgo, timeLeft } from '@/lib/crm'
import { formatMoney, formatMoneyShort, formatPhone } from '@/lib/format'
import { roomsLabel } from '@/lib/realty'
import type { ActivityKind, Booking, Client, ClientActivity, ClientStatus } from '@/lib/types'

import { CancelBookingModal, ExtendBookingModal } from './BookingModals'
import { ClientFormModal } from './ClientFormModal'

export function ClientDrawer({ clientId, onClose }: { clientId: number | null; onClose: () => void }) {
  return (
    <Drawer open={clientId !== null} onClose={onClose} title="Mijoz" width={500}>
      {clientId !== null && <ClientDetails key={clientId} id={clientId} />}
    </Drawer>
  )
}

const NOTE_KINDS: ActivityKind[] = ['note', 'call', 'meeting']

function ClientDetails({ id }: { id: number }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState<ActivityKind>('note')
  const [text, setText] = useState('')
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [extending, setExtending] = useState<Booking | null>(null)

  const client = useQuery({ queryKey: ['client', id], queryFn: () => api<Client>(`/clients/${id}/`) })
  const activities = useQuery({ queryKey: ['client', id, 'activities'], queryFn: () => api<ClientActivity[]>(`/clients/${id}/activities/`) })
  const bookings = useQuery({
    queryKey: ['bookings', 'client', id],
    queryFn: () => api<Paginated<Booking>>('/bookings/', { query: { client: id, page_size: 50 } }),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['client', id] })
    qc.invalidateQueries({ queryKey: ['clients'] })
  }

  const setStatus = useMutation({
    mutationFn: (body: { status: ClientStatus; reject_reason?: string }) => api<Client>(`/clients/${id}/`, { method: 'PATCH', body }),
    onSuccess: (c) => {
      toast.success(`Holat: ${c.status_display}`)
      setRejecting(false)
      setReason('')
      refresh()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  const addNote = useMutation({
    mutationFn: () => api<ClientActivity>(`/clients/${id}/activities/`, { method: 'POST', body: { kind, text: text.trim() } }),
    onSuccess: () => {
      setText('')
      refresh()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  if (client.isLoading || !client.data) {
    return (
      <div className="stack">
        <Skeleton height={90} />
        <Skeleton height={60} />
        <Skeleton height={200} />
      </div>
    )
  }
  const c = client.data
  const auto = c.status === 'booked' || c.status === 'contract'

  return (
    <div className="client">
      <div className="client__head">
        <div style={{ minWidth: 0 }}>
          <div className="client__name">{c.full_name}</div>
          <div className="client__phones">
            <a href={`tel:${c.phone}`} className="link-btn"><Phone size={13} /> {formatPhone(c.phone)}</a>
            {c.phone2 && <a href={`tel:${c.phone2}`} className="link-btn"><Phone size={13} /> {formatPhone(c.phone2)}</a>}
          </div>
        </div>
        {c.can_edit && <IconButton icon={Pencil} label="Tahrirlash" onClick={() => setEditing(true)} />}
      </div>

      <div className="client__meta">
        <div><span>Holat</span><Badge tone={CLIENT_STATUS[c.status].tone}>{c.status_display}</Badge></div>
        <div><span>Manba</span><b>{CLIENT_SOURCE[c.source]}</b></div>
        <div><span>Mas'ul</span><b>{c.manager_info?.full_name ?? <span className="muted">Biriktirilmagan</span>}</b></div>
        <div><span>Byudjet</span><b>{c.budget ? formatMoneyShort(c.budget) : '—'}</b></div>
        {c.interested_project_name && <div><span>Qiziqadi</span><b>{c.interested_project_name}</b></div>}
        <div><span>Qo'shilgan</span><b>{formatDateTime(c.created_at).slice(0, 10)}</b></div>
      </div>
      {c.status === 'rejected' && c.reject_reason && <div className="notice">Rad etish sababi: {c.reject_reason}</div>}
      {c.note && <p className="client__note">{c.note}</p>}

      {c.can_edit && !auto && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="form-section">Voronka bosqichi</div>
          <div className="status-steps" role="group" aria-label="Holatni o'zgartirish">
            {MANUAL_CLIENT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`status-step status-step--${s}${c.status === s ? ' is-active' : ''}`}
                aria-pressed={c.status === s}
                disabled={setStatus.isPending || c.status === s}
                onClick={() => (s === 'rejected' ? setRejecting(true) : setStatus.mutate({ status: s }))}
              >
                {CLIENT_STATUS[s].label}
              </button>
            ))}
          </div>
          {rejecting && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                if (reason.trim()) setStatus.mutate({ status: 'rejected', reject_reason: reason.trim() })
              }}
            >
              <input className="input-plain" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Rad etish sababi" autoFocus aria-label="Rad etish sababi" />
              <Button size="sm" variant="danger" type="submit" loading={setStatus.isPending} disabled={!reason.trim()}>Saqlash</Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Yopish</Button>
            </form>
          )}
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <div className="form-section">Bronlar</div>
        {bookings.isLoading ? (
          <Skeleton height={60} />
        ) : !bookings.data?.results.length ? (
          <div className="muted" style={{ fontSize: 13 }}>
            Bron yo'q. <Link to="/app/chessboard" className="link-btn">Shaxmatkadan</Link> xonadon tanlab bron qiling.
          </div>
        ) : (
          bookings.data.results.map((b) => {
            const left = b.status === 'active' ? timeLeft(b.expires_at) : null
            return (
              <div key={b.id} className={`booking-card booking-card--${b.status}`}>
                <div className="row row--between">
                  <div>
                    <b>№{b.unit_info.number}</b> · {roomsLabel(b.unit_info.rooms, b.unit_info.unit_type)} · {b.unit_info.project_name}, {b.unit_info.block_name}
                  </div>
                  <Badge tone={BOOKING_STATUS[b.status].tone}>{b.status_display}</Badge>
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {formatMoney(b.total_price)} · {formatDateTime(b.created_at)}
                  {b.created_by_info && ` · ${b.created_by_info.full_name}`}
                </div>
                {left && (
                  <div className="row row--between row--wrap">
                    <span className={`countdown${left.urgent ? ' countdown--urgent' : ''}`}><CalendarClock size={13} /> {left.label} qoldi</span>
                    {b.can_manage && (
                      <div className="row" style={{ gap: 6 }}>
                        <Button size="sm" icon={CalendarPlus} onClick={() => setExtending(b)}>Uzaytirish</Button>
                        <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setCancelling(b)}>Bekor</Button>
                      </div>
                    )}
                  </div>
                )}
                {b.cancel_reason && <div className="muted" style={{ fontSize: 12.5 }}>Sabab: {b.cancel_reason}</div>}
              </div>
            )
          })
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="form-section">Tarix</div>
        {c.can_edit && (
          <form
            className="note-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (text.trim()) addNote.mutate()
            }}
          >
            <Select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} options={NOTE_KINDS.map((k) => ({ value: k, label: ACTIVITY_KIND[k] }))} aria-label="Turi" />
            <input className="input-plain" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Nima bo'ldi? Masalan: ertaga ofisga keladi" aria-label="Matn" />
            <IconButton icon={addNote.isPending ? MessageSquarePlus : Send} label="Qo'shish" type="submit" disabled={!text.trim() || addNote.isPending} />
          </form>
        )}
        {activities.isLoading ? (
          <Skeleton height={80} />
        ) : (
          <ul className="activity">
            {(activities.data ?? []).map((a) => (
              <li key={a.id} className={`activity__item activity__item--${a.kind}`}>
                <div className="activity__top">
                  <b>{a.kind_display}</b>
                  <span className="muted" title={formatDateTime(a.created_at)}>{timeAgo(a.created_at)}</span>
                </div>
                {a.text && <div className="activity__text">{a.text}</div>}
                <div className="muted activity__author">{a.author_info?.full_name ?? 'Tizim'}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClientFormModal open={editing} client={c} onClose={() => setEditing(false)} />
      <CancelBookingModal booking={cancelling && { id: cancelling.id, unit: cancelling.unit, label: `№${cancelling.unit_info.number} · ${c.full_name}` }} onClose={() => setCancelling(null)} />
      <ExtendBookingModal booking={extending && { id: extending.id, unit: extending.unit, label: `№${extending.unit_info.number} · ${c.full_name}`, expires_at: extending.expires_at }} onClose={() => setExtending(null)} />
    </div>
  )
}
