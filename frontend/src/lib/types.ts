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
  blocks_count: number
  units_total: number
  units_available: number
  units_booked: number
  units_sold: number
  min_price: number | null
  created_at: string
  updated_at: string
}
