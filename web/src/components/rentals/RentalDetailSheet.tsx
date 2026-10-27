import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, CheckCircle2, ClipboardCheck, FileText, Truck, Undo2, XCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/rentals/StatusBadge'
import { RentalInspectionDialog } from '@/components/rentals/RentalInspectionDialog'
import { api, ApiError } from '@/lib/api'
import type { Charge, Rental, RentalStatus } from '@/lib/types'
import { addDaysISO, formatBRL, formatDay, formatNumber, formatWeight, todayISO } from '@/lib/format'

const actions: Array<{ status: RentalStatus; label: string; icon: typeof Truck; variant?: 'default' | 'outline' }> = [
  { status: 'ACTIVE', label: 'Ativar locação', icon: CheckCircle2 },
  { status: 'RETURN_PENDING', label: 'Marcar devolução pendente', icon: Truck, variant: 'outline' },
  { status: 'RETURNED', label: 'Registrar devolução', icon: Undo2, variant: 'outline' },
  { status: 'CANCELLED', label: 'Cancelar locação', icon: XCircle, variant: 'outline' },
]

export function RentalDetailSheet({
  rentalId,
  open,
  onOpenChange,
}: {
  rentalId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [inspectionKind, setInspectionKind] = useState<'DELIVERY' | 'RETURN' | null>(null)

  const { data: rental, isLoading } = useQuery({
    queryKey: ['rental', rentalId],
    queryFn: () => api.get<Rental>(`/rentals/${rentalId}`),
    enabled: Boolean(rentalId) && open,
  })

  const { data: charges = [] } = useQuery({
    queryKey: ['finance', 'charges', 'rental', rentalId],
    queryFn: () => api.get<Charge[]>(`/finance/charges?rentalId=${rentalId}`),
    enabled: Boolean(rentalId) && open,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['rentals'] })
    void queryClient.invalidateQueries({ queryKey: ['timeline'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['finance'] })
  }

  const payMutation = useMutation({
    mutationFn: (chargeId: string) =>
      api.patch(`/finance/charges/${chargeId}`, {
        status: 'PAID',
        method: 'PIX',
        paidAt: `${todayISO()}T12:00:00.000Z`,
      }),
    onSuccess: () => {
      toast.success('Recebimento registrado')
      void queryClient.invalidateQueries({ queryKey: ['rental', rentalId] })
      void queryClient.invalidateQueries({ queryKey: ['finance', 'charges', 'rental', rentalId] })
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao registrar recebimento'),
  })

  const statusMutation = useMutation({
    mutationFn: (status: RentalStatus) => api.post(`/rentals/${rentalId}/status`, { status }),
    onSuccess: (updated) => {
      toast.success(`Locação atualizada para ${(updated as Rental).statusLabel}`)
      void queryClient.invalidateQueries({ queryKey: ['rental', rentalId] })
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao atualizar locação'),
  })

  const extendMutation = useMutation({
    mutationFn: () =>
      api.patch(`/rentals/${rentalId}`, {
        expectedReturnAt: addDaysISO(7 + Math.round((new Date(rental!.expectedReturnAt).getTime() - Date.now()) / 86400000)),
      }),
    onSuccess: () => {
      toast.success('Prazo estendido em 7 dias')
      void queryClient.invalidateQueries({ queryKey: ['rental', rentalId] })
      invalidate()
    },
    onError: (error) => {
      const details = error instanceof ApiError && Array.isArray(error.details)
        ? (error.details as Array<{ code: string; available: number }>)
            .map((item) => `${item.code}: livre ${item.available}`)
            .join(' · ')
        : null
      toast.error(
        error instanceof ApiError ? `${error.message}${details ? ` (${details})` : ''}` : 'Falha ao estender prazo',
      )
    },
  })

  const allowed = rental
    ? actions.filter((action) => {
        const transitions: Record<RentalStatus, RentalStatus[]> = {
          QUOTED: ['ACTIVE', 'CANCELLED'],
          ACTIVE: ['RETURN_PENDING', 'RETURNED', 'CANCELLED'],
          RETURN_PENDING: ['RETURNED', 'ACTIVE'],
          RETURNED: [],
          CANCELLED: [],
        }
        return transitions[rental.status].includes(action.status)
      })
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-heading">
            Locação {rental?.code ?? ''}
            {rental ? <StatusBadge status={rental.status} /> : null}
          </SheetTitle>
          <SheetDescription>
            {rental ? `${rental.customer.name} · ${rental.siteName ?? 'obra não informada'}` : 'Carregando dados da locação'}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !rental ? (
          <div className="flex flex-col gap-3 px-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-4 pb-8">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
              {[
                { label: 'Saída', value: formatDay(rental.startsAt) },
                { label: 'Devolução prevista', value: formatDay(rental.expectedReturnAt) },
                { label: 'Dias cobrados', value: formatNumber(rental.days) },
                { label: 'Peso total', value: formatWeight(rental.totalWeightKg) },
                { label: 'Caução', value: formatBRL(rental.depositAmount) },
                { label: 'Em aberto', value: formatBRL(rental.finance.openAmount) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 bg-card px-3 py-2.5">
                  <dt className="label-caps text-[9px] text-muted-foreground">{item.label}</dt>
                  <dd className="metric text-sm">{item.value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="label-caps text-[10px] text-muted-foreground">Peças na obra</h3>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {rental.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="metric w-10 text-right text-sm">{formatNumber(item.quantity)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">
                        <span className="metric text-xs text-muted-foreground">{item.code}</span> {item.name}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{item.priceExplanation}</p>
                    </div>
                    <span className="metric text-sm">{formatBRL(item.periodTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-baseline justify-between rounded-md border border-border bg-card px-3 py-3">
              <span className="text-sm text-muted-foreground">Total do período</span>
              <span className="metric text-2xl">{formatBRL(rental.periodTotal)}</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="label-caps text-[10px] text-muted-foreground">Cobranças</h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  recebido {formatBRL(rental.finance.paidAmount)}
                </span>
              </div>
              {charges.length === 0 ? (
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">Nenhuma cobrança vinculada.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {charges.map((charge) => (
                    <li key={charge.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{charge.description ?? charge.kindLabel}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {charge.kindLabel} · vence {formatDay(charge.dueDate)}
                          {charge.paidAt ? ` · pago ${formatDay(charge.paidAt)}` : ''}
                        </p>
                      </div>
                      <span className="metric text-sm">{formatBRL(charge.amount)}</span>
                      {charge.status === 'PENDING' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={payMutation.isPending}
                          onClick={() => payMutation.mutate(charge.id)}
                        >
                          Receber
                        </Button>
                      ) : (
                        <span
                          className={`font-mono text-[10px] ${
                            charge.status === 'PAID' ? 'text-status-available' : 'text-muted-foreground'
                          }`}
                        >
                          {charge.statusLabel}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              {allowed.map((action) => (
                <Button
                  key={action.status}
                  variant={action.variant ?? 'default'}
                  size="sm"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(action.status)}
                >
                  <action.icon data-icon="inline-start" />
                  {action.label}
                </Button>
              ))}
              {rental.status !== 'RETURNED' && rental.status !== 'CANCELLED' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={extendMutation.isPending}
                  onClick={() => extendMutation.mutate()}
                >
                  <CalendarPlus data-icon="inline-start" />
                  Estender 7 dias
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/locacoes/${rental.id}/contrato`, '_blank', 'noopener')}
              >
                <FileText data-icon="inline-start" />
                Contrato
              </Button>
              {rental.status === 'QUOTED' || rental.status === 'ACTIVE' ? (
                <Button variant="outline" size="sm" onClick={() => setInspectionKind('DELIVERY')}>
                  <ClipboardCheck data-icon="inline-start" />
                  Checklist de entrega
                </Button>
              ) : null}
              {rental.status === 'ACTIVE' || rental.status === 'RETURN_PENDING' ? (
                <Button variant="outline" size="sm" onClick={() => setInspectionKind('RETURN')}>
                  <ClipboardCheck data-icon="inline-start" />
                  Checklist de devolução
                </Button>
              ) : null}
            </div>

            <div>
              <h3 className="label-caps text-[10px] text-muted-foreground">Conferências</h3>
              {rental.inspections.length === 0 ? (
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  Nenhuma conferência registrada. Use os checklists de entrega e devolução.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {rental.inspections.map((inspection) => {
                    const checked = inspection.items.reduce((total, item) => total + item.quantityChecked, 0)
                    const damaged = inspection.items.reduce((total, item) => total + item.damaged, 0)
                    const missing = inspection.items.reduce((total, item) => total + item.missing, 0)
                    return (
                      <li key={inspection.id} className="flex items-start gap-3 px-3 py-2.5">
                        <span
                          className={`mt-1 size-2 shrink-0 rounded-full ${
                            inspection.kind === 'DELIVERY' ? 'bg-status-active' : 'bg-status-available'
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">
                            {inspection.kindLabel} conferida em {formatDay(inspection.checkedAt)}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {formatNumber(checked)} ok
                            {damaged > 0 ? ` · ${formatNumber(damaged)} avariada(s)` : ''}
                            {missing > 0 ? ` · ${formatNumber(missing)} faltante(s)` : ''}
                          </p>
                          {inspection.notes ? (
                            <p className="mt-1 text-[12px] text-muted-foreground">{inspection.notes}</p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <h3 className="label-caps text-[10px] text-muted-foreground">Histórico</h3>
              <ol className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
                {rental.events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" aria-hidden />
                    <p className="text-[13px] text-foreground">{event.message}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{formatDay(event.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SheetContent>

      <RentalInspectionDialog
        key={`${inspectionKind ?? 'closed'}-${rental?.id ?? 'none'}`}
        rental={rental ?? null}
        kind={inspectionKind ?? 'DELIVERY'}
        open={inspectionKind !== null}
        onOpenChange={(open) => {
          if (!open) setInspectionKind(null)
        }}
      />
    </Sheet>
  )
}
