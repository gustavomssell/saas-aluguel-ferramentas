import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, CalendarClock, Truck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import type { Dashboard } from '@/lib/types'
import { formatBRL, formatDay, formatNumber, statusMeta } from '@/lib/format'
import { cn } from '@/lib/utils'

function LoadBar({ value, total }: { value: number; total: number }) {
  const safeTotal = total || 1
  const filled = Math.round((value / safeTotal) * 40)
  return (
    <div className="flex items-end gap-[2px]" aria-hidden>
      {Array.from({ length: 40 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-[1px]',
            index % 5 === 4 ? 'h-5' : 'h-3.5',
            index < filled ? 'bg-primary' : 'bg-foreground/10',
          )}
        />
      ))}
    </div>
  )
}

function Readout({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-1 first:pl-0">
      <span className="label-caps text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('metric text-2xl leading-none', tone ?? 'text-foreground')}>{value}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>
    </div>
  )
}

const attentionTone = {
  LATE: { icon: AlertTriangle, label: 'Atrasada', className: 'text-status-maintenance' },
  PENDING: { icon: Truck, label: 'Devolução pendente', className: 'text-status-late' },
  UPCOMING: { icon: CalendarClock, label: 'Devolução próxima', className: 'text-status-active' },
} as const

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/dashboard'),
  })

  const stock = data?.stock

  return (
    <AppShell
      title="Visão geral do pátio"
      subtitle={data ? `Atualizado em ${formatDay(data.generatedAt)} · Locadora Horizonte` : 'Carregando indicadores…'}
      actions={
        <Button asChild size="sm">
          <Link to="/locacoes">
            Abrir locação
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-3">
              <span className="label-caps text-[10px] text-muted-foreground">Ocupação do pátio</span>
              {isLoading || !stock ? (
                <Skeleton className="h-14 w-56" />
              ) : (
                <div className="flex items-end gap-3">
                  <span className="metric text-5xl leading-none tracking-tight">{formatNumber(stock.utilization, 1)}%</span>
                  <span className="pb-1 font-mono text-[11px] text-muted-foreground">
                    {formatNumber(stock.unitsInField)} de {formatNumber(stock.unitsTotal)} peças fora do galpão
                  </span>
                </div>
              )}
              {stock ? <LoadBar value={stock.unitsInField} total={stock.unitsTotal} /> : null}
            </div>

            <div className="flex flex-wrap divide-x divide-border">
              <Readout
                label="Disponíveis hoje"
                value={stock ? formatNumber(stock.unitsAvailable) : '—'}
                hint="prontas para sair"
              />
              <Readout
                label="Em manutenção"
                value={stock ? formatNumber(stock.unitsMaintenance) : '—'}
                hint="bloqueadas no galpão"
                tone="text-status-maintenance"
              />
              <Readout
                label="Locações abertas"
                value={data ? formatNumber(data.counts.openRentals) : '—'}
                hint={data ? `${formatNumber(data.counts.pendingReturns)} com devolução pendente` : ''}
              />
              <Readout
                label="Previsão 30 dias"
                value={data ? formatBRL(data.revenueNext30Days) : '—'}
                hint="receita contratada em curso"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section className="flex flex-col rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="font-heading text-base tracking-tight">Exige ação no pátio</h2>
                <p className="font-mono text-[10px] text-muted-foreground">
                  atrasos, devoluções pendentes e retornos dos próximos 7 dias
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/timeline">Ver timeline</Link>
              </Button>
            </header>

            <div className="flex flex-col divide-y divide-border">
              {isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="px-5 py-3">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))
                : data?.attention.map((item) => {
                    const tone = attentionTone[item.kind]
                    const late = item.kind === 'LATE'
                    return (
                      <div key={`${item.kind}-${item.id}`} className="flex items-center gap-4 px-5 py-3">
                        <tone.icon className={cn('size-4 shrink-0', tone.className)} strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            <span className="metric text-xs text-muted-foreground">{item.code}</span>{' '}
                            {item.customerName}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {item.siteName ?? 'sem obra informada'} · {formatNumber(item.quantity)} peças
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn('metric text-sm', tone.className)}>{tone.label}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {late ? `venceu ${formatDay(item.expectedReturnAt)}` : `volta ${formatDay(item.expectedReturnAt)}`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
              {!isLoading && (data?.attention.length ?? 0) === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhum atraso ou devolução pendente agora.
                </p>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col rounded-lg border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-heading text-base tracking-tight">Carga por categoria</h2>
              <p className="font-mono text-[10px] text-muted-foreground">alocação sobre o estoque cadastrado</p>
            </header>
            <div className="flex flex-col gap-4 px-5 py-4">
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)
                : data?.categories
                    .slice()
                    .sort((a, b) => b.utilization - a.utilization)
                    .map((category) => (
                      <div key={category.id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] text-foreground">{category.name}</span>
                          <span className="metric text-xs text-muted-foreground">
                            {formatNumber(category.inField)}/{formatNumber(category.units)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(category.utilization, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
            </div>
            <footer className="mt-auto flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-3">
              {data?.statusCounts.map((row) => (
                <span key={row.status} className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="size-2 rounded-[2px]" style={{ background: statusMeta[row.status].color }} />
                  {row.label} · {row.count}
                </span>
              ))}
            </footer>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
