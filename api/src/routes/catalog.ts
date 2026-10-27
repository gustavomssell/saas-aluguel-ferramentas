import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { reservedByEquipment } from '../lib/availability.js'

export const catalogRouter = Router()

catalogRouter.use(requireAuth)

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

const categorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria'),
})

catalogRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { orgId: req.auth!.orgId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { equipments: true } } },
    })

    res.json(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        equipmentCount: category._count.equipments,
      })),
    )
  }),
)

catalogRouter.post(
  '/categories',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = categorySchema.parse(req.body)
    const slug = input.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const created = await prisma.category.create({
      data: { name: input.name, slug, orgId: req.auth!.orgId },
    })
    res.status(201).json(created)
  }),
)

const equipmentSchema = z.object({
  code: z.string().min(1, 'Informe o código da peça'),
  name: z.string().min(2, 'Informe o nome'),
  categoryId: z.string().min(1, 'Selecione a categoria'),
  description: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  unit: z.string().min(1).default('un'),
  weightKg: z.coerce.number().min(0).optional().nullable(),
  dailyRate: z.coerce.number().min(0),
  weeklyRate: z.coerce.number().min(0).optional().nullable(),
  monthlyRate: z.coerce.number().min(0).optional().nullable(),
  replacementValue: z.coerce.number().min(0).default(0),
  stockTotal: z.coerce.number().int().min(0),
  stockMaintenance: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
})

catalogRouter.get(
  '/equipment',
  asyncHandler(async (req, res) => {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined
    const includeInactive = req.query.includeInactive === 'true'

    const equipments = await prisma.equipment.findMany({
      where: {
        orgId: req.auth!.orgId,
        ...(categoryId ? { categoryId } : {}),
        ...(includeInactive ? {} : { active: true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { code: 'asc' }],
    })

    const today = startOfDay(new Date())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const reserved = await reservedByEquipment(req.auth!.orgId, today, tomorrow)

    res.json(
      equipments.map((equipment) => {
        const booked = reserved.get(equipment.id) ?? 0
        const physicallyAvailable = Math.max(equipment.stockTotal - equipment.stockMaintenance, 0)
        return {
          id: equipment.id,
          code: equipment.code,
          name: equipment.name,
          description: equipment.description,
          brand: equipment.brand,
          unit: equipment.unit,
          weightKg: equipment.weightKg,
          dailyRate: equipment.dailyRate,
          weeklyRate: equipment.weeklyRate,
          monthlyRate: equipment.monthlyRate,
          replacementValue: equipment.replacementValue,
          stockTotal: equipment.stockTotal,
          stockMaintenance: equipment.stockMaintenance,
          imageUrl: equipment.imageUrl,
          active: equipment.active,
          reservedToday: booked,
          availableToday: Math.max(physicallyAvailable - booked, 0),
          inFieldToday: Math.min(booked, physicallyAvailable),
          category: { id: equipment.category.id, name: equipment.category.name, slug: equipment.category.slug },
        }
      }),
    )
  }),
)

catalogRouter.post(
  '/equipment',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = equipmentSchema.parse(req.body)
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, orgId: req.auth!.orgId },
    })
    if (!category) throw new HttpError(404, 'Categoria não encontrada')

    const conflict = await prisma.equipment.findFirst({
      where: { orgId: req.auth!.orgId, code: input.code },
    })
    if (conflict) throw new HttpError(409, 'Já existe uma peça com este código')

    const created = await prisma.equipment.create({
      data: { ...input, orgId: req.auth!.orgId },
      include: { category: true },
    })
    res.status(201).json(created)
  }),
)

catalogRouter.patch(
  '/equipment/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = equipmentSchema.partial().parse(req.body)
    const current = await prisma.equipment.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
    })
    if (!current) throw new HttpError(404, 'Peça não encontrada')

    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, orgId: req.auth!.orgId },
      })
      if (!category) throw new HttpError(404, 'Categoria não encontrada')
    }

    const updated = await prisma.equipment.update({
      where: { id: current.id },
      data: input,
      include: { category: true },
    })
    res.json(updated)
  }),
)

catalogRouter.delete(
  '/equipment/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const current = await prisma.equipment.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
      include: { _count: { select: { rentalItems: true } } },
    })
    if (!current) throw new HttpError(404, 'Peça não encontrada')

    if (current._count.rentalItems > 0) {
      const updated = await prisma.equipment.update({
        where: { id: current.id },
        data: { active: false },
      })
      res.json({ id: updated.id, archived: true })
      return
    }

    await prisma.equipment.delete({ where: { id: current.id } })
    res.json({ id: current.id, archived: false })
  }),
)

catalogRouter.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const from = startOfDay(new Date(dateOnly.parse(req.query.from ?? new Date().toISOString().slice(0, 10))))
    const to = startOfDay(
      new Date(dateOnly.parse(req.query.to ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))),
    )
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined

    const equipments = await prisma.equipment.findMany({
      where: { orgId: req.auth!.orgId, active: true, ...(categoryId ? { categoryId } : {}) },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { code: 'asc' }],
    })

    const reserved = await reservedByEquipment(req.auth!.orgId, from, to)

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      equipments: equipments.map((equipment) => {
        const booked = reserved.get(equipment.id) ?? 0
        const physicallyAvailable = Math.max(equipment.stockTotal - equipment.stockMaintenance, 0)
        return {
          id: equipment.id,
          code: equipment.code,
          name: equipment.name,
          categoryName: equipment.category.name,
          stockTotal: equipment.stockTotal,
          stockMaintenance: equipment.stockMaintenance,
          reserved: booked,
          available: Math.max(physicallyAvailable - booked, 0),
        }
      }),
    })
  }),
)
