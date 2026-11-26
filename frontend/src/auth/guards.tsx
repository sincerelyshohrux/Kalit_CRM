import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { KalitMark } from '@/components/layout/AppShell'
import type { Role } from '@/lib/types'

import { homePathFor, useAuth } from './AuthProvider'

export function FullscreenLoader() {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="brand__mark" style={{ width: 52, height: 52, borderRadius: 16, animation: 'pulse 1.4s ease-in-out infinite' }}>
        <KalitMark size={26} />
      </div>
      <style>{'@keyframes pulse{50%{opacity:.5;transform:scale(.94)}}'}</style>
    </div>
  )
}

/** Faqat tizimga kirganlar va (ixtiyoriy) ma'lum rollar uchun. */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullscreenLoader />
  if (status === 'guest' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (roles && !roles.includes(user.role)) {
    // Ruxsat yo'q — o'z paneliga qaytaramiz (UI himoyasi; asosiy tekshiruv backendda)
    return <Navigate to={homePathFor(user)} replace />
  }
  return <Outlet />
}

export function HomeRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullscreenLoader />
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />
}
