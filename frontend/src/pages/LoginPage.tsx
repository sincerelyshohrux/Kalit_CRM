import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { homePathFor, useAuth } from '@/auth/AuthProvider'
import { KalitMark } from '@/components/layout/AppShell'
import { Button, Field, PhoneInput, TextInput, toE164 } from '@/components/ui'
import { ApiError } from '@/lib/api'

const FLOORS = 9
const COLS = 6

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const formCard = useRef<HTMLFormElement>(null)

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.login-hero', { opacity: 0, x: -24, duration: 0.8 })
        .from('.login-form', { opacity: 0, x: 24, duration: 0.8 }, '<0.08')
        .from('.login-cell', { opacity: 0, scale: 0.6, duration: 0.5, stagger: { each: 0.008, from: 'end' } }, '<0.2')
        .from('[data-in]', { opacity: 0, y: 10, duration: 0.5, stagger: 0.06 }, '<0.1')

      // Shaxmatka bo'ylab "sotuv to'lqini"
      gsap.to('.login-cell--wave', {
        keyframes: [
          { backgroundColor: 'rgba(242,241,236,0.85)', duration: 0.35 },
          { backgroundColor: 'rgba(255,255,255,0.06)', duration: 0.9 },
        ],
        stagger: { each: 0.05, grid: [FLOORS, COLS], from: 'start', repeat: -1, repeatDelay: 2.4 },
        delay: 1.2,
      })
    },
    { scope: root },
  )

  // Statuslar — bir marta, tasodifiy (lekin barqaror) taqsimlanadi
  const cells = useMemo(() => {
    let seed = 7
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    return Array.from({ length: FLOORS * COLS }, () => {
      const r = rnd()
      return r < 0.38 ? 'sold' : r < 0.5 ? 'booked' : 'free'
    })
  }, [])

  if (status === 'authenticated' && user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : homePathFor(user)} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (phone.length !== 9) {
      setError("Telefon raqamni to'liq kiriting.")
      return
    }
    setBusy(true)
    try {
      const u = await login(toE164(phone), password)
      navigate(homePathFor(u), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Server bilan bog'lanib bo'lmadi.")
      setPassword('')
      gsap.fromTo(formCard.current, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={root} className="login">
      <section className="login-hero glass">
        <div className="row" data-in>
          <div className="brand__mark">
            <KalitMark />
          </div>
          <div>
            <div className="brand__name">Kalit CRM</div>
            <div className="brand__sub">Qurilish kompaniyalari uchun</div>
          </div>
        </div>

        <div className="login-board" aria-hidden="true">
          <div className="login-board__label">A blok · 9 qavat</div>
          <div className="login-board__grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {cells.map((s, i) => (
              <span key={i} className={`login-cell login-cell--${s}${s === 'free' ? ' login-cell--wave' : ''}`} />
            ))}
          </div>
          <div className="login-board__legend">
            <span><i className="dot dot--free" />Bo'sh</span>
            <span><i className="dot dot--booked" />Bron</span>
            <span><i className="dot dot--sold" />Sotilgan</span>
          </div>
        </div>

        <div>
          <h1 className="login-title" data-in>
            Bron'dan
            <br />
            kalitgacha.
          </h1>
          <p className="login-lead" data-in>
            Shaxmatka, mijozlar, shartnomalar va rassrochka — bitta tizimda.
          </p>
        </div>
      </section>

      <form ref={formCard} className="login-form glass" onSubmit={onSubmit} noValidate>
        <div data-in>
          <h2 style={{ fontSize: 26 }}>Tizimga kirish</h2>
          <p className="muted" style={{ marginTop: 6 }}>Telefon raqamingiz va parolingizni kiriting.</p>
        </div>

        <Field label="Telefon raqam" htmlFor="phone" className="mt-24">
          <div data-in>
            <PhoneInput id="phone" value={phone} onChange={setPhone} autoFocus invalid={!!error} />
          </div>
        </Field>

        <Field label="Parol" htmlFor="password">
          <div data-in>
            <TextInput
              id="password"
              icon={Lock}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!error}
              maxLength={128}
              right={
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 28, height: 28, border: 0, background: 'transparent' }}
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </div>
        </Field>

        <div className="login-error" role="alert" aria-live="assertive">
          {error}
        </div>

        <div data-in>
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            Kirish <ArrowRight size={16} />
          </Button>
        </div>

        <div className="login-note" data-in>
          <ShieldCheck size={15} />
          <span>Ketma-ket 5 marta xato kiritilsa, kirish 15 daqiqaga bloklanadi.</span>
        </div>
      </form>
    </div>
  )
}
