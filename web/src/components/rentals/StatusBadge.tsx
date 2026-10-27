import type { RentalStatus } from '@/lib/types'
import { statusMeta } from '@/lib/format'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: RentalStatus; className?: string }) {
  const meta = statusMeta[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] text-foreground',
        className,
      )}
    >
      <span className="size-2 rounded-[2px]" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  )
}
