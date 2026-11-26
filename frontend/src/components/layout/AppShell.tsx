import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  Bell,
  CircleHelp,
  CloudSun,
  LogOut,
  Menu,
  PanelLeft,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { PillNav } from '@/components/motion/PillNav'
import { Avatar, IconButton } from '@/components/ui'
import { daysUntil, formatDate, PLAN_LABELS, todayLabel } from '@/lib/format'

import { activeKeyFor, filterNav, type NavSection } from './nav'

export function KalitMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="12" r="4.2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12.7 12h8.3M18.2 12v3.6M21 12v2.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

interface AppShellProps {
  nav: NavSection[]
  variant: 'company' | 'platform'
}

export function AppShell({ nav, variant }: AppShellProps) {
  const { user } = useAuth()
  const location = useLocation()
  const sections = filterNav(nav, user?.role)
  const activeKey = activeKeyFor(sections, location.pathname)
  const [drawer, setDrawer] = useState(false)
  const content = useRef<HTMLDivElement>(null)

  useEffect(() => setDrawer(false), [location.pathname])

  // Sahifa almashganda kontent yumshoq paydo bo'ladi
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.fromTo(
        content.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' },
      )
      content.current?.scrollTo({ top: 0 })
    },
    { dependencies: [location.pathname] },
  )

  const company = user?.company
  const subTitle = variant === 'platform' ? 'Platforma boshqaruvi' : company?.name ?? ''

  return (
    <div className={`shell${drawer ? ' shell--drawer' : ''}`}>
      <aside className="sidebar glass" aria-label="Asosiy menyu">
        <div className="brand">
          <div className="brand__mark">
            <KalitMark />
          </div>
          <div className="brand__text">
            <div className="brand__name">Kalit</div>
            <div className="brand__sub" title={subTitle}>
              {subTitle}
            </div>
          </div>
          <IconButton icon={PanelLeft} label="Menyuni yopish" className="brand__toggle drawer-only" onClick={() => setDrawer(false)} />
        </div>

        <nav className="sidebar__nav">
          <PillNav
            activeKey={activeKey}
            render={(overlay) => (
              <div className="pillnav__list">
                {sections.map((section) => (
                  <SectionBlock key={section.title} section={section} overlay={overlay} />
                ))}
              </div>
            )}
          />
        </nav>

        {variant === 'company' && company ? (
          <div className="sidebar__footer">
            <Avatar name={company.name} src={company.logo} size="sm" square />
            <div className="sidebar__footer-text" style={{ minWidth: 0 }}>
              <div className="sidebar__footer-title">Tarif: {PLAN_LABELS[company.plan]}</div>
              <SubscriptionLine until={company.subscription_until} />
            </div>
          </div>
        ) : (
          <div className="sidebar__footer">
            <span className="stat__icon" style={{ width: 28, height: 28, borderRadius: 9 }}>
              <KalitMark size={15} />
            </span>
            <div className="sidebar__footer-text">
              <div className="sidebar__footer-title">Kalit CRM</div>
              <div className="sidebar__footer-sub">Bron'dan kalitgacha</div>
            </div>
          </div>
        )}
      </aside>
      <div className="drawer-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <div className="main">
        <Topbar onMenu={() => setDrawer(true)} />
        <main ref={content} className="content glass" id="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SectionBlock({ section, overlay }: { section: NavSection; overlay: boolean }) {
  return (
    <>
      <div className="pillnav__section">{section.title}</div>
      {section.items.map((item) => {
        const inner = (
          <>
            <item.icon size={17} strokeWidth={1.8} />
            <span className="pillnav__label">{item.label}</span>
            {item.stage && <span className="count" title={`${item.stage}-bosqichda`}>{item.stage}</span>}
          </>
        )
        return overlay ? (
          <div key={item.key} className="pillnav__item">
            {inner}
          </div>
        ) : (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.end}
            data-pill-key={item.key}
            className="pillnav__item"
            title={item.label}
          >
            {inner}
          </NavLink>
        )
      })}
    </>
  )
}

function SubscriptionLine({ until }: { until: string | null }) {
  if (!until) return <div className="sidebar__footer-sub">Muddatsiz obuna</div>
  const days = daysUntil(until) ?? 0
  return (
    <div className="sidebar__footer-sub" style={days <= 14 ? { color: 'var(--warn)' } : undefined}>
      {days <= 14 ? `Obuna ${days} kunda tugaydi` : `${formatDate(until)} gacha`}
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="topbar glass">
      <IconButton icon={Menu} label="Menyu" className="mobile-only" onClick={onMenu} />
      <label className="search">
        <Search size={15} />
        <span className="sr-only">Qidiruv</span>
        <input ref={searchRef} placeholder="Xonadon, mijoz, shartnoma qidirish…" />
        <span className="kbd">⌘K</span>
      </label>
      <div className="topbar__right">
        <span className="topbar__chip topbar__chip--date">
          <CloudSun size={15} />
          Toshkent · {todayLabel()}
        </span>
        <IconButton icon={CircleHelp} label="Yordam" />
        <IconButton icon={Bell} label="Bildirishnomalar" dot />
        <UserMenu />
      </div>
    </header>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useGSAP(
    () => {
      if (open && menu.current) {
        gsap.fromTo(menu.current, { opacity: 0, y: -6, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power3.out' })
      }
    },
    { dependencies: [open] },
  )

  if (!user) return null
  const settingsPath = user.role === 'superadmin' ? '/platform/settings' : '/app/settings'

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className="user-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Profil menyusi: ${user.full_name}`}>
        <Avatar name={user.full_name || user.phone} src={user.avatar} />
        <span className="user-btn__text">
          <div className="user-btn__name">{user.first_name || user.phone}</div>
          <div className="user-btn__role">{user.role_display}</div>
        </span>
      </button>
      {open && (
        <div ref={menu} className="dropdown" role="menu">
          <div className="dropdown__head">
            <div style={{ fontWeight: 500 }}>{user.full_name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{user.company?.name ?? user.role_display}</div>
          </div>
          <div className="dropdown__sep" />
          <button className="dropdown__item" role="menuitem" onClick={() => { setOpen(false); navigate(settingsPath) }}>
            <UserRound size={15} /> Profil
          </button>
          <button className="dropdown__item" role="menuitem" onClick={() => { setOpen(false); navigate(settingsPath) }}>
            <Settings size={15} /> Sozlamalar
          </button>
          <div className="dropdown__sep" />
          <button
            className="dropdown__item dropdown__item--danger"
            role="menuitem"
            onClick={async () => {
              setOpen(false)
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut size={15} /> Chiqish
          </button>
        </div>
      )}
    </div>
  )
}
