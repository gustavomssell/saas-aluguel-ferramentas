import { useMemo } from 'react'
import type { TimelineResponse } from '@/lib/types'
import { formatNumber, statusMeta } from '@/lib/format'
import { cn } from '@/lib/utils'

const LEFT_WIDTH = 268

function dayIndex(from: string, date: Date) {
  return Math.round((date.getTime() - new Date(from).getTime()) / 86400000)
}

export function TimelineGrid({
  data,
  dayWidth,
  onSelectRental,
}: {
  data: TimelineResponse
  dayWidth: number
  onSelectRental: (rentalId: string) => void
}) {
  const days = useMemo(() => data.days.map((day) => new Date(`${day}T00:00:00.000Z`)), [data.days])
  const timelineWidth = days.length * dayWidth
  const todayIndex = dayIndex(data.from, new Date(`${data.today}T00:00:00.000Z`))

  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; start: number; span: number }> = []
    days.forEach((day, index) => {
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(day)
      const last = labels[labels.length - 1]
      if (last && last.label === label) last.span += 1
      else labels.push({ label, start: index, span: 1 })
    })
    return labels
  }, [days])

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LEFT_WIDTH + timelineWidth }}>
        <div className="flex border-b border-border">
          <div
            className="sticky left-0 z-20 flex shrink-0 flex-col justify-end gap-0.5 border-r border-border bg-card px-4 py-2"
            style={{ width: LEFT_WIDTH }}
          >
            <span className="label-caps text-[10px] text-muted-foreground">Peça e estoque</span>
            <span className="font-mono text-[10px] text-muted-foreground">pico alocado / total</span>
          </div>

          <div className="relative flex-1 bg-card">
            <div className="flex border-b border-border/60">
              {monthLabels.map((month) => (
                <div
                  key={`${month.label}-${month.start}`}
                  className="label-caps border-r border-border px-2 py-1 text-[9px] text-muted-foreground"
                  style={{ width: month.span * dayWidth }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            <div className="flex">
              {days.map((day, index) => {
                const weekend = [0, 6].includes(day.getUTCDay())
                return (
                  <div
                    key={index}
                    className={cn(
                      'flex flex-col items-center gap-0.5 py-1.5',
                      weekend ? 'bg-muted/60' : 'bg-card',
                    )}
                    style={{ width: dayWidth }}
                  >
                    <span
                      className={cn(
                        'metric text-[11px]',
                        index === todayIndex ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {String(day.getUTCDate()).padStart(2, '0')}
                    </span>
                    <span className="label-caps text-[8px] text-muted-foreground/70">
                      {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][day.getUTCDay()]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {data.equipments.map((lane) => {
            const capacity = Math.max(lane.stockTotal - lane.stockMaintenance, 0)
            return (
              <div key={lane.id} className="flex">
                <div
                  className="sticky left-0 z-10 flex shrink-0 flex-col gap-0.5 border-r border-border bg-card px-4 py-2.5"
                  style={{ width: LEFT_WIDTH }}
                >
                  <span className="truncate text-[13px] text-foreground">{lane.name}</span>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>{lane.code}</span>
                    <span className="text-border">|</span>
                    <span>{lane.categoryName}</span>
                  </span>
                  <span className="metric text-[10px] text-muted-foreground">
                    {formatNumber(lane.peakLoad)} / {formatNumber(lane.stockTotal)}
                    {lane.stockMaintenance > 0 ? ` · ${lane.stockMaintenance} manut.` : ''}
                  </span>
                </div>

                <div className="relative" style={{ width: timelineWidth, height: 56 }}>
                  <div className="absolute inset-0 flex">
                    {days.map((day, index) => {
                      const weekend = [0, 6].includes(day.getUTCDay())
                      const overloaded = (lane.loadByDay[index] ?? 0) > capacity
                      return (
                        <span
                          key={index}
                          className={cn(
                            'h-full border-r border-border/50',
                            weekend ? 'bg-muted/50' : 'bg-transparent',
                            overloaded && 'bg-status-maintenance/10',
                          )}
                          style={{ width: dayWidth }}
                          title={
                            overloaded
                              ? `${formatNumber(lane.loadByDay[index])} peças alocadas acima de ${formatNumber(capacity)} disponíveis`
                              : undefined
                          }
                        />
                      )
                    })}
                  </div>

                  {todayIndex >= 0 ? (
                    <span
                      className="pointer-events-none absolute inset-y-0 w-px bg-primary"
                      style={{ left: todayIndex * dayWidth + dayWidth / 2 }}
                      aria-hidden
                    />
                  ) : null}

                  {lane.segments.map((segment) => {
                    const start = dayIndex(data.from, new Date(segment.startsAt))
                    const end = dayIndex(data.from, new Date(segment.expectedReturnAt))
                    const clampedStart = Math.max(start, 0)
                    const clampedEnd = Math.min(Math.max(end, clampedStart + 1), days.length)
                    const left = clampedStart * dayWidth
                    const width = Math.max((clampedEnd - clampedStart) * dayWidth - 4, 18)
                    const meta = statusMeta[segment.status]
                    const late = segment.status !== 'QUOTED' && end < 0

                    return (
                      <button
                        key={`${segment.rentalId}-${segment.quantity}`}
                        type="button"
                        onClick={() => onSelectRental(segment.rentalId)}
                        title={`${segment.code} · ${segment.customerName} · ${formatNumber(segment.quantity)} peças · ${segment.statusLabel}`}
                        className="absolute top-2 flex h-9 items-center gap-2 overflow-hidden rounded-sm px-2 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        style={{
                          left,
                          width,
                          background: `color-mix(in oklab, ${meta.color} 22%, var(--card))`,
                          borderLeft: `3px solid ${meta.color}`,
                          boxShadow: late ? '0 0 0 1px var(--status-maintenance)' : undefined,
                        }}
                      >
                        <span className="metric shrink-0 text-[11px] text-foreground">
                          {formatNumber(segment.quantity)}
                        </span>
                        {width > 90 ? (
                          <span className="truncate text-[11px] text-foreground/80">{segment.customerName}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
