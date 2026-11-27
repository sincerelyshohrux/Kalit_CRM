import type { Finishing, HousingClass, NearbyKind, PhotoKind, ProjectStatus, UnitStatus, UnitType } from './types'

export const UNIT_STATUS: Record<UnitStatus, { label: string; tone: 'ok' | 'warn' | 'muted' | 'info' }> = {
  available: { label: "Bo'sh", tone: 'ok' },
  booked: { label: 'Bron', tone: 'warn' },
  sold: { label: 'Sotilgan', tone: 'muted' },
  not_for_sale: { label: 'Sotuvda emas', tone: 'info' },
}

export const UNIT_TYPE: Record<UnitType, string> = {
  apartment: 'Kvartira',
  commercial: 'Tijorat',
  parking: 'Avtoturargoh',
  storage: 'Ombor',
}

export const FINISHING: Record<Finishing, string> = {
  none: 'Karobka',
  white_box: 'Qora suvoq',
  full: "Ta'mirli",
}

export const PROJECT_STATUS: Record<ProjectStatus, string> = {
  planning: 'Loyihalashtirilmoqda',
  construction: 'Qurilmoqda',
  completed: 'Topshirilgan',
}

export const HOUSING_CLASS: Record<HousingClass, string> = {
  economy: 'Ekonom',
  comfort: 'Komfort',
  business: 'Biznes',
  premium: 'Premium',
}

export const PHOTO_KIND: Record<PhotoKind, string> = {
  render: 'Vizualizatsiya',
  exterior: "Tashqi ko'rinish",
  interior: 'Interyer',
  territory: 'Hudud',
  progress: 'Qurilish jarayoni',
}

export const NEARBY_KIND: Record<NearbyKind, string> = {
  school: 'Maktab',
  kindergarten: "Bog'cha",
  hospital: 'Shifoxona',
  metro: 'Metro',
  bus: 'Bekat',
  park: 'Park',
  mall: 'Savdo markazi',
  market: 'Bozor',
  mosque: 'Masjid',
  university: 'Universitet',
  sport: 'Sport',
  other: 'Boshqa',
}

export const options = <K extends string>(map: Record<K, string>) =>
  (Object.entries(map) as [K, string][]).map(([value, label]) => ({ value, label }))

export function roomsLabel(rooms: number, type: UnitType = 'apartment') {
  if (type !== 'apartment') return UNIT_TYPE[type]
  return rooms === 0 ? 'Studiya' : `${rooms} xonali`
}

export function formatArea(area: string | number) {
  const n = typeof area === 'string' ? parseFloat(area) : area
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(',', '.')} m²`
}

export function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.0', '')} km` : `${m} m`
}

/** Fayl yuborishdan oldin brauzerda tekshirish (server baribir qayta tekshiradi) */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const MAX_PHOTO_MB = 15

export function checkImageFile(file: File, maxMb = MAX_PHOTO_MB): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return `${file.name}: faqat JPG, PNG yoki WEBP`
  if (file.size > maxMb * 1024 * 1024) return `${file.name}: ${maxMb} MB dan katta`
  return null
}
