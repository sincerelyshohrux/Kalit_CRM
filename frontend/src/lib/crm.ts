import type { Tone } from '@/components/ui'

import type { ActivityKind, BookingStatus, ClientSource, ClientStatus } from './types'

export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: Tone }> = {
  new: { label: 'Yangi', tone: 'info' },
  contacted: { label: "Bog'lanildi", tone: 'muted' },
  visited: { label: "Ko'rishga keldi", tone: 'ok' },
  booked: { label: 'Bron', tone: 'warn' },
  contract: { label: 'Shartnoma', tone: 'ok' },
  rejected: { label: 'Rad etdi', tone: 'danger' },
}

/** Voronka tartibi */
export const PIPELINE: ClientStatus[] = ['new', 'contacted', 'visited', 'booked', 'contract', 'rejected']

/** Qo'lda tanlanadigan holatlar (bron va shartnoma — avtomatik) */
export const MANUAL_CLIENT_STATUSES: ClientStatus[] = ['new', 'contacted', 'visited', 'rejected']

export const CLIENT_SOURCE: Record<ClientSource, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram',
  referral: 'Tanish-bilish',
  office: 'Ofisga keldi',
  call: "Qo'ng'iroq",
  website: 'Sayt',
  other: 'Boshqa',
}

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  active: { label: 'Faol', tone: 'warn' },
  expired: { label: 'Muddati tugagan', tone: 'muted' },
  cancelled: { label: 'Bekor qilingan', tone: 'danger' },
  converted: { label: 'Shartnomaga o\'tgan', tone: 'ok' },
}

export const ACTIVITY_KIND: Record<ActivityKind, string> = {
  created: "Bazaga qo'shildi",
  note: 'Izoh',
  call: "Qo'ng'iroq",
  meeting: 'Uchrashuv',
  status: "Holat o'zgardi",
  manager: "Menejer o'zgardi",
  booking_created: 'Bron qilindi',
  booking_extended: 'Bron uzaytirildi',
  booking_cancelled: 'Bron bekor qilindi',
  booking_expired: 'Bron muddati tugadi',
}

/** Bron muddatigacha qolgan vaqt: "2 kun 4 soat", "35 daqiqa", "tugadi" */
export function timeLeft(expiresAt: string, now = Date.now()): { label: string; urgent: boolean; over: boolean } {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return { label: 'tugadi', urgent: true, over: true }
  const min = Math.floor(ms / 60_000)
  const days = Math.floor(min / 1440)
  const hours = Math.floor((min % 1440) / 60)
  const label = days > 0 ? `${days} kun${hours ? ` ${hours} soat` : ''}` : hours > 0 ? `${hours} soat ${min % 60} daq` : `${min} daqiqa`
  return { label, urgent: ms < 24 * 3_600_000, over: false }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Nisbiy vaqt: "hozir", "5 daqiqa oldin", "kecha", "3 kun oldin" */
export function timeAgo(value: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(value).getTime()) / 1000)
  if (s < 60) return 'hozir'
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'kecha' : d < 30 ? `${d} kun oldin` : formatDateTime(value).slice(0, 10)
}
