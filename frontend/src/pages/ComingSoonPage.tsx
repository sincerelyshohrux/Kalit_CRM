import { CheckCircle2, Clock } from 'lucide-react'
import { useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { COMPANY_NAV } from '@/components/layout/nav'
import { useReveal } from '@/components/motion/effects'

const PLANS: Record<string, string[]> = {
  chessboard: ['Bloklar va podyezdlar bo\'yicha rangli to\'r', 'Xona, narx, qavat filtrlari', 'Xonadon kartasi va amallar'],
  projects: ['Loyiha va blok qo\'shish', 'Rasmlar galereyasi va planirovkalar', 'Xaritada lokatsiya'],
  clients: ['Mijozlar bazasi va qidiruv', 'Lid holatlari (yangi → shartnoma)', 'Mas\'ul menejer'],
  bookings: ['Muddatli bron', 'Muddat tugasa avtomatik bekor', 'Bron tarixi'],
  contracts: ['Shartnoma tuzish va PDF', 'Rassrochka grafigi', 'To\'lovlar tarixi'],
  payments: ['Naqd, karta, Click, Payme', 'Grafik bo\'yicha taqsimlash', 'Kassa hisoboti'],
  debtors: ['Muddati o\'tgan to\'lovlar', 'Kechikish kunlari', 'Eslatma yuborish'],
  employees: ['Xodim qo\'shish va rollar', 'Bloklash', 'Faollik tarixi'],
  reports: ['Oylik sotuv va tushum', 'Menejerlar reytingi', 'Excel eksport'],
}

export function ComingSoonPage() {
  const { pathname } = useLocation()
  const root = useRef<HTMLDivElement>(null)
  const item = COMPANY_NAV.flatMap((s) => s.items).find((i) => pathname.startsWith(i.to) && i.to !== '/app')
  useReveal(root, [pathname])

  return (
    <div ref={root} className="coming">
      <div>
        <div className="coming__badge" data-reveal>
          <Clock size={14} /> {item?.stage}-bosqichda tayyor bo'ladi
        </div>
        <h1 className="coming__title" data-reveal>
          {item?.label ?? 'Bo\'lim'}
        </h1>
        <p className="muted" style={{ marginTop: 8 }} data-reveal>
          Bu bo'lim ustida ish olib borilmoqda. Backend API qismi tayyorlanmoqda.
        </p>
        <div className="coming__list">
          {(PLANS[item?.key ?? ''] ?? []).map((p) => (
            <div key={p} data-reveal>
              <CheckCircle2 size={15} style={{ color: 'var(--text-3)' }} /> {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
