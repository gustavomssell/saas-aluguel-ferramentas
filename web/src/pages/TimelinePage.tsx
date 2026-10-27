import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TimelineGrid } from '@/components/timeline/TimelineGrid'
import { RentalDetailSheet } from '@/components/rentals/RentalDetailSheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { api } from '@/lib/api'
import type { Category, TimelineResponse } from '@/lib/types'
import { addDaysISO, formatNumber, statusMeta, todayISO } from '@/lib/format'
import type { RentalStatus } from '@/lib/types'

const ranges = [
  { value: '14', label: '14 dias', width: 54 },
  { value: '30', label: '30 dias', width: 38 },
  { value: '60', label: '60 dias', width: 20 },
]

export function TimelinePage() {
  const [range, setRange] = useState('30')
  const [categoryId, setCategoryId] = useState('all')
  const [status, setStatus] = useState('all')
  const [zoom, setZoom] = useState(0)
  const [selectedRental, setSelectedRental] = useState<string | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const from = todayISO()
  const to = addDaysISO(Number(range))

  const query = new URLSearchParams({ from, to })
  if (categoryId !== 'all') query.set('categoryId', categoryId)
  if (status !== 'all') query.set('status', status)

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', from, to, categoryId, status],
    queryFn: () => api.get<TimelineResponse>(`/timeline?${query.toString()}`),
  })

  const baseWidth = ranges.find((item) => item.value === range)?.width ?? 38
  const dayWidth = Math.min(Math.max(baseWidth + zoom * 6, 14), 90)

  const summary = useMemo(() => {
    if (!data) return { lanes: 0, segments: 0, overloaded: 0 }
    const segments = data.equipments.reduce((total, lane) => total + lane.segments.length, 0)
    const overloaded = data.equipments.filter((lane) =>
      lane.loadByDay.some((load) => load > Math.max(lane.stockTotal - lane.stockMaintenance, 0)),
    ).length
    return { lanes: data.equipments.length, segments, overloaded }
  }, [data])

  return (
    <AppShell
      title="Timeline de disponibilidade"
      subtitle={`${from} → ${to} · ${formatNumber(summary.lanes)} linhas · ${formatNumber(summary.segments)} alocações`}
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Reduzir escala"
            onClick={() => setZoom((value) => value - 1)}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Ampliar escala"
            onClick={() => setZoom((value) => value + 1)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {ranges.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]" aria-label="Filtrar por status">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(statusMeta) as RentalStatus[])
                  .filter((key) => key !== 'RETURNED' && key !== 'CANCELLED')
                  .map((key) => (
                    <SelectItem key={key} value={key}>
                      {statusMeta[key].label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {(Object.keys(statusMeta) as RentalStatus[])
              .filter((key) => key !== 'CANCELLED')
              .map((key) => (
                <span key={key} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span className="size-2.5 rounded-[2px]" style={{ background: statusMeta[key].color }} />
                  {statusMeta[key].label}
                </span>
              ))}
            {summary.overloaded > 0 ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-status-maintenance">
                <span className="size-2.5 rounded-[2px] bg-status-maintenance/30" />
                {summary.overloaded} linha(s) acima do estoque
              </span>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {isLoading || !data ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : data.equipments.length === 0 ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>Nenhuma peça no filtro atual</EmptyTitle>
                <EmptyDescription>Troque a categoria ou o status para ver as alocações do período.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <TimelineGrid data={data} dayWidth={dayWidth} onSelectRental={setSelectedRental} />
          )}
        </div>

        <p className="font-mono text-[10px] text-muted-foreground">
          Linhas marcadas em vermelho indicam dias com mais peças alocadas do que o estoque disponível — verifique
          devoluções atrasadas antes de fechar nova proposta.
        </p>
      </div>

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
