import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  CalendarClock,
  DoorOpen,
  Grid3x3,
  KeyRound,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { CountUp, Dial, useReveal } from '@/components/motion/effects'
import { Card, EmptyState, PageHead, Skeleton } from '@/components/ui'
import { api, type Paginated } from '@/lib/api'
import { formatMoneyShort, formatNumber, greeting, todayLabel } from '@/lib/format'
import type { Project } from '@/lib/types'

const COLORS = {
  sold: 'rgba(242,241,236,0.9)',
  booked: 'var(--warn)',
  available: 'rgba(143,214,168,0.55)',
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'dashboard'],
    queryFn: () => api<Paginated<Project>>('/projects/', { query: { page_size: 100 } }),
  })

  const projects = data?.results ?? []
  const t = projects.reduce(
    (acc, p) => ({
      total: acc.total + p.units_total,
      available: acc.available + p.units_available,
      booked: acc.booked + p.units_booked,
      sold: acc.sold + p.units_sold,
    }),
    { total: 0, available: 0, booked: 0, sold: 0 },
  )
  const sellable = t.available + t.booked + t.sold
  const soldShare = sellable ? t.sold / sellable : 0

  useReveal(root, [isLoading])

  const scenes = [
    { icon: Grid3x3, title: 'Shaxmatka', sub: "Bo'sh xonadonlar", to: '/app/chessboard' },
    { icon: UserPlus, title: 'Yangi mijoz', sub: "Lid qo'shish", to: '/app/clients' },
    { icon: CalendarClock, title: 'Bron qilish', sub: 'Xonadonni band qilish', to: '/app/bookings' },
    { icon: Wallet, title: "To'lov qabul qilish", sub: 'Kassa', to: '/app/payments' },
  ]

  return (
    <div ref={root}>
      <PageHead
        eyebrow={todayLabel()}
        title={<span className="hero-greet">{greeting()}, {user?.first_name}</span>}
        description={
          isLoading ? (
            'Ma’lumotlar yuklanmoqda…'
          ) : (
            <>
              {projects.length} ta loyiha · {formatNumber(t.total)} ta xonadon · {formatNumber(t.available)} ta bo'sh ·{' '}
              <a onClick={() => navigate('/app/chessboard')} style={{ cursor: 'pointer' }}>
                shaxmatkani ochish
              </a>
            </>
          )
        }
      />

      <div className="scene-row" data-reveal>
        {scenes.map((s) => (
          <button key={s.title} type="button" className="chip" onClick={() => navigate(s.to)}>
            <span className="chip__icon">
              <s.icon size={15} />
            </span>
            <span>
              <div className="chip__title">{s.title}</div>
              <div className="chip__sub">{s.sub}</div>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid--4" data-reveal>
        <StatCard icon={Building2} label="Jami xonadonlar" value={t.total} loading={isLoading} foot={`${projects.length} ta loyihada`} />
        <StatCard icon={DoorOpen} label="Bo'sh" value={t.available} loading={isLoading} foot="Sotuvga tayyor" tone="ok" />
        <StatCard icon={CalendarClock} label="Bron qilingan" value={t.booked} loading={isLoading} foot="Shartnoma kutilmoqda" tone="warn" />
        <StatCard icon={KeyRound} label="Sotilgan" value={t.sold} loading={isLoading} foot={`${Math.round(soldShare * 100)}% sotuv darajasi`} />
      </div>

      <div className="grid grid--main mt-16">
        <Card
          title="Loyihalar bo'yicha sotuv"
          subtitle="Har bir turar-joy majmuasi holati"
          action={
            <div className="legend">
              <span><i style={{ background: COLORS.sold }} />Sotilgan</span>
              <span><i style={{ background: COLORS.booked }} />Bron</span>
              <span><i style={{ background: COLORS.available }} />Bo'sh</span>
            </div>
          }
        >
          <div data-reveal>
            {isLoading ? (
              <div className="stack">
                {[0, 1].map((i) => (
                  <Skeleton key={i} height={52} />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState icon={Building2} title="Hali loyiha yo'q">
                Birinchi turar-joy majmuasini 4-bosqichda qo'shiladigan "Loyihalar" bo'limida yaratasiz.
              </EmptyState>
            ) : (
              projects.map((p) => {
                const total = p.units_total || 1
                return (
                  <div key={p.id} className="project-row">
                    <div>
                      <div className="project-row__name">{p.name}</div>
                      <div className="project-row__meta">
                        {[p.district, p.housing_class_display, `${p.blocks_count} blok`, `${p.units_total} xonadon`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="project-row__price">
                      dan
                      <b>{formatMoneyShort(p.min_price)}</b>
                    </div>
                    <div className="progress" title={`Sotilgan ${p.units_sold}, bron ${p.units_booked}, bo'sh ${p.units_available}`}>
                      <div className="progress__seg" style={{ width: `${(p.units_sold / total) * 100}%`, background: COLORS.sold }} />
                      <div className="progress__seg" style={{ width: `${(p.units_booked / total) * 100}%`, background: COLORS.booked }} />
                      <div className="progress__seg" style={{ width: `${(p.units_available / total) * 100}%`, background: COLORS.available }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        <Card title="Sotuv darajasi" subtitle="Sotuvdagi xonadonlardan sotilgani">
          <div className="dial-card" data-reveal>
            <Dial
              value={soldShare}
              size={220}
              label="Sotilgan"
              center={<CountUp value={Math.round(soldShare * 100)} format={(n) => `${Math.round(n)}%`} />}
              sub={`${formatNumber(t.sold)} / ${formatNumber(sellable)}`}
            />
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge--ok">
                {formatNumber(t.available)} bo'sh
              </span>
              <span className="badge badge--warn">{formatNumber(t.booked)} bron</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  foot,
  loading,
  tone,
}: {
  icon: typeof Building2
  label: string
  value: number
  foot: string
  loading?: boolean
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className="card stat card--interactive">
      <div className="stat__top">
        <span>{label}</span>
        <span
          className="stat__icon"
          style={tone ? { background: `var(--${tone}-bg)`, color: `var(--${tone})` } : undefined}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="stat__value">{loading ? <Skeleton width={90} height={32} /> : <CountUp value={value} />}</div>
      <div className="stat__foot">{foot}</div>
    </div>
  )
}
