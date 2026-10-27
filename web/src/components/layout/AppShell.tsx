import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Blocks,
  Boxes,
  Building2,
  CalendarRange,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Gauge,
  LogOut,
  Menu,
  Ruler,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Dashboard } from '@/lib/types'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatNumber } from '@/lib/format'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

const navigation = [
  { to: '/', label: 'Visão geral', icon: Gauge, end: true },
  { to: '/catalogo', label: 'Catálogo', icon: Boxes, end: false },
  { to: '/kits', label: 'Montador de kits', icon: Blocks, end: false },
  { to: '/timeline', label: 'Timeline', icon: CalendarRange, end: false },
  { to: '/locacoes', label: 'Locações', icon: ClipboardList, end: false },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, end: false },
  { to: '/clientes', label: 'Clientes', icon: Building2, end: false },
  { to: '/equipe', label: 'Equipe', icon: Users, end: false },
]

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Ruler className="size-5" strokeWidth={2.4} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="label-caps text-[15px] text-sidebar-foreground">Canteiro</span>
        <span className="font-mono text-[10px] tracking-tight text-sidebar-foreground/55">
          locação de equipamentos
        </span>
      </span>
    </div>
  )
}

function StockGauge() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/dashboard'),
    staleTime: 30_000,
  })

  const utilization = data?.stock.utilization ?? 0

  return (
    <div className="rounded-md border border-sidebar-border/70 bg-sidebar-accent/40 p-3">
      <div className="flex items-baseline justify-between">
        <span className="label-caps text-[10px] text-sidebar-foreground/60">Pátio alocado</span>
        <span className="metric text-sm text-sidebar-foreground">{formatNumber(utilization, 1)}%</span>
      </div>
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-4 w-full rounded-[1px]',
              index < Math.round((utilization / 100) * 24) ? 'bg-primary' : 'bg-sidebar-foreground/15',
            )}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] text-sidebar-foreground/55">
        {data ? `${formatNumber(data.stock.unitsInField)} de ${formatNumber(data.stock.unitsTotal)} peças fora do galpão` : 'carregando estoque…'}
      </p>
    </div>
  )
}

function OrgSwitcher() {
  const { session, switchOrganization } = useAuth()
  if (!session) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto gap-2 px-2 py-1.5 text-left font-normal hover:bg-secondary"
        >
          <span className="flex size-7 items-center justify-center rounded-sm bg-secondary font-mono text-[11px] text-foreground">
            {session.organization.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden flex-col leading-tight xl:flex">
            <span className="max-w-[150px] truncate text-[13px] text-foreground">{session.organization.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{session.organization.role.toLowerCase()}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Locadoras disponíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {session.memberships.map((membership) => (
          <DropdownMenuItem
            key={membership.organizationId}
            onSelect={() => {
              if (membership.organizationId !== session.organization.id) {
                void switchOrganization(membership.organizationId)
              }
            }}
          >
            <span className="flex-1 truncate">{membership.name}</span>
            {membership.organizationId === session.organization.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { session, logout } = useAuth()
  if (!session) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="flex size-7 items-center justify-center rounded-sm bg-secondary font-mono text-[11px]">
            {session.user.name
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')}
          </span>
          <span className="hidden text-[13px] sm:inline">{session.user.name.split(' ')[0]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{session.user.name}</span>
          <span className="font-mono text-[11px] font-normal text-muted-foreground">{session.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut className="size-4" />
          Encerrar sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Rail({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-4 py-5">
      <BrandMark />

      <nav className="flex flex-1 flex-col gap-1">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-primary transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <item.icon className="size-4" strokeWidth={1.9} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <StockGauge />
    </div>
  )
}

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden border-r border-sidebar-border lg:sticky lg:top-0 lg:block lg:h-screen">
        <Rail />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu principal</SheetTitle>
              <Rail onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg leading-tight tracking-tight text-foreground sm:text-xl">{title}</h1>
            {subtitle ? (
              <p className="mt-0.5 hidden truncate font-mono text-[11px] text-muted-foreground sm:block">{subtitle}</p>
            ) : null}
          </div>

          <div className="order-3 flex items-center gap-2 sm:order-4">
            <div className="hidden h-8 w-px bg-border sm:block" />
            <ThemeToggle className="size-8" />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div className="hidden sm:block">
              <OrgSwitcher />
            </div>
            <UserMenu />
          </div>

          {actions ? (
            <div className="order-4 flex w-full flex-wrap items-center justify-end gap-2 sm:order-3 sm:w-auto">
              {actions}
            </div>
          ) : null}
        </header>

        <div key={location.pathname} className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </div>

        <footer className="border-t border-border px-4 py-3 sm:px-6">
          <p className="font-mono text-[10px] text-muted-foreground">
            Dados de demonstração · Locadora Horizonte · Canteiro v0.1
          </p>
        </footer>
      </div>
    </div>
  )
}
