import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Globe, Save } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { useAuth } from '@/auth/AuthProvider'
import { useReveal } from '@/components/motion/effects'
import { Button, Card, Field, PageHead, PhoneInput, Skeleton, TextInput, toE164 } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'

interface SiteSettings {
  slug: string
  is_enabled: boolean
  show_prices: boolean
  headline: string
  about: string
  phone: string
  telegram: string
  instagram: string
  installment_enabled: boolean
  installment_min_down: number
  installment_max_months: number
  installment_markup: string
  url: string
  projects: { id: number; name: string; is_active: boolean; show_on_site: boolean }[]
  updated_at: string
}

type Form = Omit<SiteSettings, 'url' | 'projects' | 'updated_at' | 'phone'> & { phone: string }

const digits = (e164: string) => e164.replace(/^\+998/, '').replace(/\D/g, '').slice(0, 9)

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="switch-row">
      <span>
        <b>{label}</b>
        {hint && <small className="muted">{hint}</small>}
      </span>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" aria-hidden="true" />
      </span>
    </label>
  )
}

export function SiteSettingsPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'director'
  const toast = useToast()
  const qc = useQueryClient()
  const root = useRef<HTMLDivElement>(null)
  const q = useQuery({ queryKey: ['site-settings'], queryFn: () => api<SiteSettings>('/site-settings/') })
  const [f, setF] = useState<Form | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useReveal(root, [!!q.data])

  useEffect(() => {
    if (q.data) {
      const { url: _u, projects: _p, updated_at: _t, ...rest } = q.data
      setF({ ...rest, phone: digits(q.data.phone) })
    }
  }, [q.data])

  const save = useMutation({
    mutationFn: (body: Partial<SiteSettings>) => api<SiteSettings>('/site-settings/', { method: 'PATCH', body }),
    onSuccess: (data) => {
      qc.setQueryData(['site-settings'], data)
      setErrors({})
      toast.success('Sayt sozlamalari saqlandi')
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldErrors)
      toast.error(e instanceof ApiError ? e.message : 'Xatolik')
    },
  })

  const toggleProject = useMutation({
    mutationFn: ({ id, show }: { id: number; show: boolean }) => api(`/projects/${id}/`, { method: 'PATCH', body: { show_on_site: show } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Xatolik'),
  })

  if (!q.data || !f) {
    return (
      <div>
        <PageHead eyebrow="Sotuv" title="Ommaviy sayt" />
        <Skeleton height={360} />
      </div>
    )
  }
  const s = q.data
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (f.phone && f.phone.length !== 9) return setErrors({ phone: "Raqamni to'liq kiriting" })
    save.mutate({ ...f, phone: f.phone ? toE164(f.phone) : '' })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.url)
      toast.success('Havola nusxalandi')
    } catch {
      toast.error("Nusxalab bo'lmadi")
    }
  }

  return (
    <div ref={root}>
      <PageHead
        eyebrow="Sotuv"
        title="Ommaviy sayt"
        description="Mijozlar login qilmasdan loyihalar, bo'sh xonadonlar va narxlarni ko'radi va ariza qoldiradi."
        actions={
          <>
            <Button icon={Copy} onClick={copy}>Havolani nusxalash</Button>
            {s.is_enabled && (
              <a className="btn btn--primary" href={`/${s.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} /> Saytni ochish
              </a>
            )}
          </>
        }
      />

      <div className="site-url card" data-reveal>
        <Globe size={18} />
        <code>{s.url}</code>
        <span className={s.is_enabled ? 'badge badge--ok' : 'badge badge--muted'}>{s.is_enabled ? 'Ochiq' : "O'chirilgan"}</span>
      </div>

      {!canEdit && <div className="notice notice--info" style={{ marginTop: 14 }}>Sozlamalarni faqat direktor o'zgartira oladi.</div>}

      <form className="settings-grid" style={{ marginTop: 14 }} onSubmit={submit}>
        <div className="stack">
          <Card title="Asosiy" subtitle="Sayt manzili va ko'rinishi">
            <fieldset disabled={!canEdit} className="stack fieldset-reset">
              <Switch label="Sayt ochiq" hint="O'chirilsa, havola 404 qaytaradi" checked={f.is_enabled} onChange={(v) => set('is_enabled', v)} />
              <Switch label="Narxlarni ko'rsatish" hint="O'chirilsa, narx va narx filtri yashiriladi" checked={f.show_prices} onChange={(v) => set('show_prices', v)} />
              <Field label="Manzil (slug)" error={errors.slug} hint="Lotin kichik harflar, raqam va chiziqcha, 3–40 belgi">
                <TextInput prefix="kalit.uz/" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} maxLength={40} />
              </Field>
              <Field label="Sarlavha" error={errors.headline}>
                <TextInput value={f.headline} onChange={(e) => set('headline', e.target.value)} maxLength={120} placeholder="Toshkent markazida zamonaviy uylar" />
              </Field>
              <Field label="Kompaniya haqida" error={errors.about}>
                <textarea className="textarea" rows={4} value={f.about} onChange={(e) => set('about', e.target.value)} maxLength={1500} />
              </Field>
            </fieldset>
          </Card>

          <Card title="Kontaktlar">
            <fieldset disabled={!canEdit} className="form-grid fieldset-reset">
              <Field label="Telefon" error={errors.phone} className="span-2" hint="Bo'sh bo'lsa, kompaniya telefoni ko'rsatiladi">
                <PhoneInput value={f.phone} onChange={(v) => set('phone', v)} invalid={!!errors.phone} />
              </Field>
              <Field label="Telegram" error={errors.telegram}>
                <TextInput prefix="@" value={f.telegram} onChange={(e) => set('telegram', e.target.value)} maxLength={40} />
              </Field>
              <Field label="Instagram" error={errors.instagram}>
                <TextInput prefix="@" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} maxLength={40} />
              </Field>
            </fieldset>
          </Card>
        </div>

        <div className="stack">
          <Card title="Bo'lib to'lash kalkulyatori" subtitle="Xonadon sahifasida ko'rinadi (narxlar ochiq bo'lsa)">
            <fieldset disabled={!canEdit} className="form-grid fieldset-reset">
              <div className="span-2">
                <Switch label="Kalkulyatorni ko'rsatish" checked={f.installment_enabled} onChange={(v) => set('installment_enabled', v)} />
              </div>
              <Field label="Min. boshlang'ich, %" error={errors.installment_min_down}>
                <TextInput type="number" min={0} max={90} value={f.installment_min_down} onChange={(e) => set('installment_min_down', Number(e.target.value))} />
              </Field>
              <Field label="Maks. muddat, oy" error={errors.installment_max_months}>
                <TextInput type="number" min={1} max={120} value={f.installment_max_months} onChange={(e) => set('installment_max_months', Number(e.target.value))} />
              </Field>
              <Field label="Ustama, %" error={errors.installment_markup} className="span-2" hint="Qolgan summaga qo'shiladi; 0 — ustamasiz">
                <TextInput type="number" min={0} max={100} step="0.5" value={f.installment_markup} onChange={(e) => set('installment_markup', e.target.value)} />
              </Field>
            </fieldset>
          </Card>

          <Card title="Saytdagi loyihalar" subtitle="Faol loyihalardan qaysilari saytda ko'rinadi">
            <div className="stack">
              {s.projects.length === 0 && <span className="muted">Hali loyiha yo'q.</span>}
              {s.projects.map((p) => (
                <Switch
                  key={p.id}
                  label={p.name}
                  hint={p.is_active ? undefined : 'Nofaol loyiha — saytda ko\'rinmaydi'}
                  checked={p.show_on_site}
                  disabled={!canEdit || toggleProject.isPending}
                  onChange={(v) => toggleProject.mutate({ id: p.id, show: v })}
                />
              ))}
            </div>
          </Card>

          {canEdit && (
            <Button variant="primary" type="submit" icon={Save} loading={save.isPending} block>
              Saqlash
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
