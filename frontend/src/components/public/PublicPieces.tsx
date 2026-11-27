import 'leaflet/dist/leaflet.css'

import { CheckCircle2, Send, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'

import { DARKEN, pin, TASHKENT, TILES } from '@/components/map/MapPicker'
import { Button, Field, PhoneInput, TextInput, toE164 } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { ApiError } from '@/lib/api'
import { formatMoney, formatMoneyShort } from '@/lib/format'
import { installment, sendLead, type PublicProjectCard, type PublicSite } from '@/lib/public'

/* ---------------- Loyihalar xaritasi ---------------- */

export function ProjectsMap({ slug, projects, height = 380 }: { slug: string; projects: PublicProjectCard[]; height?: number }) {
  const navigate = useNavigate()
  const points = projects.filter((p) => p.latitude !== null && p.longitude !== null)
  if (!points.length) return null
  const center: [number, number] = [
    points.reduce((s, p) => s + p.latitude!, 0) / points.length,
    points.reduce((s, p) => s + p.longitude!, 0) / points.length,
  ]
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={points.length ? center : TASHKENT} zoom={points.length > 1 ? 12 : 14} scrollWheelZoom={false} className={DARKEN ? 'map map--darken' : 'map'}>
        <TileLayer url={TILES} attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' maxZoom={19} />
        {points.map((p) => (
          <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={pin} eventHandlers={{ click: () => navigate(`/${slug}/loyiha/${p.id}`) }}>
            <Tooltip direction="top" offset={[0, -12]} className="map-tip">{p.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

/* ---------------- Bo'lib to'lash kalkulyatori ---------------- */

export function InstallmentCalc({ price, cfg }: { price: number; cfg: PublicSite['installment'] }) {
  const [down, setDown] = useState(Math.max(cfg.min_down, 30))
  const [months, setMonths] = useState(Math.min(12, cfg.max_months))
  const r = installment(price, down, months, cfg.markup)
  return (
    <div className="calc">
      <div className="calc__row">
        <label htmlFor="calc-down">Boshlang'ich to'lov</label>
        <b>{down}% · {formatMoneyShort(r.down)}</b>
      </div>
      <input id="calc-down" type="range" min={cfg.min_down} max={90} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} />
      <div className="calc__row">
        <label htmlFor="calc-months">Muddat</label>
        <b>{months} oy</b>
      </div>
      <input id="calc-months" type="range" min={1} max={cfg.max_months} step={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
      <div className="calc__result">
        <span>Oylik to'lov</span>
        <strong>{formatMoney(r.monthly)}</strong>
      </div>
      {cfg.markup > 0 && <div className="muted calc__note">Bo'lib to'lashda qolgan summaga {cfg.markup}% qo'shiladi. Jami: {formatMoney(r.total)}</div>}
      <div className="muted calc__note">Taxminiy hisob. Aniq shartlarni menejer bilan kelishasiz.</div>
    </div>
  )
}

/* ---------------- Cloudflare Turnstile ---------------- */

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void }
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`)
  if (!script) {
    script = document.createElement('script')
    script.src = TURNSTILE_SRC
    script.async = true
    document.head.appendChild(script)
  }
  return new Promise((resolve) => script!.addEventListener('load', () => resolve(), { once: true }))
}

function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let id: string | null = null
    let cancelled = false
    loadTurnstile().then(() => {
      if (cancelled || !box.current || !window.turnstile) return
      id = window.turnstile.render(box.current, { sitekey: siteKey, theme: 'dark', callback: onToken, 'expired-callback': () => onToken('') })
    })
    return () => {
      cancelled = true
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [siteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={box} className="turnstile" />
}

/* ---------------- Ariza formasi ---------------- */

export interface LeadTarget {
  project?: number
  unit?: number
  label?: string
}

export function LeadModal({ open, onClose, site, target }: { open: boolean; onClose: () => void; site: PublicSite; target?: LeadTarget }) {
  return (
    <Modal open={open} onClose={onClose} title="Ariza qoldiring" description={target?.label ?? "Menejerimiz siz bilan bog'lanadi"} width={480}>
      <LeadForm site={site} target={target} onDone={onClose} />
    </Modal>
  )
}

export function LeadForm({ site, target, onDone, compact }: { site: PublicSite; target?: LeadTarget; onDone?: () => void; compact?: boolean }) {
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', message: '', website: '' })
  const [token, setToken] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const uid = useId()
  const fid = (k: string) => `${uid}-${k}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (f.phone.length !== 9) return setErrors({ phone: "Telefon raqamni to'liq kiriting" })
    if (site.turnstile_site_key && !token) return setErrors({ detail: "Bot emasligingizni tasdiqlang" })
    setErrors({})
    setSending(true)
    try {
      const res = await sendLead(site.slug, {
        first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: toE164(f.phone),
        message: f.message.trim(), website: f.website, token,
        ...(target?.unit ? { unit: target.unit } : target?.project ? { project: target.project } : {}),
      })
      setDone(res.detail)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...err.fieldErrors, detail: err.status === 429 ? "Juda ko'p urinish. Birozdan so'ng qayta yuboring." : err.message })
      } else setErrors({ detail: "Internet aloqasini tekshiring" })
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="lead-done" role="status">
        <CheckCircle2 size={40} strokeWidth={1.6} />
        <b>Rahmat!</b>
        <p>{done}</p>
        {onDone && <Button onClick={onDone}>Yopish</Button>}
      </div>
    )
  }

  return (
    <form className={compact ? 'stack' : 'form-grid'} onSubmit={submit} noValidate>
      <Field label="Ism *" htmlFor={fid('first_name')} error={errors.first_name}>
        <TextInput id={fid('first_name')} icon={UserRound} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} maxLength={80} required autoComplete="given-name" />
      </Field>
      <Field label="Familiya" htmlFor={fid('last_name')} error={errors.last_name}>
        <TextInput id={fid('last_name')} value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} maxLength={80} autoComplete="family-name" />
      </Field>
      <Field label="Telefon *" htmlFor={fid('phone')} error={errors.phone} className={compact ? undefined : 'span-2'}>
        <PhoneInput id={fid('phone')} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} invalid={!!errors.phone} />
      </Field>
      <Field label="Izoh" htmlFor={fid('message')} error={errors.message} className={compact ? undefined : 'span-2'}>
        <TextInput id={fid('message')} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={500} placeholder="Qachon qo'ng'iroq qilsak qulay?" />
      </Field>
      {/* Honeypot: ekrandan va ekran o'quvchilardan yashirin, odam to'ldirmaydi */}
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </label>
      </div>
      {site.turnstile_site_key && (
        <div className={compact ? undefined : 'span-2'}>
          <Turnstile siteKey={site.turnstile_site_key} onToken={setToken} />
        </div>
      )}
      {errors.detail && <div className={`notice ${compact ? '' : 'span-2'}`} role="alert">{errors.detail}</div>}
      <div className={compact ? undefined : 'span-2'}>
        <Button variant="primary" type="submit" block icon={Send} loading={sending}>Yuborish</Button>
        <p className="muted lead-privacy">Ma'lumotlaringiz faqat {site.company.name} menejerlariga yuboriladi.</p>
      </div>
    </form>
  )
}
