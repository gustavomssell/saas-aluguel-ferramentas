import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { RentalDialog } from '@/components/rentals/RentalDialog'
import { RentalDetailSheet } from '@/components/rentals/RentalDetailSheet'
import { StatusBadge } from '@/components/rentals/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Rental, RentalStatus } from '@/lib/types'
import { formatBRL, formatDay, formatNumber, statusMeta } from '@/lib/format'

const statusFilters: Array<{ value: 'all' | RentalStatus; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'QUOTED', label: 'Propostas' },
  { value: 'ACTIVE', label: 'Em obra' },
  { value: 'RETURN_PENDING', label: 'Pendentes' },
  { value: 'RETURNED', label: 'Devolvidas' },
]

export function RentalsPage() {
  const [status, setStatus] = useState<'all' | RentalStatus>('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRental, setSelectedRental] = useState<string | null>(null)

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ['rentals', status],
    queryFn: () => api.get<Rental[]>(`/rentals${status === 'all' ? '' : `?status=${status}`}`),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rentals
    return rentals.filter(
      (rental) =>
        rental.code.toLowerCase().includes(term) ||
        rental.customer.name.toLowerCase().includes(term) ||
        (rental.siteName ?? '').toLowerCase().includes(term),
    )
  }, [rentals, search])

  const openValue = useMemo(
    () =>
      filtered
        .filter((rental) => rental.status === 'ACTIVE' || rental.status === 'RETURN_PENDING')
        .reduce((total, rental) => total + rental.dailyTotal, 0),
    [filtered],
  )

  return (
    <AppShell
      title="Locações"
      subtitle={`${filtered.length} contrato(s) no filtro · ${formatBRL(openValue)} por dia em curso`}
      actions={
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Abrir locação
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={status} onValueChange={(value) => setStatus(value as 'all' | RentalStatus)}>
            <TabsList>
              {statusFilters.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por contrato, cliente ou obra"
              className="pl-9"
              aria-label="Buscar locação"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyTitle>Nenhuma locação neste filtro</EmptyTitle>
                <EmptyDescription>Abra uma nova locação ou ajuste o status para ver contratos anteriores.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border lg:hidden">
                {filtered.map((rental) => {
                  const pieces = rental.items.reduce((total, item) => total + item.quantity, 0)
                  return (
                    <button
                      key={rental.id}
                      type="button"
                      onClick={() => setSelectedRental(rental.id)}
                      className="flex flex-col gap-2 p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="metric text-xs text-muted-foreground">{rental.code}</span>
                        <StatusBadge status={rental.status} />
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-foreground">{rental.customer.name}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {rental.siteName ?? 'obra não informada'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="metric block text-sm">{formatBRL(rental.periodTotal)}</span>
                          <span
                            className={cn(
                              'block font-mono text-[10px]',
                              rental.finance.overdueAmount > 0
                                ? 'text-status-late'
                                : rental.finance.openAmount > 0
                                  ? 'text-muted-foreground'
                                  : 'text-status-available',
                            )}
                          >
                            {rental.finance.openAmount > 0
                              ? `${formatBRL(rental.finance.openAmount)} em aberto`
                              : 'quitado'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
                        <span className="metric text-[10px]">
                          {formatDay(rental.startsAt)} → {formatDay(rental.expectedReturnAt)}
                        </span>
                        <span>·</span>
                        <span>{formatNumber(rental.days)} d</span>
                        <span>·</span>
                        <span>{formatNumber(pieces)} peças</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">Contrato</TableHead>
                    <TableHead>Cliente e obra</TableHead>
                    <TableHead className="w-[220px]">Período</TableHead>
                    <TableHead className="w-[110px] text-right">Peças</TableHead>
                    <TableHead className="w-[170px]">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Total do período</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((rental) => (
                    <TableRow
                      key={rental.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRental(rental.id)}
                    >
                      <TableCell className="metric text-xs text-muted-foreground">{rental.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px] text-foreground">{rental.customer.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {rental.siteName ?? 'obra não informada'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="metric text-[11px]">
                          {formatDay(rental.startsAt)} → {formatDay(rental.expectedReturnAt)}
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                          {formatNumber(rental.days)} d
                        </span>
                      </TableCell>
                      <TableCell className="metric text-right text-sm">
                        {formatNumber(rental.items.reduce((total, item) => total + item.quantity, 0))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={rental.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="metric block text-sm">{formatBRL(rental.periodTotal)}</span>
                        {rental.finance.openAmount > 0 ? (
                          <span
                            className={`block font-mono text-[10px] ${
                              rental.finance.overdueAmount > 0 ? 'text-status-late' : 'text-muted-foreground'
                            }`}
                          >
                            {formatBRL(rental.finance.openAmount)} em aberto
                          </span>
                        ) : (
                          <span className="block font-mono text-[10px] text-status-available">quitado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(Object.keys(statusMeta) as RentalStatus[]).map((key) => {
            const count = rentals.filter((rental) => rental.status === key).length
            if (!count) return null
            return (
              <span key={key} className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <span className="size-2.5 rounded-[2px]" style={{ background: statusMeta[key].color }} />
                {statusMeta[key].label} · {count}
              </span>
            )
          })}
        </div>
      </div>

      <RentalDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <RentalDetailSheet
        rentalId={selectedRental}
        open={Boolean(selectedRental)}
        onOpenChange={(open) => {
          if (!open) setSelectedRental(null)
        }}
      />
    </AppShell>
  )
}
