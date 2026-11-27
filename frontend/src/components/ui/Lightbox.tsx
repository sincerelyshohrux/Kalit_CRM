import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { IconButton } from '.'

export interface LightboxItem {
  src: string
  caption?: string
}

export function Lightbox({ items, index, onIndex, onClose }: { items: LightboxItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  if (index === null || !items[index]) return null
  return createPortal(<LightboxInner items={items} index={index} onIndex={onIndex} onClose={onClose} />, document.body)
}

function LightboxInner({ items, index, onIndex, onClose }: { items: LightboxItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const img = useRef<HTMLImageElement>(null)
  const go = (d: number) => onIndex((index + d + items.length) % items.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  useGSAP(() => {
    gsap.fromTo(img.current, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' })
  }, { dependencies: [index] })

  const item = items[index]
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Rasmni ko'rish" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <IconButton icon={X} label="Yopish" className="lightbox__close" onClick={onClose} />
      {items.length > 1 && (
        <>
          <IconButton icon={ChevronLeft} label="Oldingi" className="lightbox__nav lightbox__nav--prev" onClick={() => go(-1)} />
          <IconButton icon={ChevronRight} label="Keyingi" className="lightbox__nav lightbox__nav--next" onClick={() => go(1)} />
        </>
      )}
      <figure className="lightbox__figure">
        <img ref={img} src={item.src} alt={item.caption || ''} />
        <figcaption>
          {item.caption && <span>{item.caption}</span>}
          <span className="muted">
            {index + 1} / {items.length}
          </span>
        </figcaption>
      </figure>
    </div>
  )
}
