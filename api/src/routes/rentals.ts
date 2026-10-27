import { Router } from 'express'
import { z } from 'zod'
import type { Charge, Prisma, RentalStatus } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'
import { overlapFilter, reservedByEquipment } from '../lib/availability.js'
import { billingDays, priceForDays, round2 } from '../lib/pricing.js'
import { createContractPdf } from '../lib/contractPdf.js'

export const rentalsRouter = Router()

rentalsRouter.use(requireAuth)

const ALLOWED_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  QUOTED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['RETURN_PENDING', 'RETURNED', 'CANCELLED'],
  RETURN_PENDING: ['RETURNED', 'ACTIVE'],
  RETURNED: [],
  CANCELLED: [],
}

const STATUS_LABEL: Record<RentalStatus, string> = {
  QUOTED: 'Proposta',
  ACTIVE: 'Em obra',
  RETURN_PENDING: 'Devolução pendente',
  RETURNED: 'Devolvida',
  CANCELLED: 'Cancelada',
}

function parseDate(value: string, field: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new HttpError(422, `${field} inválida`)
  return date
}

async function nextRentalCode(orgId: string) {
  const year = new Date().getUTCFullYear()
  const count = await prisma.rental.count({ where: { orgId } })
  return `L-${year}-${String(count + 1).padStart(4, '0')}`
}

function serializeRental(rental: {
  id: string
  code: string
  status: RentalStatus
  startsAt: Date
  expectedReturnAt: Date
  returnedAt: Date | null
  siteName: string | null
  notes: string | null
  createdAt: Date
  depositAmount: number
  customer: { id: string; name: string; city: string | null; phone: string | null }
  items: Array<{
    id: string
    quantity: number
    dailyRate: number
    equipment: {
      id: string
      code: string
      name: string
      unit: string
      weightKg: number | null
      weeklyRate: number | null
      monthlyRate: number | null
      category: { name: string }
    }
  }>
  charges?: Charge[]
  inspections?: Array<{
    id: string
    kind: 'DELIVERY' | 'RETURN'
    checkedAt: Date
    notes: string | null
    createdAt: Date
    items: Array<{
      id: string
      quantityExpected: number
      quantityChecked: number
      damaged: number
      missing: number
      notes: string | null
      equipment: { id: string; code: string; name: string }
    }>
  }>
  events?: Array<{ id: string; type: string; message: string; createdAt: Date }>
}) {
  const days = billingDays(rental.startsAt, rental.expectedReturnAt)

  const items = rental.items.map((item) => {
    const price = priceForDays(days, {
      dailyRate: item.dailyRate,
      weeklyRate: item.equipment.weeklyRate,
      monthlyRate: item.equipment.monthlyRate,
    })
    return {
      id: item.id,
      equipmentId: item.equipment.id,
      code: item.equipment.code,
      name: item.equipment.name,
      unit: item.equipment.unit,
      categoryName: item.equipment.category.name,
      quantity: item.quantity,
      dailyRate: item.dailyRate,
      weightKg: item.equipment.weightKg,
      periodTotal: round2(price.total * item.quantity),
      priceExplanation: price.explanation,
    }
  })

  const charges = rental.charges ?? []
  const openCharges = charges.filter((charge) => charge.status === 'PENDING')
  const overdueCharges = openCharges.filter((charge) => charge.dueDate.getTime() < Date.now())

  return {
    id: rental.id,
    code: rental.code,
    status: rental.status,
    statusLabel: STATUS_LABEL[rental.status],
    startsAt: rental.startsAt,
    expectedReturnAt: rental.expectedReturnAt,
    returnedAt: rental.returnedAt,
    depositAmount: rental.depositAmount,
    siteName: rental.siteName,
    notes: rental.notes,
    createdAt: rental.createdAt,
    customer: rental.customer,
    days,
    totalWeightKg: round2(items.reduce((total, item) => total + (item.weightKg ?? 0) * item.quantity, 0)),
    periodTotal: round2(items.reduce((total, item) => total + item.periodTotal, 0)),
    dailyTotal: round2(items.reduce((total, item) => total + item.dailyRate * item.quantity, 0)),
    finance: {
      openAmount: round2(openCharges.reduce((total, charge) => total + charge.amount, 0)),
      overdueAmount: round2(overdueCharges.reduce((total, charge) => total + charge.amount, 0)),
      paidAmount: round2(
        charges.filter((charge) => charge.status === 'PAID').reduce((total, charge) => total + charge.amount, 0),
      ),
      openCount: openCharges.length,
      overdueCount: overdueCharges.length,
    },
    items,
    inspections: (rental.inspections ?? []).map((inspection) => ({
      ...inspection,
      kindLabel: inspection.kind === 'DELIVERY' ? 'Entrega' : 'Devolução',
    })),
    events: rental.events ?? [],
  }
}

