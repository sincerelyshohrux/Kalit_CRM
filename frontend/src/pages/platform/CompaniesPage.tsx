import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Building2, CheckCircle2, Lock, MoreHorizontal, Plus, Search, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PillTabs } from '@/components/motion/PillNav'
import { useReveal } from '@/components/motion/effects'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  PageHead,
  PhoneInput,
  Select,
  Skeleton,
  TextInput,
  toE164,
} from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, type Paginated } from '@/lib/api'
import { daysUntil, formatDate, formatPhone, PLAN_LABELS } from '@/lib/format'
import type { PlatformCompany } from '@/lib/types'

type StatusTab = 'all' | 'active' | 'suspended'

export function CompaniesPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const query = useQuery({
    queryKey: ['platform', 'companies', tab, debounced],
    queryFn: () =>
      api<Paginated<PlatformCompany>>('/platform/companies/', {
        query: { status: tab === 'all' ? undefined : tab, search: debounced, page_size: 100 },
      }),
    placeholderData: keepPreviousData,
  })
  useReveal(root)

  const closeCreate = () => {
    setCreating(false)
    if (params.has('new')) setParams({}, { replace: true })
  }

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Platforma"
        title="Kompaniyalar"
        description="Qurilish kompaniyalari, tariflari va obuna muddatlari"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Kompaniya qo'shish
          </Button>
        }
      />

      <div className="row row--between row--wrap" style={{ marginBottom: 14 }} data-reveal>
        <PillTabs<StatusTab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: 'Hammasi' },
            { key: 'active', label: 'Faol' },
            { key: 'suspended', label: 'Bloklangan' },
          ]}
        />
        <div style={{ width: 300, maxWidth: '100%' }}>
          <TextInput icon={Search} placeholder="Nomi, STIR yoki telefon" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        </div>
      </div>

      <div className="table-wrap" data-reveal>
        {query.isLoading ? (
          <div className="stack" style={{ padding: 16 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        ) : !query.data?.results.length ? (
          <EmptyState icon={Building2} title="Kompaniya topilmadi">
            {debounced ? "Qidiruv bo'yicha natija yo'q." : "Birinchi qurilish kompaniyasini qo'shing."}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Kompaniya</th>
                <th>Direktor</th>
                <th>Tarif</th>
                <th>Obuna</th>
                <th className="num">Xodimlar</th>
                <th>Holat</th>
                <th aria-label="Amallar" />
              </tr>
            </thead>
            <tbody>
              {query.data.results.map((c) => (
                <CompanyRow key={c.id} company={c} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateCompanyModal open={creating} onClose={closeCreate} />
    </div>
  )
}

function CompanyRow({ company: c }: { company: PlatformCompany }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const days = daysUntil(c.subscription_until)
  const suspended = c.status === 'suspended'

  const toggle = useMutation({
    mutationFn: () => api<PlatformCompany>(`/platform/companies/${c.id}/${suspended ? 'activate' : 'suspend'}/`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(suspended ? `${c.name} faollashtirildi` : `${c.name} bloklandi`)
      qc.invalidateQueries({ queryKey: ['platform'] })
      setConfirm(false)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  return (
    <tr>
      <td>
        <div className="row">
          <Avatar name={c.name} src={c.logo} size="sm" square />
          <div>
            <div className="cell-main">{c.name}</div>
            <div className="cell-sub">{[c.city, c.inn && `STIR ${c.inn}`].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
      </td>
      <td>
        {c.director_info ? (
          <>
            <div>{c.director_info.full_name}</div>
            <div className="cell-sub">{formatPhone(c.director_info.phone)}</div>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <Badge plain>{PLAN_LABELS[c.plan]}</Badge>
      </td>
      <td>
        <div>{c.subscription_until ? formatDate(c.subscription_until) : 'Muddatsiz'}</div>
        {days !== null && (
          <div className="cell-sub" style={days <= 14 ? { color: days < 0 ? 'var(--danger)' : 'var(--warn)' } : undefined}>
            {days < 0 ? `${-days} kun oldin tugagan` : `${days} kun qoldi`}
          </div>
        )}
      </td>
      <td className="num">
        {c.users_count} / {c.max_users}
      </td>
      <td>{suspended ? <Badge tone="danger">Bloklangan</Badge> : <Badge tone="ok">Faol</Badge>}</td>
      <td className="num">
        <IconButton icon={MoreHorizontal} label="Amallar" onClick={() => setConfirm(true)} />
        <Modal
          open={confirm}
          onClose={() => setConfirm(false)}
          title={suspended ? 'Kompaniyani faollashtirish' : 'Kompaniyani bloklash'}
          description={
            suspended
              ? `${c.name} xodimlari yana tizimga kira oladi.`
              : `${c.name} xodimlari tizimga kira olmaydi. Ma'lumotlar o'chirilmaydi.`
          }
          width={440}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Bekor qilish
              </Button>
              <Button
                variant={suspended ? 'primary' : 'danger'}
                icon={suspended ? CheckCircle2 : Ban}
                loading={toggle.isPending}
                onClick={() => toggle.mutate()}
              >
                {suspended ? 'Faollashtirish' : 'Bloklash'}
              </Button>
            </>
          }
        >
          <span />
        </Modal>
      </td>
    </tr>
  )
}

const EMPTY = {
  name: '',
  legal_name: '',
  inn: '',
  city: '',
  plan: 'trial',
  subscription_until: '',
  max_users: '10',
  director_first_name: '',
  director_last_name: '',
  director_phone: '',
  director_password: '',
}

function CreateCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const create = useMutation({
    mutationFn: () =>
      api<PlatformCompany>('/platform/companies/', {
        method: 'POST',
        body: {
          name: f.name.trim(),
          legal_name: f.legal_name.trim(),
          inn: f.inn.trim(),
          city: f.city.trim(),
          plan: f.plan,
          subscription_until: f.subscription_until || null,
          max_users: Number(f.max_users) || 10,
          director: {
            first_name: f.director_first_name.trim(),
            last_name: f.director_last_name.trim(),
            phone: toE164(f.director_phone),
            password: f.director_password,
          },
        },
      }),
    onSuccess: (c) => {
      toast.success(`${c.name} qo'shildi`)
      qc.invalidateQueries({ queryKey: ['platform'] })
      setF(EMPTY)
      onClose()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const fe = e.fieldErrors
        const d = (e.data as { director?: Record<string, unknown> } | null)?.director
        if (d && typeof d === 'object' && !Array.isArray(d)) {
          for (const [k, v] of Object.entries(d)) fe[`director_${k}`] = Array.isArray(v) ? v.join(' ') : String(v)
        }
        setErrors(fe)
        toast.error(e.message)
      }
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yangi kompaniya"
      description="Kompaniya va uning direktori uchun hisob yaratiladi"
      width={620}
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="form-section span-2">Kompaniya</div>
        <Field label="Nomi *" error={errors.name} className="span-2">
          <TextInput icon={Building2} value={f.name} onChange={set('name')} maxLength={200} required />
        </Field>
        <Field label="Yuridik nomi" error={errors.legal_name}>
          <TextInput value={f.legal_name} onChange={set('legal_name')} maxLength={255} placeholder='"..." MCHJ' />
        </Field>
        <Field label="STIR" error={errors.inn}>
          <TextInput value={f.inn} onChange={(e) => setF({ ...f, inn: e.target.value.replace(/\D/g, '').slice(0, 9) })} inputMode="numeric" placeholder="9 ta raqam" />
        </Field>
        <Field label="Shahar" error={errors.city}>
          <TextInput value={f.city} onChange={set('city')} maxLength={100} />
        </Field>
        <Field label="Tarif" error={errors.plan}>
          <Select
            value={f.plan}
            onChange={set('plan')}
            options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Obuna muddati" error={errors.subscription_until} hint="Bo'sh — muddatsiz">
          <TextInput type="date" value={f.subscription_until} onChange={set('subscription_until')} />
        </Field>
        <Field label="Maksimal xodimlar" error={errors.max_users}>
          <TextInput type="number" min={1} max={1000} value={f.max_users} onChange={set('max_users')} />
        </Field>

        <div className="form-section span-2">Direktor</div>
        <Field label="Ism *" error={errors.director_first_name}>
          <TextInput icon={UserRound} value={f.director_first_name} onChange={set('director_first_name')} maxLength={150} required />
        </Field>
        <Field label="Familiya" error={errors.director_last_name}>
          <TextInput value={f.director_last_name} onChange={set('director_last_name')} maxLength={150} />
        </Field>
        <Field label="Telefon *" error={errors.director_phone}>
          <PhoneInput value={f.director_phone} onChange={(v) => setF({ ...f, director_phone: v })} invalid={!!errors.director_phone} />
        </Field>
        <Field label="Boshlang'ich parol *" error={errors.director_password} hint="Direktor kirgach almashtirishi kerak">
          <TextInput icon={Lock} type="password" autoComplete="new-password" value={f.director_password} onChange={set('director_password')} maxLength={128} />
        </Field>

        <div className="span-2 modal__foot" style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending} disabled={!f.name || !f.director_first_name || f.director_phone.length !== 9 || f.director_password.length < 8}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  )
}
