import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { GripVertical, Images, Pencil, Star, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Badge, Button, EmptyState, Field, IconButton, Select, Skeleton, Spinner, TextInput } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Dropzone } from '@/components/ui/Dropzone'
import { Lightbox } from '@/components/ui/Lightbox'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { checkImageFile, options, PHOTO_KIND } from '@/lib/realty'
import type { Block, PhotoKind, Project, ProjectPhoto } from '@/lib/types'

type Filter = 'all' | PhotoKind

interface Pending {
  key: string
  name: string
  preview: string
  error?: string
}

export function PhotosTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['photos', project.id]
  const [filter, setFilter] = useState<Filter>('all')
  const [kind, setKind] = useState<PhotoKind>('render')
  const [pending, setPending] = useState<Pending[]>([])
  const [order, setOrder] = useState<ProjectPhoto[] | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [editing, setEditing] = useState<ProjectPhoto | null>(null)
  const [deleting, setDeleting] = useState<ProjectPhoto | null>(null)

  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<ProjectPhoto[]>('/photos/', { query: { project: project.id } }) })
  const photos = order ?? data ?? []
  const shown = filter === 'all' ? photos : photos.filter((p) => p.kind === filter)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['projects'] })
  }

  /** Fayllar ketma-ket yuklanadi — serverga bir vaqtda og'irlik tushmasin */
  async function uploadFiles(files: File[]) {
    const items = files.map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random()}`, error: checkImageFile(file) }))
    items.filter((i) => i.error).forEach((i) => toast.error(i.error!))
    const valid = items.filter((i) => !i.error)
    if (!valid.length) return
    setPending((p) => [...p, ...valid.map((i) => ({ key: i.key, name: i.file.name, preview: URL.createObjectURL(i.file) }))])
    let ok = 0
    for (const item of valid) {
      const fd = new FormData()
      fd.append('project', String(project.id))
      fd.append('kind', kind)
      fd.append('image', item.file)
      try {
        await api('/photos/', { method: 'POST', body: fd })
        ok++
        setPending((p) => p.filter((x) => x.key !== item.key))
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Yuklashda xatolik'
        toast.error(`${item.file.name}: ${msg}`)
        setPending((p) => p.map((x) => (x.key === item.key ? { ...x, error: msg } : x)))
      }
      if (ok % 3 === 0) refresh()
    }
    if (ok) toast.success(`${ok} ta rasm yuklandi`)
    refresh()
  }

  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.preview)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const reorder = useMutation({
    mutationFn: (list: ProjectPhoto[]) => api('/photos/reorder/', { method: 'POST', body: { project: project.id, ids: list.map((p) => p.id) } }),
    onSuccess: () => {
      toast.success('Tartib saqlandi')
      refresh()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
    onSettled: () => setOrder(null),
  })

  const remove = useMutation({
    mutationFn: (p: ProjectPhoto) => api(`/photos/${p.id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success("Rasm o'chirildi")
      setDeleting(null)
      refresh()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  // Sudrab tartiblash (faqat "Hammasi" ko'rinishida — aks holda tartib noaniq bo'ladi)
  const draggable = canEdit && filter === 'all' && !reorder.isPending
  const onDragEnter = (target: ProjectPhoto) => {
    if (dragId === null || dragId === target.id) return
    const list = [...photos]
    const from = list.findIndex((p) => p.id === dragId)
    const to = list.findIndex((p) => p.id === target.id)
    list.splice(to, 0, list.splice(from, 1)[0])
    setOrder(list)
  }
  const onDragEnd = () => {
    setDragId(null)
    if (order && data && order.some((p, i) => p.id !== data[i]?.id)) reorder.mutate(order)
    else setOrder(null)
  }

  const counts = photos.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {})

  return (
    <div className="stack" data-reveal>
      {canEdit && (
        <div className="card upload-card">
          <Dropzone onFiles={uploadFiles} title="Rasmlarni shu yerga tashlang" hint={<>yoki bosing · JPG, PNG, WEBP · 15 MB gacha · joylashuv (GPS) ma'lumotlari avtomatik o'chiriladi</>} />
          <div className="upload-card__side">
            <Field label="Yuklanadigan rasmlar turi">
              <Select value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)} options={options(PHOTO_KIND)} />
            </Field>
            <div className="muted" style={{ fontSize: 12 }}>
              Birinchi rasm — loyiha muqovasi. Tartibni sudrab o'zgartiring.
            </div>
          </div>
        </div>
      )}

      <div className="chips">
        {(['all', ...Object.keys(PHOTO_KIND)] as Filter[]).map((k) => (
          <button key={k} type="button" className={clsx('filter-chip', filter === k && 'is-active')} onClick={() => setFilter(k)}>
            {k === 'all' ? 'Hammasi' : PHOTO_KIND[k as PhotoKind]}
            <span className="count">{k === 'all' ? photos.length : counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="photo-grid">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={180} style={{ borderRadius: 'var(--r-md)' }} />)}
        </div>
      ) : !shown.length && !pending.length ? (
        <div className="card">
          <EmptyState icon={Images} title="Rasmlar yo'q">
            {canEdit ? "Vizualizatsiya, fasad, interyer va qurilish jarayoni rasmlarini yuklang — ular ommaviy saytda ko'rinadi." : "Direktor hali rasm yuklamagan."}
          </EmptyState>
        </div>
      ) : (
        <div className="photo-grid">
          {shown.map((p) => (
            <figure
              key={p.id}
              className={clsx('photo', dragId === p.id && 'photo--dragging')}
              draggable={draggable}
              onDragStart={(e) => {
                setDragId(p.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnter={() => onDragEnter(p)}
              onDragOver={(e) => draggable && e.preventDefault()}
              onDragEnd={onDragEnd}
            >
              <button type="button" className="photo__open" onClick={() => setViewer(shown.indexOf(p))} aria-label={`Kattalashtirish: ${p.caption || p.kind_display}`}>
                <img src={p.thumb} alt={p.caption || p.kind_display} loading="lazy" draggable={false} />
              </button>
              <div className="photo__top">
                {filter === 'all' && photos[0]?.id === p.id ? (
                  <Badge tone="warn"><Star size={11} /> Muqova</Badge>
                ) : (
                  <Badge plain>{p.kind_display}</Badge>
                )}
                {draggable && <GripVertical size={16} className="photo__grip" />}
              </div>
              <figcaption className="photo__bottom">
                <span className="photo__caption">{p.caption || <span className="muted">Izohsiz</span>}</span>
                {canEdit && (
                  <span className="photo__actions">
                    <IconButton icon={Pencil} label="Tahrirlash" onClick={() => setEditing(p)} />
                    <IconButton icon={Trash2} label="O'chirish" onClick={() => setDeleting(p)} />
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
          {pending.map((p) => (
            <figure key={p.key} className={clsx('photo photo--pending', p.error && 'photo--error')}>
              <img src={p.preview} alt="" />
              <div className="photo__overlay">
                {p.error ? (
                  <>
                    <span>{p.error}</span>
                    <Button size="sm" onClick={() => setPending((x) => x.filter((i) => i.key !== p.key))}>Yopish</Button>
                  </>
                ) : (
                  <>
                    <Spinner /> <span>Qayta ishlanmoqda…</span>
                  </>
                )}
              </div>
            </figure>
          ))}
        </div>
      )}

      <Lightbox items={shown.map((p) => ({ src: p.image, caption: p.caption || p.kind_display }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      <PhotoEditModal photo={editing} project={project} onClose={() => setEditing(null)} onSaved={refresh} />
      <Confirm
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Rasmni o'chirish"
        description="Rasm diskdan butunlay o'chiriladi."
        confirmLabel="O'chirish"
        danger
        icon={Trash2}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

function PhotoEditModal({ photo, project, onClose, onSaved }: { photo: ProjectPhoto | null; project: Project; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ caption: '', kind: 'render' as PhotoKind, block: '' })
  const blocks = useQuery({
    queryKey: ['blocks', project.id],
    queryFn: () => api<Paginated<Block>>('/blocks/', { query: { project: project.id, page_size: 100 } }),
    enabled: !!photo,
  })

  useEffect(() => {
    if (photo) setF({ caption: photo.caption, kind: photo.kind, block: photo.block ? String(photo.block) : '' })
  }, [photo])

  const save = useMutation({
    mutationFn: () => api(`/photos/${photo!.id}/`, { method: 'PATCH', body: { caption: f.caption.trim(), kind: f.kind, block: f.block ? Number(f.block) : null } }),
    onSuccess: () => {
      toast.success('Saqlandi')
      onSaved()
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Modal open={!!photo} onClose={onClose} title="Rasm ma'lumotlari" width={520}>
      {photo && (
        <form className="stack" onSubmit={submit}>
          <img src={photo.thumb} alt="" className="edit-preview" />
          <Field label="Izoh">
            <TextInput value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} maxLength={200} placeholder="Masalan: Hovli, bolalar maydonchasi" />
          </Field>
          <div className="form-grid">
            <Field label="Turi">
              <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PhotoKind })} options={options(PHOTO_KIND)} />
            </Field>
            <Field label="Blok">
              <Select value={f.block} onChange={(e) => setF({ ...f, block: e.target.value })} options={[{ value: '', label: 'Butun loyiha' }, ...(blocks.data?.results ?? []).map((b) => ({ value: String(b.id), label: b.name }))]} />
            </Field>
          </div>
          <div className="modal__foot">
            <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
            <Button variant="primary" type="submit" loading={save.isPending}>Saqlash</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
