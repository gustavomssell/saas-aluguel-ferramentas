import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, Boxes, History, MoreHorizontal, Pencil, Plus, Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { EquipmentDialog } from '@/components/catalog/EquipmentDialog'
import { EquipmentSheet } from '@/components/catalog/EquipmentSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { api, ApiError } from '@/lib/api'
import type { Category, Equipment } from '@/lib/types'
import { formatBRL, formatNumber, formatWeight } from '@/lib/format'
import { cn } from '@/lib/utils'

function StockCell({ equipment, wide }: { equipment: Equipment; wide?: boolean }) {
  const ready = Math.max(equipment.stockTotal - equipment.stockMaintenance, 0)
  const segments = [
    { value: equipment.reservedToday, className: 'bg-status-active' },
    { value: equipment.stockMaintenance, className: 'bg-status-maintenance' },
    { value: Math.max(ready - equipment.reservedToday, 0), className: 'bg-status-available' },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn('flex h-2 overflow-hidden rounded-sm bg-foreground/10', wide ? 'w-full' : 'w-28')}>
        {segments.map((segment, index) => (
          <span
            key={index}
            className={cn('h-full', segment.className)}
            style={{ width: `${(segment.value / Math.max(equipment.stockTotal, 1)) * 100}%` }}
          />
        ))}
      </div>
      <span className="metric text-[11px] text-muted-foreground">
        {formatNumber(equipment.stockTotal)} total · {formatNumber(equipment.reservedToday)} fora ·{' '}
        {formatNumber(equipment.stockMaintenance)} manut.
      </span>
    </div>
  )
}

