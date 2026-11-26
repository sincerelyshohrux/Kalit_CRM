import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Building2,
  CalendarClock,
  FileSignature,
  Grid3x3,
  Home,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'

import type { Role } from '@/lib/types'

export interface NavItem {
  key: string
  to: string
  label: string
  icon: LucideIcon
  /** Qaysi bosqichda tayyor bo'ladi (hozircha "tez orada" sahifasi) */
  stage?: number
  roles?: Role[]
  end?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const COMPANY_NAV: NavSection[] = [
  {
    title: 'Asosiy',
    items: [
      { key: 'home', to: '/app', label: 'Bosh sahifa', icon: Home, end: true },
      { key: 'chessboard', to: '/app/chessboard', label: 'Shaxmatka', icon: Grid3x3, stage: 4 },
      { key: 'projects', to: '/app/projects', label: 'Loyihalar', icon: Building2, stage: 4 },
      { key: 'clients', to: '/app/clients', label: 'Mijozlar', icon: UserRound, stage: 5 },
      { key: 'bookings', to: '/app/bookings', label: 'Bronlar', icon: CalendarClock, stage: 5 },
    ],
  },
  {
    title: 'Moliya',
    items: [
      { key: 'contracts', to: '/app/contracts', label: 'Shartnomalar', icon: FileSignature, stage: 7 },
      { key: 'payments', to: '/app/payments', label: "To'lovlar", icon: Wallet, stage: 7 },
      { key: 'debtors', to: '/app/debtors', label: 'Qarzdorlar', icon: TriangleAlert, stage: 8 },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { key: 'employees', to: '/app/employees', label: 'Xodimlar', icon: Users, stage: 4, roles: ['director'] },
      { key: 'reports', to: '/app/reports', label: 'Hisobotlar', icon: BarChart3, stage: 8, roles: ['director'] },
      { key: 'settings', to: '/app/settings', label: 'Sozlamalar', icon: Settings },
    ],
  },
]

export const PLATFORM_NAV: NavSection[] = [
  {
    title: 'Platforma',
    items: [
      { key: 'home', to: '/platform', label: 'Umumiy holat', icon: Home, end: true },
      { key: 'companies', to: '/platform/companies', label: 'Kompaniyalar', icon: Building2 },
    ],
  },
  {
    title: 'Hisob',
    items: [
      { key: 'security', to: '/platform/settings', label: 'Xavfsizlik', icon: ShieldCheck },
    ],
  },
]

export function filterNav(sections: NavSection[], role: Role | undefined): NavSection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || (role && i.roles.includes(role))) }))
    .filter((s) => s.items.length > 0)
}

/** Joriy URL uchun faol menyu kalitini topadi (eng uzun mos prefiks) */
export function activeKeyFor(sections: NavSection[], pathname: string): string | null {
  let best: NavItem | null = null
  for (const item of sections.flatMap((s) => s.items)) {
    const match = item.end ? pathname === item.to || pathname === item.to + '/' : pathname.startsWith(item.to)
    if (match && (!best || item.to.length > best.to.length)) best = item
  }
  return best?.key ?? null
}
