const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']

/** 605000000 -> "605 000 000" */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${formatNumber(value)} so'm`
}

/** 605000000 -> "605 mln", 1250000000 -> "1,25 mlrd" */
export function formatMoneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const abs = Math.abs(value)
  const fmt = (n: number) => n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2).replace(/\.?0+$/, '').replace('.', ',')
  if (abs >= 1e12) return `${fmt(value / 1e12)} trln`
  if (abs >= 1e9) return `${fmt(value / 1e9)} mlrd`
  if (abs >= 1e6) return `${fmt(value / 1e6)} mln`
  if (abs >= 1e3) return `${fmt(value / 1e3)} ming`
  return formatNumber(value)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function todayLabel(d = new Date()): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`
}

export function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Xayrli tun'
  if (h < 11) return 'Xayrli tong'
  if (h < 18) return 'Xayrli kun'
  return 'Xayrli kech'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** "+998901234567" -> "+998 90 123-45-67" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const m = phone.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/)
  return m ? `+998 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : phone
}

/** Foydalanuvchi kiritgan 9 ta raqamni "90 123-45-67" ko'rinishida chiqaradi */
export function maskPhoneDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9)
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)]
  let out = parts[0]
  if (parts[1]) out += ' ' + parts[1]
  if (parts[2]) out += '-' + parts[2]
  if (parts[3]) out += '-' + parts[3]
  return out
}

export function pluralize(n: number, word: string): string {
  return `${formatNumber(n)} ta ${word}`
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const ms = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Platforma admini',
  director: 'Direktor',
  manager: 'Sotuv menejeri',
  cashier: 'Kassir',
}

export const PLAN_LABELS: Record<string, string> = {
  trial: 'Sinov',
  start: 'Start',
  business: 'Business',
  enterprise: 'Enterprise',
}
