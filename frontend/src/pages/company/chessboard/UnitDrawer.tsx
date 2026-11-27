import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarPlus, Eye, EyeOff, History, Maximize2, Save, UserRound, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { BookingCreateModal, CancelBookingModal, ExtendBookingModal } from '@/components/crm/BookingModals'

import { PlanSketch } from '@/components/realty/PlanSketch'
import { Badge, Button, Field, Select, Skeleton, TextInput } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { Lightbox } from '@/components/ui/Lightbox'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatDateTime, timeLeft } from '@/lib/crm'
import { formatDate, formatMoney, formatMoneyShort, formatNumber, formatPhone } from '@/lib/format'
import { FINISHING, formatArea, options, roomsLabel, UNIT_STATUS } from '@/lib/realty'
import type { Chessboard, Finishing, PriceChange, Unit } from '@/lib/types'

export function UnitDrawer({ unitId, layouts, onClose, canEdit }: { unitId: number | null; layouts: Chessboard['layouts']; onClose: () => void; canEdit: boolean }) {
  return (
    <Drawer open={unitId !== null} onClose={onClose} title="Xonadon" width={460}>
      {unitId !== null && <UnitDetails key={unitId} id={unitId} layouts={layouts} canEdit={canEdit} />}
    </Drawer>
  )
}

