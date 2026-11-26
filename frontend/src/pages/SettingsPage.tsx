import { KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { useReveal } from '@/components/motion/effects'
import { Avatar, Button, Card, Field, PageHead, TextInput } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { User } from '@/lib/types'
import { formatDate, formatPhone } from '@/lib/format'

export function SettingsPage() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)

  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
  })
  const [profileErr, setProfileErr] = useState<Record<string, string>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwErr, setPwErr] = useState<Record<string, string>>({})
  const [savingPw, setSavingPw] = useState(false)

  if (!user) return null

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setProfileErr({})
    setSavingProfile(true)
    try {
      const updated = await api<User>('/auth/me/', { method: 'PATCH', body: profile })
      setUser(updated)
      toast.success('Profil saqlandi')
    } catch (err) {
      if (err instanceof ApiError) setProfileErr(err.fieldErrors)
      toast.error(err instanceof ApiError ? err.message : 'Xatolik')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPwErr({})
    if (pw.new_password !== pw.confirm) {
      setPwErr({ confirm: 'Parollar mos kelmadi.' })
      return
    }
    setSavingPw(true)
    try {
      await api('/auth/change-password/', {
        method: 'POST',
        body: { old_password: pw.old_password, new_password: pw.new_password },
      })
      toast.success('Parol almashtirildi. Qayta kiring.')
      // Backend barcha sessiyalarni bekor qildi — qayta login
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) setPwErr(err.fieldErrors)
      toast.error(err instanceof ApiError ? err.message : 'Xatolik')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div ref={root}>
      <PageHead eyebrow="Hisob" title="Sozlamalar" description="Shaxsiy ma'lumotlar va xavfsizlik" />

      <div className="settings-grid">
        <div className="stack">
          <Card title="Profil" subtitle="Ismingiz tizimda shunday ko'rinadi">
            <div data-reveal>
              <div className="row" style={{ marginBottom: 18 }}>
                <Avatar name={user.full_name || user.phone} src={user.avatar} size="lg" />
                <div>
                  <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{user.role_display}</div>
                </div>
              </div>
              <form className="form-grid" onSubmit={saveProfile}>
                <Field label="Ism" error={profileErr.first_name}>
                  <TextInput value={profile.first_name} maxLength={150} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
                </Field>
                <Field label="Familiya" error={profileErr.last_name}>
                  <TextInput value={profile.last_name} maxLength={150} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
                </Field>
                <Field label="Email" error={profileErr.email} className="span-2">
                  <TextInput type="email" value={profile.email} maxLength={254} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </Field>
                <div className="span-2 row" style={{ justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="primary" loading={savingProfile}>
                    Saqlash
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card title="Hisob ma'lumotlari">
            <dl className="kv" data-reveal>
              <dt>Telefon</dt>
              <dd>{formatPhone(user.phone)}</dd>
              <dt>Rol</dt>
              <dd>{user.role_display}</dd>
              {user.company && (
                <>
                  <dt>Kompaniya</dt>
                  <dd>{user.company.name}</dd>
                </>
              )}
              <dt>Oxirgi kirish</dt>
              <dd>{formatDate(user.last_login)}</dd>
              <dt>Ro'yxatdan o'tgan</dt>
              <dd>{formatDate(user.date_joined)}</dd>
            </dl>
          </Card>
        </div>

        <Card title="Parolni almashtirish" subtitle="Almashtirilgach, barcha qurilmalardagi sessiyalar yopiladi">
          <form className="stack" onSubmit={changePassword} data-reveal>
            <Field label="Joriy parol" error={pwErr.old_password}>
              <TextInput type="password" icon={Lock} autoComplete="current-password" value={pw.old_password} maxLength={128} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} />
            </Field>
            <Field label="Yangi parol" error={pwErr.new_password} hint="Kamida 8 belgi, faqat raqamlardan iborat bo'lmasin">
              <TextInput type="password" icon={KeyRound} autoComplete="new-password" value={pw.new_password} maxLength={128} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </Field>
            <Field label="Yangi parolni takrorlang" error={pwErr.confirm}>
              <TextInput type="password" icon={KeyRound} autoComplete="new-password" value={pw.confirm} maxLength={128} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <div className="login-note" style={{ marginTop: 0 }}>
              <ShieldCheck size={15} />
              <span>Parollar Argon2 bilan shifrlangan holda saqlanadi.</span>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" loading={savingPw} disabled={!pw.old_password || !pw.new_password}>
                Parolni almashtirish
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
