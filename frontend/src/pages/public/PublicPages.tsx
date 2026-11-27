import clsx from 'clsx'
import { ArrowLeft, Building2, CalendarDays, Images, MapPin, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PillTabs } from '@/components/motion/PillNav'
import { useReveal } from '@/components/motion/effects'
import { InstallmentCalc, LeadForm, ProjectsMap, type LeadTarget } from '@/components/public/PublicPieces'
import { PlanSketch } from '@/components/realty/PlanSketch'
import { Button, EmptyState, Skeleton, TextInput } from '@/components/ui'
import { Lightbox } from '@/components/ui/Lightbox'
import { ApiError } from '@/lib/api'
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from '@/lib/format'
import { formatArea, formatDistance, NEARBY_KIND, roomsLabel } from '@/lib/realty'
import {
  setPageMeta,
  usePublicBoard,
  usePublicProject,
  usePublicUnit,
  type PublicBoard,
  type PublicCell,
  type PublicProjectCard,
  type PublicSite,
} from '@/lib/public'

import { PublicLayout } from './PublicLayout'

const ROOM_FILTERS = [
  { key: '0', label: 'Studiya' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4,5,6,7,8', label: '4+' },
]

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function NotFound({ slug, text }: { slug: string; text: string }) {
  return (
    <div className="card">
      <EmptyState icon={Building2} title={text} action={<Link className="btn" to={`/${slug}`}>Barcha loyihalar</Link>}>
        Ehtimol, u sotuvdan olingan yoki havola eskirgan.
      </EmptyState>
    </div>
  )
}

/* =============== Kompaniya sahifasi =============== */

export function SiteHomePage() {
  const { slug = '' } = useParams()
  return <PublicLayout slug={slug}>{(site, openLead) => <SiteHome site={site} openLead={openLead} />}</PublicLayout>
}

function SiteHome({ site, openLead }: { site: PublicSite; openLead: (t?: LeadTarget) => void }) {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root, [site.slug])
  useEffect(() => setPageMeta(`${site.company.name} — yangi uylar`, site.headline || site.about.slice(0, 160)), [site])

  return (
    <div ref={root}>
      <section className="pub-hero card" data-reveal>
        <div className="pub-hero__text">
          <span className="eyebrow">{site.company.name}</span>
          <h1>{site.headline || `${site.company.name} turar-joy majmualari`}</h1>
          {site.about && <p className="muted">{site.about}</p>}
          <div className="pub-hero__cta">
            <Button variant="primary" size="lg" onClick={() => openLead()}>
              Bepul maslahat olish
            </Button>
            <span className="muted">{formatNumber(site.projects.reduce((s, p) => s + p.units_available, 0))} ta bo'sh xonadon</span>
          </div>
        </div>
      </section>

      <h2 className="pub-section-title" data-reveal>Loyihalar</h2>
      {site.projects.length ? (
        <div className="pub-projects">
          {site.projects.map((p) => (
            <ProjectCard key={p.id} slug={site.slug} project={p} showPrices={site.show_prices} />
          ))}
        </div>
      ) : (
        <div className="card" data-reveal>
          <EmptyState icon={Building2} title="Hozircha loyihalar e'lon qilinmagan">Tez orada yangi loyihalar qo'shiladi.</EmptyState>
        </div>
      )}

      {site.projects.some((p) => p.latitude !== null) && (
        <section data-reveal>
          <h2 className="pub-section-title">Xaritada</h2>
          <ProjectsMap slug={site.slug} projects={site.projects} />
        </section>
      )}
    </div>
  )
}

