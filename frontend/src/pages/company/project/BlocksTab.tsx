import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building, Grid3x3, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button, EmptyState, Field, IconButton, Select, Skeleton, TextInput } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from '@/lib/format'
import { options, UNIT_TYPE } from '@/lib/realty'
import type { Block, Project, UnitType } from '@/lib/types'

export function BlocksTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const [modal, setModal] = useState<{ block?: Block } | null>(null)
  const [deleting, setDeleting] = useState<Block | null>(null)
  const qc = useQueryClient()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['blocks', project.id],
    queryFn: () => api<Paginated<Block>>('/blocks/', { query: { project: project.id, page_size: 100 } }),
  })
  const remove = useMutation({
    mutationFn: (b: Block) => api(`/blocks/${b.id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success("Blok o'chirildi")
      qc.invalidateQueries({ queryKey: ['blocks', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      setDeleting(null)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  const blocks = data?.results ?? []

  return (
    <div className="stack" data-reveal>
      <div className="row row--between">
        <div className="muted">Har bir blok yaratilganda xonadonlar planirovka bo'yicha avtomatik generatsiya qilinadi.</div>
        {canEdit && (
          <Button variant="primary" icon={Plus} onClick={() => setModal({})}>
            Blok qo'shish
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton height={160} />
      ) : !blocks.length ? (
        <div className="card">
          <EmptyState icon={Building} title="Bloklar yo'q" action={canEdit && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>Birinchi blokni qo'shish</Button>}>
            Blok — bu bino (korpus). Qavatlar, podyezdlar va bir qavatdagi xonadonlarni kiriting.
          </EmptyState>
        </div>
      ) : (
        <div className="block-grid">
          {blocks.map((b) => (
            <div key={b.id} className="card block-card">
              <MiniFacade block={b} />
              <div className="block-card__body">
                <div className="row row--between">
                  <div className="block-card__name">{b.name}</div>
                  {canEdit && (
                    <div className="row" style={{ gap: 4 }}>
                      <IconButton icon={Pencil} label="Tahrirlash" onClick={() => setModal({ block: b })} />
                      <IconButton icon={Trash2} label="O'chirish" onClick={() => setDeleting(b)} />
                    </div>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {b.floors_count} qavat · {b.entrances_count} podyezd · qavatda {b.units_per_floor} ta
                  {b.completion_date && ` · ${formatDate(b.completion_date)}`}
                </div>
                <div className="project-card__stats" style={{ marginTop: 12 }}>
                  <div><b>{formatNumber(b.units_total)}</b><span>jami</span></div>
                  <div><b>{formatNumber(b.units_available)}</b><span>bo'sh</span></div>
                  <div><b>{formatNumber(b.units_sold)}</b><span>sotilgan</span></div>
                  <div className="project-card__price"><span>dan</span><b>{b.min_price ? formatMoneyShort(b.min_price) : '—'}</b></div>
                </div>
                <Link className="btn btn--sm btn--block" style={{ marginTop: 12 }} to={`/app/chessboard?project=${project.id}&block=${b.id}`}>
                  <Grid3x3 size={14} /> Shaxmatkada ochish
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <BlockModal open={!!modal} block={modal?.block} project={project} onClose={() => setModal(null)} />
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Blokni o'chirish"
        description={deleting ? `«${deleting.name}» va uning ${deleting.units_total} ta xonadoni o'chiriladi. Bron yoki sotilgan xonadon bo'lsa, o'chirib bo'lmaydi.` : ''}
        confirmLabel="O'chirish"
        danger
        icon={Trash2}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

/** Blokning sxematik fasadi: qavatlar × podyezdlar, sotilganlar ulushi bilan */
function MiniFacade({ block: b }: { block: Block }) {
  const floors = Math.min(b.floors_count, 24)
  const cols = Math.min(b.entrances_count * b.units_per_floor, 18)
  const sold = b.units_total ? (b.units_sold + b.units_booked) / b.units_total : 0
  return (
    <div className="mini-facade" aria-hidden="true">
      <div className="mini-facade__grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: floors * cols }).map((_, i) => {
          const r = ((i * 9301 + 49297) % 233280) / 233280
          return <span key={i} className={r < sold ? 'is-sold' : ''} />
        })}
      </div>
    </div>
  )
}

/* ---------------- Blok yaratish / tahrirlash ---------------- */

interface Row {
  unit_type: UnitType
  rooms: string
  area: string
}

const DEFAULT_ROWS: Row[] = [
  { unit_type: 'apartment', rooms: '1', area: '42' },
  { unit_type: 'apartment', rooms: '2', area: '64.5' },
  { unit_type: 'apartment', rooms: '3', area: '86' },
  { unit_type: 'apartment', rooms: '2', area: '61' },
]

function BlockModal({ open, block, project, onClose }: { open: boolean; block?: Block; project: Project; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const editing = !!block
  const [f, setF] = useState({ name: '', floors_count: '12', entrances_count: '2', start_floor: '1', completion_date: '', base_price: '9500000', step: '1' })
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (block) {
      setF({ name: block.name, floors_count: String(block.floors_count), entrances_count: String(block.entrances_count), start_floor: String(block.start_floor), completion_date: block.completion_date ?? '', base_price: '', step: '' })
    } else {
      setF({ name: '', floors_count: '12', entrances_count: '2', start_floor: '1', completion_date: '', base_price: '9500000', step: '1' })
      setRows(DEFAULT_ROWS)
    }
  }, [open, block])

  const n = (v: string) => Number(v) || 0
  const preview = useMemo(() => {
    const floors = n(f.floors_count)
    const total = floors * n(f.entrances_count) * rows.length
    const areas = rows.map((r) => parseFloat(r.area) || 0)
    const base = n(f.base_price)
    const top = base * (1 + (parseFloat(f.step) || 0) / 100 * Math.max(floors - 1, 0))
    return {
      total,
      minTotal: Math.min(...areas) * base,
      maxTotal: Math.max(...areas) * top,
      topPpm: top,
    }
  }, [f, rows])

  const save = useMutation({
    mutationFn: () => {
      if (editing) {
        return api<Block>(`/blocks/${block!.id}/`, { method: 'PATCH', body: { name: f.name.trim(), completion_date: f.completion_date || null } })
      }
      return api<Block>('/blocks/', {
        method: 'POST',
        body: {
          project: project.id,
          name: f.name.trim(),
          floors_count: n(f.floors_count),
          entrances_count: n(f.entrances_count),
          units_per_floor: rows.length,
          start_floor: Number(f.start_floor) || 1,
          completion_date: f.completion_date || null,
          generate: {
            layout: rows.map((r) => ({ unit_type: r.unit_type, rooms: r.unit_type === 'apartment' ? n(r.rooms) : 0, area: r.area })),
            base_price_per_m2: n(f.base_price),
            floor_step_percent: f.step || '0',
          },
        },
      })
    },
    onSuccess: (b) => {
      toast.success(editing ? 'Blok saqlandi' : `«${b.name}» yaratildi — ${formatNumber(b.units_total)} ta xonadon`)
      qc.invalidateQueries({ queryKey: ['blocks', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['layouts', project.id] })
      qc.invalidateQueries({ queryKey: ['chessboard'] })
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors)
        toast.error(e.message)
      }
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Blokni tahrirlash' : 'Yangi blok'} description={editing ? "Xonadonlari bor blokning tuzilishi (qavat, podyezd) o'zgarmaydi." : `«${project.name}» uchun bino va xonadonlar`} width={editing ? 480 : 760}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Blok nomi *" error={errors.name}>
          <TextInput value={f.name} onChange={set('name')} maxLength={50} required placeholder="A blok" />
        </Field>
        <Field label="Topshirish sanasi" error={errors.completion_date}>
          <TextInput type="date" value={f.completion_date} onChange={set('completion_date')} />
        </Field>

        {!editing && (
          <>
            <Field label="Qavatlar *" error={errors.floors_count}>
              <TextInput type="number" min={1} max={100} value={f.floors_count} onChange={set('floors_count')} required />
            </Field>
            <div className="form-grid" style={{ gap: 14 }}>
              <Field label="Podyezdlar *" error={errors.entrances_count}>
                <TextInput type="number" min={1} max={20} value={f.entrances_count} onChange={set('entrances_count')} required />
              </Field>
              <Field label="Boshlanish qavati" error={errors.start_floor} hint="Masalan 2 — 1-qavat tijorat">
                <TextInput type="number" min={-5} max={100} value={f.start_floor} onChange={set('start_floor')} />
              </Field>
            </div>

            <div className="form-section span-2">Bir qavatdagi planirovka (har podyezdda) — {rows.length} ta xonadon</div>
            <div className="span-2 layout-rows">
              {rows.map((r, i) => (
                <div key={i} className="layout-row">
                  <span className="layout-row__n">{i + 1}</span>
                  <Select aria-label="Turi" value={r.unit_type} onChange={(e) => setRow(i, { unit_type: e.target.value as UnitType })} options={options(UNIT_TYPE)} />
                  <TextInput aria-label="Xonalar" type="number" min={0} max={20} value={r.rooms} disabled={r.unit_type !== 'apartment'} onChange={(e) => setRow(i, { rooms: e.target.value })} right={<span className="input__suffix">xona</span>} />
                  <TextInput aria-label="Maydon" type="number" min={1} max={10000} step="0.01" value={r.area} onChange={(e) => setRow(i, { area: e.target.value })} right={<span className="input__suffix">m²</span>} required />
                  <IconButton icon={X} label="Olib tashlash" disabled={rows.length <= 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
                </div>
              ))}
              {rows.length < 30 && (
                <Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { ...rows[rows.length - 1] }])}>
                  Xonadon qo'shish
                </Button>
              )}
              {errors.generate && <div className="field__error">{errors.generate}</div>}
            </div>

            <div className="form-section span-2">Narx</div>
            <Field label="1 m² boshlang'ich narx (so'm) *" hint={formatMoney(n(f.base_price))}>
              <TextInput type="number" min={0} step={1000} value={f.base_price} onChange={set('base_price')} required />
            </Field>
            <Field label="Har qavatda oshish (%)" hint={`Yuqori qavat: ${formatMoney(Math.round(preview.topPpm / 1000) * 1000)} / m²`}>
              <TextInput type="number" min={-10} max={10} step="0.1" value={f.step} onChange={set('step')} />
            </Field>

            <div className="span-2 gen-preview">
              <div>
                <span className="muted">Generatsiya qilinadi</span>
                <b>{formatNumber(preview.total)} ta xonadon</b>
              </div>
              <div>
                <span className="muted">Narxlar oralig'i</span>
                <b>
                  {formatMoneyShort(preview.minTotal)} — {formatMoneyShort(preview.maxTotal)}
                </b>
              </div>
            </div>
          </>
        )}

        <div className="span-2 modal__foot" style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button variant="primary" type="submit" loading={save.isPending} disabled={!editing && preview.total > 5000}>
            {editing ? 'Saqlash' : 'Yaratish va generatsiya'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
