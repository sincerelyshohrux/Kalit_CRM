import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState, type RefObject } from 'react'

import { formatNumber } from '@/lib/format'

gsap.registerPlugin(useGSAP)

const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Sahifa ochilganda `[data-reveal]` elementlarini ketma-ket paydo qiladi. */
export function useReveal(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useGSAP(
    () => {
      if (reduce()) return
      const items = scope.current?.querySelectorAll('[data-reveal]')
      if (!items?.length) return
      gsap.fromTo(
        items,
        { opacity: 0, y: 14, filter: 'blur(4px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', stagger: 0.05, clearProps: 'filter,transform' },
      )
    },
    { scope, dependencies: deps },
  )
}

/** Raqamni 0 dan qiymatgacha "sanab" ko'rsatadi. */
export function CountUp({
  value,
  format = formatNumber,
  duration = 1.1,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const [display, setDisplay] = useState(reduce() ? value : 0)
  const obj = useRef({ v: 0 })

  useEffect(() => {
    if (reduce()) {
      setDisplay(value)
      return
    }
    const tween = gsap.to(obj.current, {
      v: value,
      duration,
      ease: 'power3.out',
      onUpdate: () => setDisplay(obj.current.v),
    })
    return () => {
      tween.kill()
    }
  }, [value, duration])

  return <>{format(display)}</>
}

/**
 * Dial — videodagi termostat uslubidagi yoy (gauge).
 * `value` 0..1 oralig'ida; markazda katta raqam.
 */
export function Dial({
  value,
  size = 200,
  label,
  center,
  sub,
}: {
  value: number
  size?: number
  label?: string
  center: React.ReactNode
  sub?: React.ReactNode
}) {
  const arc = useRef<SVGPathElement>(null)
  const knob = useRef<SVGCircleElement>(null)
  const stroke = 10
  const r = size / 2 - stroke - 6
  const cx = size / 2
  const cy = size / 2
  const start = 135 // gradus
  const sweep = 270
  const v = Math.max(0, Math.min(1, value))

  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }
  const path = (from: number, to: number) => {
    const [x1, y1] = point(from)
    const [x2, y2] = point(to)
    const large = to - from > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }
  const full = path(start, start + sweep)
  const length = (Math.PI * 2 * r * sweep) / 360

  useGSAP(
    () => {
      const p = { t: reduce() ? v : 0 }
      const draw = () => {
        if (arc.current) arc.current.style.strokeDashoffset = String(length * (1 - p.t))
        const [kx, ky] = point(start + sweep * p.t)
        knob.current?.setAttribute('cx', String(kx))
        knob.current?.setAttribute('cy', String(ky))
      }
      draw()
      if (!reduce()) gsap.to(p, { t: v, duration: 1.4, ease: 'power3.out', onUpdate: draw })
    },
    { dependencies: [v, size] },
  )

  return (
    <div style={{ position: 'relative', width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* shkala chiziqlari */}
        {Array.from({ length: 46 }, (_, i) => {
          const deg = start + (sweep * i) / 45
          const rad = (deg * Math.PI) / 180
          const r1 = r + stroke / 2 + 5
          const r2 = r1 + (i % 5 === 0 ? 6 : 3)
          return (
            <line
              key={i}
              x1={cx + r1 * Math.cos(rad)}
              y1={cy + r1 * Math.sin(rad)}
              x2={cx + r2 * Math.cos(rad)}
              y2={cy + r2 * Math.sin(rad)}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
            />
          )
        })}
        <path d={full} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          ref={arc}
          d={full}
          fill="none"
          stroke="url(#dial-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length}
        />
        <circle ref={knob} r={8} fill="#f2f1ec" stroke="rgba(0,0,0,0.35)" strokeWidth={2} />
        <defs>
          <linearGradient id="dial-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(242,241,236,0.35)" />
            <stop offset="100%" stopColor="#f2f1ec" />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <div>
          {label && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{label}</div>}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: size / 5.2, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
            {center}
          </div>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}