function ProjectCard({ slug, project: p, showPrices }: { slug: string; project: PublicProjectCard; showPrices: boolean }) {
  return (
    <Link to={`/${slug}/loyiha/${p.id}`} className="pub-card card" data-reveal>
      <div className="pub-card__cover">
        {p.cover ? <img src={p.cover} alt={p.name} loading="lazy" /> : <Building2 size={34} strokeWidth={1.4} />}
        <span className="pub-card__badge">{p.status_display}</span>
      </div>
      <div className="pub-card__body">
        <h3>{p.name}</h3>
        <div className="muted pub-card__addr">
          <MapPin size={13} /> {[p.city, p.district].filter(Boolean).join(', ') || p.address}
        </div>
        <div className="pub-card__meta">
          <span>{p.units_available ? `${p.units_available} bo'sh` : 'Hammasi band'}</span>
          {p.completion_date && <span className="muted">Topshirish: {formatDate(p.completion_date)}</span>}
        </div>
        {showPrices && p.min_price !== null && <div className="pub-card__price">{formatMoneyShort(p.min_price)} so'mdan</div>}
      </div>
    </Link>
  )
}

/* =============== Loyiha sahifasi =============== */

export function PublicProjectPage() {
  const { slug = '', id } = useParams()
  return <PublicLayout slug={slug}>{(site, openLead) => <ProjectView site={site} id={Number(id)} openLead={openLead} />}</PublicLayout>
}

function ProjectView({ site, id, openLead }: { site: PublicSite; id: number; openLead: (t?: LeadTarget) => void }) {
  const q = usePublicProject(site.slug, id)
  const root = useRef<HTMLDivElement>(null)
  const [photo, setPhoto] = useState<number | null>(null)
  useReveal(root, [q.data?.id])
  useEffect(() => {
    if (q.data) setPageMeta(`${q.data.name} — ${site.company.name}`, q.data.description.slice(0, 160))
  }, [q.data, site])

  if (q.isLoading) return <Skeleton height={420} />
  if (!q.data) return <NotFound slug={site.slug} text={q.error instanceof ApiError && q.error.status === 404 ? 'Loyiha topilmadi' : "Yuklab bo'lmadi"} />
  const p = q.data
  const cover = p.photos[0]?.image ?? p.cover

  return (
    <div ref={root}>
      <Link to={`/${site.slug}`} className="pub-back muted">
        <ArrowLeft size={15} /> Barcha loyihalar
      </Link>

      <section className="pub-project-hero card" data-reveal>
        <div className="pub-project-hero__media">
          {cover ? (
            <button type="button" className="pub-cover-btn" onClick={() => setPhoto(0)} aria-label="Rasmlarni ko'rish" disabled={!p.photos.length}>
              <img src={cover} alt={p.name} />
              {p.photos.length > 1 && (
                <span className="pub-cover-btn__count">
                  <Images size={14} /> {p.photos.length}
                </span>
              )}
            </button>
          ) : (
            <div className="pub-cover-empty">
              <Building2 size={44} strokeWidth={1.3} />
            </div>
          )}
        </div>
        <div className="pub-project-hero__info">
          <span className="eyebrow">{p.housing_class_display} · {p.status_display}</span>
          <h1>{p.name}</h1>
          <div className="muted pub-card__addr">
            <MapPin size={14} /> {[p.city, p.district, p.address].filter(Boolean).join(', ')}
          </div>
          <dl className="pub-facts">
            <div>
              <dt>Bo'sh xonadonlar</dt>
              <dd>{p.units_available}</dd>
            </div>
            {p.completion_date && (
              <div>
                <dt>Topshirish</dt>
                <dd>{formatDate(p.completion_date)}</dd>
              </div>
            )}
            {site.show_prices && p.min_price !== null && (
              <div>
                <dt>Narx</dt>
                <dd>{formatMoneyShort(p.min_price)} dan</dd>
              </div>
            )}
          </dl>
          <Button variant="primary" onClick={() => openLead({ project: p.id, label: p.name })}>
            Shu loyiha bo'yicha ariza
          </Button>
        </div>
      </section>

      {p.photos.length > 1 && (
        <div className="pub-gallery" data-reveal>
          {p.photos.slice(0, 8).map((ph, i) => (
            <button key={ph.id} type="button" className="pub-gallery__item" onClick={() => setPhoto(i)} aria-label={ph.caption || ph.kind_display}>
              <img src={ph.thumb} alt={ph.caption || ph.kind_display} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {p.description && (
        <section className="card pub-text" data-reveal>
          <h2 className="pub-section-title">Loyiha haqida</h2>
          <p>{p.description}</p>
        </section>
      )}

      {p.layouts.length > 0 && (
        <section data-reveal>
          <h2 className="pub-section-title">Planirovkalar</h2>
          <div className="pub-layouts">
            {p.layouts.map((l) => (
              <div key={l.id} className="pub-layout card">
                <div className="pub-layout__img">{l.thumb ? <img src={l.thumb} alt={l.name} loading="lazy" /> : <PlanSketch rooms={l.rooms} area={l.area} />}</div>
                <b>{l.name || roomsLabel(l.rooms, l.unit_type)}</b>
                <span className="muted">{formatArea(l.area)} · {l.available} bo'sh</span>
                {l.min_price !== null && <span className="pub-card__price">{formatMoneyShort(l.min_price)} dan</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section data-reveal>
        <h2 className="pub-section-title">Xonadon tanlash</h2>
        <PublicChessboard site={site} projectId={p.id} />
      </section>

      {(p.latitude !== null || p.nearby.length > 0) && (
        <section className="pub-location" data-reveal>
          <h2 className="pub-section-title">Joylashuv</h2>
          <div className="pub-location__grid">
            {p.latitude !== null && <ProjectsMap slug={site.slug} projects={[p]} height={320} />}
            {p.nearby.length > 0 && (
              <ul className="pub-nearby card">
                {p.nearby.map((n, i) => (
                  <li key={i}>
                    <span>
                      <b>{n.name}</b>
                      <small className="muted">{NEARBY_KIND[n.kind]}</small>
                    </span>
                    <span className="muted">{formatDistance(n.distance_m)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <Lightbox items={p.photos.map((ph) => ({ src: ph.image, caption: ph.caption || ph.kind_display }))} index={photo} onIndex={setPhoto} onClose={() => setPhoto(null)} />
    </div>
  )
}

function PublicChessboard({ site, projectId }: { site: PublicSite; projectId: number }) {
  const navigate = useNavigate()
  const [block, setBlock] = useState('all')
  const [rooms, setRooms] = useState<string[]>([])
  const [free, setFree] = useState(false)
  const [price, setPrice] = useState<[string, string]>(['', ''])
  const [debounced, setDebounced] = useState<[string, string]>(['', ''])

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(price), 400)
    return () => window.clearTimeout(t)
  }, [price])

  const mln = (v: string) => (v ? String(Math.round(parseFloat(v) * 1_000_000)) : undefined)
  const query = {
    rooms: rooms.join(',') || undefined,
    free: free ? '1' : undefined,
    price_min: site.show_prices ? mln(debounced[0]) : undefined,
    price_max: site.show_prices ? mln(debounced[1]) : undefined,
  }
  const filtering = Object.values(query).some(Boolean)
  const board = usePublicBoard(site.slug, projectId, query)
  const data = board.data

  if (board.isLoading) return <Skeleton height={360} />
  if (!data || !data.blocks.length) {
    return (
      <div className="card">
        <EmptyState icon={Building2} title="Xonadonlar hali e'lon qilinmagan">Ariza qoldiring — sotuv boshlanganda birinchi bo'lib xabar beramiz.</EmptyState>
      </div>
    )
  }
  const blocks = block === 'all' ? data.blocks : data.blocks.filter((b) => String(b.id) === block)

  return (
    <>
      <div className="chess-toolbar card">
        {data.blocks.length > 1 && (
          <PillTabs
            value={block}
            onChange={setBlock}
            items={[{ key: 'all', label: 'Barcha bloklar', count: data.summary.free }, ...data.blocks.map((b) => ({ key: String(b.id), label: b.name, count: b.summary.free }))]}
          />
        )}
        <div className="chess-filters">
          <div className="chips" role="group" aria-label="Xonalar soni">
            {ROOM_FILTERS.map((r) => (
              <button key={r.key} type="button" className={clsx('filter-chip', rooms.includes(r.key) && 'is-active')} aria-pressed={rooms.includes(r.key)} onClick={() => setRooms(toggle(rooms, r.key))}>
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" className={clsx('filter-chip', free && 'is-active')} aria-pressed={free} onClick={() => setFree(!free)}>
            <span className="legend-dot legend-dot--available" /> Faqat bo'sh
            <span className="count">{data.summary.free}</span>
          </button>
          {site.show_prices && (
            <div className="price-range">
              <TextInput aria-label="Narx dan (mln)" type="number" min={0} placeholder="dan" value={price[0]} onChange={(e) => setPrice([e.target.value, price[1]])} right={<span className="input__suffix">mln</span>} />
              <span className="muted">—</span>
              <TextInput aria-label="Narx gacha (mln)" type="number" min={0} placeholder="gacha" value={price[1]} onChange={(e) => setPrice([price[0], e.target.value])} right={<span className="input__suffix">mln</span>} />
            </div>
          )}
          {filtering && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { setRooms([]); setFree(false); setPrice(['', '']) }}>
              Tozalash · {formatNumber(data.summary.matched)} mos
            </Button>
          )}
        </div>
      </div>

      <div className={clsx('chess', board.isFetching && 'chess--fetching')}>
        {blocks.map((b) => (
          <BlockBoard key={b.id} block={b} filtering={filtering} onOpen={(u) => navigate(`/${site.slug}/xonadon/${u.id}`)} />
        ))}
      </div>
    </>
  )
}

function BlockBoard({ block: b, filtering, onOpen }: { block: PublicBoard['blocks'][number]; filtering: boolean; onOpen: (u: PublicCell) => void }) {
  const floors = b.entrances[0]?.floors.map((f) => f.floor) ?? []
  return (
    <section className="chess-block card">
      <header className="chess-block__head">
        <div>
          <h3 className="chess-block__title">{b.name}</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            {b.floors_count} qavat · {b.entrances_count} podyezd
          </div>
        </div>
        <div className="chess-block__stats">
          <span>
            <span className="legend-dot legend-dot--available" /> {b.summary.free} bo'sh
          </span>
          <span className="muted">
            <span className="legend-dot legend-dot--busy" /> band
          </span>
        </div>
      </header>
      <div className="chess-scroll">
        <div className="chess-grid">
          <div className="chess-floors" aria-hidden="true">
            <div className="chess-entrance__label">&nbsp;</div>
            {floors.map((f) => (
              <div key={f} className="chess-floor">{f}</div>
            ))}
          </div>
          {b.entrances.map((e) => (
            <div key={e.entrance} className="chess-entrance">
              <div className="chess-entrance__label">{e.entrance}-podyezd</div>
              {e.floors.map((fl) => (
                <div key={fl.floor} className="chess-row" style={{ gridTemplateColumns: `repeat(${b.units_per_floor}, var(--cell-w))` }}>
                  {fl.units.map((u) => (
                    <PublicCellButton key={u.id} unit={u} dim={filtering && !u.match} onOpen={() => onOpen(u)} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PublicCellButton({ unit: u, dim, onOpen }: { unit: PublicCell; dim: boolean; onOpen: () => void }) {
  const rooms = u.unit_type !== 'apartment' ? (u.unit_type === 'commercial' ? 'T' : u.unit_type === 'parking' ? 'P' : 'O') : u.rooms === 0 ? 'S' : `${u.rooms}x`
  const price = u.total_price !== null ? formatMoneyShort(u.total_price) : u.free ? "bo'sh" : 'band'
  return (
    <button
      type="button"
      className={clsx('cell', u.free ? 'cell--available' : 'cell--sold', dim && 'cell--dim')}
      onClick={onOpen}
      disabled={!u.free}
      aria-label={`№${u.number}, ${u.floor}-qavat, ${rooms}, ${u.area} m², ${u.free ? "bo'sh" : 'band'}`}
      title={`№${u.number} · ${u.area} m²${u.total_price !== null ? ` · ${formatMoneyShort(u.total_price)}` : ''}`}
    >
      <span className="cell__top">
        <b>{rooms}</b>
        <span>{u.number}</span>
      </span>
      <span className="cell__area">{parseFloat(u.area)} m²</span>
      <span className="cell__price">{price}</span>
    </button>
  )
}

/* =============== Xonadon sahifasi =============== */

export function PublicUnitPage() {
  const { slug = '', id } = useParams()
  return <PublicLayout slug={slug}>{(site) => <UnitView site={site} id={Number(id)} />}</PublicLayout>
}

function UnitView({ site, id }: { site: PublicSite; id: number }) {
  const q = usePublicUnit(site.slug, id)
  const root = useRef<HTMLDivElement>(null)
  useReveal(root, [q.data?.id])
  useEffect(() => {
    if (!q.data) return
    const u = q.data
    setPageMeta(`${roomsLabel(u.rooms, u.unit_type)}, ${formatArea(u.area)} — ${u.project.name}`, `${u.block.name}, ${u.floor}-qavat. ${site.company.name}`)
  }, [q.data, site])

  if (q.isLoading) return <Skeleton height={420} />
  if (!q.data) return <NotFound slug={site.slug} text={q.error instanceof ApiError && q.error.status === 404 ? 'Xonadon topilmadi' : "Yuklab bo'lmadi"} />
  const u = q.data
  const title = roomsLabel(u.rooms, u.unit_type)

  return (
    <div ref={root}>
      <Link to={`/${site.slug}/loyiha/${u.project.id}`} className="pub-back muted">
        <ArrowLeft size={15} /> {u.project.name}
      </Link>

      <div className="pub-unit">
        <section className="card pub-unit__main" data-reveal>
          <div className="pub-unit__plan">
            {u.layout?.image ? <img src={u.layout.image} alt={u.layout.name || title} /> : <PlanSketch rooms={u.rooms} area={u.area} />}
          </div>
          <div>
            <span className="eyebrow">{u.project.name} · {u.block.name}</span>
            <h1>
              {title}, {formatArea(u.area)}
            </h1>
            <dl className="pub-facts">
              <div><dt>Xonadon</dt><dd>№{u.number}</dd></div>
              <div><dt>Qavat</dt><dd>{u.floor} / {u.block.floors_count}</dd></div>
              <div><dt>Podyezd</dt><dd>{u.entrance}</dd></div>
              <div><dt>Ta'mir</dt><dd>{u.finishing_display}</dd></div>
              {u.has_balcony && <div><dt>Balkon</dt><dd>bor</dd></div>}
            </dl>
            {u.layout?.description && <p className="muted">{u.layout.description}</p>}
          </div>
        </section>

        <aside className="pub-unit__side" data-reveal>
          <div className="card pub-price">
            {!u.free ? (
              <div className="notice">Bu xonadon band. O'xshash variantlarni menejer taklif qiladi.</div>
            ) : u.total_price !== null ? (
              <>
                <div className="pub-price__total">{formatMoney(u.total_price)}</div>
                {u.price_per_m2 !== null && <div className="muted">{formatMoney(u.price_per_m2)} / m²</div>}
              </>
            ) : (
              <div className="pub-price__total">Narxi so'rov bo'yicha</div>
            )}
            {u.free && u.total_price !== null && site.installment.enabled && <InstallmentCalc price={u.total_price} cfg={site.installment} />}
          </div>
          <div className="card">
            <h2 className="pub-side-title">
              <CalendarDays size={16} /> Ko'rishga yoziling
            </h2>
            <LeadForm site={site} target={{ unit: u.id }} compact />
          </div>
        </aside>
      </div>
    </div>
  )
}
