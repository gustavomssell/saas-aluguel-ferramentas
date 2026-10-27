import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw, Ruler, Save, Trash2, TriangleAlert } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { KitElevation } from '@/components/kit/KitElevation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { api, ApiError } from '@/lib/api'
import type { AvailabilityResponse, Equipment, Kit } from '@/lib/types'
import { calculateKit, roleColors, roleLabel } from '@/lib/kitCalculator'
import { addDaysISO, formatBRL, formatDay, formatNumber, formatWeight, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

export function KitsPage() {
  const queryClient = useQueryClient()
  const [heightMeters, setHeightMeters] = useState('6')
  const [facadeMeters, setFacadeMeters] = useState('10')
  const [useWheels, setUseWheels] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [saveOpen, setSaveOpen] = useState(false)
  const [kitName, setKitName] = useState('')
  const [kitNotes, setKitNotes] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Kit | null>(null)

  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipment', 'all'],
    queryFn: () => api.get<Equipment[]>('/equipment'),
  })

  const { data: kits = [] } = useQuery({
    queryKey: ['kits'],
    queryFn: () => api.get<Kit[]>('/kits'),
  })

  const from = todayISO()
  const to = addDaysISO(30)

  const { data: availability } = useQuery({
    queryKey: ['availability', from, to],
    queryFn: () => api.get<AvailabilityResponse>(`/availability?from=${from}&to=${to}`),
  })

  const result = useMemo(
    () =>
      calculateKit(
        {
          heightMeters: Number(heightMeters.replace(',', '.')) || 0,
          facadeMeters: Number(facadeMeters.replace(',', '.')) || 0,
          useWheels,
        },
        equipments,
      ),
    [heightMeters, facadeMeters, useWheels, equipments],
  )

  const lines = useMemo(
    () =>
      result.lines.map((line) => {
        const override = overrides[line.equipmentId]
        const quantity = override ?? line.quantity
        return {
          ...line,
          quantity,
          adjusted: override !== undefined && override !== line.quantity,
          weightKg: line.unitWeightKg * quantity,
          dailyRate: line.unitDailyRate * quantity,
        }
      }),
    [result.lines, overrides],
  )

  const totals = useMemo(
    () => ({
      weight: lines.reduce((total, line) => total + line.weightKg, 0),
      daily: lines.reduce((total, line) => total + line.dailyRate, 0),
      pieces: lines.reduce((total, line) => total + line.quantity, 0),
    }),
    [lines],
  )

  const shortages = useMemo(() => {
    if (!availability) return []
    return lines
      .map((line) => {
        const row = availability.equipments.find((item) => item.id === line.equipmentId)
        if (!row) return null
        if (line.quantity <= row.available) return null
        return { code: line.code, name: line.name, requested: line.quantity, available: row.available }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [availability, lines])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/kits', {
        name: kitName.trim(),
        notes: kitNotes.trim() || null,
        heightMeters: Number(heightMeters.replace(',', '.')) || null,
        facadeMeters: Number(facadeMeters.replace(',', '.')) || null,
        items: lines.map((line) => ({ equipmentId: line.equipmentId, quantity: line.quantity })),
      }),
    onSuccess: () => {
      toast.success('Kit salvo no catálogo comercial')
      setSaveOpen(false)
      setKitName('')
      setKitNotes('')
      void queryClient.invalidateQueries({ queryKey: ['kits'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao salvar kit'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/kits/${id}`),
    onSuccess: () => {
      toast.success('Kit removido')
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['kits'] })
    },
  })

  return (
    <AppShell
      title="Montador de kits"
      subtitle="A altura e a metragem viram lista de peças, peso de frete e preço de locação"
      actions={
        <Button size="sm" onClick={() => setSaveOpen(true)} disabled={lines.length === 0}>
          <Save data-icon="inline-start" />
          Salvar kit
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <section className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Ruler className="size-4 text-primary" strokeWidth={2.2} />
              <h2 className="font-heading text-base tracking-tight">Medidas da montagem</h2>
            </div>

            <FieldGroup className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="height">Altura da torre (m)</FieldLabel>
                  <Input
                    id="height"
                    inputMode="decimal"
                    value={heightMeters}
                    onChange={(event) => setHeightMeters(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="facade">Fachada (m)</FieldLabel>
                  <Input
                    id="facade"
                    inputMode="decimal"
                    value={facadeMeters}
                    onChange={(event) => setFacadeMeters(event.target.value)}
                  />
                </Field>
              </div>

              <Field orientation="horizontal" className="justify-between rounded-md border border-border px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="wheels">Montagem com rodízios</FieldLabel>
                  <FieldDescription>Substitui as sapatas ajustáveis por rodas com freio.</FieldDescription>
                </div>
                <input
                  id="wheels"
                  type="checkbox"
                  checked={useWheels}
                  onChange={(event) => setUseWheels(event.target.checked)}
                  className="size-5 accent-[var(--primary)]"
                />
              </Field>
            </FieldGroup>

            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
              {[
                { label: 'Vãos calculados', value: `${result.bays} × 1,50 m` },
                { label: 'Níveis', value: `${result.levels} × 1,50 m` },
                { label: 'Altura real', value: `${result.towerHeight.toFixed(2)} m` },
                { label: 'Plataforma', value: `${result.platformArea.toFixed(2)} m²` },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 bg-card px-3 py-2.5">
                  <dt className="label-caps text-[9px] text-muted-foreground">{item.label}</dt>
                  <dd className="metric text-sm">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-base tracking-tight">Resumo da proposta</h2>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Peças no kit</span>
                <span className="metric text-lg">{formatNumber(totals.pieces)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Peso para frete</span>
                <span className="metric text-lg">{formatWeight(totals.weight)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">Locação por dia</span>
                <span className="metric text-xl text-foreground">{formatBRL(totals.daily)}</span>
              </div>
            </div>

            {shortages.length > 0 ? (
              <div className="mt-4 rounded-md border border-status-late/40 bg-status-late/5 p-3">
                <p className="flex items-center gap-2 text-[13px] text-status-late">
                  <TriangleAlert className="size-4" /> Estoque insuficiente nos próximos 30 dias
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {shortages.map((item) => (
                    <li key={item.code} className="font-mono text-[10px] text-muted-foreground">
                      {item.code}: pedido {item.requested} · livre {item.available}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 font-mono text-[10px] text-status-available">
                Estoque livre de {formatDay(from)} a {formatDay(to)}
              </p>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-6">
          <div className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <div>
                <h2 className="font-heading text-base tracking-tight">Elevação sugerida</h2>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {result.bays} vão(s) × {result.levels} nível(is) · cotas em metros
                </p>
              </div>
              {Object.keys(overrides).length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setOverrides({})}>
                  <RotateCcw data-icon="inline-start" />
                  Voltar ao cálculo
                </Button>
              ) : null}
            </header>
            <div className="px-3 py-4 sm:px-5">
              {isLoading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <KitElevation result={result} />
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-heading text-base tracking-tight">Lista de peças</h2>
              <p className="font-mono text-[10px] text-muted-foreground">quantidades editáveis antes de salvar</p>
            </header>
            {result.warnings.length > 0 ? (
              <div className="border-b border-border bg-accent/40 px-5 py-2">
                {result.warnings.map((warning) => (
                  <p key={warning} className="font-mono text-[10px] text-accent-foreground">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
            <ul className="divide-y divide-border">
              {lines.map((line) => (
                <li key={line.equipmentId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span
                    className="size-3 shrink-0 rounded-[2px]"
                    style={{ background: roleColors[line.role] }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-foreground">
                      <span className="metric text-xs text-muted-foreground">{line.code}</span> {line.name}
                    </p>
                    <p
                      className="truncate font-mono text-[10px] text-muted-foreground"
                      title={`${roleLabel(line.role)} · ${line.rule} · ${formatBRL(line.unitDailyRate)}/peça`}
                    >
                      {roleLabel(line.role)} · {line.rule} · {formatBRL(line.unitDailyRate)}/peça
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {line.adjusted ? <Badge variant="secondary">ajustado</Badge> : null}
                    <Input
                      type="number"
                      min={0}
                      value={line.quantity}
                      onChange={(event) =>
                        setOverrides((current) => ({
                          ...current,
                          [line.equipmentId]: Number(event.target.value),
                        }))
                      }
                      className={cn('metric h-8 w-20 text-right')}
                      aria-label={`Quantidade de ${line.name}`}
                    />
                  </div>
                  <span className="metric w-24 text-right text-[11px] text-muted-foreground">
                    {formatWeight(line.weightKg)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="font-heading text-base tracking-tight">Kits salvos</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            composições prontas para reaproveitar em propostas
          </p>
        </header>

        {kits.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>Nenhum kit salvo ainda</EmptyTitle>
              <EmptyDescription>Monte uma torre acima e salve para reaproveitar depois.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {kits.map((kit) => (
              <li key={kit.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground">{kit.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {kit.heightMeters ? `${kit.heightMeters} m de altura` : 'altura livre'}
                    {kit.facadeMeters ? ` · ${kit.facadeMeters} m de fachada` : ''} · {kit.items.length} itens ·{' '}
                    {formatWeight(kit.totalWeightKg)}
                  </p>
                </div>
                <span className="metric text-sm">{formatBRL(kit.estimatedDailyRate)}/dia</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${kit.name}`}
                  onClick={() => setDeleteTarget(kit)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Salvar kit</DialogTitle>
            <DialogDescription>
              {formatNumber(totals.pieces)} peças · {formatWeight(totals.weight)} · {formatBRL(totals.daily)} por dia
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="kit-name">Nome do kit</FieldLabel>
                <Input
                  id="kit-name"
                  value={kitName}
                  onChange={(event) => setKitName(event.target.value)}
                  placeholder="Torre 6 m — fachada 10 m"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="kit-notes">Observações</FieldLabel>
                <Textarea
                  id="kit-notes"
                  value={kitNotes}
                  onChange={(event) => setKitNotes(event.target.value)}
                  rows={3}
                  placeholder="Usar sapata ajustável no terreno inclinado."
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !kitName.trim()}>
                {saveMutation.isPending ? 'Salvando…' : 'Salvar kit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Remover kit</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.name}” sai do catálogo comercial. Propostas já criadas não são afetadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Removendo…' : 'Remover kit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
