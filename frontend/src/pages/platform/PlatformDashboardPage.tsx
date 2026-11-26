import { useQuery } from '@tanstack/react-query'
import { AlarmClock, Building2, CheckCircle2, Plus, Users } from 'lucide-react'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { CountUp, Dial, useReveal } from '@/components/motion/effects'
import { Badge, Button, Card, PageHead, Skeleton } from '@/components/ui'
import { api, type Paginated } from '@/lib/api'
import { daysUntil, formatDate, greeting, PLAN_LABELS, todayLabel } from '@/lib/format'
import type { PlatformCompany, PlatformStats } from '@/lib/types'

export function PlatformDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)

  const stats = useQuery({ queryKey: ['platform', 'stats'], queryFn: () => api<PlatformStats>('/platform/stats/') })
  const expiring = useQuery({
    queryKey: ['platform', 'companies', 'expiring'],
    queryFn: () => api<Paginated<PlatformCompany>>('/platform/companies/', { query: { ordering: 'subscription_until', page_size: 6 } }),
  })
  useReveal(root, [stats.isLoading])

  const s = stats.data
  const activeShare = s && s.companies_total ? s.companies_active / s.companies_total : 0

  return (
    <div ref={root}>
      <PageHead
        eyebrow={todayLabel()}
        title={<span className="hero-greet">{greeting()}, {user?.first_name}</span>}
        description="Platformadagi kompaniyalar va obunalar holati"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate('/platform/companies?new=1')}>
            Kompaniya qo'shish
          </Button>
        }
      />

      <div className="grid grid--4" data-reveal>
        <Stat icon={Building2} label="Kompaniyalar" value={s?.companies_total} foot="Jami ro'yxatdan o'tgan" />
        <Stat icon={CheckCircle2} label="Faol" value={s?.companies_active} foot="Tizimdan foydalanmoqda" tone="ok" />
        <Stat icon={AlarmClock} label="Obunasi tugayapti" value={s?.subscriptions_expiring_14d} foot="Keyingi 14 kunda" tone="warn" />
        <Stat icon={Users} label="Foydalanuvchilar" value={s?.users_total} foot="Kompaniya xodimlari" />
      </div>

      <div className="grid grid--main mt-16">
        <Card
          title="Obuna muddatlari"
          subtitle="Eng yaqin tugaydiganlar birinchi"
          action={<Button size="sm" variant="ghost" onClick={() => navigate('/platform/companies')}>Barchasi</Button>}
        >
          <div data-reveal>
            {expiring.isLoading ? (
              <Skeleton height={120} />
            ) : (
              <table className="table">
                <tbody>
                  {expiring.data?.results.map((c) => {
                    const d = daysUntil(c.subscription_until)
                    return (
                      <tr key={c.id}>
                        <td style={{ paddingLeft: 0 }}>
                          <div className="cell-main">{c.name}</div>
                          <div className="cell-sub">{PLAN_LABELS[c.plan]} · {c.users_count} xodim</div>
                        </td>
                        <td>{formatDate(c.subscription_until)}</td>
                        <td className="num" style={{ paddingRight: 0 }}>
                          {c.status === 'suspended' ? (
                            <Badge tone="danger">Bloklangan</Badge>
                          ) : d === null ? (
                            <Badge>Muddatsiz</Badge>
                          ) : d < 0 ? (
                            <Badge tone="danger">Tugagan</Badge>
                          ) : d <= 14 ? (
                            <Badge tone="warn">{d} kun qoldi</Badge>
                          ) : (
                            <Badge tone="ok">{d} kun</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card title="Faollik" subtitle="Faol kompaniyalar ulushi">
          <div className="dial-card" data-reveal>
            <Dial
              value={activeShare}
              size={220}
              label="Faol"
              center={<CountUp value={Math.round(activeShare * 100)} format={(n) => `${Math.round(n)}%`} />}
              sub={s ? `${s.companies_active} / ${s.companies_total}` : ''}
            />
            <div className="row row--wrap" style={{ gap: 8, justifyContent: 'center' }}>
              {s && s.companies_suspended > 0 && (
                <span className="badge badge--danger">
                  {s.companies_suspended} bloklangan
                </span>
              )}
              {s &&
                Object.entries(s.by_plan).map(([plan, n]) => (
                  <span key={plan} className="badge badge--plain">
                    {PLAN_LABELS[plan]}: {n}
                  </span>
                ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  foot,
  tone,
}: {
  icon: typeof Building2
  label: string
  value: number | undefined
  foot: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className="card stat card--interactive">
      <div className="stat__top">
        <span>{label}</span>
        <span className="stat__icon" style={tone ? { background: `var(--${tone}-bg)`, color: `var(--${tone})` } : undefined}>
          <Icon size={16} />
        </span>
      </div>
      <div className="stat__value">{value === undefined ? <Skeleton width={60} height={32} /> : <CountUp value={value} />}</div>
      <div className="stat__foot">{foot}</div>
    </div>
  )
}
