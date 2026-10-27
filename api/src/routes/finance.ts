import { Router } from 'express'
import { z } from 'zod'
import type { Charge, ChargeKind, ChargeStatus } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'
import { round2 } from '../lib/pricing.js'

export const financeRouter = Router()

financeRouter.use(requireAuth)

const KIND_LABEL: Record<ChargeKind, string> = {
  RENT: 'Locação',
  DEPOSIT: 'Caução',
  LATE_FEE: 'Multa por atraso',
  DAMAGE: 'Avaria',
  OTHER: 'Outros',
}

const STATUS_LABEL: Record<ChargeStatus, string> = {
  PENDING: 'Em aberto',
  PAID: 'Recebido',
  CANCELLED: 'Cancelado',
}

type ChargeWithRelations = Charge & {
  customer: { id: string; name: string }
  rental: { id: string; code: string } | null
}

function serializeCharge(charge: ChargeWithRelations) {
  return {
    id: charge.id,
    kind: charge.kind,
    kindLabel: KIND_LABEL[charge.kind],
    status: charge.status,
    statusLabel: STATUS_LABEL[charge.status],
    description: charge.description,
    amount: charge.amount,
    dueDate: charge.dueDate,
    paidAt: charge.paidAt,
    method: charge.method,
    createdAt: charge.createdAt,
    customer: charge.customer,
    rental: charge.rental,
    overdue: charge.status === 'PENDING' && charge.dueDate.getTime() < Date.now(),
  }
}

function startOfMonth(offset = 0) {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

financeRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId
    const from = typeof req.query.from === 'string' ? new Date(`${req.query.from}T00:00:00.000Z`) : null
    const to = typeof req.query.to === 'string' ? new Date(`${req.query.to}T23:59:59.999Z`) : null

    const charges = (await prisma.charge.findMany({
      where: { orgId },
      include: {
        customer: { select: { id: true, name: true } },
        rental: { select: { id: true, code: true } },
      },
      orderBy: { dueDate: 'asc' },
    })) as ChargeWithRelations[]

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const weekAhead = new Date(today.getTime() + 7 * 86_400_000)

    const openCharges = charges.filter((charge) => charge.status === 'PENDING')
    const overdue = openCharges.filter((charge) => charge.dueDate < today)
    const dueThisWeek = openCharges.filter(
      (charge) => charge.dueDate >= today && charge.dueDate <= weekAhead,
    )
    const paid = charges.filter((charge) => charge.status === 'PAID')

    const receivedInRange = paid.filter((charge) => {
      if (!charge.paidAt) return false
      if (from && charge.paidAt < from) return false
      if (to && charge.paidAt > to) return false
      return true
    })

    const currentMonth = startOfMonth(0)
    const receivedThisMonth = paid.filter(
      (charge) => charge.paidAt && charge.paidAt >= currentMonth,
    )

    const sum = (list: Charge[]) => round2(list.reduce((total, charge) => total + charge.amount, 0))

    const byKind = (['RENT', 'DEPOSIT', 'LATE_FEE', 'DAMAGE', 'OTHER'] as ChargeKind[]).map((kind) => {
      const open = openCharges.filter((charge) => charge.kind === kind)
      const received = paid.filter((charge) => charge.kind === kind)
      return {
        kind,
        label: KIND_LABEL[kind],
        openAmount: sum(open),
        openCount: open.length,
        receivedAmount: sum(received),
      }
    })

    const series = Array.from({ length: 6 }).map((_, index) => {
      const start = startOfMonth(index - 5)
      const end = startOfMonth(index - 4)
      const key = monthKey(start)
      const billed = charges.filter(
        (charge) => charge.status !== 'CANCELLED' && charge.dueDate >= start && charge.dueDate < end,
      )
      const received = paid.filter(
        (charge) => charge.paidAt && charge.paidAt >= start && charge.paidAt < end,
      )
      return {
        month: key,
        billed: sum(billed),
        received: sum(received),
      }
    })

    res.json({
      generatedAt: new Date(),
      totals: {
        openAmount: sum(openCharges),
        overdueAmount: sum(overdue),
        dueThisWeekAmount: sum(dueThisWeek),
        receivedThisMonth: sum(receivedThisMonth),
        receivedInRange: sum(receivedInRange),
        depositHeld: sum(paid.filter((charge) => charge.kind === 'DEPOSIT')),
        openCount: openCharges.length,
        overdueCount: overdue.length,
      },
      byKind,
      series,
      attention: [...overdue, ...dueThisWeek]
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 8)
        .map(serializeCharge),
    })
  }),
)

