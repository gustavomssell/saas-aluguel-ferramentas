import { Router } from 'express'
import { prisma } from '../db.js'
import { asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'
import { billingDays, priceForDays, round2 } from '../lib/pricing.js'

export const reportsRouter = Router()

reportsRouter.use(requireAuth)

const STATUS_LABEL: Record<string, string> = {
  QUOTED: 'Proposta',
  ACTIVE: 'Em obra',
  RETURN_PENDING: 'Devolução pendente',
  RETURNED: 'Devolvida',
  CANCELLED: 'Cancelada',
}

function parseDate(value: unknown, fallback: Date, endOfDay = false) {
  if (typeof value !== 'string' || !value) return fallback
  const parsed = new Date(`${value}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

type RentalWithItems = {
  id: string
  code: string
  status: string
  startsAt: Date
  expectedReturnAt: Date
  customer: { id: string; name: string }
  items: Array<{
    quantity: number
    dailyRate: number
    equipment: {
      code: string
      name: string
      weeklyRate: number | null
      monthlyRate: number | null
      category: { name: string }
    }
  }>
}

function rentalValue(rental: RentalWithItems) {
  const days = billingDays(rental.startsAt, rental.expectedReturnAt)
  return round2(
    rental.items.reduce(
      (total, item) =>
        total +
        priceForDays(days, {
          dailyRate: item.dailyRate,
          weeklyRate: item.equipment.weeklyRate,
          monthlyRate: item.equipment.monthlyRate,
        }).total *
          item.quantity,
      0,
    ),
  )
}

reportsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId
    const now = new Date()
    const defaultFrom = startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)))
    const from = parseDate(req.query.from, defaultFrom)
    const to = parseDate(req.query.to, now, true)

    const [charges, rentals, allRentals, stock, statusGroups] = await Promise.all([
      prisma.charge.findMany({ where: { orgId } }),
      prisma.rental.findMany({
        where: { orgId, startsAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
        include: {
          customer: { select: { id: true, name: true } },
          items: {
            include: {
              equipment: {
                select: {
                  code: true,
                  name: true,
                  weeklyRate: true,
                  monthlyRate: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.rental.findMany({
        where: {
          orgId,
          status: { in: ['ACTIVE', 'RETURN_PENDING'] },
          startsAt: { lte: to },
          expectedReturnAt: { gte: from },
        },
        select: {
          startsAt: true,
          expectedReturnAt: true,
          items: { select: { quantity: true } },
        },
      }),
      prisma.equipment.aggregate({
        where: { orgId, active: true },
        _sum: { stockTotal: true, stockMaintenance: true },
      }),
      prisma.rental.groupBy({
        by: ['status'],
        where: { orgId, startsAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ])

    const billedCharges = charges.filter(
      (charge) => charge.status !== 'CANCELLED' && charge.dueDate >= from && charge.dueDate <= to,
    )
    const receivedCharges = charges.filter(
      (charge) => charge.status === 'PAID' && charge.paidAt && charge.paidAt >= from && charge.paidAt <= to,
    )
    const openCharges = charges.filter((charge) => charge.status === 'PENDING')
    const overdueCharges = openCharges.filter((charge) => charge.dueDate.getTime() < now.getTime())

    const sum = (list: Array<{ amount: number }>) => round2(list.reduce((total, item) => total + item.amount, 0))

    const billed = sum(billedCharges)
    const received = sum(receivedCharges)
    const rentalRevenue = round2(rentals.reduce((total, rental) => total + rentalValue(rental as RentalWithItems), 0))

    const capacity = Math.max(
      (stock._sum.stockTotal ?? 0) - (stock._sum.stockMaintenance ?? 0),
      1,
    )
    const dayCount = Math.min(Math.max(Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1, 1), 120)
    let utilizationSum = 0
    let peakUtilization = 0
    for (let index = 0; index < dayCount; index += 1) {
      const day = new Date(from.getTime() + index * 86_400_000)
      const unitsOut = allRentals
        .filter((rental) => rental.startsAt <= day && rental.expectedReturnAt >= day)
        .reduce((total, rental) => total + rental.items.reduce((sumItems, item) => sumItems + item.quantity, 0), 0)
      const ratio = Math.min(unitsOut / capacity, 1.5)
      utilizationSum += ratio
      peakUtilization = Math.max(peakUtilization, ratio)
    }

    const seriesStart = startOfMonth(from)
    const months = Math.min(
      Math.max(
        (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1,
        1,
      ),
      12,
    )
    const series = Array.from({ length: months }).map((_, index) => {
      const start = new Date(
        Date.UTC(seriesStart.getUTCFullYear(), seriesStart.getUTCMonth() + index, 1),
      )
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
      return {
        month: monthKey(start),
        billed: sum(
          billedCharges.filter((charge) => charge.dueDate >= start && charge.dueDate < end),
        ),
        received: sum(
          receivedCharges.filter((charge) => charge.paidAt && charge.paidAt >= start && charge.paidAt < end),
        ),
      }
    })

    const equipmentMap = new Map<string, { code: string; name: string; categoryName: string; quantity: number; revenue: number }>()
    const categoryMap = new Map<string, number>()
    const customerMap = new Map<string, { id: string; name: string; rentals: number; revenue: number }>()

    for (const rental of rentals) {
      const days = billingDays(rental.startsAt, rental.expectedReturnAt)
      let rentalRevenueValue = 0
      for (const item of rental.items) {
        const revenue = round2(
          priceForDays(days, {
            dailyRate: item.dailyRate,
            weeklyRate: item.equipment.weeklyRate,
            monthlyRate: item.equipment.monthlyRate,
          }).total * item.quantity,
        )
        rentalRevenueValue += revenue
        const key = item.equipment.code
        const current = equipmentMap.get(key) ?? {
          code: item.equipment.code,
          name: item.equipment.name,
          categoryName: item.equipment.category.name,
          quantity: 0,
          revenue: 0,
        }
        current.quantity += item.quantity
        current.revenue = round2(current.revenue + revenue)
        equipmentMap.set(key, current)
        categoryMap.set(
          item.equipment.category.name,
          round2((categoryMap.get(item.equipment.category.name) ?? 0) + revenue),
        )
      }

      const customer = customerMap.get(rental.customer.id) ?? {
        id: rental.customer.id,
        name: rental.customer.name,
        rentals: 0,
        revenue: 0,
      }
      customer.rentals += 1
      customer.revenue = round2(customer.revenue + rentalRevenueValue)
      customerMap.set(rental.customer.id, customer)
    }

    const categoryTotal = [...categoryMap.values()].reduce((total, value) => total + value, 0) || 1

    res.json({
      range: { from: from.toISOString(), to: to.toISOString(), days: dayCount },
      kpis: {
        billed,
        received,
        openAmount: sum(openCharges),
        overdueAmount: sum(overdueCharges),
        rentalRevenue,
        rentalCount: rentals.length,
        avgTicket: rentals.length ? round2(rentalRevenue / rentals.length) : 0,
        utilization: dayCount ? round2((utilizationSum / dayCount) * 100) : 0,
        peakUtilization: round2(peakUtilization * 100),
        lateCount: allRentals.filter((rental) => rental.expectedReturnAt.getTime() < now.getTime()).length,
        unitsOut: allRentals
          .filter((rental) => rental.startsAt <= now && rental.expectedReturnAt >= now)
          .reduce((total, rental) => total + rental.items.reduce((sumItems, item) => sumItems + item.quantity, 0), 0),
        capacity,
      },
      series,
      topEquipment: [...equipmentMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      topCustomers: [...customerMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
      categoryMix: [...categoryMap.entries()]
        .map(([name, revenue]) => ({ name, revenue, share: round2((revenue / categoryTotal) * 100) }))
        .sort((a, b) => b.revenue - a.revenue),
      statusCounts: statusGroups.map((group) => ({
        status: group.status,
        label: STATUS_LABEL[group.status] ?? group.status,
        count: group._count._all,
      })),
    })
  }),
)
