/** Ommaviy sayt (login talab qilinmaydi) — turlar va so'rovlar */
import { useQuery } from '@tanstack/react-query'

import { api } from './api'
import type { NearbyPlace, ProjectStatus, UnitType } from './types'

export interface PublicProjectCard {
  id: number
  name: string
  city: string
  district: string
  address: string
  status: ProjectStatus
  status_display: string
  housing_class: string
  housing_class_display: string
  completion_date: string | null
  latitude: number | null
  longitude: number | null
  cover: string | null
  units_available: number
  min_price: number | null
}

export interface PublicSite {
  slug: string
  company: { name: string; logo: string | null; city: string }
  headline: string
  about: string
  phone: string
  telegram: string
  instagram: string
  show_prices: boolean
  installment: { enabled: boolean; min_down: number; max_months: number; markup: number }
  turnstile_site_key: string | null
  projects: PublicProjectCard[]
}

export interface PublicProject extends PublicProjectCard {
  description: string
  start_date: string | null
  nearby: NearbyPlace[]
  blocks: { id: number; name: string; floors_count: number }[]
  photos: { id: number; kind: string; kind_display: string; caption: string; image: string; thumb: string; width: number; height: number }[]
  layouts: { id: number; name: string; rooms: number; area: string; unit_type: UnitType; image: string | null; thumb: string | null; available: number; min_price: number | null }[]
}

export interface PublicCell {
  id: number
  entrance: number
  floor: number
  position: number
  number: string
  unit_type: UnitType
  rooms: number
  area: string
  layout_id: number | null
  match: boolean
  free: boolean
  total_price: number | null
  price_per_m2: number | null
}

export interface PublicBoard {
  project: { id: number; name: string }
  show_prices: boolean
  layouts: { id: number; name: string; rooms: number; area: string; image: string | null; thumb: string | null }[]
  summary: { total: number; free: number; matched: number }
  blocks: {
    id: number
    name: string
    floors_count: number
    entrances_count: number
    units_per_floor: number
    summary: { total: number; free: number }
    entrances: { entrance: number; floors: { floor: number; units: PublicCell[] }[] }[]
  }[]
}

export interface PublicUnit {
  id: number
  number: string
  floor: number
  entrance: number
  unit_type: UnitType
  unit_type_display: string
  rooms: number
  area: string
  finishing: string
  finishing_display: string
  has_balcony: boolean
  free: boolean
  total_price: number | null
  price_per_m2: number | null
  block: { id: number; name: string; floors_count: number }
  project: { id: number; name: string }
  layout: { id: number; name: string; description: string; image: string | null; thumb: string | null } | null
}

const base = (slug: string) => `/public/sites/${encodeURIComponent(slug)}`

export function useSite(slug: string) {
  return useQuery({ queryKey: ['public', slug], queryFn: () => api<PublicSite>(`${base(slug)}/`), staleTime: 60_000 })
}

export function usePublicProject(slug: string, id: number) {
  return useQuery({ queryKey: ['public', slug, 'project', id], queryFn: () => api<PublicProject>(`${base(slug)}/projects/${id}/`), staleTime: 60_000 })
}

export function usePublicBoard(slug: string, id: number, query: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['public', slug, 'board', id, query],
    queryFn: () => api<PublicBoard>(`${base(slug)}/projects/${id}/chessboard/`, { query }),
    placeholderData: (prev) => prev,
  })
}

export function usePublicUnit(slug: string, id: number) {
  return useQuery({ queryKey: ['public', slug, 'unit', id], queryFn: () => api<PublicUnit>(`${base(slug)}/units/${id}/`) })
}

export function sendLead(slug: string, body: Record<string, unknown>) {
  return api<{ ok: boolean; detail: string }>(`${base(slug)}/leads/`, { method: 'POST', body })
}

/** Bo'lib to'lash hisobi: boshlang'ich to'lov va oylik to'lov */
export function installment(price: number, downPercent: number, months: number, markup: number) {
  const down = Math.round((price * downPercent) / 100)
  const rest = Math.round((price - down) * (1 + markup / 100))
  return { down, rest, monthly: months > 0 ? Math.ceil(rest / months) : rest, total: down + rest }
}

/** Sahifa sarlavhasi va tavsifini yangilash (brauzer tab va ulashish uchun) */
export function setPageMeta(title: string, description?: string) {
  document.title = title
  if (description !== undefined) {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.appendChild(tag)
    }
    tag.content = description
  }
}
