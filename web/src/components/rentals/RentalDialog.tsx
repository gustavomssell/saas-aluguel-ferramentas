import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import type { AvailabilityResponse, Customer, Equipment } from '@/lib/types'
import { addDaysISO, formatBRL, formatNumber, formatWeight, todayISO } from '@/lib/format'

type ItemRow = { key: string; equipmentId: string; quantity: string }

function newRow(): ItemRow {
  return { key: Math.random().toString(36).slice(2), equipmentId: '', quantity: '1' }
}

export function RentalDialog({
  open,
  onOpenChange,
  defaultCustomerId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultCustomerId?: string
}) {
  const queryClient = useQueryClient()
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '')
  const [siteName, setSiteName] = useState('')
  const [startsAt, setStartsAt] = useState(todayISO())
  const [expectedReturnAt, setExpectedReturnAt] = useState(addDaysISO(30))
  const [status, setStatus] = useState<'QUOTED' | 'ACTIVE'>('QUOTED')
  const [deposit, setDeposit] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<ItemRow[]>([newRow()])

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
    enabled: open,
  })

  const { data: equipments = [] } = useQuery({
    queryKey: ['equipment', 'all'],
    queryFn: () => api.get<Equipment[]>('/equipment'),
    enabled: open,
  })

  const { data: availability } = useQuery({
    queryKey: ['availability', startsAt, expectedReturnAt],
    queryFn: () => api.get<AvailabilityResponse>(`/availability?from=${startsAt}&to=${expectedReturnAt}`),
    enabled: open && Boolean(startsAt && expectedReturnAt),
  })

  const filledRows = rows.filter((row) => row.equipmentId && Number(row.quantity) > 0)

  const totals = useMemo(() => {
    const days = Math.max(Math.round((new Date(expectedReturnAt).getTime() - new Date(startsAt).getTime()) / 86400000), 1)
    let daily = 0
    let weight = 0
    for (const row of filledRows) {
      const equipment = equipments.find((item) => item.id === row.equipmentId)
      if (!equipment) continue
      const quantity = Number(row.quantity)
      daily += equipment.dailyRate * quantity
      weight += (equipment.weightKg ?? 0) * quantity
    }
    return { days, daily, weight, estimate: daily * days }
  }, [filledRows, equipments, startsAt, expectedReturnAt])

  const shortages = useMemo(() => {
    if (!availability) return []
    return filledRows
      .map((row) => {
        const equipment = equipments.find((item) => item.id === row.equipmentId)
        const available = availability.equipments.find((item) => item.id === row.equipmentId)?.available ?? 0
        if (!equipment) return null
        if (Number(row.quantity) <= available) return null
        return { code: equipment.code, requested: Number(row.quantity), available }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [availability, filledRows, equipments])

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/rentals', {
        customerId,
        siteName: siteName.trim() || null,
        startsAt: `${startsAt}T00:00:00.000Z`,
        expectedReturnAt: `${expectedReturnAt}T00:00:00.000Z`,
        status,
        notes: notes.trim() || null,
        depositAmount: Number(deposit.replace(',', '.')) || 0,
        items: filledRows.map((row) => ({
          equipmentId: row.equipmentId,
          quantity: Number(row.quantity),
        })),
      }),
    onSuccess: () => {
      toast.success(status === 'ACTIVE' ? 'Locação aberta' : 'Proposta registrada')
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['timeline'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
      onOpenChange(false)
      setRows([newRow()])
      setSiteName('')
      setNotes('')
      setDeposit('')
    },
    onError: (error) => {
      const details = error instanceof ApiError && Array.isArray(error.details)
        ? (error.details as Array<{ code: string; name: string; requested: number; available: number }>)
            .map((item) => `${item.code} (pedido ${item.requested}, livre ${item.available})`)
            .join(' · ')
        : null
      toast.error(error instanceof ApiError ? `${error.message}${details ? `: ${details}` : ''}` : 'Falha ao abrir locação')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Abrir locação</DialogTitle>
          <DialogDescription>
            O sistema confere a disponibilidade das peças no período antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!customerId || filledRows.length === 0) {
              toast.error('Escolha o cliente e ao menos uma peça')
              return
            }
            mutation.mutate()
          }}
        >
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <Select value={customerId} onValueChange={setCustomerId}>
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
                <FieldLabel htmlFor="site">Obra / canteiro</FieldLabel>
                <Input
                  id="site"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="Edifício Ipê — Guarapiranga"
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startsAt">Saída</FieldLabel>
                <Input
                  id="startsAt"
                  type="date"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expectedReturnAt">Devolução prevista</FieldLabel>
                <Input
                  id="expectedReturnAt"
                  type="date"
                  value={expectedReturnAt}
                  onChange={(event) => setExpectedReturnAt(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Status inicial</FieldLabel>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'QUOTED', label: 'Proposta (reserva)' },
                    { value: 'ACTIVE', label: 'Em obra (carga entregue)' },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={status === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatus(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </Field>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Peças</FieldLabel>
                <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, newRow()])}>
                  <Plus data-icon="inline-start" />
                  Adicionar peça
                </Button>
              </div>

            <Field>
              <FieldLabel htmlFor="deposit">Caução (R$)</FieldLabel>
              <Input
                id="deposit"
                inputMode="decimal"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
                placeholder="0,00"
              />
              <FieldDescription>Gera uma cobrança de caução no financeiro.</FieldDescription>
            </Field>

            <div className="flex flex-col gap-3">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={row.equipmentId}
                        onValueChange={(value) =>
                          setRows((current) =>
                            current.map((item) => (item.key === row.key ? { ...item, equipmentId: value } : item)),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha a peça" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {equipments.map((equipment) => (
                              <SelectItem key={equipment.id} value={equipment.id}>
                                {equipment.code} — {equipment.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.key === row.key ? { ...item, quantity: event.target.value } : item,
                          ),
                        )
                      }
                      className="metric w-24 text-right"
                      aria-label="Quantidade"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover peça"
                      onClick={() => setRows((current) => (current.length > 1 ? current.filter((item) => item.key !== row.key) : current))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {shortages.length > 0 ? (
                <div className="rounded-md border border-status-late/40 bg-status-late/5 p-3">
                  <p className="flex items-center gap-2 text-[13px] text-status-late">
                    <TriangleAlert className="size-4" /> Sem estoque livre para todo o período
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {shortages.map((item) => (
                      <li key={item.code} className="font-mono text-[10px] text-muted-foreground">
                        {item.code}: pedido {item.requested} · livre {item.available}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <Field>
              <FieldLabel htmlFor="rental-notes">Observações</FieldLabel>
              <Textarea
                id="rental-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Entrega com caminhão munck às 7h."
              />
            </Field>
          </FieldGroup>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatNumber(filledRows.length)} linha(s) · {totals.days} dia(s)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{formatWeight(totals.weight)} para frete</span>
            </div>
            <div className="text-right">
              <p className="label-caps text-[9px] text-muted-foreground">Estimativa do período</p>
              <p className="metric text-lg">{formatBRL(totals.estimate)}</p>
              <FieldDescription className="font-mono text-[10px]">
                {formatBRL(totals.daily)} por diária
              </FieldDescription>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Gravando…' : status === 'ACTIVE' ? 'Abrir locação' : 'Salvar proposta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
