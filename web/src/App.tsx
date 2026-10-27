import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const CatalogPage = lazy(() => import('@/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })))
const KitsPage = lazy(() => import('@/pages/KitsPage').then((m) => ({ default: m.KitsPage })))
const TimelinePage = lazy(() => import('@/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })))
const RentalsPage = lazy(() => import('@/pages/RentalsPage').then((m) => ({ default: m.RentalsPage })))
const FinancePage = lazy(() => import('@/pages/FinancePage').then((m) => ({ default: m.FinancePage })))
const ContractPage = lazy(() => import('@/pages/ContractPage').then((m) => ({ default: m.ContractPage })))
const TeamPage = lazy(() => import('@/pages/TeamPage').then((m) => ({ default: m.TeamPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })))

function Protected({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="label-caps text-xs text-muted-foreground">carregando pátio…</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="label-caps text-xs text-muted-foreground">carregando pátio…</p>
    </div>
  )
}

export default function App() {
  const { session, ready } = useAuth()

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={ready && session ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/registrar" element={ready && session ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/catalogo"
          element={
            <Protected>
              <CatalogPage />
            </Protected>
          }
        />
        <Route
          path="/kits"
          element={
            <Protected>
              <KitsPage />
            </Protected>
          }
        />
        <Route
          path="/timeline"
          element={
            <Protected>
              <TimelinePage />
            </Protected>
          }
        />
        <Route
          path="/locacoes"
          element={
            <Protected>
              <RentalsPage />
            </Protected>
          }
        />
        <Route
          path="/financeiro"
          element={
            <Protected>
              <FinancePage />
            </Protected>
          }
        />
        <Route
          path="/clientes"
          element={
            <Protected>
              <CustomersPage />
            </Protected>
          }
        />
        <Route
          path="/relatorios"
          element={
            <Protected>
              <ReportsPage />
            </Protected>
          }
        />
        <Route
          path="/equipe"
          element={
            <Protected>
              <TeamPage />
            </Protected>
          }
        />
        <Route
          path="/locacoes/:id/contrato"
          element={
            <Protected>
              <ContractPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
