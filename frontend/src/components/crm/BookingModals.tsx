import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarPlus, Check, Plus, Search, UserRound, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { Badge, Button, Field, Spinner, TextInput } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { CLIENT_STATUS, formatDateTime } from '@/lib/crm'
import { formatMoney, formatPhone } from '@/lib/format'
import { formatArea, roomsLabel } from '@/lib/realty'
import type { Booking, BookingStats, Client, Unit } from '@/lib/types'

import { ClientFormModal } from './ClientFormModal'

export function useBookingStats() {
  return useQuery({ queryKey: ['bookings', 'stats'], queryFn: () => api<BookingStats>('/bookings/stats/'), staleTime: 30_000 })
}

/** Bron o'zgarganda tegishli barcha keshlarni yangilash */
export function invalidateBookingData(qc: ReturnType<typeof useQueryClient>, unitId?: number) {
  qc.invalidateQueries({ queryKey: ['bookings'] })
  qc.invalidateQueries({ queryKey: ['clients'] })
  qc.invalidateQueries({ queryKey: ['client'] })
  qc.invalidateQueries({ queryKey: ['chessboard'] })
  qc.invalidateQueries({ queryKey: ['projects'] })
  if (unitId) qc.invalidateQueries({ queryKey: ['unit', unitId] })
}

export function BookingCreateModal({ open, unit, onClose, presetClient }: { open: boolean; unit: Unit | null; onClose: () => void; presetClient?: Client }) {
  const qc = useQueryClient()
  const toast = useToast()
  const stats = useBookingStats()
  const maxDays = stats.data?.max_days ?? 3
  const [client, setClient] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [days, setDays] = useState('3')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setClient(presetClient ?? null)
    setSearch('')
    setNote('')
    setErrors({})
  }, [open, presetClient])

  useEffect(() => {
    if (open) setDays(String(Math.min(3, maxDays)))
  }, [open, maxDays])

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 250)
    return () => window.clearTimeout(t)
  }, [search])

  const found = useQuery({
    queryKey: ['clients', 'pick', debounced],
    queryFn: () => api<Paginated<Client>>('/clients/', { query: { search: debounced, page_size: 8 } }),
    enabled: open && !client,
    placeholderData: keepPreviousData,
  })

  const book = useMutation({
    mutationFn: () => api<Booking>('/bookings/', { method: 'POST', body: { unit: unit!.id, client: client!.id, days: Number(days), note: note.trim() } }),
    onSuccess: (b) => {
      toast.success(`№${b.unit_info.number} — ${b.client_info.full_name} uchun bron qilindi`)
      invalidateBookingData(qc, unit?.id)
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors)
        toast.error(e.message)
      }
    },
  })

  const phoneDigits = useMemo(() => {
    const d = search.replace(/\D/g, '')
    return d.startsWith('998') ? d.slice(3) : d
  }, [search])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!client) return setErrors({ client: 'Mijozni tanlang' })
    const n = Number(days)
    if (!Number.isInteger(n) || n < 1 || n > maxDays) return setErrors({ days: `1–${maxDays} kun` })
    setErrors({})
    book.mutate()
  }

  if (!unit) return null
  const until = new Date(Date.now() + (Number(days) || 0) * 86_400_000)

  return (
    <>
      <Modal open={open && !creating} onClose={onClose} title="Xonadonni bron qilish" description={`${unit.project_name} · ${unit.block_name} · №${unit.number}`} width={560}>
        <form className="stack" onSubmit={submit}>
          <div className="book-unit">
            <div>
              <b>{roomsLabel(unit.rooms, unit.unit_type)}</b> · {formatArea(unit.area)} · {unit.floor}-qavat
            </div>
            <div className="book-unit__price">{formatMoney(unit.total_price)}</div>
          </div>

          <Field label="Mijoz *" error={errors.client}>
            {client ? (
              <div className="picked">
                <span className="picked__icon"><UserRound size={16} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cell-main">{client.full_name}</div>
                  <div className="cell-sub">{formatPhone(client.phone)}</div>
                </div>
                {!presetClient && <Button size="sm" variant="ghost" onClick={() => setClient(null)}>O'zgartirish</Button>}
              </div>
            ) : (
              <div className="picker">
                <TextInput icon={Search} placeholder="Ism yoki telefon bo'yicha qidiring" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} autoFocus right={found.isFetching ? <Spinner size={14} /> : undefined} />
                <ul className="picker__list" role="listbox" aria-label="Mijozlar">
                  {(found.data?.results ?? []).map((c) => (
                    <li key={c.id}>
                      <button type="button" className="picker__item" onClick={() => setClient(c)} role="option" aria-selected={false}>
                        <span className="cell-main">{c.full_name}</span>
                        <span className="cell-sub">{formatPhone(c.phone)}</span>
                        <Badge tone={CLIENT_STATUS[c.status].tone}>{CLIENT_STATUS[c.status].label}</Badge>
                      </button>
                    </li>
                  ))}
                  {found.data && !found.data.results.length && <li className="picker__empty">Topilmadi</li>}
                </ul>
                <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>Yangi mijoz qo'shish</Button>
              </div>
            )}
          </Field>

          <div className="form-grid">
            <Field label="Muddat (kun) *" error={errors.days} hint={`Sizga ruxsat: ${maxDays} kungacha`}>
              <TextInput type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(e.target.value)} icon={CalendarClock} />
            </Field>
            <Field label="Amal qiladi">
              <TextInput value={Number(days) > 0 ? formatDateTime(until.toISOString()) : '—'} disabled readOnly />
            </Field>
          </div>
          <Field label="Izoh" error={errors.note}>
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Masalan: avans ertaga olib keladi" />
          </Field>
          <div className="notice notice--info">Muddat tugaganda bron avtomatik bekor bo'ladi va xonadon yana sotuvga chiqadi.</div>
          <div className="modal__foot">
            <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
            <Button variant="primary" type="submit" icon={Check} loading={book.isPending} disabled={!client}>Bron qilish</Button>
          </div>
        </form>
      </Modal>
      <ClientFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => setClient(c)}
        initial={/^\d{9}$/.test(phoneDigits) ? { phone: phoneDigits } : search.trim() && !/\d/.test(search) ? { first_name: search.trim() } : undefined}
      />
    </>
  )
}

