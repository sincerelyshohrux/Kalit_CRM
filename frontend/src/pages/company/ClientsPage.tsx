import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search, UserRound, UsersRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { ClientDrawer } from '@/components/crm/ClientDrawer'
import { ClientFormModal, useManagers } from '@/components/crm/ClientFormModal'
import { useReveal } from '@/components/motion/effects'
import { Badge, Button, EmptyState, IconButton, PageHead, Select, Skeleton, TextInput } from '@/components/ui'
import { api, type Paginated } from '@/lib/api'
import { CLIENT_SOURCE, CLIENT_STATUS, PIPELINE, timeAgo } from '@/lib/crm'
import { formatMoneyShort, formatNumber, formatPhone } from '@/lib/format'
import { options } from '@/lib/realty'
import type { Client, ClientStats, ClientStatus } from '@/lib/types'

type Tab = 'all' | ClientStatus
const PAGE_SIZE = 25

export function ClientsPage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'director'
  const canCreate = user?.role === 'director' || user?.role === 'manager'
  const [params, setParams] = useSearchParams()
  const tab = (params.get('status') as Tab) || 'all'
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [source, setSource] = useState('')
  const [manager, setManager] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const openId = params.get('client') ? Number(params.get('client')) : null
  const root = useRef<HTMLDivElement>(null)
  const managers = useManagers(isDirector)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [tab, debounced, source, manager])

  const stats = useQuery({ queryKey: ['clients', 'stats'], queryFn: () => api<ClientStats>('/clients/stats/') })
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['clients', 'list', tab, debounced, source, manager, page],
    queryFn: () =>
      api<Paginated<Client>>('/clients/', {
        query: {
          status: tab === 'all' ? undefined : tab,
          search: debounced,
          source,
          ...(manager === 'mine' ? { mine: 1 } : manager === 'none' ? { unassigned: 1 } : { manager }),
          page,
          page_size: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })
  useReveal(root, [isLoading])

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const rows = data?.results ?? []
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1
  const s = stats.data
  const funnelMax = s ? Math.max(1, ...PIPELINE.map((k) => s[k])) : 1

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Sotuv"
        title="Mijozlar"
        description={s ? `${formatNumber(s.total)} ta mijoz${s.mine ? ` · ${formatNumber(s.mine)} tasi sizniki` : ''}` : 'Lidlar bazasi va sotuv voronkasi'}
        actions={canCreate && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Mijoz qo'shish</Button>}
      />

      <div className="funnel glass" data-reveal>
        {PIPELINE.map((k) => (
          <button key={k} type="button" className={`funnel__step funnel__step--${k}${tab === k ? ' is-active' : ''}`} onClick={() => setQuery({ status: tab === k ? null : k })}>
            <span className="funnel__label">{CLIENT_STATUS[k].label}</span>
            <span className="funnel__value">{s ? formatNumber(s[k]) : '—'}</span>
            <span className="funnel__bar"><i style={{ width: `${s ? (s[k] / funnelMax) * 100 : 0}%` }} /></span>
          </button>
        ))}
      </div>

      <div className="row row--between row--wrap" style={{ margin: '14px 0' }} data-reveal>
        <div className="row" style={{ gap: 8 }}>
          {tab === 'all' ? (
            <span className="muted" style={{ fontSize: 13 }}>Voronka bosqichini bosib filtrlang</span>
          ) : (
            <button type="button" className="filter-chip is-active" onClick={() => setQuery({ status: null })}>
              {CLIENT_STATUS[tab].label} <X size={13} />
            </button>
          )}
        </div>
        <div className="row row--wrap filters-row">
          <Select aria-label="Manba" value={source} onChange={(e) => setSource(e.target.value)} options={[{ value: '', label: 'Barcha manbalar' }, ...options(CLIENT_SOURCE)]} />
          <Select
            aria-label="Menejer"
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            options={[
              { value: '', label: isDirector ? 'Barcha menejerlar' : 'Hammasi' },
              { value: 'mine', label: 'Mening mijozlarim' },
              { value: 'none', label: 'Biriktirilmagan' },
              ...(managers.data ?? []).filter((m) => m.id !== user?.id).map((m) => ({ value: String(m.id), label: m.full_name || m.phone })),
            ]}
          />
          <div style={{ width: 260, maxWidth: '100%' }}>
            <TextInput icon={Search} placeholder="Ism yoki telefon" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
          </div>
        </div>
      </div>

      <div className="table-wrap" data-reveal style={{ opacity: isFetching && !isLoading ? 0.7 : 1 }}>
        {isLoading ? (
          <div className="stack" style={{ padding: 16 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} />)}</div>
        ) : !rows.length ? (
          <EmptyState
            icon={UsersRound}
            title={debounced || source || manager || tab !== 'all' ? 'Mos mijoz topilmadi' : "Hali mijoz yo'q"}
            action={canCreate && !debounced && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Birinchi mijozni qo'shish</Button>}
          >
            {!debounced && tab === 'all' && "Qo'ng'iroq qilgan yoki ofisga kelgan har bir odamni bazaga kiriting — keyin bron va shartnoma shu yerdan davom etadi."}
          </EmptyState>
        ) : (
          <table className="table table--click">
            <thead>
              <tr>
                <th>Mijoz</th>
                <th>Telefon</th>
                <th>Holat</th>
                <th>Manba</th>
                <th>Mas'ul</th>
                <th className="num">Byudjet</th>
                <th>Faollik</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setQuery({ client: String(c.id) })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setQuery({ client: String(c.id) })}>
                  <td>
                    <div className="row">
                      <span className="avatar avatar--sm client-avatar" aria-hidden="true"><UserRound size={14} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-main">{c.full_name}</div>
                        <div className="cell-sub">{c.interested_project_name ?? (c.note ? c.note.slice(0, 48) : '—')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="nowrap">{formatPhone(c.phone)}</td>
                  <td>
                    <Badge tone={CLIENT_STATUS[c.status].tone}>{c.status_display}</Badge>
                    {c.active_bookings > 1 && <span className="muted" style={{ fontSize: 12 }}> ×{c.active_bookings}</span>}
                  </td>
                  <td className="nowrap">{CLIENT_SOURCE[c.source]}</td>
                  <td className="nowrap">{c.manager_info?.full_name ?? <span className="muted">—</span>}</td>
                  <td className="num nowrap">{c.budget ? formatMoneyShort(c.budget) : '—'}</td>
                  <td className="nowrap muted">{timeAgo(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="pager" data-reveal>
          <IconButton icon={ChevronLeft} label="Oldingi" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
          <span>{page} / {pages}</span>
          <IconButton icon={ChevronRight} label="Keyingi" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} />
        </div>
      )}

      <ClientFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => setQuery({ client: String(c.id) })} />
      <ClientDrawer clientId={openId} onClose={() => setQuery({ client: null })} />
    </div>
  )
}
