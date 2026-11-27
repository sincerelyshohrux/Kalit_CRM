import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Button, Field, Select, TextInput } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { HOUSING_CLASS, options, PROJECT_STATUS } from '@/lib/realty'
import type { Project } from '@/lib/types'

const EMPTY = {
  name: '',
  city: 'Toshkent',
  district: '',
  address: '',
  description: '',
  housing_class: 'comfort',
  status: 'construction',
  start_date: '',
  completion_date: '',
  is_active: true,
}

type Form = typeof EMPTY

export function ProjectFormModal({ open, onClose, project, onSaved }: { open: boolean; onClose: () => void; project?: Project; onSaved?: (p: Project) => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      project
        ? {
            name: project.name,
            city: project.city,
            district: project.district,
            address: project.address,
            description: project.description,
            housing_class: project.housing_class,
            status: project.status,
            start_date: project.start_date ?? '',
            completion_date: project.completion_date ?? '',
            is_active: project.is_active,
          }
        : EMPTY,
    )
  }, [open, project])

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const save = useMutation({
    mutationFn: () =>
      api<Project>(project ? `/projects/${project.id}/` : '/projects/', {
        method: project ? 'PATCH' : 'POST',
        body: {
          ...f,
          name: f.name.trim(),
          start_date: f.start_date || null,
          completion_date: f.completion_date || null,
        },
      }),
    onSuccess: (p) => {
      toast.success(project ? 'Loyiha saqlandi' : `«${p.name}» yaratildi`)
      qc.invalidateQueries({ queryKey: ['projects'] })
      onSaved?.(p)
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

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Loyihani tahrirlash' : 'Yangi loyiha'} description="Turar-joy majmuasi (ЖК) haqida asosiy ma'lumotlar" width={640}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Nomi *" error={errors.name} className="span-2">
          <TextInput icon={Building2} value={f.name} onChange={set('name')} maxLength={200} required placeholder="Masalan: Yangi Hayot Residence" />
        </Field>
        <Field label="Shahar" error={errors.city}>
          <TextInput value={f.city} onChange={set('city')} maxLength={100} />
        </Field>
        <Field label="Tuman" error={errors.district}>
          <TextInput value={f.district} onChange={set('district')} maxLength={100} placeholder="Yunusobod" />
        </Field>
        <Field label="Manzil" error={errors.address} className="span-2">
          <TextInput value={f.address} onChange={set('address')} maxLength={255} placeholder="Ko'cha, mo'ljal" />
        </Field>
        <Field label="Sinf" error={errors.housing_class}>
          <Select value={f.housing_class} onChange={set('housing_class')} options={options(HOUSING_CLASS)} />
        </Field>
        <Field label="Holat" error={errors.status}>
          <Select value={f.status} onChange={set('status')} options={options(PROJECT_STATUS)} />
        </Field>
        <Field label="Qurilish boshlangan" error={errors.start_date}>
          <TextInput type="date" value={f.start_date} onChange={set('start_date')} />
        </Field>
        <Field label="Topshirish sanasi" error={errors.completion_date}>
          <TextInput type="date" value={f.completion_date} onChange={set('completion_date')} />
        </Field>
        <Field label="Tavsif" error={errors.description} className="span-2" hint="Ommaviy saytda ko'rinadi (6-bosqich)">
          <textarea className="textarea" value={f.description} onChange={set('description')} rows={4} maxLength={5000} placeholder="Majmua afzalliklari, infratuzilma…" />
        </Field>
        <label className="check span-2">
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
          <span>Sotuvda (ommaviy saytda ko'rsatiladi)</span>
        </label>
        <div className="span-2 modal__foot" style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button variant="primary" type="submit" loading={save.isPending}>
            {project ? 'Saqlash' : 'Yaratish'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
