import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { Category, Equipment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type EquipmentForm = {
  code: string
  name: string
  categoryId: string
  unit: string
  weightKg: string
  dailyRate: string
  weeklyRate: string
  monthlyRate: string
  replacementValue: string
  stockTotal: string
  stockMaintenance: string
  description: string
}

const emptyForm: EquipmentForm = {
  code: '',
  name: '',
  categoryId: '',
  unit: 'un',
  weightKg: '',
  dailyRate: '',
  weeklyRate: '',
  monthlyRate: '',
  replacementValue: '',
  stockTotal: '',
  stockMaintenance: '0',
  description: '',
}

function toForm(equipment: Equipment): EquipmentForm {
  return {
    code: equipment.code,
    name: equipment.name,
    categoryId: equipment.category.id,
    unit: equipment.unit,
    weightKg: equipment.weightKg?.toString() ?? '',
    dailyRate: equipment.dailyRate.toString(),
    weeklyRate: equipment.weeklyRate?.toString() ?? '',
    monthlyRate: equipment.monthlyRate?.toString() ?? '',
    replacementValue: equipment.replacementValue.toString(),
    stockTotal: equipment.stockTotal.toString(),
    stockMaintenance: equipment.stockMaintenance.toString(),
    description: equipment.description ?? '',
  }
}

export function EquipmentDialog({
  open,
  onOpenChange,
  categories,
  equipment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  equipment?: Equipment | null
}) {
  const queryClient = useQueryClient()
  // O diálogo é remontado pelo pai a cada abertura (key), então o estado inicial
  // já reflete a peça em edição sem precisar de efeito de sincronização.
  const [form, setForm] = useState<EquipmentForm>(() =>
    equipment ? toForm(equipment) : { ...emptyForm, categoryId: categories[0]?.id ?? '' },
  )

  function update(field: keyof EquipmentForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId,
        unit: form.unit.trim() || 'un',
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        dailyRate: Number(form.dailyRate || 0),
        weeklyRate: form.weeklyRate ? Number(form.weeklyRate) : null,
        monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null,
        replacementValue: Number(form.replacementValue || 0),
        stockTotal: Number(form.stockTotal || 0),
        stockMaintenance: Number(form.stockMaintenance || 0),
        description: form.description.trim() || null,
      }
      return equipment ? api.patch(`/equipment/${equipment.id}`, payload) : api.post('/equipment', payload)
    },
    onSuccess: () => {
      toast.success(equipment ? 'Peça atualizada' : 'Peça cadastrada no catálogo')
      void queryClient.invalidateQueries({ queryKey: ['equipment'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onOpenChange(false)
    },
    onError: (error) => {
      const detail = error instanceof ApiError && Array.isArray(error.details)
        ? (error.details as Array<{ message: string }>).map((item) => item.message).join(' · ')
        : undefined
      toast.error(error instanceof ApiError ? `${error.message}${detail ? `: ${detail}` : ''}` : 'Falha ao salvar peça')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{equipment ? 'Editar peça' : 'Nova peça no catálogo'}</DialogTitle>
          <DialogDescription>
            Preços e estoque alimentam o montador de kits e a timeline de disponibilidade.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate()
          }}
        >
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="equipment-code">Código</FieldLabel>
                <Input
                  id="equipment-code"
                  value={form.code}
                  onChange={(event) => update('code', event.target.value)}
                  placeholder="AND-P100"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipment-unit">Unidade</FieldLabel>
                <Input id="equipment-unit" value={form.unit} onChange={(event) => update('unit', event.target.value)} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="equipment-name">Nome da peça</FieldLabel>
              <Input
                id="equipment-name"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Painel de andaime 1,00 x 1,50 m"
                required
              />
            </Field>

            <Field>
              <FieldLabel>Categoria</FieldLabel>
              <Select value={form.categoryId} onValueChange={(value) => update('categoryId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="equipment-daily">Diária (R$)</FieldLabel>
                <Input
                  id="equipment-daily"
                  inputMode="decimal"
                  value={form.dailyRate}
                  onChange={(event) => update('dailyRate', event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipment-weekly">Semana (R$)</FieldLabel>
                <Input
                  id="equipment-weekly"
                  inputMode="decimal"
                  value={form.weeklyRate}
                  onChange={(event) => update('weeklyRate', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipment-monthly">Mês (R$)</FieldLabel>
                <Input
                  id="equipment-monthly"
                  inputMode="decimal"
                  value={form.monthlyRate}
                  onChange={(event) => update('monthlyRate', event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="equipment-stock">Estoque</FieldLabel>
                <Input
                  id="equipment-stock"
                  inputMode="numeric"
                  value={form.stockTotal}
                  onChange={(event) => update('stockTotal', event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipment-maintenance">Manutenção</FieldLabel>
                <Input
                  id="equipment-maintenance"
                  inputMode="numeric"
                  value={form.stockMaintenance}
                  onChange={(event) => update('stockMaintenance', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipment-weight">Peso (kg)</FieldLabel>
                <Input
                  id="equipment-weight"
                  inputMode="decimal"
                  value={form.weightKg}
                  onChange={(event) => update('weightKg', event.target.value)}
                  placeholder="12.8"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipment-replacement">Reposição (R$)</FieldLabel>
                <Input
                  id="equipment-replacement"
                  inputMode="decimal"
                  value={form.replacementValue}
                  onChange={(event) => update('replacementValue', event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="equipment-description">Observações de operação</FieldLabel>
              <Textarea
                id="equipment-description"
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Aço galvanizado, piso antiderrapante."
                rows={3}
              />
              <FieldDescription>Peso é usado no cálculo de frete do montador de kits.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando…' : equipment ? 'Salvar alterações' : 'Cadastrar peça'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
