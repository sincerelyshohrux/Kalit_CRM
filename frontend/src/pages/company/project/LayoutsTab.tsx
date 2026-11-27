import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageOff, LayoutPanelTop, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { PlanSketch } from '@/components/realty/PlanSketch'
import { Badge, Button, EmptyState, Field, IconButton, Select, Skeleton, Spinner, TextInput } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Dropzone } from '@/components/ui/Dropzone'
import { Lightbox } from '@/components/ui/Lightbox'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatMoneyShort } from '@/lib/format'
import { checkImageFile, formatArea, IMAGE_ACCEPT, options, UNIT_TYPE } from '@/lib/realty'
import type { Layout, Project, UnitType } from '@/lib/types'

export function LayoutsTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['layouts', project.id]
  const [modal, setModal] = useState<{ layout?: Layout } | null>(null)
  const [deleting, setDeleting] = useState<Layout | null>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)

  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<Layout[]>('/layouts/', { query: { project: project.id } }) })
  const layouts = data ?? []
  const withImages = layouts.filter((l) => l.image)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['chessboard'] })
  }

  async function uploadImage(layout: Layout, file: File) {
    const err = checkImageFile(file)
    if (err) return toast.error(err)
    const fd = new FormData()
    fd.append('image', file)
    setUploading(layout.id)
    try {
      await api(`/layouts/${layout.id}/`, { method: 'PATCH', body: fd })
      toast.success(`«${layout.name}» chizmasi yuklandi`)
      refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Yuklashda xatolik')
    } finally {
      setUploading(null)
    }
  }

  const clearImage = useMutation({
    mutationFn: (l: Layout) => api(`/layouts/${l.id}/`, { method: 'PATCH', body: { image: null } }),
    onSuccess: () => {
      toast.success("Chizma o'chirildi")
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (l: Layout) => api(`/layouts/${l.id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success("Planirovka o'chirildi")
      setDeleting(null)
      refresh()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  return (
    <div className="stack" data-reveal>
      <div className="row row--between">
        <div className="muted">Planirovkalar blok generatsiyasida avtomatik yaratiladi. Har biriga chizma yuklang — u shu turdagi barcha xonadonlarda ko'rinadi.</div>
        {canEdit && (
          <Button icon={Plus} onClick={() => setModal({})}>
            Planirovka qo'shish
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="layout-grid">{[0, 1, 2].map((i) => <Skeleton key={i} height={300} />)}</div>
      ) : !layouts.length ? (
        <div className="card">
          <EmptyState icon={LayoutPanelTop} title="Planirovkalar yo'q">
            Blok qo'shganingizda planirovka turlari o'zi paydo bo'ladi.
          </EmptyState>
        </div>
      ) : (
        <div className="layout-grid">
          {layouts.map((l) => (
            <article key={l.id} className="card layout-card">
              <div className="layout-card__media">
                {uploading === l.id ? (
                  <div className="layout-card__busy"><Spinner /> Qayta ishlanmoqda…</div>
                ) : l.thumb ? (
                  <button type="button" className="layout-card__open" onClick={() => setViewer(withImages.indexOf(l))} aria-label={`Chizmani kattalashtirish: ${l.name}`}>
                    <img src={l.thumb} alt={`Planirovka: ${l.name}`} loading="lazy" />
                  </button>
                ) : (
                  <>
                    <PlanSketch rooms={l.rooms} area={l.area} className="layout-card__sketch" />
                    {canEdit && <LayoutUpload onFile={(f) => uploadImage(l, f)} />}
                  </>
                )}
              </div>
              <div className="layout-card__body">
                <div className="row row--between">
                  <div className="layout-card__name">{l.name}</div>
                  {!l.image && <Badge tone="warn" plain>Chizma yo'q</Badge>}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {UNIT_TYPE[l.unit_type]} · {formatArea(l.area)}
                  {l.description && ` · ${l.description}`}
                </div>
                <div className="project-card__stats" style={{ marginTop: 12 }}>
                  <div><b>{l.units_count}</b><span>xonadon</span></div>
                  <div><b>{l.units_available}</b><span>bo'sh</span></div>
                  <div className="project-card__price"><span>dan</span><b>{l.min_price ? formatMoneyShort(l.min_price) : '—'}</b></div>
                </div>
                {canEdit && (
                  <div className="row" style={{ gap: 4, marginTop: 10 }}>
                    {l.image && <ReplaceButton onFile={(f) => uploadImage(l, f)} />}
                    {l.image && <IconButton icon={ImageOff} label="Chizmani o'chirish" onClick={() => clearImage.mutate(l)} />}
                    <IconButton icon={Pencil} label="Tahrirlash" onClick={() => setModal({ layout: l })} />
                    <IconButton icon={Trash2} label="O'chirish" onClick={() => setDeleting(l)} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Lightbox items={withImages.map((l) => ({ src: l.image!, caption: l.name }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      <LayoutModal open={!!modal} layout={modal?.layout} project={project} onClose={() => setModal(null)} onSaved={refresh} />
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Planirovkani o'chirish"
        description={deleting ? `«${deleting.name}» o'chiriladi. ${deleting.units_count} ta xonadon planirovkasiz qoladi (xonadonlar o'chmaydi).` : ''}
        confirmLabel="O'chirish"
        danger
        icon={Trash2}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

function LayoutUpload({ onFile }: { onFile: (f: File) => void }) {
  return (
    <div className="layout-card__drop">
      <Dropzone compact multiple={false} title="Chizmani yuklash" hint="JPG, PNG, WEBP" onFiles={(f) => f[0] && onFile(f[0])} />
    </div>
  )
}

function ReplaceButton({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button size="sm" icon={Upload} onClick={() => ref.current?.click()}>
        Almashtirish
      </Button>
      <input ref={ref} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </>
  )
}

function LayoutModal({ open, layout, project, onClose, onSaved }: { open: boolean; layout?: Layout; project: Project; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', unit_type: 'apartment' as UnitType, rooms: '2', area: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(layout ? { name: layout.name, unit_type: layout.unit_type, rooms: String(layout.rooms), area: layout.area, description: layout.description } : { name: '', unit_type: 'apartment', rooms: '2', area: '', description: '' })
  }, [open, layout])

  const save = useMutation({
    mutationFn: () =>
      api(layout ? `/layouts/${layout.id}/` : '/layouts/', {
        method: layout ? 'PATCH' : 'POST',
        body: { ...(layout ? {} : { project: project.id }), name: f.name.trim(), unit_type: f.unit_type, rooms: Number(f.rooms) || 0, area: f.area, description: f.description.trim() },
      }),
    onSuccess: () => {
      toast.success('Saqlandi')
      onSaved()
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
    save.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={layout ? 'Planirovkani tahrirlash' : 'Yangi planirovka'} width={520}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Nomi *" error={errors.name} className="span-2">
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={100} required placeholder="2 xonali · 64.5 m² (Euro)" />
        </Field>
        <Field label="Turi" error={errors.unit_type}>
          <Select value={f.unit_type} onChange={(e) => setF({ ...f, unit_type: e.target.value as UnitType })} options={options(UNIT_TYPE)} />
        </Field>
        <Field label="Xonalar" error={errors.rooms} hint="0 — studiya">
          <TextInput type="number" min={0} max={20} value={f.rooms} onChange={(e) => setF({ ...f, rooms: e.target.value })} />
        </Field>
        <Field label="Maydon (m²) *" error={errors.area} className="span-2">
          <TextInput type="number" min={1} step="0.01" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} required />
        </Field>
        <Field label="Tavsif" error={errors.description} className="span-2">
          <TextInput value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} placeholder="Masalan: oshxona-mehmonxona, 2 ta hammom" />
        </Field>
        <div className="span-2 modal__foot">
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" type="submit" loading={save.isPending}>Saqlash</Button>
        </div>
      </form>
    </Modal>
  )
}
