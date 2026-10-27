import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  Camera,
  ClipboardCheck,
  ClipboardList,
  ImageOff,
  Minus,
  Package,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthContext'
import type { Equipment, EquipmentHistoryEntry, StockMovement } from '@/lib/types'
import { formatBRL, formatDay, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const toneStyles: Record<EquipmentHistoryEntry['tone'], string> = {
  neutral: 'bg-foreground/30',
  positive: 'bg-status-available',
  negative: 'bg-status-late',
  warning: 'bg-status-maintenance',
}

const kindIcons = {
  STOCK: Package,
  RENTAL: ClipboardList,
  INSPECTION: ClipboardCheck,
} as const

async function fileToDataUrl(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponível')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  let quality = 0.85
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length * 0.75 > 580_000 && quality > 0.5) {
    quality -= 0.1
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  return dataUrl
}

function Readout({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <span className="label-caps text-[10px] text-muted-foreground">{label}</span>
      <span className="metric text-base leading-none">{value}</span>
      {hint ? <span className="font-mono text-[10px] text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export function EquipmentSheet({
  equipment,
  open,
  onOpenChange,
}: {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const canManage = session?.organization.role === 'OWNER' || session?.organization.role === 'ADMIN'
  const fileInput = useRef<HTMLInputElement>(null)

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [kind, setKind] = useState<'ADJUSTMENT' | 'MAINTENANCE'>('ADJUSTMENT')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')

  const equipmentId = equipment?.id ?? null

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['equipment-history', equipmentId],
    queryFn: () => api.get<{ entries: EquipmentHistoryEntry[] }>(`/equipment/${equipmentId}/history`),
    enabled: Boolean(equipmentId) && open,
  })

  const { data: movements = [] } = useQuery({
    queryKey: ['equipment-movements', equipmentId],
    queryFn: () => api.get<StockMovement[]>(`/equipment/${equipmentId}/movements`),
    enabled: Boolean(equipmentId) && open,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['equipment'] })
    void queryClient.invalidateQueries({ queryKey: ['equipment-history', equipmentId] })
    void queryClient.invalidateQueries({ queryKey: ['equipment-movements', equipmentId] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const photoMutation = useMutation({
    mutationFn: (dataUrl: string) => api.post<{ imageUrl: string }>(`/equipment/${equipmentId}/photo`, { dataUrl }),
    onSuccess: () => {
      toast.success('Foto atualizada')
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao enviar foto'),
  })

  const removePhotoMutation = useMutation({
    mutationFn: () => api.delete(`/equipment/${equipmentId}/photo`),
    onSuccess: () => {
      toast.success('Foto removida')
      invalidate()
    },
    onError: () => toast.error('Não foi possível remover a foto'),
  })

  const stockMutation = useMutation({
    mutationFn: () =>
      api.post(`/equipment/${equipmentId}/stock`, {
        kind,
        delta: Number(quantity) * (direction === 'in' ? 1 : -1),
        note,
      }),
    onSuccess: () => {
      toast.success(kind === 'ADJUSTMENT' ? 'Estoque ajustado' : 'Manutenção atualizada')
      setAdjustOpen(false)
      setQuantity('1')
      setNote('')
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao ajustar estoque'),
  })

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      photoMutation.mutate(dataUrl)
    } catch {
      toast.error('Não foi possível processar a imagem')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (!equipment) return null

  const ready = Math.max(equipment.stockTotal - equipment.stockMaintenance, 0)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="gap-1 border-b border-border px-5 py-4 pr-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {equipment.category.name} · {equipment.code}
            </span>
            <SheetTitle className="font-heading text-xl tracking-tight">{equipment.name}</SheetTitle>
            <SheetDescription className="font-mono text-[10px]">
              {equipment.brand ?? 'marca não informada'} · unidade {equipment.unit}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
              <div className="relative overflow-hidden rounded-lg border border-border bg-secondary">
                {equipment.imageUrl ? (
                  <img
                    src={equipment.imageUrl}
                    alt={equipment.name}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                    <ImageOff className="size-6 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-muted-foreground">sem foto cadastrada</span>
                  </div>
                )}
                {canManage ? (
                  <div className="absolute bottom-2 left-2 flex gap-2">
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => void handleFile(event.target.files?.[0])}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={photoMutation.isPending}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Camera data-icon="inline-start" />
                      {photoMutation.isPending ? 'Enviando…' : equipment.imageUrl ? 'Trocar foto' : 'Adicionar foto'}
                    </Button>
                    {equipment.imageUrl ? (
                      <Button
                        size="icon"
                        variant="secondary"
                        aria-label="Remover foto"
                        disabled={removePhotoMutation.isPending}
                        onClick={() => removePhotoMutation.mutate()}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-1">
                  <span className="label-caps text-[10px] text-muted-foreground">Disponível hoje</span>
                  <span
                    className={cn(
                      'metric text-3xl leading-none',
                      equipment.availableToday > 0 ? 'text-status-available' : 'text-status-maintenance',
                    )}
                  >
                    {formatNumber(equipment.availableToday)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    de {formatNumber(ready)} prontas
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
                  <span className="flex justify-between">
                    <span>fora do galpão</span>
                    <span className="text-foreground">{formatNumber(equipment.reservedToday)}</span>
                  </span>
                  <span className="flex justify-between">
                    <span>em manutenção</span>
                    <span className="text-foreground">{formatNumber(equipment.stockMaintenance)}</span>
                  </span>
                  <span className="flex justify-between">
                    <span>estoque total</span>
                    <span className="text-foreground">{formatNumber(equipment.stockTotal)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-lg border border-border sm:grid-cols-4 sm:divide-y-0">
              <Readout label="Diária" value={formatBRL(equipment.dailyRate)} />
              <Readout
                label="Semanal"
                value={equipment.weeklyRate ? formatBRL(equipment.weeklyRate) : '—'}
              />
              <Readout
                label="Mensal"
                value={equipment.monthlyRate ? formatBRL(equipment.monthlyRate) : '—'}
              />
              <Readout label="Reposição" value={formatBRL(equipment.replacementValue)} />
            </div>

            {equipment.description ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">{equipment.description}</p>
            ) : null}

            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setKind('ADJUSTMENT')
                    setDirection('in')
                    setAdjustOpen(true)
                  }}
                >
                  <Boxes data-icon="inline-start" />
                  Ajustar estoque
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setKind('MAINTENANCE')
                    setDirection('in')
                    setAdjustOpen(true)
                  }}
                >
                  <Wrench data-icon="inline-start" />
                  Enviar para manutenção
                </Button>
              </div>
            ) : null}

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-heading text-sm tracking-tight">Histórico da peça</h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {history ? `${history.entries.length} registros` : '…'}
                </span>
              </div>

              {historyLoading || !history ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : history.entries.length ? (
                <ol className="flex flex-col">
                  {history.entries.map((entry, index) => {
                    const Icon = kindIcons[entry.kind]
                    return (
                      <li key={entry.id} className="relative flex gap-3 pb-4">
                        {index < history.entries.length - 1 ? (
                          <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border" />
                        ) : null}
                        <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                          <Icon className="size-3.5 text-muted-foreground" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] text-foreground">{entry.title}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {formatDay(entry.date)}
                            </span>
                          </div>
                          {entry.detail ? (
                            <span className="text-[11px] leading-relaxed text-muted-foreground">{entry.detail}</span>
                          ) : null}
                        </div>
                        <span
                          className={cn('mt-2 size-1.5 shrink-0 rounded-full', toneStyles[entry.tone])}
                          aria-hidden
                        />
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center font-mono text-[10px] text-muted-foreground">
                  sem movimentações registradas
                </p>
              )}
            </section>

            {movements.length ? (
              <section className="flex flex-col gap-2">
                <h3 className="font-heading text-sm tracking-tight">Últimos ajustes de estoque</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {movements.slice(0, 6).map((movement) => (
                    <li key={movement.id} className="flex items-center gap-3 px-3 py-2">
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-sm',
                          movement.delta > 0 ? 'bg-status-available/15' : 'bg-status-late/15',
                        )}
                      >
                        {movement.delta > 0 ? (
                          <Plus className="size-3.5 text-status-available" />
                        ) : (
                          <Minus className="size-3.5 text-status-late" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px]">{movement.note}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {movement.kind === 'MAINTENANCE' ? 'manutenção' : 'ajuste'} · saldo{' '}
                          {formatNumber(movement.balance)} · {formatDay(movement.createdAt)}
                          {movement.createdByName ? ` · ${movement.createdByName}` : ''}
                        </p>
                      </div>
                      <span className="metric shrink-0 text-xs">
                        {movement.delta > 0 ? '+' : ''}
                        {formatNumber(movement.delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {kind === 'ADJUSTMENT' ? 'Ajustar estoque' : 'Movimentar manutenção'}
            </DialogTitle>
            <DialogDescription>
              {kind === 'ADJUSTMENT'
                ? 'Corrija o estoque total após compra, perda ou inventário. O ajuste entra no histórico da peça.'
                : 'Envie peças para revisão ou devolva as revisadas ao estoque disponível.'}
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const value = Number(quantity)
              if (!Number.isInteger(value) || value <= 0) {
                toast.error('Informe uma quantidade inteira maior que zero')
                return
              }
              if (note.trim().length < 3) {
                toast.error('Descreva o motivo da movimentação')
                return
              }
              stockMutation.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel>Sentido</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      [
                        'in',
                        kind === 'ADJUSTMENT' ? 'Adicionar ao estoque' : 'Enviar para manutenção',
                      ],
                      [
                        'out',
                        kind === 'ADJUSTMENT' ? 'Baixar do estoque' : 'Retornar ao estoque',
                      ],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={direction === value}
                      onClick={() => setDirection(value)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-left text-[12px] transition-colors',
                        direction === value
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="stock-quantity">Quantidade</FieldLabel>
                  <Input
                    id="stock-quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-note">Motivo</FieldLabel>
                  <Input
                    id="stock-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={kind === 'ADJUSTMENT' ? 'Compra NF 8842' : 'Revisão de solda'}
                    required
                  />
                </Field>
              </div>
            </FieldGroup>

            <p className="font-mono text-[10px] text-muted-foreground">
              saldo após a operação:{' '}
              {formatNumber(
                kind === 'ADJUSTMENT'
                  ? equipment.stockTotal + Number(quantity || 0) * (direction === 'in' ? 1 : -1)
                  : equipment.stockMaintenance + Number(quantity || 0) * (direction === 'in' ? 1 : -1),
              )}{' '}
              un. ({kind === 'ADJUSTMENT' ? 'estoque total' : 'em manutenção'})
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={stockMutation.isPending}>
                {stockMutation.isPending ? 'Salvando…' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
