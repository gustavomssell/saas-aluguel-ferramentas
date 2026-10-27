import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import type { Rental } from '@/lib/types'
import { formatNumber, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

type Line = {
  equipmentId: string
  code: string
  name: string
  expected: number
  checked: string
  damaged: string
  missing: string
}

function buildLines(rental: Rental): Line[] {
  return rental.items.map((item) => ({
    equipmentId: item.equipmentId,
    code: item.code,
    name: item.name,
    expected: item.quantity,
    checked: String(item.quantity),
    damaged: '0',
    missing: '0',
  }))
}

export function RentalInspectionDialog({
  rental,
  kind,
  open,
  onOpenChange,
}: {
  rental: Rental | null
  kind: 'DELIVERY' | 'RETURN'
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  // O pai remonta este diálogo a cada abertura/checklist (key), então o estado
  // inicial pode ser derivado da locação diretamente.
  const [lines, setLines] = useState<Line[]>(() => (rental ? buildLines(rental) : []))
  const [notes, setNotes] = useState('')
  const [checkedAt, setCheckedAt] = useState(todayISO)

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/rentals/${rental!.id}/inspections`, {
        kind,
        checkedAt: `${checkedAt}T12:00:00.000Z`,
        notes: notes.trim() || null,
        items: lines.map((line) => ({
          equipmentId: line.equipmentId,
          quantityChecked: Number(line.checked) || 0,
          damaged: Number(line.damaged) || 0,
          missing: Number(line.missing) || 0,
        })),
      }),
    onSuccess: () => {
      toast.success(kind === 'DELIVERY' ? 'Entrega conferida e locação ativada' : 'Devolução conferida e locação encerrada')
      if (rental) {
        void queryClient.invalidateQueries({ queryKey: ['rental', rental.id] })
      }
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['timeline'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao salvar checklist'),
  })

  const totals = lines.reduce(
    (acc, line) => ({
      expected: acc.expected + line.expected,
      checked: acc.checked + (Number(line.checked) || 0),
      damaged: acc.damaged + (Number(line.damaged) || 0),
      missing: acc.missing + (Number(line.missing) || 0),
    }),
    { expected: 0, checked: 0, damaged: 0, missing: 0 },
  )

  const invalidLines = lines.filter(
    (line) => (Number(line.checked) || 0) + (Number(line.damaged) || 0) + (Number(line.missing) || 0) > line.expected,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {kind === 'DELIVERY' ? 'Checklist de entrega' : 'Checklist de devolução'}
          </DialogTitle>
          <DialogDescription>
            {rental ? `${rental.code} · ${rental.customer.name} · confira peça por peça` : 'Carregando…'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <span>{formatNumber(totals.expected)} peça(s) previstas</span>
              <span className="text-status-available">{formatNumber(totals.checked)} em ordem</span>
              {kind === 'RETURN' ? (
                <>
                  <span className={totals.damaged ? 'text-status-late' : ''}>
                    {formatNumber(totals.damaged)} avariada(s)
                  </span>
                  <span className={totals.missing ? 'text-status-late' : ''}>
                    {formatNumber(totals.missing)} faltante(s)
                  </span>
                </>
              ) : null}
            </div>
            <Field className="w-auto">
              <FieldLabel htmlFor="inspection-date" className="sr-only">
                Data da conferência
              </FieldLabel>
              <Input
                id="inspection-date"
                type="date"
                value={checkedAt}
                onChange={(event) => setCheckedAt(event.target.value)}
                className="h-8 w-[150px]"
              />
            </Field>
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[1fr_repeat(4,58px)] items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2 sm:grid-cols-[1fr_repeat(4,72px)]">
              <span className="label-caps text-[9px] text-muted-foreground">Peça</span>
              <span className="label-caps text-center text-[9px] text-muted-foreground">Prev.</span>
              <span className="label-caps text-center text-[9px] text-muted-foreground">Ok</span>
              <span className="label-caps text-center text-[9px] text-muted-foreground">Avariada</span>
              <span className="label-caps text-center text-[9px] text-muted-foreground">Faltando</span>
            </div>
            <div className="divide-y divide-border">
              {lines.map((line, index) => (
                <div key={line.equipmentId} className="grid grid-cols-[1fr_repeat(4,58px)] items-center gap-1.5 px-3 py-2 sm:grid-cols-[1fr_repeat(4,72px)]">
                  <div className="min-w-0">
                    <p className="truncate text-[12px]">
                      <span className="metric text-[10px] text-muted-foreground">{line.code}</span> {line.name}
                    </p>
                  </div>
                  <span className="metric text-center text-xs text-muted-foreground">{line.expected}</span>
                  <Input
                    type="number"
                    min={0}
                    max={line.expected}
                    value={line.checked}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, checked: event.target.value } : item,
                        ),
                      )
                    }
                    className={cn('metric h-8 px-1 text-center')}
                    aria-label={`Peças em ordem de ${line.name}`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={line.expected}
                    value={line.damaged}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, damaged: event.target.value } : item,
                        ),
                      )
                    }
                    className={cn('metric h-8 px-1 text-center')}
                    aria-label={`Peças avariadas de ${line.name}`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={line.expected}
                    value={line.missing}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, missing: event.target.value } : item,
                        ),
                      )
                    }
                    className={cn('metric h-8 px-1 text-center')}
                    aria-label={`Peças faltantes de ${line.name}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {invalidLines.length > 0 ? (
            <p className="flex items-center gap-2 rounded-md border border-status-late/40 bg-status-late/5 px-3 py-2 text-[12px] text-status-late">
              <TriangleAlert className="size-4 shrink-0" />
              {invalidLines.length} linha(s) passam da quantidade locada. Ajuste antes de concluir.
            </p>
          ) : null}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inspection-notes">Observações</FieldLabel>
              <Textarea
                id="inspection-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={
                  kind === 'DELIVERY'
                    ? 'Carga entregue com caminhão munck às 7h.'
                    : 'Dois painéis voltaram amassados; cliente ciente.'
                }
              />
            </Field>
          </FieldGroup>

          {kind === 'RETURN' ? (
            <p className="font-mono text-[10px] text-muted-foreground">
              Avarias geram cobrança automática pelo valor de reposição. A locação é encerrada ao confirmar.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || invalidLines.length > 0 || !checkedAt}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Salvando…' : kind === 'DELIVERY' ? 'Confirmar entrega' : 'Confirmar devolução'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
