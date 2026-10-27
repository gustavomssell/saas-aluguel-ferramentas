import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Gauge, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { BillingChart } from '@/components/finance/BillingChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { ReportsResponse } from '@/lib/types'
import { addDaysISO, formatBRL, formatDay, formatNumber, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

type Preset = '30' | '90' | 'year' | 'custom'

function presetRange(preset: Preset): { from: string; to: string } {
  const to = todayISO()
  if (preset === '30') return { from: addDaysISO(-29), to }
  if (preset === '90') return { from: addDaysISO(-89), to }
  if (preset === 'year') return { from: `${to.slice(0, 4)}-01-01`, to }
  return { from: `${to.slice(0, 4)}-01-01`, to }
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-3 sm:px-4">
      <span className="label-caps text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('metric text-lg leading-none sm:text-2xl', tone ?? 'text-foreground')}>{value}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>
    </div>
  )
}

function RankingRow({
  label,
  sublabel,
  value,
  share,
  suffix,
}: {
  label: string
  sublabel: string
  value: string
  share: number
  suffix?: string
}) {
  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] text-foreground">{label}</span>
        <span className="metric shrink-0 text-xs">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share * 100, 2)}%` }} />
        </div>
        <span className="w-24 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
          {suffix ?? sublabel}
        </span>
      </div>
    </li>
  )
}

export function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('90')
  const [range, setRange] = useState(() => presetRange('90'))

  const { data, isLoading } = useQuery({
    queryKey: ['reports', range.from, range.to],
    queryFn: () => api.get<ReportsResponse>(`/reports?from=${range.from}&to=${range.to}`),
  })

  function applyPreset(next: Preset) {
    setPreset(next)
    setRange(presetRange(next))
  }

  const kpis = data?.kpis
  const maxEquipment = Math.max(...(data?.topEquipment.map((item) => item.revenue) ?? [1]), 1)
  const maxCustomer = Math.max(...(data?.topCustomers.map((item) => item.revenue) ?? [1]), 1)
  const settleRate = kpis && kpis.billed > 0 ? Math.round((kpis.received / kpis.billed) * 100) : 0

  const csv = useMemo(() => {
    if (!data) return ''
    const lines: string[][] = [
      ['Relatório Canteiro'],
      ['Período', data.range.from.slice(0, 10), data.range.to.slice(0, 10)],
      [],
      ['Indicador', 'Valor'],
      ['Faturado', String(data.kpis.billed)],
      ['Recebido', String(data.kpis.received)],
      ['Em aberto', String(data.kpis.openAmount)],
      ['Vencido', String(data.kpis.overdueAmount)],
      ['Receita de locações no período', String(data.kpis.rentalRevenue)],
      ['Locações', String(data.kpis.rentalCount)],
      ['Ticket médio', String(data.kpis.avgTicket)],
      ['Ocupação média (%)', String(data.kpis.utilization)],
      ['Unidades em campo', String(data.kpis.unitsOut)],
      ['Devoluções atrasadas', String(data.kpis.lateCount)],
      [],
      ['Mês', 'Faturado', 'Recebido'],
      ...data.series.map((row) => [row.month, String(row.billed), String(row.received)]),
      [],
      ['Equipamento', 'Código', 'Categoria', 'Unidades', 'Receita'],
      ...data.topEquipment.map((item) => [
        item.name,
        item.code,
        item.categoryName,
        String(item.quantity),
        String(item.revenue),
      ]),
      [],
      ['Cliente', 'Locações', 'Receita'],
      ...data.topCustomers.map((item) => [item.name, String(item.rentals), String(item.revenue)]),
      [],
      ['Categoria', 'Receita', 'Participação (%)'],
      ...data.categoryMix.map((item) => [item.name, String(item.revenue), String(item.share)]),
    ]
    return lines
      .map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';'))
      .join('\r\n')
  }, [data])

  function exportCsv() {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `canteiro-relatorio-${range.from}-a-${range.to}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="Relatórios"
      subtitle="Faturamento, ocupação e mix da operação por período"
      actions={
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}>
          <Download data-icon="inline-start" />
          Exportar CSV
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-3">
            <div className="flex flex-col gap-1">
              <span className="label-caps text-[10px] text-muted-foreground">Período do relatório</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-sm border border-border p-0.5">
                  {(
                    [
                      ['30', '30 dias'],
                      ['90', '90 dias'],
                      ['year', 'Este ano'],
                    ] as Array<[Preset, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => applyPreset(value)}
                      className={cn(
                        'rounded-[2px] px-2.5 py-1 font-mono text-[11px] transition-colors',
                        preset === value
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">ou</span>
                <Input
                  type="date"
                  value={range.from}
                  onChange={(event) => {
                    setPreset('custom')
                    setRange((current) => ({ ...current, from: event.target.value }))
                  }}
                  className="h-8 w-[142px]"
                  aria-label="Data inicial"
                />
                <span className="font-mono text-[10px] text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={range.to}
                  onChange={(event) => {
                    setPreset('custom')
                    setRange((current) => ({ ...current, to: event.target.value }))
                  }}
                  className="h-8 w-[142px]"
                  aria-label="Data final"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <Gauge className="size-3.5" />
              {isLoading ? 'calculando…' : `${data?.range.days ?? 0} dias analisados`}
            </div>
          </header>

          {isLoading || !kpis ? (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
              <Metric label="Faturado" value={formatBRL(kpis.billed)} hint={`${kpis.rentalCount} locações no período`} />
              <Metric
                label="Recebido"
                value={formatBRL(kpis.received)}
                hint={`${settleRate}% do faturado`}
                tone="text-status-available"
              />
              <Metric
                label="Em aberto"
                value={formatBRL(kpis.openAmount)}
                hint={`${formatBRL(kpis.overdueAmount)} vencido`}
                tone={kpis.overdueAmount > 0 ? 'text-status-late' : undefined}
              />
              <Metric
                label="Ticket médio"
                value={formatBRL(kpis.avgTicket)}
                hint={`receita ${formatBRL(kpis.rentalRevenue)}`}
              />
              <Metric
                label="Ocupação média"
                value={`${kpis.utilization.toFixed(1)}%`}
                hint={`pico de ${kpis.peakUtilization.toFixed(1)}% no período`}
              />
              <Metric
                label="Atrasos"
                value={formatNumber(kpis.lateCount)}
                hint="devoluções vencidas agora"
                tone={kpis.lateCount > 0 ? 'text-status-late' : undefined}
              />
            </div>
          )}
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="font-heading text-base tracking-tight">Faturamento por mês</h2>
                <p className="font-mono text-[10px] text-muted-foreground">emitido por vencimento · recebido por data de pagamento</p>
              </div>
              <TrendingUp className="size-4 text-muted-foreground" />
            </header>
            <div className="p-5">
              {isLoading || !data ? (
                <Skeleton className="h-44 w-full" />
              ) : data.series.length ? (
                <BillingChart series={data.series} height="h-44" />
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground">sem movimento no período</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="font-heading text-base tracking-tight">Mix por categoria</h2>
                <p className="font-mono text-[10px] text-muted-foreground">receita contratada nas locações iniciadas no período</p>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {data?.categoryMix.length ?? 0} categorias
              </Badge>
            </header>
            <div className="p-5">
              {isLoading || !data ? (
                <Skeleton className="h-44 w-full" />
              ) : data.categoryMix.length ? (
                <ul className="flex flex-col divide-y divide-border">
                  {data.categoryMix.map((item) => (
                    <RankingRow
                      key={item.name}
                      label={item.name}
                      sublabel={`${item.share.toFixed(1)}%`}
                      value={formatBRL(item.revenue)}
                      share={item.share / 100}
                    />
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground">sem locações no período</p>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-heading text-base tracking-tight">Equipamentos que mais faturaram</h2>
              <p className="font-mono text-[10px] text-muted-foreground">unidades contratadas e receita no período</p>
            </header>
            <div className="overflow-x-auto">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead className="text-right">Un.</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || !data ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={4}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : data.topEquipment.length ? (
                    data.topEquipment.map((item) => (
                      <TableRow key={item.code}>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{item.code}</TableCell>
                        <TableCell>
                          <span className="block text-[13px]">{item.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{item.categoryName}</span>
                        </TableCell>
                        <TableCell className="metric text-right text-xs">{formatNumber(item.quantity)}</TableCell>
                        <TableCell className="text-right">
                          <span className="metric block text-xs">{formatBRL(item.revenue)}</span>
                          <span className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-border">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.max((item.revenue / maxEquipment) * 100, 3)}%` }}
                            />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center font-mono text-[11px] text-muted-foreground">
                        sem locações no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-heading text-base tracking-tight">Clientes por receita</h2>
              <p className="font-mono text-[10px] text-muted-foreground">locações iniciadas no período</p>
            </header>
            <div className="p-5">
              {isLoading || !data ? (
                <Skeleton className="h-40 w-full" />
              ) : data.topCustomers.length ? (
                <ul className="flex flex-col divide-y divide-border">
                  {data.topCustomers.map((item) => (
                    <RankingRow
                      key={item.id}
                      label={item.name}
                      sublabel={`${item.rentals} locação(ões)`}
                      value={formatBRL(item.revenue)}
                      share={item.revenue / maxCustomer}
                      suffix={`${item.rentals} loc.`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground">sem locações no período</p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
            <div>
              <h2 className="font-heading text-base tracking-tight">Situação das locações</h2>
              <p className="font-mono text-[10px] text-muted-foreground">locações iniciadas entre {formatDay(range.from)} e {formatDay(range.to)}</p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              gerado em {data ? formatDay(data.range.to) : '—'}
            </span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
            {isLoading || !data
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="p-4">
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))
              : data.statusCounts.map((item) => (
                  <div key={item.status} className="flex flex-col gap-1 px-4 py-3">
                    <span className="label-caps text-[10px] text-muted-foreground">{item.label}</span>
                    <span className="metric text-xl leading-none">{formatNumber(item.count)}</span>
                  </div>
                ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
