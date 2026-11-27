import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Building2, CalendarCheck2, Grid3x3, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { PillTabs } from '@/components/motion/PillNav'
import { CountUp, useReveal } from '@/components/motion/effects'
import { Badge, Button, EmptyState, IconButton, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatDate, formatMoneyShort } from '@/lib/format'
import { formatDistance, NEARBY_KIND } from '@/lib/realty'
import type { Project, ProjectPhoto } from '@/lib/types'

import { BlocksTab } from './project/BlocksTab'
import { LayoutsTab } from './project/LayoutsTab'
import { LocationTab } from './project/LocationTab'
import { PhotosTab } from './project/PhotosTab'
import { ProjectCover } from './project/ProjectCover'
import { ProjectFormModal } from './project/ProjectFormModal'

type Tab = 'overview' | 'blocks' | 'photos' | 'layouts' | 'location'
const TABS: Tab[] = ['overview', 'blocks', 'photos', 'layouts', 'location']

export function ProjectDetailPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const { user } = useAuth()
  const canEdit = user?.role === 'director'
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as Tab | null
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'overview'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: ['projects', 'detail', projectId],
    queryFn: () => api<Project>(`/projects/${projectId}/`),
    enabled: Number.isFinite(projectId),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  })
  const photos = useQuery({
    queryKey: ['photos', projectId],
    queryFn: () => api<ProjectPhoto[]>('/photos/', { query: { project: projectId } }),
    enabled: Number.isFinite(projectId),
  })
  useReveal(root, [query.isLoading])

  const remove = useMutation({
    mutationFn: () => api(`/projects/${projectId}/`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success("Loyiha o'chirildi")
      navigate('/app/projects', { replace: true })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  if (query.isLoading) {
    return (
      <div className="stack">
        <Skeleton height={260} style={{ borderRadius: 'var(--r-lg)' }} />
        <Skeleton height={44} width={420} />
        <Skeleton height={200} />
      </div>
    )
  }
  const p = query.data
  if (!p) {
    return (
      <EmptyState icon={Building2} title="Loyiha topilmadi" action={<Link className="btn" to="/app/projects">Loyihalarga qaytish</Link>}>
        U o'chirilgan yoki sizda ruxsat yo'q.
      </EmptyState>
    )
  }

  const hero = photos.data?.[0]
  const sellable = p.units_available + p.units_booked + p.units_sold

  return (
    <div ref={root}>
      <section className="project-hero" data-reveal>
        <ProjectCover src={hero?.image ?? null} name={p.name} className="project-hero__img" />
        <div className="project-hero__shade" />
        <div className="project-hero__top">
          <IconButton icon={ArrowLeft} label="Loyihalarga qaytish" onClick={() => navigate('/app/projects')} />
          <div className="row">
            <Link to={`/app/chessboard?project=${p.id}`} className="btn btn--sm">
              <Grid3x3 size={14} /> Shaxmatka
            </Link>
            {canEdit && (
              <>
                <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                  Tahrirlash
                </Button>
                <IconButton icon={Trash2} label="Loyihani o'chirish" onClick={() => setDeleting(true)} />
              </>
            )}
          </div>
        </div>
        <div className="project-hero__bottom">
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <Badge tone={p.status === 'completed' ? 'ok' : p.status === 'construction' ? 'warn' : 'info'}>{p.status_display}</Badge>
            <Badge plain>{p.housing_class_display}</Badge>
            {!p.is_active && <Badge tone="danger">Sotuvda emas</Badge>}
          </div>
          <h1 className="project-hero__title">{p.name}</h1>
          <div className="project-hero__meta">
            <MapPin size={14} /> {[p.city, p.district, p.address].filter(Boolean).join(', ') || 'Manzil kiritilmagan'}
            {p.completion_date && (
              <>
                <span className="sep-dot" /> <CalendarCheck2 size={14} /> Topshirish: {formatDate(p.completion_date)}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="project-tabs" data-reveal>
        <PillTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'overview', label: 'Umumiy' },
            { key: 'blocks', label: 'Bloklar', count: p.blocks_count },
            { key: 'photos', label: 'Rasmlar', count: p.photos_count },
            { key: 'layouts', label: 'Planirovkalar', count: p.layouts_count },
            { key: 'location', label: 'Lokatsiya' },
          ]}
        />
      </div>

      {tab === 'overview' && (
        <div className="grid grid--main" data-reveal>
          <div className="stack">
            <div className="grid grid--4">
              <Stat label="Jami xonadon" value={p.units_total} />
              <Stat label="Bo'sh" value={p.units_available} tone="var(--ok)" />
              <Stat label="Bron" value={p.units_booked} tone="var(--warn)" />
              <Stat label="Sotilgan" value={p.units_sold} />
            </div>
            <div className="card">
              <div className="card__head">
                <h3 className="card__title">Sotuv holati</h3>
                <span className="muted">{sellable ? Math.round((p.units_sold / sellable) * 100) : 0}% sotilgan</span>
              </div>
              <div className="progress progress--lg">
                {[
                  [p.units_sold, 'rgba(242,241,236,0.85)'],
                  [p.units_booked, 'var(--warn)'],
                  [p.units_available, 'rgba(143,214,168,0.45)'],
                ].map(([n, c], i) => (
                  <span key={i} className="progress__seg" style={{ width: `${sellable ? (Number(n) / sellable) * 100 : 0}%`, background: String(c) }} />
                ))}
              </div>
              <p className="project-desc">{p.description || <span className="muted">Tavsif kiritilmagan.</span>}</p>
            </div>
          </div>
          <div className="stack">
            <div className="card">
              <h3 className="card__title" style={{ marginBottom: 12 }}>Ma'lumotlar</h3>
              <dl className="kv">
                <dt>Eng arzon xonadon</dt>
                <dd>{p.min_price ? formatMoneyShort(p.min_price) + " so'm" : '—'}</dd>
                <dt>Bloklar</dt>
                <dd>{p.blocks_count}</dd>
                <dt>Qurilish boshlangan</dt>
                <dd>{formatDate(p.start_date)}</dd>
                <dt>Topshirish</dt>
                <dd>{formatDate(p.completion_date)}</dd>
                <dt>Koordinata</dt>
                <dd>{p.latitude != null ? `${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}` : '—'}</dd>
              </dl>
            </div>
            {p.nearby.length > 0 && (
              <div className="card">
                <h3 className="card__title" style={{ marginBottom: 12 }}>Atrofda</h3>
                <dl className="kv">
                  {p.nearby.map((n, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      <dt>
                        {NEARBY_KIND[n.kind]} · {n.name}
                      </dt>
                      <dd>{formatDistance(n.distance_m)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === 'blocks' && <BlocksTab project={p} canEdit={canEdit} />}
      {tab === 'photos' && <PhotosTab project={p} canEdit={canEdit} />}
      {tab === 'layouts' && <LayoutsTab project={p} canEdit={canEdit} />}
      {tab === 'location' && <LocationTab project={p} canEdit={canEdit} />}

      <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={p} />
      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Loyihani o'chirish"
        description={`«${p.name}» va uning barcha bloklari, xonadonlari, rasmlari o'chiriladi. Bron yoki sotilgan xonadon bo'lsa, o'chirib bo'lmaydi.`}
        confirmLabel="O'chirish"
        danger
        icon={Trash2}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="stat card">
      <div className="stat__top">
        <span className="muted">{label}</span>
        {tone && <span className="legend-dot" style={{ background: tone }} />}
      </div>
      <div className="stat__value">
        <CountUp value={value} />
      </div>
    </div>
  )
}
