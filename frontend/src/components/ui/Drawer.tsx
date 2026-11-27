import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { IconButton } from '.'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** O'ng tomondan chiquvchi shisha panel (xonadon tafsilotlari va h.k.) */
export function Drawer({ open, ...rest }: DrawerProps) {
  if (!open) return null
  return createPortal(<DrawerInner {...rest} />, document.body)
}

function DrawerInner({ onClose, title, subtitle, children, footer, width = 440 }: Omit<DrawerProps, 'open'>) {
  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useGSAP(() => {
    gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
    gsap.fromTo(panel.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' })
  })

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div className="drawer-layer">
      <div ref={scrim} className="drawer-layer__scrim" onMouseDown={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        className="side-drawer glass glass--strong"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100vw)` }}
      >
        <header className="side-drawer__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="side-drawer__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <div className="side-drawer__sub">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Yopish" onClick={onClose} />
        </header>
        <div className="side-drawer__body">{children}</div>
        {footer && <footer className="side-drawer__foot">{footer}</footer>}
      </aside>
    </div>
  )
}
