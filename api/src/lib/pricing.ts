export type RateTable = {
  dailyRate: number
  weeklyRate?: number | null
  monthlyRate?: number | null
}

export type PriceBreakdown = {
  days: number
  months: number
  weeks: number
  extraDays: number
  total: number
  explanation: string
}

export function billingDays(startsAt: Date, endsAt: Date) {
  const start = Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate())
  const end = Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth(), endsAt.getUTCDate())
  return Math.max(Math.round((end - start) / 86400000), 1)
}

export function priceForDays(days: number, rate: RateTable): PriceBreakdown {
  const daily = rate.dailyRate
  const weekly = rate.weeklyRate && rate.weeklyRate > 0 ? rate.weeklyRate : daily * 7
  const monthly = rate.monthlyRate && rate.monthlyRate > 0 ? rate.monthlyRate : weekly * 4

  const months = Math.floor(days / 30)
  const afterMonths = days - months * 30
  const weeks = Math.floor(afterMonths / 7)
  const extraDays = afterMonths - weeks * 7

  const greedy = months * monthly + weeks * weekly + extraDays * daily

  const oneMonthFewer = months > 0 ? (months - 1) * monthly + Math.min(Math.floor((afterMonths + 30) / 7), 5) * weekly : Number.POSITIVE_INFINITY
  const pureDaily = days * daily

  if (pureDaily <= greedy) {
    return {
      days,
      months: 0,
      weeks: 0,
      extraDays: days,
      total: round2(pureDaily),
      explanation: `${days} diária(s) de ${formatBRL(daily)}`,
    }
  }

  if (oneMonthFewer < greedy) {
    const remaining = days - (months - 1) * 30
    const w = Math.floor(remaining / 7)
    const d = remaining - w * 7
    return {
      days,
      months: months - 1,
      weeks: w,
      extraDays: d,
      total: round2((months - 1) * monthly + w * weekly + d * daily),
      explanation: `${months - 1} mensalidade(s), ${w} semana(s) e ${d} diária(s)`,
    }
  }

  return {
    days,
    months,
    weeks,
    extraDays,
    total: round2(greedy),
    explanation: [months && `${months} mensalidade(s)`, weeks && `${weeks} semana(s)`, extraDays && `${extraDays} diária(s)`]
      .filter(Boolean)
      .join(', '),
  }
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
