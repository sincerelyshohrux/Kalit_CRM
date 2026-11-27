import { Phone, Send } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { KalitMark } from '@/components/layout/AppShell'
import { LeadModal, type LeadTarget } from '@/components/public/PublicPieces'
import { Button, Skeleton } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { formatPhone } from '@/lib/format'
import { useSite, type PublicSite } from '@/lib/public'

/** Ommaviy sahifalar uchun umumiy qobiq: sarlavha, kontaktlar, ariza oynasi. */
export function PublicLayout({ slug, children }: { slug: string; children: (site: PublicSite, openLead: (t?: LeadTarget) => void) => ReactNode }) {
  const site = useSite(slug)
  const [lead, setLead] = useState<LeadTarget | null>(null)

  if (site.isLoading) {
    return (
      <div className="pub">
        <div className="pub-main">
          <Skeleton height={64} />
          <Skeleton height={360} style={{ marginTop: 16 }} />
        </div>
      </div>
    )
  }
  if (site.error || !site.data) {
    const missing = site.error instanceof ApiError && site.error.status === 404
    return (
      <div className="pub pub--empty">
        <div className="pub-missing card">
          <KalitMark size={28} />
          <h1>{missing ? 'Sahifa topilmadi' : "Sahifani yuklab bo'lmadi"}</h1>
          <p className="muted">{missing ? "Manzil noto'g'ri yoki kompaniya sayti hozircha yopiq." : "Internet aloqasini tekshirib, sahifani yangilang."}</p>
        </div>
      </div>
    )
  }

  const s = site.data
  const tel = s.phone ? s.phone.replace(/[^\d+]/g, '') : ''
  return (
    <div className="pub">
      <header className="pub-head">
        <Link to={`/${s.slug}`} className="pub-brand">
          {s.company.logo ? <img src={s.company.logo} alt="" className="pub-brand__logo" /> : <span className="pub-brand__mark">{s.company.name.slice(0, 1)}</span>}
          <span>
            <b>{s.company.name}</b>
            {s.company.city && <small className="muted">{s.company.city}</small>}
          </span>
        </Link>
        <nav className="pub-head__actions">
          {s.telegram && (
            <a className="icon-btn" href={`https://t.me/${s.telegram}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram">
              <Send size={16} strokeWidth={1.8} />
            </a>
          )}
          {tel && (
            <a className="pub-phone" href={`tel:${tel}`}>
              <Phone size={15} strokeWidth={1.8} /> <span>{formatPhone(s.phone)}</span>
            </a>
          )}
          <Button variant="primary" size="sm" onClick={() => setLead({})}>
            Ariza qoldirish
          </Button>
        </nav>
      </header>

      <main className="pub-main">{children(s, (t) => setLead(t ?? {}))}</main>

      <footer className="pub-foot muted">
        <span>© {new Date().getFullYear()} {s.company.name}</span>
        {s.instagram && (
          <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        )}
        <span className="pub-foot__kalit">
          <KalitMark size={13} /> Kalit
        </span>
      </footer>

      <LeadModal open={lead !== null} onClose={() => setLead(null)} site={s} target={lead ?? undefined} />
    </div>
  )
}
