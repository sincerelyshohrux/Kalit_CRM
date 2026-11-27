import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarCheck2, Images, MapPin, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { PillTabs } from '@/components/motion/PillNav'
import { useReveal } from '@/components/motion/effects'
import { Badge, Button, EmptyState, PageHead, Skeleton, TextInput } from '@/components/ui'
import { api, type Paginated } from '@/lib/api'
import { formatDate, formatMoneyShort, formatNumber } from '@/lib/format'
import type { Project, ProjectStatus } from '@/lib/types'

import { ProjectCover } from './project/ProjectCover'
import { ProjectFormModal } from './project/ProjectFormModal'

type Tab = 'all' | ProjectStatus

export function ProjectsPage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'director'
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [creating, setCreating] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'list', tab, debounced],
    queryFn: () => api<Paginated<Project>>('/projects/', { query: { status: tab === 'all' ? undefined : tab, search: debounced, page_size: 100 } }),
  })
  useReveal(root, [isLoading])

  const projects = data?.results ?? []

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Ko'chmas mulk"
        title="Loyihalar"
        description="Turar-joy majmualari, bloklar, rasmlar va planirovkalar"
        actions={
          isDirector && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Yangi loyiha
            </Button>
          )
        }
      />

      <div className="row row--between row--wrap" style={{ marginBottom: 14 }} data-reveal>
        <PillTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: 'Hammasi' },
            { key: 'construction', label: 'Qurilmoqda' },
            { key: 'planning', label: 'Loyihada' },
            { key: 'completed', label: 'Topshirilgan' },
          ]}
        />
        <div style={{ width: 280, maxWidth: '100%' }}>
          <TextInput icon={Search} placeholder="Nomi yoki manzil" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        </div>
      </div>

      {isLoading ? (
        <div className="project-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={330} style={{ borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      ) : !projects.length ? (
        <div className="card" data-reveal>
          <EmptyState
            icon={Building2}
            title={debounced ? 'Hech narsa topilmadi' : "Hali loyiha yo'q"}
            action={isDirector && !debounced && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Birinchi loyihani qo'shish</Button>}
          >
            {debounced ? "Qidiruv so'zini o'zgartirib ko'ring." : 'Loyiha qo\'shing, so\'ng bloklarni yarating — xonadonlar avtomatik generatsiya qilinadi.'}
          </EmptyState>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <ProjectFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const sellable = p.units_available + p.units_booked + p.units_sold
  const pct = (n: number) => (sellable ? (n / sellable) * 100 : 0)
  return (
    <Link to={`/app/projects/${p.id}`} className="project-card card card--interactive" data-reveal>
      <div className="project-card__media">
        <ProjectCover src={p.cover} name={p.name} className="project-card__img" />
        <div className="project-card__badges">
          <Badge tone={p.status === 'completed' ? 'ok' : p.status === 'construction' ? 'warn' : 'info'}>{p.status_display}</Badge>
          <Badge plain>{p.housing_class_display}</Badge>
        </div>
        {p.photos_count > 0 && (
          <span className="project-card__photos">
            <Images size={13} /> {p.photos_count}
          </span>
        )}
      </div>
      <div className="project-card__body">
        <div className="project-card__title">{p.name}</div>
        <div className="project-card__meta">
          <MapPin size={13} />
          <span>{[p.city, p.district].filter(Boolean).join(', ') || 'Manzil kiritilmagan'}</span>
          {p.completion_date && (
            <>
              <span className="sep-dot" />
              <CalendarCheck2 size={13} />
              <span>{formatDate(p.completion_date)}</span>
            </>
          )}
        </div>

        <div className="progress" style={{ marginTop: 14 }} aria-label="Sotuv holati">
          <span className="progress__seg" style={{ width: `${pct(p.units_sold)}%`, background: 'rgba(242,241,236,0.85)' }} />
          <span className="progress__seg" style={{ width: `${pct(p.units_booked)}%`, background: 'var(--warn)' }} />
          <span className="progress__seg" style={{ width: `${pct(p.units_available)}%`, background: 'rgba(143,214,168,0.45)' }} />
        </div>

        <div className="project-card__stats">
          <div>
            <b>{formatNumber(p.units_available)}</b>
            <span>bo'sh</span>
          </div>
          <div>
            <b>{formatNumber(p.units_booked)}</b>
            <span>bron</span>
          </div>
          <div>
            <b>{formatNumber(p.units_sold)}</b>
            <span>sotilgan</span>
          </div>
          <div className="project-card__price">
            <span>dan</span>
            <b>{p.min_price ? formatMoneyShort(p.min_price) : '—'}</b>
          </div>
        </div>
      </div>
    </Link>
  )
}
