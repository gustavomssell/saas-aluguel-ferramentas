import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'

export const kitsRouter = Router()

kitsRouter.use(requireAuth)

const kitSchema = z.object({
  name: z.string().min(2, 'Informe o nome do kit'),
  description: z.string().optional().nullable(),
  heightMeters: z.coerce.number().min(0).optional().nullable(),
  facadeMeters: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        quantity: z.coerce.number().int().min(1, 'Quantidade mínima é 1'),
      }),
    )
    .min(1, 'Inclua ao menos uma peça no kit'),
})

kitsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const kits = await prisma.kit.findMany({
      where: { orgId: req.auth!.orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { equipment: { include: { category: true } } },
        },
      },
    })

    res.json(
      kits.map((kit) => ({
        id: kit.id,
        name: kit.name,
        description: kit.description,
        heightMeters: kit.heightMeters,
        facadeMeters: kit.facadeMeters,
        notes: kit.notes,
        createdAt: kit.createdAt,
        totalWeightKg: kit.items.reduce(
          (total, item) => total + (item.equipment.weightKg ?? 0) * item.quantity,
          0,
        ),
        estimatedDailyRate: kit.items.reduce(
          (total, item) => total + item.equipment.dailyRate * item.quantity,
          0,
        ),
        items: kit.items.map((item) => ({
          id: item.id,
          equipmentId: item.equipmentId,
          quantity: item.quantity,
          code: item.equipment.code,
          name: item.equipment.name,
          unit: item.equipment.unit,
          weightKg: item.equipment.weightKg,
          dailyRate: item.equipment.dailyRate,
          categoryName: item.equipment.category.name,
        })),
      })),
    )
  }),
)

kitsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = kitSchema.parse(req.body)

    const equipmentIds = input.items.map((item) => item.equipmentId)
    const found = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds }, orgId: req.auth!.orgId },
      select: { id: true },
    })
    if (found.length !== new Set(equipmentIds).size) {
      throw new HttpError(400, 'Uma ou mais peças do kit não pertencem à sua locadora')
    }

    const created = await prisma.kit.create({
      data: {
        name: input.name,
        description: input.description,
        heightMeters: input.heightMeters,
        facadeMeters: input.facadeMeters,
        notes: input.notes,
        orgId: req.auth!.orgId,
        items: {
          create: input.items.map((item) => ({
            equipmentId: item.equipmentId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: { include: { equipment: true } } },
    })

    res.status(201).json(created)
  }),
)

kitsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const kit = await prisma.kit.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } })
    if (!kit) throw new HttpError(404, 'Kit não encontrado')
    await prisma.kit.delete({ where: { id: kit.id } })
    res.json({ id: kit.id })
  }),
)
