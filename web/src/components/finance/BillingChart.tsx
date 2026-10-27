import { formatBRL, formatMonth } from '@/lib/format'

export type BillingPoint = { month: string; billed: number; received: number }

export function BillingChart({ series, height = 'h-32' }: { series: BillingPoint[]; height?: string }) {
  const max = Math.max(...series.map((row) => Math.max(row.billed, row.received)), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex ${height} items-stretch gap-3`}>
        {series.map((row) => (
          <div key={row.month} className="flex h-full flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <span
                className="w-1/3 rounded-t-[2px] bg-foreground/15"
                style={{ height: `${Math.max((row.billed / max) * 100, row.billed ? 3 : 0)}%` }}
                title={`Faturado: ${formatBRL(row.billed)}`}
              />
              <span
                className="w-1/3 rounded-t-[2px] bg-primary"
                style={{ height: `${Math.max((row.received / max) * 100, row.received ? 3 : 0)}%` }}
                title={`Recebido: ${formatBRL(row.received)}`}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{formatMonth(row.month)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3">
        <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-foreground/15" /> faturado
        </span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-primary" /> recebido
        </span>
      </div>
    </div>
  )
}
