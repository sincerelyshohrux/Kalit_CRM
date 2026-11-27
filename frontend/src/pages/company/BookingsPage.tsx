import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Grid3x3, Search, Settings2, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { CancelBookingModal, ExtendBookingModal, useBookingStats } from '@/components/crm/BookingModals'
import { ClientDrawer } from '@/components/crm/ClientDrawer'
import { PillTabs } from '@/components/motion/PillNav'
import { useReveal } from '@/components/motion/effects'
import { Badge, Button, EmptyState, Field, IconButton, PageHead, Skeleton, TextInput } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { BOOKING_STATUS, formatDateTime, timeLeft } from '@/lib/crm'
import { formatMoneyShort, formatPhone } from '@/lib/format'
import { roomsLabel } from '@/lib/realty'
import type { Booking, BookingStatus } from '@/lib/types'

const TABS: BookingStatus[] = ['active', 'expired', 'cancelled', 'converted']
const PAGE_SIZE = 25

/** Har daqiqada qayta chizish — qolgan vaqt jonli ko'rinsin */
function useMinuteTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setT((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
}

export function BookingsPage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'director'
  const [tab, setTab] = useState<BookingStatus>('active')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [clientId, setClientId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [extending, setExtending] = useState<Booking | null>(null)
  const [settings, setSettings] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useMinuteTick()

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [tab, debounced])

  const stats = useBookingStats()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['bookings', 'list', tab, debounced, page],
    queryFn: () =>
      api<Paginated<Booking>>('/bookings/', {
        query: { status: tab, search: debounced, page, page_size: PAGE_SIZE, ordering: tab === 'active' ? 'expires_at' : '-created_at' },
      }),
    placeholderData: keepPreviousData,
    refetchInterval: tab === 'active' ? 60_000 : false,
  })
  useReveal(root, [isLoading])

  const rows = data?.results ?? []
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Sotuv"
        title="Bronlar"
        description={stats.data ? `Menejerlar uchun bron muddati: ${stats.data.company_days} kun · muddati tugagan bron avtomatik yopiladi` : undefined}
        actions={
          <div className="row">
            {isDirector && <Button icon={Settings2} onClick={() => setSettings(true)}>Muddat sozlamasi</Button>}
            <Link className="btn btn--primary" to="/app/chessboard"><Grid3x3 size={16} /> Shaxmatkadan bron</Link>
          </div>
        }
      />

      <div className="row row--between row--wrap" style={{ marginBottom: 14 }} data-reveal>
        <PillTabs<BookingStatus> value={tab} onChange={setTab} items={TABS.map((k) => ({ key: k, label: BOOKING_STATUS[k].label, count: stats.data?.[k] }))} />
        <div style={{ width: 280, maxWidth: '100%' }}>
          <TextInput icon={Search} placeholder="Mijoz ismi yoki telefoni" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        </div>
      </div>

      <div className="table-wrap" data-reveal style={{ opacity: isFetching && !isLoading ? 0.7 : 1 }}>
        {isLoading ? (
          <div className="stack" style={{ padding: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}</div>
        ) : !rows.length ? (
          <EmptyState icon={CalendarClock} title={debounced ? 'Topilmadi' : tab === 'active' ? "Faol bron yo'q" : "Bu bo'limda bron yo'q"}>
            {tab === 'active' && !debounced && 'Shaxmatkada bo\'sh xonadonni bosing va «Bron qilish» tugmasini tanlang.'}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Xonadon</th>
                <th>Mijoz</th>
                <th className="num">Narx</th>
                <th>{tab === 'active' ? 'Qoldi' : 'Yopilgan'}</th>
                <th>Menejer</th>
                <th aria-label="Amallar" />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const left = b.status === 'active' ? timeLeft(b.expires_at) : null
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="cell-main">№{b.unit_info.number} · {roomsLabel(b.unit_info.rooms, b.unit_info.unit_type)}</div>
                      <div className="cell-sub">{b.unit_info.project_name} · {b.unit_info.block_name} · {b.unit_info.floor}-qavat</div>
                    </td>
                    <td>
                      <button type="button" className="link-btn cell-main" onClick={() => setClientId(b.client)}>{b.client_info.full_name}</button>
                      <div className="cell-sub">{formatPhone(b.client_info.phone)}</div>
                    </td>
                    <td className="num nowrap">{formatMoneyShort(b.total_price)}</td>
                    <td className="nowrap">
                      {left ? (
                        <span className={`countdown${left.urgent ? ' countdown--urgent' : ''}`} title={formatDateTime(b.expires_at)}>
                          <CalendarClock size={13} /> {left.label}
                        </span>
                      ) : (
                        <>
                          <Badge tone={BOOKING_STATUS[b.status].tone}>{b.status_display}</Badge>
                          <div className="cell-sub" title={b.cancel_reason || undefined}>
                            {formatDateTime(b.closed_at)}{b.cancel_reason && ` · ${b.cancel_reason.slice(0, 30)}`}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="nowrap">{b.created_by_info?.full_name ?? '—'}</td>
                    <td className="num">
                      {b.can_manage && (
                        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <IconButton icon={CalendarPlus} label="Uzaytirish" onClick={() => setExtending(b)} />
                          <IconButton icon={XCircle} label="Bekor qilish" onClick={() => setCancelling(b)} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="pager">
          <IconButton icon={ChevronLeft} label="Oldingi" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
          <span>{page} / {pages}</span>
          <IconButton icon={ChevronRight} label="Keyingi" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} />
        </div>
      )}

      <ClientDrawer clientId={clientId} onClose={() => setClientId(null)} />
      <CancelBookingModal booking={cancelling && { id: cancelling.id, unit: cancelling.unit, label: `№${cancelling.unit_info.number} · ${cancelling.client_info.full_name}` }} onClose={() => setCancelling(null)} />
      <ExtendBookingModal booking={extending && { id: extending.id, unit: extending.unit, label: `№${extending.unit_info.number} · ${extending.client_info.full_name}`, expires_at: extending.expires_at }} onClose={() => setExtending(null)} />
      {isDirector && <BookingDaysModal open={settings} current={stats.data?.company_days ?? 3} onClose={() => setSettings(false)} />}
    </div>
  )
}

function BookingDaysModal({ open, current, onClose }: { open: boolean; current: number; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [days, setDays] = useState(String(current))
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setDays(String(current))
      setError('')
    }
  }, [open, current])

  const save = useMutation({
    mutationFn: () => api('/company/', { method: 'PATCH', body: { booking_days: Number(days) } }),
    onSuccess: () => {
      toast.success('Saqlandi')
      qc.invalidateQueries({ queryKey: ['bookings', 'stats'] })
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setError(e.fieldErrors.booking_days ?? e.message)
      }
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Bron muddati" description="Menejer bron qila oladigan eng uzoq muddat. Direktor 30 kungacha bron qila oladi." width={420}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Field label="Kun (1–30)" error={error}>
          <TextInput type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} autoFocus />
        </Field>
        <div className="modal__foot">
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" type="submit" loading={save.isPending}>Saqlash</Button>
        </div>
      </form>
    </Modal>
  )
}
