import { Router } from 'express'
import { prisma } from '../db.js'
import { asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'
import { reservedByEquipment } from '../lib/availability.js'
import { billingDays, round2 } from '../lib/pricing.js'
import { STATUS_LABEL } from './rentals.js'

export const dashboardRouter = Router()

dashboardRouter.use(requireAuth)

function dayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId
    const today = dayStart(new Date())
    const tomorrow = new Date(today.getTime() + 86400000)
    const in7 = new Date(today.getTime() + 7 * 86400000)
    const in30 = new Date(today.getTime() + 30 * 86400000)

    const [equipments, reservedToday, activeRentals] = await Promise.all([
      prisma.equipment.findMany({
        where: { orgId, active: true },
        include: { category: true },
      }),
      reservedByEquipment(orgId, today, tomorrow),
      prisma.rental.findMany({
        where: { orgId, status: { in: ['ACTIVE', 'RETURN_PENDING'] } },
        include: {
          customer: { select: { id: true, name: true, city: true, phone: true } },
          items: { include: { equipment: { select: { code: true, name: true } } } },
        },
        orderBy: { expectedReturnAt: 'asc' },
      }),
    ])

    const unitsTotal = equipments.reduce((total, item) => total + item.stockTotal, 0)
    const unitsMaintenance = equipments.reduce((total, item) => total + item.stockMaintenance, 0)
    const unitsInField = equipments.reduce(
      (total, item) => total + Math.min(reservedToday.get(item.id) ?? 0, Math.max(item.stockTotal - item.stockMaintenance, 0)),
      0,
    )
    const physicallyReady = unitsTotal - unitsMaintenance
    const utilization = physicallyReady > 0 ? (unitsInField / physicallyReady) * 100 : 0

    let revenueNext30Days = 0
    const projectedReturns = activeRentals.map((rental) => {
      const dailyTotal = rental.items.reduce((total, item) => total + item.dailyRate * item.quantity, 0)
      const overlapStart = rental.startsAt > today ? rental.startsAt : today
      const overlapEnd = rental.expectedReturnAt < in30 ? rental.expectedReturnAt : in30
      const overlapDays = overlapEnd > overlapStart ? Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) : 0
      revenueNext30Days += dailyTotal * overlapDays

      return {
        id: rental.id,
        code: rental.code,
        status: rental.status,
        statusLabel: STATUS_LABEL[rental.status],
        customerName: rental.customer.name,
        siteName: rental.siteName,
        expectedReturnAt: rental.expectedReturnAt,
        days: billingDays(rental.startsAt, rental.expectedReturnAt),
        dailyTotal: round2(dailyTotal),
        quantity: rental.items.reduce((total, item) => total + item.quantity, 0),
      }
    })

    const pendingReturns = projectedReturns.filter((rental) => rental.status === 'RETURN_PENDING')
    const upcomingReturns = projectedReturns.filter(
      (rental) => rental.expectedReturnAt <= in7 && rental.status !== 'RETURN_PENDING',
    )
    const lateReturns = projectedReturns.filter((rental) => rental.expectedReturnAt < today)

    const priority = { LATE: 0, PENDING: 1, UPCOMING: 2 } as const
    const attentionMap = new Map<string, { kind: 'LATE' | 'PENDING' | 'UPCOMING'; rental: (typeof projectedReturns)[number] }>()
    for (const rental of lateReturns) attentionMap.set(rental.id, { kind: 'LATE', rental })
    for (const rental of pendingReturns) {
      if (!attentionMap.has(rental.id)) attentionMap.set(rental.id, { kind: 'PENDING', rental })
    }
    for (const rental of upcomingReturns) {
      if (!attentionMap.has(rental.id)) attentionMap.set(rental.id, { kind: 'UPCOMING', rental })
    }
    const attention = [...attentionMap.values()]
      .sort((a, b) => priority[a.kind] - priority[b.kind])
      .slice(0, 6)
      .map((item) => ({ ...item.rental, kind: item.kind }))

    const categoryMap = new Map<
      string,
      { id: string; name: string; units: number; inField: number; available: number; utilization: number }
    >()
    for (const equipment of equipments) {
      const entry = categoryMap.get(equipment.categoryId) ?? {
        id: equipment.categoryId,
        name: equipment.category.name,
        units: 0,
        inField: 0,
        available: 0,
        utilization: 0,
      }
      const ready = Math.max(equipment.stockTotal - equipment.stockMaintenance, 0)
      const inField = Math.min(reservedToday.get(equipment.id) ?? 0, ready)
      entry.units += equipment.stockTotal
      entry.inField += inField
      entry.available += ready - inField
      categoryMap.set(equipment.categoryId, entry)
    }
    const categories = [...categoryMap.values()].map((entry) => ({
      ...entry,
      utilization: entry.units > 0 ? (entry.inField / entry.units) * 100 : 0,
    }))

    const statusCounts = await prisma.rental.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { _all: true },
    })

    res.json({
      generatedAt: new Date().toISOString(),
      stock: {
        unitsTotal,
        unitsInField,
        unitsAvailable: physicallyReady - unitsInField,
        unitsMaintenance,
        utilization: round2(utilization),
      },
      counts: {
        equipment: equipments.length,
        openRentals: activeRentals.length,
        late: lateReturns.length,
        pendingReturns: pendingReturns.length,
        returnsNext7Days: upcomingReturns.length,
      },
      revenueNext30Days: round2(revenueNext30Days),
      categories,
      statusCounts: statusCounts.map((row) => ({
        status: row.status,
        label: STATUS_LABEL[row.status],
        count: row._count._all,
      })),
      attention,
    })
  }),
)
