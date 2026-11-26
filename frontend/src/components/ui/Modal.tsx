import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { IconButton } from '.'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  width?: number
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, description, width, children, footer }: ModalProps) {
  if (!open) return null
  return createPortal(
    <ModalInner onClose={onClose} title={title} description={description} width={width} footer={footer}>
      {children}
    </ModalInner>,
    document.body,
  )
}

function ModalInner({ onClose, title, description, width, children, footer }: Omit<ModalProps, 'open'>) {
  const backdrop = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useGSAP(() => {
    gsap.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    gsap.fromTo(
      panel.current,
      { opacity: 0, y: 16, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' },
    )
  })

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Yopish"])')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div
      ref={backdrop}
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description && <p className="modal__desc">{description}</p>}
          </div>
          <IconButton icon={X} label="Yopish" onClick={onClose} />
        </div>
        {children}
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}
