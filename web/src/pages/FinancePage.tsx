import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, CircleDollarSign, Plus, Search, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { BillingChart } from '@/components/finance/BillingChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { api, ApiError } from '@/lib/api'
import type { Charge, ChargeKind, Customer, FinanceSummary, Rental } from '@/lib/types'
import { addDaysISO, formatBRL, formatDay, formatNumber, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

const kindOptions: Array<{ value: ChargeKind; label: string }> = [
  { value: 'RENT', label: 'Locação' },
  { value: 'DEPOSIT', label: 'Caução' },
  { value: 'LATE_FEE', label: 'Multa por atraso' },
  { value: 'DAMAGE', label: 'Avaria' },
  { value: 'OTHER', label: 'Outros' },
]

type Filter = 'OPEN' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'ALL'

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'OPEN', label: 'Em aberto' },
  { value: 'OVERDUE', label: 'Vencidas' },
  { value: 'PAID', label: 'Recebidas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'ALL', label: 'Todas' },
]

function ChargeStatus({ charge }: { charge: Charge }) {
  if (charge.status === 'PAID') {
    return <Badge variant="secondary" className="text-status-available">Recebido</Badge>
  }
  if (charge.status === 'CANCELLED') {
    return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>
  }
  if (charge.overdue) {
    return (
      <Badge variant="outline" className="border-status-late/30 bg-status-late/10 text-status-late">
        Vencido
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-status-active/30 bg-status-active/10 text-status-active">
      Em aberto
    </Badge>
  )
}

function Readout({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string
  value: string
  hint: string
  tone?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1 bg-card px-4 py-3', className)}>
      <span className="label-caps text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('metric text-xl leading-none', tone ?? 'text-foreground')}>{value}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>
    </div>
  )
}

export function FinancePage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('OPEN')
  const [search, setSearch] = useState('')
  const [payTarget, setPayTarget] = useState<Charge | null>(null)
  const [payMethod, setPayMethod] = useState('PIX')
  const [payDate, setPayDate] = useState(todayISO())
  const [newOpen, setNewOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [newRental, setNewRental] = useState('')
  const [newKind, setNewKind] = useState<ChargeKind>('OTHER')
  const [newAmount, setNewAmount] = useState('')
  const [newDueDate, setNewDueDate] = useState(addDaysISO(7))
  const [newDescription, setNewDescription] = useState('')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => api.get<FinanceSummary>('/finance/summary'),
  })

  const { data: charges = [], isLoading: chargesLoading } = useQuery({
    queryKey: ['finance', 'charges'],
    queryFn: () => api.get<Charge[]>('/finance/charges'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
    enabled: newOpen,
  })

  const { data: rentals = [] } = useQuery({
    queryKey: ['rentals'],
    queryFn: () => api.get<Rental[]>('/rentals'),
    enabled: newOpen,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['finance'] })
    void queryClient.invalidateQueries({ queryKey: ['rentals'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const payMutation = useMutation({
    mutationFn: (charge: Charge) =>
      api.patch(`/finance/charges/${charge.id}`, {
        status: 'PAID',
        method: payMethod,
        paidAt: `${payDate}T12:00:00.000Z`,
      }),
    onSuccess: () => {
      toast.success('Recebimento registrado')
      setPayTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao registrar recebimento'),
  })

  const cancelMutation = useMutation({
    mutationFn: (charge: Charge) => api.patch(`/finance/charges/${charge.id}`, { status: 'CANCELLED' }),
    onSuccess: () => {
      toast.success('Cobrança cancelada')
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao cancelar cobrança'),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/finance/charges', {
        customerId: newCustomer,
        rentalId: newRental || null,
        kind: newKind,
        amount: Number(newAmount.replace(',', '.')),
        dueDate: newDueDate,
        description: newDescription.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Cobrança criada')
      setNewOpen(false)
      setNewAmount('')
      setNewDescription('')
      setNewRental('')
      setNewCustomer('')
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao criar cobrança'),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return charges.filter((charge) => {
      if (filter === 'OPEN' && charge.status !== 'PENDING') return false
      if (filter === 'OVERDUE' && !charge.overdue) return false
      if (filter === 'PAID' && charge.status !== 'PAID') return false
      if (filter === 'CANCELLED' && charge.status !== 'CANCELLED') return false
      if (!term) return true
      return (
        charge.customer.name.toLowerCase().includes(term) ||
        (charge.description ?? '').toLowerCase().includes(term) ||
        (charge.rental?.code ?? '').toLowerCase().includes(term) ||
        charge.kindLabel.toLowerCase().includes(term)
      )
    })
  }, [charges, filter, search])

  const rentalsForCustomer = useMemo(
    () => rentals.filter((rental) => !newCustomer || rental.customer.id === newCustomer),
    [rentals, newCustomer],
  )

  const openTotal = filtered
    .filter((charge) => charge.status === 'PENDING')
    .reduce((total, charge) => total + charge.amount, 0)

  return (
    <AppShell
      title="Financeiro"
      subtitle="Cobranças, cauções e recebimentos das locações"
      actions={
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus data-icon="inline-start" />
          Nova cobrança
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Wallet className="size-5" strokeWidth={2} />
              </span>
              <div>
                <p className="label-caps text-[10px] text-muted-foreground">Posição de caixa</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {summary ? `atualizado em ${formatDay(summary.generatedAt)}` : 'carregando…'}
                </p>
              </div>
            </div>
          </div>

          {summaryLoading || !summary ? (
            <div className="p-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5">
              <Readout
                label="A receber"
                value={formatBRL(summary.totals.openAmount)}
                hint={`${formatNumber(summary.totals.openCount)} cobrança(s) em aberto`}
                className="col-span-2 lg:col-span-1"
              />
              <Readout
                label="Vencido"
                value={formatBRL(summary.totals.overdueAmount)}
                hint={`${formatNumber(summary.totals.overdueCount)} em atraso`}
                tone="text-status-late"
              />
              <Readout
                label="Próximos 7 dias"
                value={formatBRL(summary.totals.dueThisWeekAmount)}
                hint="vencem nesta semana"
              />
              <Readout
                label="Recebido no mês"
                value={formatBRL(summary.totals.receivedThisMonth)}
                hint="confirmado por pagamento"
                tone="text-status-available"
              />
              <Readout
                label="Cauções retidas"
                value={formatBRL(summary.totals.depositHeld)}
                hint="a devolver após retorno"
              />
            </div>
          )}
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
          <section className="min-w-0 rounded-lg border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-heading text-base tracking-tight">Faturado x recebido</h2>
              <p className="font-mono text-[10px] text-muted-foreground">últimos 6 meses, por vencimento e pagamento</p>
            </header>
            <div className="px-5 py-4">
              {summaryLoading || !summary ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <BillingChart series={summary.series} />
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="font-heading text-base tracking-tight">Exige cobrança</h2>
                <p className="font-mono text-[10px] text-muted-foreground">vencidas e a vencer nos próximos 7 dias</p>
              </div>
              <CircleDollarSign className="size-4 text-muted-foreground" />
            </header>
            <div className="flex flex-col divide-y divide-border">
              {summaryLoading ? (
                <div className="p-4">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (summary?.attention.length ?? 0) === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma cobrança pendente. Caixa em dia.</p>
              ) : (
                summary?.attention.map((charge) => (
                  <div key={charge.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <AlertTriangle
                        className={cn('size-4 shrink-0', charge.overdue ? 'text-status-late' : 'text-status-quoted')}
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-foreground">
                          {charge.description ?? charge.kindLabel}
                        </p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {charge.customer.name} · vence {formatDay(charge.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-7 sm:justify-end sm:pl-0">
                      <span className="metric text-sm">{formatBRL(charge.amount)}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPayTarget(charge)
                          setPayMethod('PIX')
                          setPayDate(todayISO())
                        }}
                      >
                        Receber
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <h2 className="font-heading text-base tracking-tight">Cobranças</h2>
              <p className="font-mono text-[10px] text-muted-foreground">
                {formatNumber(filtered.length)} registro(s) · {formatBRL(openTotal)} em aberto no filtro
              </p>
            </div>
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, contrato ou cobrança"
                className="pl-9"
                aria-label="Buscar cobrança"
              />
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList className="h-auto! flex-wrap justify-start">
                {filters.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {chargesLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyTitle>Nenhuma cobrança neste filtro</EmptyTitle>
                <EmptyDescription>Ajuste os filtros ou lance uma nova cobrança para o cliente.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border lg:hidden">
                {filtered.map((charge) => (
                  <div key={charge.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <ChargeStatus charge={charge} />
                      <span
                        className={cn(
                          'metric text-[10px]',
                          charge.overdue ? 'text-status-late' : 'text-muted-foreground',
                        )}
                      >
                        vence {formatDay(charge.dueDate)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-foreground">
                          {charge.description ?? charge.kindLabel}
                        </p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {charge.customer.name} · {charge.kindLabel}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="metric text-sm">{formatBRL(charge.amount)}</span>
                        {charge.paidAt ? (
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            pago {formatDay(charge.paidAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {charge.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Cancelar cobrança de ${charge.customer.name}`}
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(charge)}
                        >
                          <X data-icon="inline-start" className="size-4" />
                          Cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPayTarget(charge)
                            setPayMethod('PIX')
                            setPayDate(todayISO())
                          }}
                        >
                          <Check data-icon="inline-start" className="size-4" />
                          Receber
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Vencimento</TableHead>
                    <TableHead>Cobrança</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[130px] text-right">Valor</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell className={cn('metric text-xs', charge.overdue ? 'text-status-late' : 'text-muted-foreground')}>
                        {formatDay(charge.dueDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px] text-foreground">
                            {charge.description ?? charge.kindLabel}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {charge.customer.name} · {charge.kindLabel}
                            {charge.rental ? (
                              <>
                                {' · '}
                                <Link
                                  to="/locacoes"
                                  className="underline decoration-border underline-offset-2 hover:text-foreground"
                                >
                                  {charge.rental.code}
                                </Link>
                              </>
                            ) : null}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChargeStatus charge={charge} />
                      </TableCell>
                      <TableCell className="metric text-right text-sm">
                        {formatBRL(charge.amount)}
                        {charge.paidAt ? (
                          <span className="block font-mono text-[10px] font-normal text-muted-foreground">
                            pago {formatDay(charge.paidAt)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {charge.status === 'PENDING' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPayTarget(charge)
                                  setPayMethod('PIX')
                                  setPayDate(todayISO())
                                }}
                              >
                                <Check data-icon="inline-start" />
                                Receber
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Cancelar cobrança de ${charge.customer.name}`}
                                disabled={cancelMutation.isPending}
                                onClick={() => cancelMutation.mutate(charge)}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={payTarget !== null} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Registrar recebimento</DialogTitle>
            <DialogDescription>
              {payTarget?.customer.name} · {payTarget?.description ?? payTarget?.kindLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
            <span className="label-caps text-[10px] text-muted-foreground">Valor</span>
            <span className="metric text-2xl">{formatBRL(payTarget?.amount ?? 0)}</span>
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel>Forma de recebimento</FieldLabel>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {['PIX', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência'].map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="paid-at">Data do recebimento</FieldLabel>
              <Input id="paid-at" type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={payMutation.isPending || !payDate}
              onClick={() => payTarget && payMutation.mutate(payTarget)}
            >
              {payMutation.isPending ? 'Registrando…' : 'Confirmar recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova cobrança</DialogTitle>
            <DialogDescription>Multas, avarias, cauções extras ou serviços avulsos.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!newCustomer || !Number(newAmount)) {
                toast.error('Escolha o cliente e informe o valor')
                return
              }
              createMutation.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <Select
                  value={newCustomer}
                  onValueChange={(value) => {
                    setNewCustomer(value)
                    setNewRental('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Locação vinculada (opcional)</FieldLabel>
                <Select value={newRental} onValueChange={setNewRental} disabled={!newCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder={newCustomer ? 'Sem vínculo' : 'Escolha o cliente primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {rentalsForCustomer.map((rental) => (
                        <SelectItem key={rental.id} value={rental.id}>
                          {rental.code} — {rental.siteName ?? rental.customer.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Tipo</FieldLabel>
                  <Select value={newKind} onValueChange={(value) => setNewKind(value as ChargeKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {kindOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="charge-amount">Valor (R$)</FieldLabel>
                  <Input
                    id="charge-amount"
                    inputMode="decimal"
                    value={newAmount}
                    onChange={(event) => setNewAmount(event.target.value)}
                    placeholder="0,00"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="charge-due">Vencimento</FieldLabel>
                <Input
                  id="charge-due"
                  type="date"
                  value={newDueDate}
                  onChange={(event) => setNewDueDate(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="charge-description">Descrição</FieldLabel>
                <Textarea
                  id="charge-description"
                  rows={2}
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Reposição de 2 painéis avariados"
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando…' : 'Criar cobrança'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
