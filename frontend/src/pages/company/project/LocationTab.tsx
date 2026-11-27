import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crosshair, Link2, MapPin, Plus, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MapPicker, parseCoords, type LatLng } from '@/components/map/MapPicker'
import { Button, EmptyState, Field, IconButton, Select, TextInput } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatDistance, NEARBY_KIND, options } from '@/lib/realty'
import type { NearbyKind, NearbyPlace, Project } from '@/lib/types'

type Row = { kind: NearbyKind; name: string; distance: string }

export function LocationTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const initialPoint = project.latitude != null && project.longitude != null ? { lat: Number(project.latitude), lng: Number(project.longitude) } : null
  const [point, setPoint] = useState<LatLng | null>(initialPoint)
  const [paste, setPaste] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    setRows(project.nearby.map((n) => ({ kind: n.kind, name: n.name, distance: String(n.distance_m) })))
  }, [project.nearby])

  const save = useMutation({
    mutationFn: () => {
      const nearby: NearbyPlace[] = rows
        .filter((r) => r.name.trim())
        .map((r) => ({ kind: r.kind, name: r.name.trim(), distance_m: Math.max(0, Math.round(Number(r.distance) || 0)) }))
      return api<Project>(`/projects/${project.id}/`, {
        method: 'PATCH',
        body: {
          latitude: point ? Number(point.lat.toFixed(6)) : null,
          longitude: point ? Number(point.lng.toFixed(6)) : null,
          nearby,
        },
      })
    },
    onSuccess: () => {
      toast.success('Lokatsiya saqlandi')
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  const applyPaste = () => {
    const p = parseCoords(paste)
    if (!p) return toast.error("Koordinata topilmadi. Masalan: 41.311081, 69.240562 yoki Google Maps havolasi")
    setPoint(p)
    setPaste('')
  }

  const myLocation = () => {
    if (!navigator.geolocation) return toast.error('Brauzer joylashuvni aniqlay olmaydi')
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Joylashuvga ruxsat berilmadi"),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  if (!canEdit && !initialPoint && !project.nearby.length) {
    return (
      <div className="card" data-reveal>
        <EmptyState icon={MapPin} title="Lokatsiya kiritilmagan">Direktor xaritada majmua joylashuvini belgilashi kerak.</EmptyState>
      </div>
    )
  }

  return (
    <div className="grid grid--main" data-reveal>
      <div className="card" style={{ padding: 10 }}>
        <MapPicker value={point} onChange={canEdit ? setPoint : undefined} readOnly={!canEdit} height={480} />
        {canEdit && (
          <div className="map-tools">
            <span className="muted">
              <Crosshair size={14} /> Xaritani bosing yoki markerni suring
            </span>
            {point && <span className="kbd">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span>}
          </div>
        )}
      </div>

      <div className="stack">
        {canEdit && (
          <div className="card">
            <h3 className="card__title" style={{ marginBottom: 12 }}>Koordinata</h3>
            <div className="stack" style={{ gap: 10 }}>
              <Field label="Koordinata yoki xarita havolasi" hint="Google/Yandex xaritadan nusxa oling">
                <TextInput
                  icon={Link2}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyPaste())}
                  placeholder="41.311081, 69.240562"
                  maxLength={500}
                  right={<Button size="sm" variant="ghost" onClick={applyPaste} disabled={!paste.trim()}>Qo'yish</Button>}
                />
              </Field>
              <div className="row">
                <Button size="sm" icon={Crosshair} onClick={myLocation}>Mening joylashuvim</Button>
                {point && <Button size="sm" variant="ghost" icon={X} onClick={() => setPoint(null)}>Tozalash</Button>}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card__head">
            <h3 className="card__title">Atrofdagi joylar</h3>
            {canEdit && rows.length < 20 && (
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { kind: 'school', name: '', distance: '' }])}>
                Qo'shish
              </Button>
            )}
          </div>
          {!rows.length ? (
            <div className="muted" style={{ fontSize: 13 }}>Maktab, metro, park… — xaridorlar uchun muhim.</div>
          ) : canEdit ? (
            <div className="stack" style={{ gap: 8 }}>
              {rows.map((r, i) => (
                <div key={i} className="nearby-row">
                  <Select aria-label="Turi" value={r.kind} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as NearbyKind } : x)))} options={options(NEARBY_KIND)} />
                  <TextInput aria-label="Nomi" value={r.name} maxLength={100} placeholder="Nomi" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <TextInput aria-label="Masofa (metr)" type="number" min={0} max={50000} value={r.distance} placeholder="450" right={<span className="input__suffix">m</span>} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, distance: e.target.value } : x)))} />
                  <IconButton icon={X} label="Olib tashlash" onClick={() => setRows(rows.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
          ) : (
            <dl className="kv">
              {project.nearby.map((n, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <dt>{NEARBY_KIND[n.kind]} · {n.name}</dt>
                  <dd>{formatDistance(n.distance_m)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {canEdit && (
          <Button variant="primary" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>
            Lokatsiyani saqlash
          </Button>
        )}
      </div>
    </div>
  )
}
