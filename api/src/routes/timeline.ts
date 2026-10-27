import { Router } from 'express'
import { prisma } from '../db.js'
import { asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'
import { overlapFilter } from '../lib/availability.js'
import { STATUS_LABEL } from './rentals.js'

export const timelineRouter = Router()

timelineRouter.use(requireAuth)

function parseDay(value: unknown, fallback: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  return new Date(`${value}T00:00:00.000Z`)
}

timelineRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const today = new Date()
    const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    const defaultTo = new Date(defaultFrom.getTime() + 30 * 86400000)

    const from = parseDay(req.query.from, defaultFrom)
    const to = parseDay(req.query.to, defaultTo)
    const categoryId = typeof req.query.categoryId === 'string' && req.query.categoryId ? req.query.categoryId : undefined
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined

    const equipments = await prisma.equipment.findMany({
      where: { orgId: req.auth!.orgId, active: true, ...(categoryId ? { categoryId } : {}) },
      include: {
        category: true,
        rentalItems: {
          where: {
            rental: {
              orgId: req.auth!.orgId,
              ...(status ? { status: status as never } : {}),
              ...overlapFilter(from, to),
            },
          },
          include: {
            rental: {
              include: { customer: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { code: 'asc' }],
    })

    const dayCount = Math.max(Math.round((to.getTime() - from.getTime()) / 86400000), 1)
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(from.getTime() + index * 86400000)
      return date.toISOString().slice(0, 10)
    })

    const payload = equipments.map((equipment) => {
      const segments = equipment.rentalItems
        .map((item) => ({
          rentalId: item.rental.id,
          code: item.rental.code,
          status: item.rental.status,
          statusLabel: STATUS_LABEL[item.rental.status],
          customerName: item.rental.customer.name,
          siteName: item.rental.siteName,
          startsAt: item.rental.startsAt,
          expectedReturnAt: item.rental.expectedReturnAt,
          quantity: item.quantity,
        }))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

      const loadByDay = days.map((day) => {
        const point = new Date(`${day}T00:00:00.000Z`)
        return segments.reduce((total, segment) => {
          if (segment.startsAt > point) return total
          const active =
            segment.status === 'QUOTED' ? segment.expectedReturnAt > point : true
          return total + (active ? segment.quantity : 0)
        }, 0)
      })

      return {
        id: equipment.id,
        code: equipment.code,
        name: equipment.name,
        unit: equipment.unit,
        categoryId: equipment.categoryId,
        categoryName: equipment.category.name,
        stockTotal: equipment.stockTotal,
        stockMaintenance: equipment.stockMaintenance,
        peakLoad: loadByDay.reduce((max, value) => Math.max(max, value), 0),
        loadByDay,
        segments,
      }
    })

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      today: defaultFrom.toISOString().slice(0, 10),
      days,
      equipments: payload,
    })
  }),
)
