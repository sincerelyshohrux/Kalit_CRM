import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '@/auth/AuthProvider'
import { Button, Field, PhoneInput, Select, TextInput, toE164 } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { CLIENT_SOURCE, CLIENT_STATUS, MANUAL_CLIENT_STATUSES } from '@/lib/crm'
import { options } from '@/lib/realty'
import type { Client, ClientSource, ClientStatus, Employee, Project } from '@/lib/types'

const EMPTY = {
  last_name: '', first_name: '', middle_name: '', phone: '', phone2: '',
  source: 'office' as ClientSource, status: 'new' as ClientStatus, reject_reason: '',
  manager: '', interested_project: '', budget: '', note: '',
}

const digits9 = (phone: string) => phone.replace(/^\+998/, '')

export function useManagers(enabled = true) {
  return useQuery({
    queryKey: ['employees', 'sellers'],
    queryFn: () => api<Paginated<Employee>>('/employees/', { query: { is_active: true, page_size: 200 } }),
    select: (d) => d.results.filter((e) => e.role === 'director' || e.role === 'manager'),
    enabled,
    staleTime: 60_000,
  })
}

export function useProjectOptions() {
  return useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => api<Paginated<Project>>('/projects/', { query: { page_size: 200 } }),
    select: (d) => d.results.map((p) => ({ value: String(p.id), label: p.name })),
    staleTime: 60_000,
  })
}

interface Props {
  open: boolean
  client?: Client
  onClose: () => void
  onSaved?: (c: Client) => void
  /** Yangi mijoz uchun oldindan to'ldirilgan qiymatlar (masalan, qidiruvdagi telefon) */
  initial?: Partial<typeof EMPTY>
}

export function ClientFormModal({ open, client, onClose, onSaved, initial }: Props) {
  const { user } = useAuth()
  const isDirector = user?.role === 'director'
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const managers = useManagers(open && isDirector)
  const projects = useProjectOptions()

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      client
        ? {
            last_name: client.last_name, first_name: client.first_name, middle_name: client.middle_name,
            phone: digits9(client.phone), phone2: digits9(client.phone2), source: client.source, status: client.status,
            reject_reason: client.reject_reason, manager: client.manager ? String(client.manager) : '',
            interested_project: client.interested_project ? String(client.interested_project) : '',
            budget: client.budget ? String(client.budget) : '', note: client.note,
          }
        : { ...EMPTY, ...initial },
    )
  }, [open, client, initial])

  const autoStatus = client && (client.status === 'booked' || client.status === 'contract')

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        last_name: f.last_name.trim(), first_name: f.first_name.trim(), middle_name: f.middle_name.trim(),
        phone: toE164(f.phone), phone2: f.phone2 ? toE164(f.phone2) : '',
        source: f.source, note: f.note.trim(),
        interested_project: f.interested_project ? Number(f.interested_project) : null,
        budget: f.budget ? Number(f.budget) : null,
      }
      if (!autoStatus) Object.assign(body, { status: f.status, reject_reason: f.status === 'rejected' ? f.reject_reason.trim() : '' })
      if (isDirector) body.manager = f.manager ? Number(f.manager) : null
      return api<Client>(client ? `/clients/${client.id}/` : '/clients/', { method: client ? 'PATCH' : 'POST', body })
    },
    onSuccess: (c) => {
      toast.success(client ? 'Saqlandi' : `${c.full_name} bazaga qo'shildi`)
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', c.id] })
      onSaved?.(c)
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
    if (f.phone.length !== 9) {
      setErrors({ phone: "Telefon raqamni to'liq kiriting" })
      return
    }
    save.mutate()
  }

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal open={open} onClose={onClose} title={client ? 'Mijozni tahrirlash' : 'Yangi mijoz'} description={client ? undefined : "Telefon raqam bazada takrorlanmaydi — bor bo'lsa, ogohlantiramiz"} width={640}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Ism *" error={errors.first_name}>
          <TextInput icon={UserRound} value={f.first_name} onChange={set('first_name')} maxLength={80} required autoFocus />
        </Field>
        <Field label="Familiya" error={errors.last_name}>
          <TextInput value={f.last_name} onChange={set('last_name')} maxLength={80} />
        </Field>
        <Field label="Otasining ismi" error={errors.middle_name}>
          <TextInput value={f.middle_name} onChange={set('middle_name')} maxLength={80} />
        </Field>
        <Field label="Manba" error={errors.source}>
          <Select value={f.source} onChange={set('source')} options={options(CLIENT_SOURCE)} />
        </Field>
        <Field label="Telefon *" error={errors.phone}>
          <PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} invalid={!!errors.phone} />
        </Field>
        <Field label="Qo'shimcha telefon" error={errors.phone2}>
          <PhoneInput value={f.phone2} onChange={(v) => setF({ ...f, phone2: v })} invalid={!!errors.phone2} />
        </Field>
        <Field label="Holat" error={errors.status} hint={autoStatus ? 'Bron/shartnoma orqali avtomatik boshqariladi' : undefined}>
          {autoStatus ? (
            <TextInput value={CLIENT_STATUS[f.status].label} disabled readOnly />
          ) : (
            <Select value={f.status} onChange={set('status')} options={MANUAL_CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS[s].label }))} />
          )}
        </Field>
        {isDirector ? (
          <Field label="Mas'ul menejer" error={errors.manager}>
            <Select value={f.manager} onChange={set('manager')} options={[{ value: '', label: 'Biriktirilmagan' }, ...(managers.data ?? []).map((m) => ({ value: String(m.id), label: m.full_name || m.phone }))]} />
          </Field>
        ) : (
          <Field label="Mas'ul menejer" hint="Siz kiritgan mijoz sizga biriktiriladi">
            <TextInput value={client?.manager_info?.full_name ?? user?.full_name ?? ''} disabled readOnly />
          </Field>
        )}
        {f.status === 'rejected' && !autoStatus && (
          <Field label="Rad etish sababi *" error={errors.reject_reason} className="span-2">
            <TextInput value={f.reject_reason} onChange={set('reject_reason')} maxLength={255} placeholder="Masalan: narx qimmat, boshqa loyihani tanladi" required />
          </Field>
        )}
        <Field label="Qiziqqan loyiha" error={errors.interested_project}>
          <Select value={f.interested_project} onChange={set('interested_project')} options={[{ value: '', label: '—' }, ...(projects.data ?? [])]} />
        </Field>
        <Field label="Byudjet (so'm)" error={errors.budget}>
          <TextInput type="number" min={0} step={1_000_000} value={f.budget} onChange={set('budget')} placeholder="Masalan: 600000000" />
        </Field>
        <Field label="Izoh" error={errors.note} className="span-2">
          <textarea className="textarea" rows={3} value={f.note} onChange={set('note')} maxLength={2000} placeholder="Nimaga qiziqadi, qachon qo'ng'iroq qilish kerak..." />
        </Field>
        <div className="span-2 modal__foot" style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" type="submit" loading={save.isPending}>{client ? 'Saqlash' : "Qo'shish"}</Button>
        </div>
      </form>
    </Modal>
  )
}