financeRouter.get(
  '/charges',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as ChargeStatus) : undefined
    const kind = typeof req.query.kind === 'string' ? (req.query.kind as ChargeKind) : undefined
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
    const rentalId = typeof req.query.rentalId === 'string' ? req.query.rentalId : undefined
    const from = typeof req.query.from === 'string' ? new Date(`${req.query.from}T00:00:00.000Z`) : undefined
    const to = typeof req.query.to === 'string' ? new Date(`${req.query.to}T23:59:59.999Z`) : undefined

    const charges = (await prisma.charge.findMany({
      where: {
        orgId: req.auth!.orgId,
        ...(status ? { status } : {}),
        ...(kind ? { kind } : {}),
        ...(customerId ? { customerId } : {}),
        ...(rentalId ? { rentalId } : {}),
        ...(from || to
          ? {
              dueDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        rental: { select: { id: true, code: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    })) as ChargeWithRelations[]

    res.json(charges.map(serializeCharge))
  }),
)

const createSchema = z.object({
  customerId: z.string().min(1, 'Selecione o cliente'),
  rentalId: z.string().optional().nullable(),
  kind: z.enum(['RENT', 'DEPOSIT', 'LATE_FEE', 'DAMAGE', 'OTHER']).default('OTHER'),
  amount: z.coerce.number().positive('Informe um valor maior que zero'),
  dueDate: z.string().min(1, 'Informe o vencimento'),
  description: z.string().optional().nullable(),
})

financeRouter.post(
  '/charges',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, orgId } })
    if (!customer) throw new HttpError(404, 'Cliente não encontrado')

    if (input.rentalId) {
      const rental = await prisma.rental.findFirst({ where: { id: input.rentalId, orgId } })
      if (!rental) throw new HttpError(404, 'Locação não encontrada')
    }

    const dueDate = new Date(`${input.dueDate}T00:00:00.000Z`)
    if (Number.isNaN(dueDate.getTime())) throw new HttpError(422, 'Vencimento inválido')

    const charge = await prisma.charge.create({
      data: {
        orgId,
        customerId: input.customerId,
        rentalId: input.rentalId || null,
        kind: input.kind,
        amount: round2(input.amount),
        dueDate,
        description: input.description?.trim() || null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        rental: { select: { id: true, code: true } },
      },
    })

    res.status(201).json(serializeCharge(charge as ChargeWithRelations))
  }),
)

const patchSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  dueDate: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
  method: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
})

financeRouter.patch(
  '/charges/:id',
  asyncHandler(async (req, res) => {
    const input = patchSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const current = await prisma.charge.findFirst({ where: { id: req.params.id, orgId } })
    if (!current) throw new HttpError(404, 'Cobrança não encontrada')

    const dueDate = input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : undefined
    if (dueDate && Number.isNaN(dueDate.getTime())) throw new HttpError(422, 'Vencimento inválido')

    const nextStatus = input.status ?? current.status
    const paidAt =
      nextStatus === 'PAID'
        ? input.paidAt
          ? new Date(input.paidAt)
          : (current.paidAt ?? new Date())
        : null

    const updated = await prisma.charge.update({
      where: { id: current.id },
      data: {
        amount: input.amount !== undefined ? round2(input.amount) : undefined,
        dueDate,
        description: input.description,
        status: nextStatus,
        paidAt,
        method: nextStatus === 'PAID' ? (input.method ?? current.method) : null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        rental: { select: { id: true, code: true } },
      },
    })

    res.json(serializeCharge(updated as ChargeWithRelations))
  }),
)

financeRouter.delete(
  '/charges/:id',
  asyncHandler(async (req, res) => {
    const current = await prisma.charge.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
    })
    if (!current) throw new HttpError(404, 'Cobrança não encontrada')

    if (current.status === 'PAID') throw new HttpError(409, 'Cobranças recebidas não podem ser removidas')

    if (current.rentalId) {
      await prisma.charge.update({ where: { id: current.id }, data: { status: 'CANCELLED' } })
    } else {
      await prisma.charge.delete({ where: { id: current.id } })
    }

    res.status(204).end()
  }),
)