function EquipmentMenu({
  equipment,
  onDetail,
  onEdit,
  onArchive,
}: {
  equipment: Equipment
  onDetail: () => void
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Ações de ${equipment.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDetail}>
          <History className="size-4" />
          Foto e histórico
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="size-4" />
          Editar peça
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onArchive}>
          <Archive className="size-4" />
          Arquivar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CatalogPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [detail, setDetail] = useState<Equipment | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipment', categoryId],
    queryFn: () => api.get<Equipment[]>(`/equipment${categoryId === 'all' ? '' : `?categoryId=${categoryId}`}`),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return equipments
    return equipments.filter(
      (equipment) =>
        equipment.name.toLowerCase().includes(term) || equipment.code.toLowerCase().includes(term),
    )
  }, [equipments, search])

  const totals = useMemo(
    () =>
      filtered.reduce(
        (accumulator, equipment) => ({
          units: accumulator.units + equipment.stockTotal,
          inField: accumulator.inField + equipment.reservedToday,
          available: accumulator.available + equipment.availableToday,
          maintenance: accumulator.maintenance + equipment.stockMaintenance,
          weight: accumulator.weight + (equipment.weightKg ?? 0) * equipment.stockTotal,
        }),
        { units: 0, inField: 0, available: 0, maintenance: 0, weight: 0 },
      ),
    [filtered],
  )

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/equipment/${id}`),
    onSuccess: () => {
      toast.success('Peça arquivada do catálogo')
      void queryClient.invalidateQueries({ queryKey: ['equipment'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error('Não foi possível arquivar a peça'),
  })

  const categoryMutation = useMutation({
    mutationFn: () => api.post('/categories', { name: categoryName }),
    onSuccess: () => {
      toast.success('Categoria criada')
      setCategoryName('')
      setCategoryOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao criar categoria'),
  })

  const detailEquipment = detail ? (equipments.find((item) => item.id === detail.id) ?? detail) : null

  return (
    <AppShell
      title="Catálogo e estoque"
      subtitle={`${filtered.length} linhas · ${formatNumber(totals.units)} peças cadastradas`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)}>
            Nova categoria
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus data-icon="inline-start" />
            Nova peça
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por peça ou código"
              className="pl-9"
              aria-label="Buscar peça"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[220px]" aria-label="Filtrar por categoria">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {[
            { label: 'Peças totais', value: formatNumber(totals.units) },
            { label: 'Fora do galpão hoje', value: formatNumber(totals.inField) },
            { label: 'Disponíveis', value: formatNumber(totals.available) },
            { label: 'Em manutenção', value: formatNumber(totals.maintenance) },
            { label: 'Peso em estoque', value: formatWeight(totals.weight) },
          ].map((item) => (
            <div
              key={item.label}
              className={cn('flex flex-col gap-1 px-4 py-3', item.label === 'Peso em estoque' && 'col-span-2 sm:col-span-1')}
            >
              <span className="label-caps text-[10px] text-muted-foreground">{item.label}</span>
              <span className="metric text-lg">{item.value}</span>
            </div>
          ))}
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
                <EmptyTitle>Nenhuma peça encontrada</EmptyTitle>
                <EmptyDescription>
                  Ajuste a busca ou cadastre a primeira peça deste catálogo.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border lg:hidden">
                {filtered.map((equipment) => (
                  <div key={equipment.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDetail(equipment)
                          setSheetOpen(true)
                        }}
                        className="group/photo relative size-12 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary"
                        aria-label={`Abrir ficha de ${equipment.name}`}
                      >
                        {equipment.imageUrl ? (
                          <img src={equipment.imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center">
                            <Boxes className="size-5 text-muted-foreground" />
                          </span>
                        )}
                      </button>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <button
                          type="button"
                          onClick={() => {
                            setDetail(equipment)
                            setSheetOpen(true)
                          }}
                          className="truncate text-left text-sm text-foreground hover:underline hover:decoration-primary hover:underline-offset-4"
                        >
                          {equipment.name}
                        </button>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {equipment.code} · {equipment.category.name}
                        </span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {equipment.weightKg ? `${formatWeight(equipment.weightKg)} por peça` : 'peso não informado'}
                          {equipment.brand ? ` · ${equipment.brand}` : ''}
                        </span>
                      </div>
                      <EquipmentMenu
                        equipment={equipment}
                        onDetail={() => {
                          setDetail(equipment)
                          setSheetOpen(true)
                        }}
                        onEdit={() => {
                          setEditing(equipment)
                          setDialogOpen(true)
                        }}
                        onArchive={() => archiveMutation.mutate(equipment.id)}
                      />
                    </div>

                    <StockCell equipment={equipment} wide />

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="label-caps text-[9px] text-muted-foreground">Disponível</span>
                        <span
                          className={cn(
                            'metric text-sm',
                            equipment.availableToday === 0 ? 'text-status-maintenance' : 'text-status-available',
                          )}
                        >
                          {formatNumber(equipment.availableToday)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="label-caps text-[9px] text-muted-foreground">Diária</span>
                        <span className="metric text-sm">{formatBRL(equipment.dailyRate)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="label-caps text-[9px] text-muted-foreground">Reposição</span>
                        <span className="metric text-sm text-muted-foreground">
                          {formatBRL(equipment.replacementValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead>Peça</TableHead>
                    <TableHead className="w-[150px]">Categoria</TableHead>
                    <TableHead className="w-[240px]">Estoque</TableHead>
                    <TableHead className="w-[110px] text-right">Disponível</TableHead>
                    <TableHead className="w-[130px] text-right">Diária</TableHead>
                    <TableHead className="w-[130px] text-right">Reposição</TableHead>
                    <TableHead className="w-[52px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((equipment) => (
                    <TableRow key={equipment.id} className="group">
                      <TableCell className="metric text-xs text-muted-foreground">{equipment.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setDetail(equipment)
                              setSheetOpen(true)
                            }}
                            className="group/photo relative size-10 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary"
                            aria-label={`Abrir ficha de ${equipment.name}`}
                          >
                            {equipment.imageUrl ? (
                              <img
                                src={equipment.imageUrl}
                                alt=""
                                className="size-full object-cover transition-transform group-hover/photo:scale-105"
                              />
                            ) : (
                              <span className="flex size-full items-center justify-center">
                                <Boxes className="size-4 text-muted-foreground" />
                              </span>
                            )}
                          </button>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => {
                                setDetail(equipment)
                                setSheetOpen(true)
                              }}
                              className="text-left text-[13px] text-foreground hover:underline hover:decoration-primary hover:underline-offset-4"
                            >
                              {equipment.name}
                            </button>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {equipment.weightKg ? `${formatWeight(equipment.weightKg)} por peça` : 'peso não informado'}
                              {equipment.brand ? ` · ${equipment.brand}` : ''}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{equipment.category.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <StockCell equipment={equipment} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'metric text-sm',
                            equipment.availableToday === 0 ? 'text-status-maintenance' : 'text-status-available',
                          )}
                        >
                          {formatNumber(equipment.availableToday)}
                        </span>
                      </TableCell>
                      <TableCell className="metric text-right text-sm">{formatBRL(equipment.dailyRate)}</TableCell>
                      <TableCell className="metric text-right text-sm text-muted-foreground">
                        {formatBRL(equipment.replacementValue)}
                      </TableCell>
                      <TableCell>
                        <EquipmentMenu
                          equipment={equipment}
                          onDetail={() => {
                            setDetail(equipment)
                            setSheetOpen(true)
                          }}
                          onEdit={() => {
                            setEditing(equipment)
                            setDialogOpen(true)
                          }}
                          onArchive={() => archiveMutation.mutate(equipment.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </div>
      </div>

      <EquipmentDialog
        key={`${dialogOpen ? 'open' : 'closed'}-${editing?.id ?? 'new'}-${categories[0]?.id ?? 'loading'}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        equipment={editing}
      />

      <EquipmentSheet equipment={detailEquipment} open={sheetOpen} onOpenChange={setSheetOpen} />

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova categoria</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              categoryMutation.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="category-name">Nome</FieldLabel>
                <Input
                  id="category-name"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Escoramento"
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={categoryMutation.isPending}>
                {categoryMutation.isPending ? 'Criando…' : 'Criar categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
