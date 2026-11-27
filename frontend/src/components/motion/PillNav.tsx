/**
 * PillNav — videodagi "pill" animatsiyasi, yanada silliqroq:
 *
 * 1) Pill — butun ro'yxatni qoplagan oq qatlam, `clip-path: inset(...)` bilan kesiladi.
 * 2) Harakat paytida OLDINGI cheti tez (0.36s, power3.out) yetib boradi,
 *    ORQA cheti esa kechroq (0.55s, power3.inOut) "yetib oladi" — cho'zilib-qisqarish effekti.
 * 3) Pill ichida ro'yxatning to'q rangli NUSXASI bor, shuning uchun matn rangi
 *    aynan pill chegarasida, harakat davomida almashadi (videodagidan ham toza).
 *
 * Vertikal (sidebar) va gorizontal (tablar) rejimlarda ishlaydi.
 */
import { useGSAP } from '@gsap/react'
import clsx from 'clsx'
import gsap from 'gsap'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

type Edges = { t: number; r: number; b: number; l: number }
type Edge = keyof Edges

interface PillNavProps {
  activeKey: string | null
  orientation?: 'vertical' | 'horizontal'
  radius?: number
  className?: string
  /** Ro'yxatni chizadi. `overlay=true` bo'lsa — pill ichidagi interaktiv bo'lmagan nusxa. */
  render: (overlay: boolean) => ReactNode
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function PillNav({ activeKey, orientation = 'vertical', radius, className, render }: PillNavProps) {
  const root = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const state = useRef<Edges | null>(null)
  const rounded = radius ?? (orientation === 'horizontal' ? 999 : 12)

  const paint = () => {
    const s = state.current
    if (!s || !pill.current) return
    pill.current.style.clipPath = `inset(${s.t}px ${s.r}px ${s.b}px ${s.l}px round ${rounded}px)`
  }

  const measure = (): Edges | null => {
    const container = root.current
    if (!container || activeKey == null) return null
    const el = container.querySelector<HTMLElement>(
      `:scope > .pillnav__base [data-pill-key="${CSS.escape(activeKey)}"]`,
    )
    if (!el) return null
    const c = container.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return {
      t: r.top - c.top,
      l: r.left - c.left,
      b: c.bottom - r.bottom,
      r: c.right - r.right,
    }
  }

  const hide = () => {
    // Faol element yo'q — pillni markazga "yig'ib" yashiramiz
    if (!pill.current) return
    pill.current.style.clipPath = `inset(50% 50% 50% 50% round ${rounded}px)`
    state.current = null
  }

  // Faol element o'zgarganda — lead/trail animatsiya
  useGSAP(
    () => {
      const to = measure()
      if (!to) {
        hide()
        return
      }
      const prev = state.current
      if (!prev || reduceMotion()) {
        state.current = { ...to }
        paint()
        if (!prev && pill.current && !reduceMotion()) {
          gsap.fromTo(pill.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
        }
        return
      }

      const st = state.current!
      gsap.killTweensOf(st)

      const vertical = Math.abs(to.t - prev.t) >= Math.abs(to.l - prev.l)
      const fwd = vertical ? to.t > prev.t : to.l > prev.l
      const [lead, trail]: [Edge, Edge] = vertical
        ? fwd ? ['b', 't'] : ['t', 'b']
        : fwd ? ['r', 'l'] : ['l', 'r']
      const cross: [Edge, Edge] = vertical ? ['l', 'r'] : ['t', 'b']

      gsap.to(st, { [lead]: to[lead], duration: 0.36, ease: 'power3.out', onUpdate: paint })
      gsap.to(st, { [trail]: to[trail], duration: 0.55, ease: 'power3.inOut', onUpdate: paint })
      gsap.to(st, {
        [cross[0]]: to[cross[0]],
        [cross[1]]: to[cross[1]],
        duration: 0.45,
        ease: 'power3.inOut',
        onUpdate: paint,
      })
    },
    { dependencies: [activeKey], scope: root },
  )

  // O'lcham o'zgarsa (oyna, sidebar yig'ilishi) — darhol joyiga qo'yamiz
  useLayoutEffect(() => {
    const container = root.current
    if (!container) return
    // Faqat o'lcham haqiqatan o'zgarsa qayta joylaymiz: observe() ning dastlabki chaqiruvi
    // aktiv animatsiyani buzmasin, lekin bir vaqtda yuklangan sanoqlar ham o'tkazib yuborilmasin
    const key = (e: Edges | null) => (e ? `${e.t}|${e.l}|${e.b}|${e.r}` : '')
    let last = key(measure())
    const ro = new ResizeObserver(() => {
      const to = measure()
      const k = key(to)
      if (k === last) return
      last = k
      if (!to || !state.current) return
      gsap.killTweensOf(state.current)
      state.current = { ...to }
      paint()
    })
    ro.observe(container)
    // Element ichidagi matn/son o'zgarsa (masalan, sanoq keyin yuklansa) ham qayta o'lchaymiz
    container.querySelectorAll<HTMLElement>(':scope > .pillnav__base [data-pill-key]').forEach((el) => ro.observe(el))
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  return (
    <div ref={root} className={clsx('pillnav', `pillnav--${orientation}`, className)}>
      <div className="pillnav__base">{render(false)}</div>
      <div ref={pill} className="pillnav__pill" aria-hidden="true">
        {render(true)}
      </div>
    </div>
  )
}

/* ------------- Gorizontal tablar (PillNav ustiga qurilgan) ------------- */

export interface TabItem<K extends string = string> {
  key: K
  label: ReactNode
  count?: number
}

export function PillTabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    <div className={clsx('tabs-wrap', className)}>
      <PillNav
        orientation="horizontal"
        activeKey={value}
        render={(overlay) => (
          <div className="pillnav__list" role={overlay ? undefined : 'tablist'}>
            {items.map((item) =>
              overlay ? (
                <div key={item.key} className="pillnav__item">
                  {item.label}
                  {item.count !== undefined && <span className="count">{item.count}</span>}
                </div>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={item.key === value}
                  data-pill-key={item.key}
                  className="pillnav__item"
                  onClick={() => onChange(item.key)}
                >
                  {item.label}
                  {item.count !== undefined && <span className="count">{item.count}</span>}
                </button>
              ),
            )}
          </div>
        )}
      />
    </div>
  )
}
