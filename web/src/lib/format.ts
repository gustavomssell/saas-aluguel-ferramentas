import type { RentalStatus } from './types'

export function formatBRL(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value ?? 0)
}

export function formatWeight(value: number | null | undefined) {
  if (!value) return '—'
  if (value >= 1000) return `${formatNumber(value / 1000, 2)} t`
  return `${formatNumber(value, 1)} kg`
}

export function formatDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function formatShortDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date)
}

export function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
  return label.replace('.', '')
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysISO(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

export function daysBetween(from: string | Date, to: string | Date) {
  const start = typeof from === 'string' ? new Date(from) : from
  const end = typeof to === 'string' ? new Date(to) : to
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0)
}

export const statusMeta: Record<RentalStatus, { label: string; color: string; token: string }> = {
  ACTIVE: { label: 'Em obra', color: 'var(--status-active)', token: 'text-status-active' },
  QUOTED: { label: 'Proposta', color: 'var(--status-quoted)', token: 'text-status-quoted' },
  RETURN_PENDING: { label: 'Devolução pendente', color: 'var(--status-late)', token: 'text-status-late' },
  RETURNED: { label: 'Devolvida', color: 'var(--status-available)', token: 'text-status-available' },
  CANCELLED: { label: 'Cancelada', color: 'var(--muted-foreground)', token: 'text-muted-foreground' },
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