export function CancelBookingModal({ booking, onClose }: { booking: { id: number; unit?: number; label: string } | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setReason('')
    setError('')
  }, [booking?.id])

  const cancel = useMutation({
    mutationFn: () => api<Booking>(`/bookings/${booking!.id}/cancel/`, { method: 'POST', body: { reason: reason.trim() } }),
    onSuccess: (b) => {
      toast.success(`Bron bekor qilindi — №${b.unit_info.number} yana sotuvda`)
      invalidateBookingData(qc, b.unit)
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setError(e.fieldErrors.reason ?? '')
        toast.error(e.message)
      }
    },
  })

  return (
    <Modal open={!!booking} onClose={onClose} title="Bronni bekor qilish" description={booking?.label} width={460}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (reason.trim().length < 3) return setError('Sababni yozing')
          cancel.mutate()
        }}
      >
        <Field label="Sabab *" error={error} hint="Mijoz tarixida saqlanadi">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} autoFocus placeholder="Masalan: mijoz fikridan qaytdi" />
        </Field>
        <div className="modal__foot">
          <Button variant="ghost" onClick={onClose}>Yopish</Button>
          <Button variant="danger" type="submit" icon={XCircle} loading={cancel.isPending}>Bekor qilish</Button>
        </div>
      </form>
    </Modal>
  )
}

export function ExtendBookingModal({ booking, onClose }: { booking: { id: number; unit?: number; label: string; expires_at: string } | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const stats = useBookingStats()
  const maxDays = stats.data?.max_days ?? 3
  const [days, setDays] = useState('1')
  const [error, setError] = useState('')
  useEffect(() => {
    setDays('1')
    setError('')
  }, [booking?.id])

  const extend = useMutation({
    mutationFn: () => api<Booking>(`/bookings/${booking!.id}/extend/`, { method: 'POST', body: { days: Number(days) } }),
    onSuccess: (b) => {
      toast.success(`Bron ${formatDateTime(b.expires_at)} gacha uzaytirildi`)
      invalidateBookingData(qc, b.unit)
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setError(e.fieldErrors.days ?? '')
        toast.error(e.message)
      }
    },
  })

  if (!booking) return null
  const base = Math.max(new Date(booking.expires_at).getTime(), Date.now())
  const until = new Date(base + (Number(days) || 0) * 86_400_000)

  return (
    <Modal open onClose={onClose} title="Bronni uzaytirish" description={booking.label} width={460}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          extend.mutate()
        }}
      >
        <div className="form-grid">
          <Field label="Necha kunga" error={error} hint={`Jami muddat bugundan ${maxDays} kundan oshmaydi`}>
            <TextInput type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(e.target.value)} autoFocus />
          </Field>
          <Field label="Yangi muddat">
            <TextInput value={formatDateTime(until.toISOString())} disabled readOnly />
          </Field>
        </div>
        <div className="modal__foot">
          <Button variant="ghost" onClick={onClose}>Yopish</Button>
          <Button variant="primary" type="submit" icon={CalendarPlus} loading={extend.isPending}>Uzaytirish</Button>
        </div>
      </form>
    </Modal>
  )
}