function UnitDetails({ id, layouts, canEdit }: { id: number; layouts: Chessboard['layouts']; canEdit: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [zoom, setZoom] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [booking, setBooking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [extending, setExtending] = useState(false)
  const { user } = useAuth()
  const canBook = user?.role === 'director' || user?.role === 'manager'

  const unit = useQuery({ queryKey: ['unit', id], queryFn: () => api<Unit>(`/units/${id}/`) })
  const history = useQuery({ queryKey: ['unit', id, 'history'], queryFn: () => api<PriceChange[]>(`/units/${id}/price-history/`), enabled: showHistory })

  const [f, setF] = useState({ price: '', reason: '', finishing: 'none' as Finishing, layout: '', note: '' })
  useEffect(() => {
    if (unit.data) setF({ price: String(unit.data.price_per_m2), reason: '', finishing: unit.data.finishing, layout: unit.data.layout ? String(unit.data.layout) : '', note: unit.data.note })
  }, [unit.data])

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Unit>(`/units/${id}/`, { method: 'PATCH', body }),
    onSuccess: (u) => {
      qc.setQueryData(['unit', id], u)
      qc.invalidateQueries({ queryKey: ['chessboard'] })
      qc.invalidateQueries({ queryKey: ['unit', id, 'history'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Saqlandi')
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  if (unit.isLoading || !unit.data) {
    return (
      <div className="stack">
        <Skeleton height={220} />
        <Skeleton height={80} />
        <Skeleton height={120} />
      </div>
    )
  }
  const u = unit.data
  const locked = u.status === 'booked' || u.status === 'sold'
  const ppm = Number(f.price) || 0
  const newTotal = Math.round(parseFloat(u.area) * ppm)
  const priceChanged = ppm !== u.price_per_m2
  const dirty = priceChanged || f.finishing !== u.finishing || f.note !== u.note || f.layout !== (u.layout ? String(u.layout) : '')

  const save = () => {
    const body: Record<string, unknown> = { finishing: f.finishing, note: f.note.trim(), layout: f.layout ? Number(f.layout) : null }
    if (priceChanged) Object.assign(body, { price_per_m2: ppm, price_reason: f.reason.trim() })
    patch.mutate(body)
  }

  return (
    <div className="unit">
      <div className="unit__head">
        <div>
          <div className="unit__number">№ {u.number}</div>
          <div className="muted">
            {u.project_name} · {u.block_name} · {u.entrance}-podyezd · {u.floor}-qavat
          </div>
        </div>
        <Badge tone={UNIT_STATUS[u.status].tone}>{u.status_display}</Badge>
      </div>

      <div className="unit__plan">
        {u.layout_info?.image ? (
          <>
            <img src={u.layout_info.thumb ?? u.layout_info.image} alt={`Planirovka: ${u.layout_info.name}`} />
            <button type="button" className="unit__zoom icon-btn" onClick={() => setZoom(true)} aria-label="Chizmani kattalashtirish">
              <Maximize2 size={16} />
            </button>
            <Lightbox items={[{ src: u.layout_info.image, caption: u.layout_info.name }]} index={zoom ? 0 : null} onIndex={() => {}} onClose={() => setZoom(false)} />
          </>
        ) : (
          <PlanSketch rooms={u.rooms} area={u.area} />
        )}
      </div>

      <div className="unit__specs">
        <div><span>Turi</span><b>{roomsLabel(u.rooms, u.unit_type)}</b></div>
        <div><span>Maydon</span><b>{formatArea(u.area)}</b></div>
        <div><span>Pardozlash</span><b>{FINISHING[u.finishing]}</b></div>
        <div><span>Balkon</span><b>{u.has_balcony ? 'Bor' : "Yo'q"}</b></div>
      </div>

      <div className="unit__price">
        <div className="muted">Umumiy narx</div>
        <div className="unit__total">{formatMoney(u.total_price)}</div>
        <div className="muted">{formatNumber(u.price_per_m2)} so'm / m²</div>
      </div>

      {u.active_booking ? (
        <BookingBox u={u} onCancel={() => setCancelling(true)} onExtend={() => setExtending(true)} canManage={user?.role === 'director' || (user?.role === 'manager' && u.active_booking.mine)} />
      ) : u.status === 'available' && canBook ? (
        <Button variant="primary" block icon={CalendarClock} onClick={() => setBooking(true)}>
          Bron qilish
        </Button>
      ) : null}
      <BookingCreateModal open={booking} unit={u} onClose={() => setBooking(false)} />
      {u.active_booking && (
        <>
          <CancelBookingModal booking={cancelling ? { id: u.active_booking.id, unit: u.id, label: `№${u.number}${u.active_booking.client_name ? ` · ${u.active_booking.client_name}` : ''}` } : null} onClose={() => setCancelling(false)} />
          <ExtendBookingModal booking={extending ? { id: u.active_booking.id, unit: u.id, label: `№${u.number}`, expires_at: u.active_booking.expires_at } : null} onClose={() => setExtending(false)} />
        </>
      )}

      {canEdit && (
        <div className="unit__edit">
          <div className="form-section">Boshqaruv</div>
          {locked ? (
            <div className="notice">Bron qilingan yoki sotilgan xonadon narxi va holatini o'zgartirib bo'lmaydi — narx shartnomada qotgan.</div>
          ) : (
            <>
              <Field label="1 m² narxi (so'm)" hint={priceChanged ? `Yangi umumiy narx: ${formatMoney(newTotal)}` : undefined}>
                <TextInput type="number" min={0} step={1000} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
              </Field>
              {priceChanged && (
                <Field label="O'zgartirish sababi" hint="Narx tarixida saqlanadi">
                  <TextInput value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={255} placeholder="Masalan: aksiya, bozor narxi" />
                </Field>
              )}
            </>
          )}
          <div className="form-grid">
            <Field label="Pardozlash">
              <Select value={f.finishing} onChange={(e) => setF({ ...f, finishing: e.target.value as Finishing })} options={options(FINISHING)} />
            </Field>
            <Field label="Planirovka">
              <Select value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value })} options={[{ value: '', label: '—' }, ...layouts.map((l) => ({ value: String(l.id), label: l.name }))]} />
            </Field>
          </div>
          <Field label="Izoh">
            <TextInput value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={255} />
          </Field>
          <div className="row">
            <Button variant="primary" icon={Save} loading={patch.isPending} disabled={!dirty} onClick={save}>
              Saqlash
            </Button>
            {!locked && (
              <Button
                icon={u.status === 'not_for_sale' ? Eye : EyeOff}
                loading={patch.isPending}
                onClick={() => patch.mutate({ status: u.status === 'not_for_sale' ? 'available' : 'not_for_sale' })}
              >
                {u.status === 'not_for_sale' ? 'Sotuvga chiqarish' : 'Sotuvdan olish'}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="unit__history">
        <button type="button" className="link-btn" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
          <History size={14} /> Narx tarixi
        </button>
        {showHistory &&
          (history.isLoading ? (
            <Skeleton height={60} />
          ) : !history.data?.length ? (
            <div className="muted" style={{ fontSize: 13 }}>Narx o'zgarmagan.</div>
          ) : (
            <ul className="timeline">
              {history.data.map((h) => (
                <li key={h.id}>
                  <div>
                    <b>{formatMoneyShort(h.old_total)} → {formatMoneyShort(h.new_total)}</b>
                    <span className={h.new_total > h.old_total ? 'up' : 'down'}>
                      {h.new_total > h.old_total ? '+' : ''}
                      {(((h.new_total - h.old_total) / (h.old_total || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="muted">
                    {formatDate(h.created_at)} · {h.changed_by_name || 'tizim'}
                    {h.reason && ` · ${h.reason}`}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}

function BookingBox({ u, canManage, onCancel, onExtend }: { u: Unit; canManage: boolean; onCancel: () => void; onExtend: () => void }) {
  const b = u.active_booking!
  const left = timeLeft(b.expires_at)
  return (
    <div className="booking-box">
      <div className="row row--between">
        <span className="form-section" style={{ margin: 0 }}>Faol bron</span>
        <span className={`countdown${left.urgent ? ' countdown--urgent' : ''}`} title={formatDateTime(b.expires_at)}>
          <CalendarClock size={13} /> {left.label} qoldi
        </span>
      </div>
      {b.client_name ? (
        <Link to={`/app/clients?client=${b.client_id}`} className="booking-box__client">
          <UserRound size={15} />
          <span>
            <b>{b.client_name}</b>
            {b.client_phone && <span className="muted"> · {formatPhone(b.client_phone)}</span>}
          </span>
        </Link>
      ) : (
        <div className="muted" style={{ fontSize: 13 }}>Boshqa menejer mijozi</div>
      )}
      <div className="muted" style={{ fontSize: 12.5 }}>
        Menejer: {b.manager ?? '—'} · {formatDateTime(b.expires_at)} gacha
        {b.total_price && b.total_price !== u.total_price ? ` · bron narxi ${formatMoneyShort(b.total_price)}` : ''}
      </div>
      {canManage && (
        <div className="row">
          <Button size="sm" icon={CalendarPlus} onClick={onExtend}>Uzaytirish</Button>
          <Button size="sm" variant="ghost" icon={XCircle} onClick={onCancel}>Bekor qilish</Button>
        </div>
      )}
    </div>
  )
}
