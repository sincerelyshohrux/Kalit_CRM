import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Building2, Grid3x3, Percent, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { PillTabs } from '@/components/motion/PillNav'
import { useReveal } from '@/components/motion/effects'
import { Button, EmptyState, PageHead, Select, Skeleton, TextInput } from '@/components/ui'
import { api, type Paginated } from '@/lib/api'
import { formatMoneyShort, formatNumber } from '@/lib/format'
import { UNIT_STATUS } from '@/lib/realty'
import type { ChessBlock, Chessboard, ChessUnit, Project, UnitStatus } from '@/lib/types'

import { BulkPriceModal } from './chessboard/BulkPriceModal'
import { UnitDrawer } from './chessboard/UnitDrawer'

const ROOM_FILTERS = [
  { key: '0', label: 'Studiya' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4,5,6,7,8', label: '4+' },
]
const STATUSES: UnitStatus[] = ['available', 'booked', 'sold', 'not_for_sale']

export function ChessboardPage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'director'
  const [params, setParams] = useSearchParams()
  const root = useRef<HTMLDivElement>(null)

  const projects = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => api<Paginated<Project>>('/projects/', { query: { page_size: 200 } }),
  })
  const list = projects.data?.results ?? []
  const projectId = Number(params.get('project')) || list[0]?.id
  const blockParam = params.get('block') ?? 'all'

  const [rooms, setRooms] = useState<string[]>([])
  const [statuses, setStatuses] = useState<UnitStatus[]>([])
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [debouncedPrice, setDebouncedPrice] = useState<[string, string]>(['', ''])
  const [selected, setSelected] = useState<number | null>(null)
  const [bulk, setBulk] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedPrice([priceMin, priceMax]), 400)
    return () => window.clearTimeout(t)
  }, [priceMin, priceMax])

  const mln = (v: string) => (v ? Math.round(parseFloat(v) * 1_000_000) : undefined)
  const filters = {
    rooms: rooms.join(',') || undefined,
    status: statuses.join(',') || undefined,
    price_min: mln(debouncedPrice[0]),
    price_max: mln(debouncedPrice[1]),
  }

  const board = useQuery({
    queryKey: ['chessboard', projectId, filters],
    queryFn: () => api<Chessboard>(`/projects/${projectId}/chessboard/`, { query: filters }),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  })
  useReveal(root, [projects.isLoading])

  const data = board.data?.project.id === projectId ? board.data : undefined
  const blocks = useMemo(() => (data?.blocks ?? []).filter((b) => blockParam === 'all' || String(b.id) === blockParam), [data, blockParam])
  const filtering = rooms.length > 0 || statuses.length > 0 || !!priceMin || !!priceMax
  const summary = blockParam === 'all' ? data?.summary : blocks[0]?.summary

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    if (k === 'project') next.delete('block')
    setParams(next, { replace: true })
  }
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const reset = () => {
    setRooms([])
    setStatuses([])
    setPriceMin('')
    setPriceMax('')
  }

  if (projects.isLoading) return <Skeleton height={400} />
  if (!list.length) {
    return (
      <div ref={root}>
        <PageHead eyebrow="Sotuv" title="Shaxmatka" />
        <div className="card">
          <EmptyState icon={Building2} title="Loyiha yo'q" action={isDirector && <Link className="btn btn--primary" to="/app/projects">Loyiha qo'shish</Link>}>
            Shaxmatka loyiha va bloklar yaratilgandan keyin paydo bo'ladi.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Sotuv"
        title="Shaxmatka"
        description="Xonadonlar holati real vaqtda: bo'sh, bron, sotilgan"
        actions={
          <>
            <div className="page-head__select">
              <Select aria-label="Loyiha" value={String(projectId ?? '')} onChange={(e) => setParam('project', e.target.value)} options={list.map((p) => ({ value: String(p.id), label: p.name }))} />
            </div>
            {isDirector && (
              <Button icon={Percent} onClick={() => setBulk(true)} disabled={!data?.blocks.length}>
                Narxlarni o'zgartirish
              </Button>
            )}
          </>
        }
      />

      {data && data.blocks.length > 0 && (
        <div className="chess-toolbar card" data-reveal>
          <PillTabs
            value={blockParam}
            onChange={(k) => setParam('block', k === 'all' ? null : k)}
            items={[{ key: 'all', label: 'Barcha bloklar', count: data.summary.total }, ...data.blocks.map((b) => ({ key: String(b.id), label: b.name, count: b.summary.total }))]}
          />
          <div className="chess-filters">
            <div className="chips" role="group" aria-label="Xonalar soni">
              {ROOM_FILTERS.map((r) => (
                <button key={r.key} type="button" className={clsx('filter-chip', rooms.includes(r.key) && 'is-active')} aria-pressed={rooms.includes(r.key)} onClick={() => setRooms(toggle(rooms, r.key))}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="chips" role="group" aria-label="Holat">
              {STATUSES.map((s) => (
                <button key={s} type="button" className={clsx('filter-chip', statuses.includes(s) && 'is-active')} aria-pressed={statuses.includes(s)} onClick={() => setStatuses(toggle(statuses, s))}>
                  <span className={`legend-dot legend-dot--${s}`} />
                  {UNIT_STATUS[s].label}
                  <span className="count">{summary?.[s] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="price-range">
              <TextInput aria-label="Narx dan (mln)" type="number" min={0} placeholder="dan" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} right={<span className="input__suffix">mln</span>} />
              <span className="muted">—</span>
              <TextInput aria-label="Narx gacha (mln)" type="number" min={0} placeholder="gacha" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} right={<span className="input__suffix">mln</span>} />
            </div>
            {filtering && (
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={reset}>
                Tozalash · {formatNumber(data.summary.matched ?? 0)} mos
              </Button>
            )}
          </div>
        </div>
      )}

      {board.isLoading || !data ? (
        <Skeleton height={420} style={{ marginTop: 14 }} />
      ) : !data.blocks.length ? (
        <div className="card" style={{ marginTop: 14 }}>
          <EmptyState icon={Grid3x3} title="Bu loyihada blok yo'q" action={isDirector && <Link className="btn btn--primary" to={`/app/projects/${projectId}?tab=blocks`}>Blok qo'shish</Link>}>
            Blok yaratilganda xonadonlar avtomatik generatsiya qilinadi.
          </EmptyState>
        </div>
      ) : (
        <div className={clsx('chess', board.isFetching && 'chess--fetching')}>
          {blocks.map((b) => (
            <BlockBoard key={b.id} block={b} filtering={filtering} selected={selected} onSelect={setSelected} />
          ))}
        </div>
      )}

      <UnitDrawer unitId={selected} layouts={data?.layouts ?? []} onClose={() => setSelected(null)} canEdit={isDirector} />
      {data && <BulkPriceModal open={bulk} onClose={() => setBulk(false)} board={data} blockId={blockParam === 'all' ? null : Number(blockParam)} />}
    </div>
  )
}

function BlockBoard({ block: b, filtering, selected, onSelect }: { block: ChessBlock; filtering: boolean; selected: number | null; onSelect: (id: number) => void }) {
  const floors = b.entrances[0]?.floors.map((f) => f.floor) ?? []
  const sellable = b.summary.total - b.summary.not_for_sale
  return (
    <section className="chess-block card" data-reveal>
      <header className="chess-block__head">
        <div>
          <h2 className="chess-block__title">{b.name}</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {b.floors_count} qavat · {b.entrances_count} podyezd · {b.summary.total} xonadon
          </div>
        </div>
        <div className="chess-block__stats">
          {(['available', 'booked', 'sold'] as UnitStatus[]).map((s) => (
            <span key={s}>
              <span className={`legend-dot legend-dot--${s}`} /> {b.summary[s]}
            </span>
          ))}
          <span className="muted">{sellable ? Math.round((b.summary.sold / sellable) * 100) : 0}% sotilgan</span>
        </div>
      </header>

      <div className="chess-scroll">
        <div className="chess-grid">
          <div className="chess-floors" aria-hidden="true">
            <div className="chess-entrance__label">&nbsp;</div>
            {floors.map((f) => (
              <div key={f} className="chess-floor">
                {f}
              </div>
            ))}
          </div>
          {b.entrances.map((e) => (
            <div key={e.entrance} className="chess-entrance">
              <div className="chess-entrance__label">{e.entrance}-podyezd</div>
              {e.floors.map((fl) => (
                <div key={fl.floor} className="chess-row" style={{ gridTemplateColumns: `repeat(${b.units_per_floor}, var(--cell-w))` }}>
                  {fl.units.map((u) => (
                    <Cell key={u.id} unit={u} dim={filtering && !u.match} active={selected === u.id} onClick={() => onSelect(u.id)} />
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

function Cell({ unit: u, dim, active, onClick }: { unit: ChessUnit; dim: boolean; active: boolean; onClick: () => void }) {
  const rooms = u.unit_type !== 'apartment' ? u.unit_type === 'commercial' ? 'T' : u.unit_type === 'parking' ? 'P' : 'O' : u.rooms === 0 ? 'S' : `${u.rooms}x`
  return (
    <button
      type="button"
      className={clsx('cell', `cell--${u.status}`, dim && 'cell--dim', active && 'cell--active')}
      onClick={onClick}
      aria-label={`№${u.number}, ${u.floor}-qavat, ${rooms}, ${u.area} m², ${UNIT_STATUS[u.status].label}, ${formatMoneyShort(u.total_price)} so'm`}
      title={`№${u.number} · ${u.area} m² · ${formatMoneyShort(u.total_price)}${u.booking ? ` · bron: ${u.booking.client_name ?? u.booking.manager ?? ''}` : ''}`}
    >
      <span className="cell__top">
        <b>{rooms}</b>
        <span>{u.number}</span>
      </span>
      <span className="cell__area">{parseFloat(u.area)} m²</span>
      <span className="cell__price">{u.status === 'sold' ? 'sotilgan' : formatMoneyShort(u.total_price)}</span>
      {u.booking?.mine && <span className="cell__mine" aria-hidden="true" />}
    </button>
  )
}
