import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

import { initials, maskPhoneDigits } from '@/lib/format'

/* ---------------- Button ---------------- */

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
  icon?: LucideIcon
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', block, loading, icon: Icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} /> : null}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  dot?: boolean
}

export function IconButton({ icon: Icon, label, dot, className, ...rest }: IconButtonProps) {
  return (
    <button type="button" className={clsx('icon-btn', className)} aria-label={label} title={label} {...rest}>
      <Icon size={17} strokeWidth={1.8} />
      {dot && <span className="icon-btn__dot" />}
    </button>
  )
}

/* ---------------- Form ---------------- */

interface FieldProps {
  label?: string
  error?: string
  hint?: string
  htmlFor?: string
  className?: string
  children: ReactNode
}

/** `<label>` ichiga o'ralgan maydon — input avtomatik nomlanadi (screen reader, avtoto'ldirish). */
export function Field({ label, error, hint, htmlFor, className, children }: FieldProps) {
  return (
    <label className={clsx('field', className)} htmlFor={htmlFor}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {error ? <span className="field__error" role="alert">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon
  prefix?: string
  invalid?: boolean
  right?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon: Icon, prefix, invalid, right, className, ...rest },
  ref,
) {
  return (
    <div className={clsx('input', invalid && 'input--invalid', className)}>
      {Icon && (
        <span className="input__icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      )}
      {prefix && <span className="input__prefix">{prefix}</span>}
      <input ref={ref} aria-invalid={invalid || undefined} {...rest} />
      {right}
    </div>
  )
})

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  /** faqat 9 ta raqam: "901234567" */
  value: string
  onChange: (digits: string) => void
  invalid?: boolean
  icon?: LucideIcon
}

/** +998 prefiksli telefon maydoni: "90 123-45-67" ko'rinishida formatlaydi */
export function PhoneInput({ value, onChange, invalid, icon, ...rest }: PhoneInputProps) {
  return (
    <TextInput
      {...rest}
      icon={icon}
      prefix="+998"
      invalid={invalid}
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="90 123-45-67"
      value={maskPhoneDigits(value)}
      onChange={(e) => {
        let digits = e.target.value.replace(/\D/g, '')
        if (digits.startsWith('998') && digits.length > 9) digits = digits.slice(3)
        onChange(digits.slice(0, 9))
      }}
    />
  )
}

export function toE164(digits: string) {
  return `+998${digits}`
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  invalid?: boolean
}

export function Select({ options, invalid, className, ...rest }: SelectProps) {
  return (
    <div className={clsx('input', invalid && 'input--invalid', className)}>
      <select {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ color: 'var(--text-3)', flex: 'none' }}>
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/* ---------------- Display ---------------- */

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted'

export function Badge({ tone = 'muted', plain, children }: { tone?: Tone; plain?: boolean; children: ReactNode }) {
  return <span className={clsx('badge', tone !== 'muted' && `badge--${tone}`, plain && 'badge--plain')}>{children}</span>
}

export function Avatar({
  name,
  src,
  size = 'md',
  square,
}: {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  square?: boolean
}) {
  return (
    <span className={clsx('avatar', size !== 'md' && `avatar--${size}`, square && 'avatar--square')} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name) || '?'}
    </span>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Yuklanmoqda" />
}

export function Skeleton({ width = '100%', height = 16, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ display: 'block', width, height, ...style }} />
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon size={24} strokeWidth={1.6} />
      </div>
      <div className="empty__title">{title}</div>
      {children && <div style={{ maxWidth: 380 }}>{children}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || action) && (
        <header className="card__head">
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-head" data-reveal>
      <div>
        {eyebrow && <div className="page-head__eyebrow">{eyebrow}</div>}
        <h1 className="page-head__title">{title}</h1>
        {description && <p className="page-head__desc">{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  )
}
