import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Lock, Pencil, Plus, Search, UserRound, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { useAuth } from '@/auth/AuthProvider'
import { PillTabs } from '@/components/motion/PillNav'
import { useReveal } from '@/components/motion/effects'
import { Avatar, Badge, Button, EmptyState, Field, IconButton, PageHead, PhoneInput, Select, Skeleton, TextInput, toE164 } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { formatDate, formatPhone, ROLE_LABELS } from '@/lib/format'
import type { Employee, Role } from '@/lib/types'

type Tab = 'active' | 'blocked'
const COMPANY_ROLES: Role[] = ['director', 'manager', 'cashier']

export function EmployeesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('active')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [modal, setModal] = useState<{ employee?: Employee } | null>(null)
  const [toggling, setToggling] = useState<Employee | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const toast = useToast()

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['employees', tab, debounced],
    queryFn: () => api<Paginated<Employee>>('/employees/', { query: { is_active: tab === 'active', search: debounced, page_size: 200 } }),
    placeholderData: keepPreviousData,
  })
  useReveal(root, [isLoading])

  const toggle = useMutation({
    mutationFn: (e: Employee) => (e.is_active ? api(`/employees/${e.id}/`, { method: 'DELETE' }) : api(`/employees/${e.id}/`, { method: 'PATCH', body: { is_active: true } })),
    onSuccess: (_, e) => {
      toast.success(e.is_active ? `${e.full_name} bloklandi` : `${e.full_name} faollashtirildi`)
      qc.invalidateQueries({ queryKey: ['employees'] })
      setToggling(null)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  const rows = data?.results ?? []

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Boshqaruv"
        title="Xodimlar"
        description="Menejerlar, kassirlar va ularning kirish huquqlari"
        actions={<Button variant="primary" icon={Plus} onClick={() => setModal({})}>Xodim qo'shish</Button>}
      />

      <div className="row row--between row--wrap" style={{ marginBottom: 14 }} data-reveal>
        <PillTabs<Tab> value={tab} onChange={setTab} items={[{ key: 'active', label: 'Faol' }, { key: 'blocked', label: 'Bloklangan' }]} />
        <div style={{ width: 280, maxWidth: '100%' }}>
          <TextInput icon={Search} placeholder="Ism yoki telefon" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        </div>
      </div>

      <div className="table-wrap" data-reveal>
        {isLoading ? (
          <div className="stack" style={{ padding: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}</div>
        ) : !rows.length ? (
          <EmptyState icon={Users} title={tab === 'active' ? "Xodim yo'q" : "Bloklangan xodim yo'q"}>
            {tab === 'active' && !debounced && "Menejer va kassirlarni qo'shing — ular o'z telefon raqami bilan kiradi."}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Xodim</th>
                <th>Telefon</th>
                <th>Rol</th>
                <th>Oxirgi kirish</th>
                <th>Qo'shilgan</th>
                <th aria-label="Amallar" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="row">
                      <Avatar name={e.full_name || e.phone} src={e.avatar} size="sm" />
                      <div>
                        <div className="cell-main">
                          {e.full_name || '—'} {e.id === user?.id && <Badge plain>Siz</Badge>}
                        </div>
                        <div className="cell-sub">{e.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="nowrap">{formatPhone(e.phone)}</td>
                  <td>
                    <Badge tone={e.role === 'director' ? 'info' : e.role === 'cashier' ? 'warn' : 'muted'}>{e.role_display}</Badge>
                  </td>
                  <td className="nowrap">{e.last_login ? formatDate(e.last_login) : <span className="muted">Hali kirmagan</span>}</td>
                  <td className="nowrap">{formatDate(e.date_joined)}</td>
                  <td className="num">
                    {e.id !== user?.id && (
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <IconButton icon={Pencil} label="Tahrirlash" onClick={() => setModal({ employee: e })} />
                        <IconButton icon={e.is_active ? Ban : CheckCircle2} label={e.is_active ? 'Bloklash' : 'Faollashtirish'} onClick={() => setToggling(e)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EmployeeModal open={!!modal} employee={modal?.employee} onClose={() => setModal(null)} />
      <Confirm
        open={!!toggling}
        onClose={() => setToggling(null)}
        title={toggling?.is_active ? 'Xodimni bloklash' : 'Xodimni faollashtirish'}
        description={toggling?.is_active ? `${toggling.full_name} tizimdan darhol chiqariladi va kira olmaydi. Uning tarixi saqlanadi.` : `${toggling?.full_name} yana tizimga kira oladi.`}
        confirmLabel={toggling?.is_active ? 'Bloklash' : 'Faollashtirish'}
        danger={toggling?.is_active}
        icon={toggling?.is_active ? Ban : CheckCircle2}
        loading={toggle.isPending}
        onConfirm={() => toggling && toggle.mutate(toggling)}
      />
    </div>
  )
}

function EmployeeModal({ open, employee, onClose }: { open: boolean; employee?: Employee; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', email: '', role: 'manager' as Role, password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      employee
        ? { first_name: employee.first_name, last_name: employee.last_name, phone: employee.phone.replace(/^\+998/, ''), email: employee.email, role: employee.role, password: '' }
        : { first_name: '', last_name: '', phone: '', email: '', role: 'manager', password: '' },
    )
  }, [open, employee])

  const save = useMutation({
    mutationFn: () =>
      api<Employee>(employee ? `/employees/${employee.id}/` : '/employees/', {
        method: employee ? 'PATCH' : 'POST',
        body: {
          first_name: f.first_name.trim(),
          last_name: f.last_name.trim(),
          phone: toE164(f.phone),
          email: f.email.trim(),
          role: f.role,
          ...(f.password ? { password: f.password } : {}),
        },
      }),
    onSuccess: (e) => {
      toast.success(employee ? 'Saqlandi' : `${e.full_name} qo'shildi`)
      qc.invalidateQueries({ queryKey: ['employees'] })
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
    <Modal open={open} onClose={onClose} title={employee ? 'Xodimni tahrirlash' : 'Yangi xodim'} description={employee ? "Rol yoki parol o'zgarsa, xodim tizimdan chiqariladi va qayta kiradi." : 'Xodim telefon raqami va parol bilan kiradi'} width={560}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Ism *" error={errors.first_name}>
          <TextInput icon={UserRound} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} maxLength={150} required />
        </Field>
        <Field label="Familiya" error={errors.last_name}>
          <TextInput value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} maxLength={150} />
        </Field>
        <Field label="Telefon *" error={errors.phone}>
          <PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} invalid={!!errors.phone} />
        </Field>
        <Field label="Rol *" error={errors.role}>
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} options={COMPANY_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        </Field>
        <Field label="Email" error={errors.email}>
          <TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={254} />
        </Field>
        <Field label={employee ? 'Yangi parol' : 'Parol *'} error={errors.password} hint={employee ? "Bo'sh qoldirsangiz o'zgarmaydi" : 'Kamida 8 belgi'}>
          <TextInput icon={Lock} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} maxLength={128} required={!employee} minLength={8} />
        </Field>
        <div className="span-2 modal__foot" style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" type="submit" loading={save.isPending}>{employee ? 'Saqlash' : "Qo'shish"}</Button>
        </div>
      </form>
    </Modal>
  )
}
