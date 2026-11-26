import { Route, Routes } from 'react-router-dom'

import { HomeRedirect, RequireAuth } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { COMPANY_NAV, PLATFORM_NAV } from '@/components/layout/nav'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { DashboardPage } from '@/pages/company/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CompaniesPage } from '@/pages/platform/CompaniesPage'
import { PlatformDashboardPage } from '@/pages/platform/PlatformDashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'

const COMING = ['chessboard', 'projects', 'clients', 'bookings', 'contracts', 'payments', 'debtors', 'employees', 'reports']

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Kompaniya paneli: direktor, menejer, kassir */}
      <Route element={<RequireAuth roles={['director', 'manager', 'cashier']} />}>
        <Route path="/app" element={<AppShell nav={COMPANY_NAV} variant="company" />}>
          <Route index element={<DashboardPage />} />
          {COMING.map((p) => (
            <Route key={p} path={p} element={<ComingSoonPage />} />
          ))}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      {/* Platforma admin paneli */}
      <Route element={<RequireAuth roles={['superadmin']} />}>
        <Route path="/platform" element={<AppShell nav={PLATFORM_NAV} variant="platform" />}>
          <Route index element={<PlatformDashboardPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
