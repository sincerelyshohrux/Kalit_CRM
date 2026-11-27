export type Role = 'superadmin' | 'director' | 'manager' | 'cashier'

export type CompanyStatus = 'active' | 'suspended'
export type Plan = 'trial' | 'start' | 'business' | 'enterprise'

export interface CompanyShort {
  id: number
  name: string
  logo: string | null
  status: CompanyStatus
  plan: Plan
  subscription_until: string | null
}

export interface User {
  id: number
  phone: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  avatar: string | null
  role: Role
  role_display: string
  company: CompanyShort | null
  is_active: boolean
  last_login: string | null
  date_joined: string
}

export interface LoginResponse {
  access: string
  user: User
}

export interface PlatformCompany {
  id: number
  name: string
  legal_name: string
  inn: string
  phone: string
  email: string
  city: string
  address: string
  logo: string | null
  status: CompanyStatus
  plan: Plan
  subscription_until: string | null
  max_users: number
  users_count: number
  director_info: { id: number; full_name: string; phone: string } | null
  created_at: string
  updated_at: string
}

export interface PlatformStats {
  companies_total: number
  companies_active: number
  companies_suspended: number
  subscriptions_expiring_14d: number
  subscriptions_expired: number
  users_total: number
  by_plan: Partial<Record<Plan, number>>
}

export type ProjectStatus = 'planning' | 'construction' | 'completed'
export type HousingClass = 'economy' | 'comfort' | 'business' | 'premium'

export interface Project {
  id: number
  name: string
  city: string
  district: string
  address: string
  description: string
  housing_class: HousingClass
  housing_class_display: string
  status: ProjectStatus
  status_display: string
  start_date: string | null
  completion_date: string | null
  cover: string | null
  is_active: boolean
  show_on_site: boolean
  latitude: number | null
  longitude: number | null
  nearby: NearbyPlace[]
  blocks_count: number
  photos_count: number
  layouts_count: number
  units_total: number
  units_available: number
  units_booked: number
  units_sold: number
  min_price: number | null
  created_at: string
  updated_at: string
}

export type NearbyKind =
  | 'school' | 'kindergarten' | 'hospital' | 'metro' | 'bus' | 'park'
  | 'mall' | 'market' | 'mosque' | 'university' | 'sport' | 'other'

export interface NearbyPlace {
  kind: NearbyKind
  name: string
  distance_m: number
}

export type UnitStatus = 'available' | 'booked' | 'sold' | 'not_for_sale'
export type UnitType = 'apartment' | 'commercial' | 'parking' | 'storage'
export type Finishing = 'none' | 'white_box' | 'full'

interface UnitStats {
  units_total: number
  units_available: number
  units_booked: number
  units_sold: number
  min_price: number | null
}

export interface Block extends UnitStats {
  id: number
  project: number
  project_name: string
  name: string
  floors_count: number
  entrances_count: number
  units_per_floor: number
  start_floor: number
  top_floor: number
  completion_date: string | null
  sort_order: number
  created_at: string
}

export interface LayoutInfo {
  id: number
  name: string
  image: string | null
  thumb: string | null
}

export interface Unit {
  id: number
  project_id: number
  project_name: string
  block: number
  block_name: string
  entrance: number
  floor: number
  position: number
  number: string
  unit_type: UnitType
  unit_type_display: string
  rooms: number
  area: string
  price_per_m2: number
  total_price: number
  status: UnitStatus
  status_display: string
  finishing: Finishing
  has_balcony: boolean
  layout: number | null
  layout_info: LayoutInfo | null
  note: string
  active_booking: UnitBooking | null
  updated_at: string
}

/** Xonadondagi faol bron (menejerga begona mijoz ismi `null` bo'lib keladi) */
export interface UnitBooking {
  id: number
  expires_at: string
  total_price?: number
  manager: string | null
  client_id: number | null
  client_name: string | null
  client_phone?: string | null
  mine: boolean
}

export interface PriceChange {
  id: number
  old_price_per_m2: number
  new_price_per_m2: number
  old_total: number
  new_total: number
  changed_by_name: string | null
  reason: string
  created_at: string
}

