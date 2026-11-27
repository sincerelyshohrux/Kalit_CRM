import clsx from 'clsx'
import { ImagePlus } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { IMAGE_ACCEPT } from '@/lib/realty'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  title?: string
  hint?: ReactNode
  compact?: boolean
}

/** Rasmlarni sudrab tashlash yoki tanlash maydoni */
export function Dropzone({ onFiles, multiple = true, disabled, title = 'Rasmlarni shu yerga tashlang', hint, compact }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (list: FileList | null) => {
    if (!list || disabled) return
    const files = Array.from(list)
    onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      className={clsx('dropzone', over && 'dropzone--over', compact && 'dropzone--compact', disabled && 'dropzone--disabled')}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <span className="dropzone__icon">
        <ImagePlus size={compact ? 18 : 22} strokeWidth={1.7} />
      </span>
      <div>
        <div className="dropzone__title">{title}</div>
        <div className="dropzone__hint">{hint ?? 'yoki bosing va tanlang · JPG, PNG, WEBP · 15 MB gacha'}</div>
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