async function loadContract(rentalId: string, orgId: string) {
  const [rental, organization] = await Promise.all([
    prisma.rental.findFirst({
      where: { id: rentalId, orgId },
      include: {
        customer: true,
        items: { include: { equipment: { include: { category: true } } } },
        charges: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, document: true, phone: true, email: true, city: true, slug: true },
    }),
  ])

  if (!rental) throw new HttpError(404, 'Locação não encontrada')

  return {
    generatedAt: new Date(),
    organization,
    rental: serializeRental(rental),
  }
}

function periodTotalFor(
  days: number,
  items: Array<{
    quantity: number
    dailyRate: number
    equipment: { weeklyRate: number | null; monthlyRate: number | null }
  }>,
) {
  return round2(
    items.reduce(
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

async function syncOpenCharges(
  tx: Prisma.TransactionClient,
  rental: {
    id: string
    code: string
    orgId: string
    customerId: string
    startsAt: Date
    expectedReturnAt: Date
    depositAmount: number
    items: Array<{
      quantity: number
      dailyRate: number
      equipment: { weeklyRate: number | null; monthlyRate: number | null }
    }>
  },
) {
  const days = billingDays(rental.startsAt, rental.expectedReturnAt)
  const total = periodTotalFor(days, rental.items)

  const rentCharge = await tx.charge.findFirst({
    where: { rentalId: rental.id, kind: 'RENT', status: 'PENDING' },
  })
  if (rentCharge) {
    await tx.charge.update({
      where: { id: rentCharge.id },
      data: { amount: total, dueDate: rental.startsAt, description: `Locação ${rental.code} — ${days} dia(s)` },
    })
  } else {
    await tx.charge.create({
      data: {
        orgId: rental.orgId,
        customerId: rental.customerId,
        rentalId: rental.id,
        kind: 'RENT',
        amount: total,
        dueDate: rental.startsAt,
        description: `Locação ${rental.code} — ${days} dia(s)`,
      },
    })
  }

  const depositCharge = await tx.charge.findFirst({
    where: { rentalId: rental.id, kind: 'DEPOSIT', status: 'PENDING' },
  })
  if (rental.depositAmount > 0) {
    if (depositCharge) {
      await tx.charge.update({ where: { id: depositCharge.id }, data: { amount: rental.depositAmount } })
    } else {
      await tx.charge.create({
        data: {
          orgId: rental.orgId,
          customerId: rental.customerId,
          rentalId: rental.id,
          kind: 'DEPOSIT',
          amount: rental.depositAmount,
          dueDate: rental.startsAt,
          description: `Caução da locação ${rental.code}`,
        },
      })
    }
  } else if (depositCharge) {
    await tx.charge.update({ where: { id: depositCharge.id }, data: { status: 'CANCELLED' } })
  }
}

const itemsSchema = z
  .array(
    z.object({
      equipmentId: z.string().min(1),
      quantity: z.coerce.number().int().min(1, 'Quantidade mínima é 1'),
      dailyRate: z.coerce.number().min(0).optional(),
    }),
  )
  .min(1, 'Inclua ao menos uma peça')

const rentalSchema = z.object({
  customerId: z.string().min(1, 'Selecione o cliente'),
  siteName: z.string().optional().nullable(),
  startsAt: z.string().min(1, 'Informe a data de saída'),
  expectedReturnAt: z.string().min(1, 'Informe a data prevista de devolução'),
  status: z.enum(['QUOTED', 'ACTIVE']).default('QUOTED'),
  notes: z.string().optional().nullable(),
  depositAmount: z.coerce.number().min(0).default(0),
  items: itemsSchema,
})

rentalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? (req.query.status as RentalStatus) : undefined
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined

    const rentals = await prisma.rental.findMany({
      where: { orgId: req.auth!.orgId, ...(status ? { status } : {}), ...(customerId ? { customerId } : {}) },
      orderBy: { startsAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, city: true, phone: true } },
        items: { include: { equipment: { include: { category: true } } } },
        charges: { orderBy: { dueDate: 'asc' } },
      },
    })

    res.json(rentals.map((rental) => serializeRental(rental)))
  }),
)

rentalsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rental = await prisma.rental.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
      include: {
        customer: { select: { id: true, name: true, city: true, phone: true } },
        items: { include: { equipment: { include: { category: true } } } },
        charges: { orderBy: { dueDate: 'asc' } },
        inspections: {
          orderBy: { checkedAt: 'desc' },
          include: { items: { include: { equipment: { select: { id: true, code: true, name: true } } } } },
        },
        events: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!rental) throw new HttpError(404, 'Locação não encontrada')
    res.json(serializeRental(rental))
  }),
)

rentalsRouter.get(
  '/:id/contract/pdf',
  asyncHandler(async (req, res) => {
    const data = await loadContract(req.params.id, req.auth!.orgId)
    const filename = `contrato-${data.rental.code.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const doc = createContractPdf(data)
    doc.pipe(res)
    doc.end()
  }),
)

rentalsRouter.get(
  '/:id/contract',
  asyncHandler(async (req, res) => {
    res.json(await loadContract(req.params.id, req.auth!.orgId))
  }),
)

const inspectionSchema = z.object({
  kind: z.enum(['DELIVERY', 'RETURN']),
  checkedAt: z.string().optional(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        quantityChecked: z.coerce.number().int().min(0),
        damaged: z.coerce.number().int().min(0).default(0),
        missing: z.coerce.number().int().min(0).default(0),
        notes: z.string().optional().nullable(),
      }),
    )
    .min(1, 'Confira ao menos uma peça'),
})

rentalsRouter.post(
  '/:id/inspections',
  asyncHandler(async (req, res) => {
    const input = inspectionSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const rental = await prisma.rental.findFirst({
      where: { id: req.params.id, orgId },
      include: {
        items: {
          include: {
            equipment: { select: { id: true, code: true, name: true, replacementValue: true } },
          },
        },
      },
    })
    if (!rental) throw new HttpError(404, 'Locação não encontrada')

    const allowedStatuses: RentalStatus[] =
      input.kind === 'DELIVERY' ? ['QUOTED', 'ACTIVE'] : ['ACTIVE', 'RETURN_PENDING']
    if (!allowedStatuses.includes(rental.status)) {
      throw new HttpError(
        409,
        input.kind === 'DELIVERY'
          ? 'A entrega só pode ser conferida em propostas ou locações em curso'
          : 'A devolução só pode ser conferida em locações em curso',
      )
    }

    const rentalItems = new Map(rental.items.map((item) => [item.equipmentId, item]))
    const seen = new Set<string>()

    for (const line of input.items) {
      const item = rentalItems.get(line.equipmentId)
      if (!item) throw new HttpError(422, 'Há peças que não pertencem a esta locação')
      if (seen.has(line.equipmentId)) throw new HttpError(422, 'Há peças repetidas no checklist')
      seen.add(line.equipmentId)
      if (line.quantityChecked + line.damaged + line.missing > item.quantity) {
        throw new HttpError(
          422,
          `A conferência de ${item.equipment.code} passa das ${item.quantity} peças locadas`,
        )
      }
    }

    if (input.items.length !== rental.items.length) {
      throw new HttpError(422, 'Confira todas as peças da locação antes de concluir')
    }

    const checkedAt = input.checkedAt ? parseDate(input.checkedAt, 'Data da conferência') : new Date()
    const totals = input.items.reduce(
      (acc, line) => ({
        checked: acc.checked + line.quantityChecked,
        damaged: acc.damaged + line.damaged,
        missing: acc.missing + line.missing,
      }),
      { checked: 0, damaged: 0, missing: 0 },
    )

    const nextStatus: RentalStatus = input.kind === 'DELIVERY' ? 'ACTIVE' : 'RETURNED'
    const eventType = input.kind === 'DELIVERY' ? ('ACTIVATED' as const) : ('RETURNED' as const)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.rentalInspection.create({
        data: {
          rentalId: rental.id,
          kind: input.kind,
          checkedAt,
          notes: input.notes?.trim() || null,
          items: {
            create: input.items.map((line) => {
              const item = rentalItems.get(line.equipmentId)!
              return {
                equipmentId: line.equipmentId,
                quantityExpected: item.quantity,
                quantityChecked: line.quantityChecked,
                damaged: line.damaged,
                missing: line.missing,
                notes: line.notes?.trim() || null,
              }
            }),
          },
        },
      })

      if (input.kind === 'RETURN') {
        for (const line of input.items) {
          if (line.damaged <= 0) continue
          const item = rentalItems.get(line.equipmentId)!
          const amount = round2(item.equipment.replacementValue * line.damaged)
          if (amount <= 0) continue
          await tx.charge.create({
            data: {
              orgId,
              customerId: rental.customerId,
              rentalId: rental.id,
              kind: 'DAMAGE',
              amount,
              dueDate: new Date(checkedAt.getTime() + 86_400_000),
              description: `Avaria na devolução — ${item.equipment.code} (${line.damaged} pç)`,
            },
          })
        }
      }

      const summary =
        input.kind === 'DELIVERY'
          ? `Entrega conferida: ${totals.checked} peça(s) em ${rental.items.length} linha(s)`
          : `Devolução conferida: ${totals.checked} ok · ${totals.damaged} avariada(s) · ${totals.missing} faltante(s)`

      return tx.rental.update({
        where: { id: rental.id },
        data: {
          status: nextStatus,
          ...(input.kind === 'RETURN' ? { returnedAt: checkedAt } : {}),
          events: {
            create: {
              type: eventType,
              message: input.notes?.trim() ? `${summary} — ${input.notes.trim()}` : summary,
            },
          },
        },
        include: {
          customer: { select: { id: true, name: true, city: true, phone: true } },
          items: { include: { equipment: { include: { category: true } } } },
          charges: { orderBy: { dueDate: 'asc' } },
          inspections: {
            orderBy: { checkedAt: 'desc' },
            include: { items: { include: { equipment: { select: { id: true, code: true, name: true } } } } },
          },
          events: { orderBy: { createdAt: 'desc' } },
        },
      })
    })

    res.status(201).json(serializeRental(updated))
  }),
)

rentalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = rentalSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, orgId } })
    if (!customer) throw new HttpError(404, 'Cliente não encontrado')

    const startsAt = parseDate(input.startsAt, 'Data de saída')
    const expectedReturnAt = parseDate(input.expectedReturnAt, 'Data de devolução')
    if (expectedReturnAt <= startsAt) throw new HttpError(422, 'A devolução deve ser depois da saída')

    const equipmentIds = input.items.map((item) => item.equipmentId)
    if (new Set(equipmentIds).size !== equipmentIds.length) {
      throw new HttpError(422, 'Há peças repetidas na locação; some as quantidades')
    }

    const equipments = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds }, orgId, active: true },
    })
    if (equipments.length !== equipmentIds.length) {
      throw new HttpError(400, 'Uma ou mais peças não estão disponíveis no catálogo')
    }

    const reserved = await reservedByEquipment(orgId, startsAt, expectedReturnAt)
    const shortages = input.items
      .map((item) => {
        const equipment = equipments.find((candidate) => candidate.id === item.equipmentId)!
        const available = Math.max(equipment.stockTotal - equipment.stockMaintenance - (reserved.get(item.equipmentId) ?? 0), 0)
        return { code: equipment.code, name: equipment.name, requested: item.quantity, available }
      })
      .filter((row) => row.requested > row.available)

    if (shortages.length > 0) {
      throw new HttpError(409, 'Estoque insuficiente para o período pedido', shortages)
    }

    const days = billingDays(startsAt, expectedReturnAt)
    const periodTotal = round2(
      input.items.reduce((total, item) => {
        const equipment = equipments.find((candidate) => candidate.id === item.equipmentId)!
        const price = priceForDays(days, {
          dailyRate: item.dailyRate ?? equipment.dailyRate,
          weeklyRate: equipment.weeklyRate,
          monthlyRate: equipment.monthlyRate,
        })
        return total + price.total * item.quantity
      }, 0),
    )

    const rental = await prisma.$transaction(async (tx) => {
      const code = await nextRentalCode(orgId)
      return tx.rental.create({
        data: {
          code,
          orgId,
          customerId: input.customerId,
          siteName: input.siteName,
          notes: input.notes,
          startsAt,
          expectedReturnAt,
          status: input.status,
          depositAmount: input.depositAmount,
          items: {
            create: input.items.map((item) => {
              const equipment = equipments.find((candidate) => candidate.id === item.equipmentId)!
              return {
                equipmentId: item.equipmentId,
                quantity: item.quantity,
                dailyRate: item.dailyRate ?? equipment.dailyRate,
              }
            }),
          },
          charges: {
            create: [
              {
                orgId,
                customerId: input.customerId,
                kind: 'RENT',
                amount: periodTotal,
                dueDate: startsAt,
                description: `Locação ${code} — ${days} dia(s)`,
              },
              ...(input.depositAmount > 0
                ? [
                    {
                      orgId,
                      customerId: input.customerId,
                      kind: 'DEPOSIT' as const,
                      amount: input.depositAmount,
                      dueDate: startsAt,
                      description: `Caução da locação ${code}`,
                    },
                  ]
                : []),
            ],
          },
          events: {
            create: {
              type: 'CREATED',
              message:
                input.status === 'ACTIVE'
                  ? `Locação aberta para ${customer.name}`
                  : `Proposta criada para ${customer.name}`,
            },
          },
        },
        include: {
          customer: { select: { id: true, name: true, city: true, phone: true } },
          items: { include: { equipment: { include: { category: true } } } },
          charges: { orderBy: { dueDate: 'asc' } },
          events: true,
        },
      })
    })

    res.status(201).json(serializeRental(rental))
  }),
)

const patchSchema = z.object({
  customerId: z.string().optional(),
  siteName: z.string().optional().nullable(),
  startsAt: z.string().optional(),
  expectedReturnAt: z.string().optional(),
  notes: z.string().optional().nullable(),
  depositAmount: z.coerce.number().min(0).optional(),
})

rentalsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = patchSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const current = await prisma.rental.findFirst({ where: { id: req.params.id, orgId } })
    if (!current) throw new HttpError(404, 'Locação não encontrada')
    if (current.status === 'RETURNED' || current.status === 'CANCELLED') {
      throw new HttpError(409, `Locação ${STATUS_LABEL[current.status].toLowerCase()} não pode ser alterada`)
    }

    const startsAt = input.startsAt ? parseDate(input.startsAt, 'Data de saída') : current.startsAt
    const expectedReturnAt = input.expectedReturnAt
      ? parseDate(input.expectedReturnAt, 'Data de devolução')
      : current.expectedReturnAt
    if (expectedReturnAt <= startsAt) throw new HttpError(422, 'A devolução deve ser depois da saída')

    const extendWindow = expectedReturnAt > current.expectedReturnAt || startsAt < current.startsAt

    if (extendWindow) {
      const reserved = await reservedByEquipment(orgId, startsAt, expectedReturnAt, {
        excludeRentalId: current.id,
      })
      const currentItems = await prisma.rentalItem.findMany({ where: { rentalId: current.id } })
      const equipments = await prisma.equipment.findMany({
        where: { id: { in: currentItems.map((item) => item.equipmentId) } },
      })

      const shortages = currentItems
        .map((item) => {
          const equipment = equipments.find((candidate) => candidate.id === item.equipmentId)!
          const available = Math.max(
            equipment.stockTotal - equipment.stockMaintenance - (reserved.get(item.equipmentId) ?? 0),
            0,
          )
          return { code: equipment.code, name: equipment.name, requested: item.quantity, available }
        })
        .filter((row) => row.requested > row.available)

      if (shortages.length > 0) {
        throw new HttpError(409, 'Não há estoque livre para o novo período', shortages)
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.rental.update({
        where: { id: current.id },
        data: {
          customerId: input.customerId ?? undefined,
          siteName: input.siteName,
          notes: input.notes,
          startsAt,
          expectedReturnAt,
          depositAmount: input.depositAmount ?? current.depositAmount,
          ...(extendWindow && expectedReturnAt > current.expectedReturnAt
            ? {
                events: {
                  create: {
                    type: 'EXTENDED',
                    message: `Prazo estendido para ${expectedReturnAt.toISOString().slice(0, 10)}`,
                  },
                },
              }
            : {}),
        },
      })

      const fresh = await tx.rental.findUniqueOrThrow({
        where: { id: current.id },
        include: { items: { include: { equipment: true } } },
      })
      await syncOpenCharges(tx, fresh)

      return tx.rental.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          customer: { select: { id: true, name: true, city: true, phone: true } },
          items: { include: { equipment: { include: { category: true } } } },
          charges: { orderBy: { dueDate: 'asc' } },
          events: { orderBy: { createdAt: 'desc' } },
        },
      })
    })

    res.json(serializeRental(updated))
  }),
)

const statusSchema = z.object({
  status: z.enum(['QUOTED', 'ACTIVE', 'RETURN_PENDING', 'RETURNED', 'CANCELLED']),
  note: z.string().optional().nullable(),
})

rentalsRouter.post(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const input = statusSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const current = await prisma.rental.findFirst({
      where: { id: req.params.id, orgId },
      include: { customer: { select: { name: true } } },
    })
    if (!current) throw new HttpError(404, 'Locação não encontrada')

    if (!ALLOWED_TRANSITIONS[current.status].includes(input.status)) {
      throw new HttpError(
        409,
        `Não é possível mudar de ${STATUS_LABEL[current.status]} para ${STATUS_LABEL[input.status]}`,
      )
    }

    const eventType =
      input.status === 'ACTIVE'
        ? 'ACTIVATED'
        : input.status === 'RETURN_PENDING'
          ? 'RETURN_PENDING'
          : input.status === 'RETURNED'
            ? 'RETURNED'
            : input.status === 'CANCELLED'
              ? 'CANCELLED'
              : 'CREATED'

    if (input.status === 'CANCELLED') {
      await prisma.charge.updateMany({
        where: { rentalId: current.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      })
    }

    const updated = await prisma.rental.update({
      where: { id: current.id },
      data: {
        status: input.status,
        returnedAt: input.status === 'RETURNED' ? new Date() : null,
        events: {
          create: {
            type: eventType,
            message: input.note?.trim()
              ? input.note.trim()
              : `Status alterado para ${STATUS_LABEL[input.status]}`,
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, city: true, phone: true } },
        items: { include: { equipment: { include: { category: true } } } },
        charges: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    })

    res.json(serializeRental(updated))
  }),
)

export { STATUS_LABEL, overlapFilter }