export type PhotoKind = 'render' | 'exterior' | 'interior' | 'territory' | 'progress'

export interface ProjectPhoto {
  id: number
  project: number
  block: number | null
  kind: PhotoKind
  kind_display: string
  image: string
  thumb: string
  width: number
  height: number
  caption: string
  sort_order: number
  created_at: string
}

export interface Layout {
  id: number
  project: number
  name: string
  unit_type: UnitType
  unit_type_display: string
  rooms: number
  area: string
  image: string | null
  thumb: string | null
  description: string
  sort_order: number
  units_count: number
  units_available: number
  min_price: number | null
}

/* ---- Shaxmatka ---- */

export interface ChessUnit {
  id: number
  block_id: number
  entrance: number
  floor: number
  position: number
  number: string
  unit_type: UnitType
  rooms: number
  area: string
  price_per_m2: number
  total_price: number
  status: UnitStatus
  finishing: Finishing
  layout_id: number | null
  booking: UnitBooking | null
  match: boolean
}

export type ChessSummary = { total: number; matched?: number } & Record<UnitStatus, number>

export interface ChessBlock {
  id: number
  name: string
  floors_count: number
  entrances_count: number
  units_per_floor: number
  start_floor: number
  top_floor: number
  summary: ChessSummary
  entrances: { entrance: number; floors: { floor: number; units: ChessUnit[] }[] }[]
}

export interface Chessboard {
  project: { id: number; name: string; status: ProjectStatus }
  layouts: (LayoutInfo & { rooms: number; area: string })[]
  summary: ChessSummary
  statuses: { value: UnitStatus; label: string }[]
  blocks: ChessBlock[]
}

export interface Employee {
  id: number
  phone: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  avatar: string | null
  role: Role
  role_display: string
  is_active: boolean
  last_login: string | null
  date_joined: string
}

/* ---------------- CRM: mijozlar va bronlar ---------------- */

export type ClientStatus = 'new' | 'contacted' | 'visited' | 'booked' | 'contract' | 'rejected'
export type ClientSource = 'instagram' | 'telegram' | 'referral' | 'office' | 'call' | 'website' | 'other'
export type BookingStatus = 'active' | 'expired' | 'cancelled' | 'converted'
export type ActivityKind =
  | 'created' | 'note' | 'call' | 'meeting' | 'status' | 'manager'
  | 'booking_created' | 'booking_extended' | 'booking_cancelled' | 'booking_expired'

export interface UserBrief {
  id: number
  full_name: string
}

export interface Client {
  id: number
  last_name: string
  first_name: string
  middle_name: string
  full_name: string
  phone: string
  phone2: string
  source: ClientSource
  source_display: string
  status: ClientStatus
  status_display: string
  reject_reason: string
  manager: number | null
  manager_info: UserBrief | null
  interested_project: number | null
  interested_project_name: string | null
  budget: number | null
  note: string
  created_by_info: UserBrief | null
  active_bookings: number
  can_edit: boolean
  created_at: string
  updated_at: string
}

export type ClientStats = { total: number; mine: number } & Record<ClientStatus, number>

export interface ClientActivity {
  id: number
  kind: ActivityKind
  kind_display: string
  text: string
  author_info: UserBrief | null
  booking: number | null
  created_at: string
}

export interface Booking {
  id: number
  unit: number
  unit_info: {
    id: number
    number: string
    floor: number
    entrance: number
    rooms: number
    area: string
    unit_type: UnitType
    status: UnitStatus
    block_id: number
    block_name: string
    project_id: number
    project_name: string
  }
  client: number
  client_info: { id: number; full_name: string; phone: string; status: ClientStatus }
  status: BookingStatus
  status_display: string
  expires_at: string
  price_per_m2: number
  total_price: number
  note: string
  created_by_info: UserBrief | null
  closed_at: string | null
  closed_by_info: UserBrief | null
  cancel_reason: string
  can_manage: boolean
  created_at: string
}

export type BookingStats = Record<BookingStatus, number> & { max_days: number; company_days: number }
