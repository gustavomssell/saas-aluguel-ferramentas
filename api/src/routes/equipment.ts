import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

export const equipmentRouter = Router()

equipmentRouter.use(requireAuth)

export const uploadsDir = path.resolve(process.cwd(), 'uploads')

function removePhotoFile(imageUrl: string | null) {
  if (!imageUrl || !imageUrl.startsWith('/api/uploads/')) return
  const filename = path.basename(imageUrl)
  const target = path.join(uploadsDir, filename)
  if (path.dirname(target) !== uploadsDir) return
  fs.promises.unlink(target).catch(() => undefined)
}

equipmentRouter.get(
  '/:id/movements',
  asyncHandler(async (req, res) => {
    const equipment = await prisma.equipment.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
      select: { id: true },
    })
    if (!equipment) throw new HttpError(404, 'Peça não encontrada')

    const movements = await prisma.stockMovement.findMany({
      where: { equipmentId: equipment.id, orgId: req.auth!.orgId },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { createdBy: { select: { name: true } } },
    })

    res.json(
      movements.map((movement) => ({
        id: movement.id,
        kind: movement.kind,
        delta: movement.delta,
        balance: movement.balance,
        note: movement.note,
        createdAt: movement.createdAt.toISOString(),
        createdByName: movement.createdBy?.name ?? null,
      })),
    )
  }),
)

equipmentRouter.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const equipment = await prisma.equipment.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
      select: { id: true },
    })
    if (!equipment) throw new HttpError(404, 'Peça não encontrada')

    const [movements, rentals] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { equipmentId: equipment.id },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { createdBy: { select: { name: true } } },
      }),
      prisma.rental.findMany({
        where: { orgId: req.auth!.orgId, items: { some: { equipmentId: equipment.id } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          customer: { select: { name: true } },
          items: { where: { equipmentId: equipment.id }, select: { quantity: true, dailyRate: true } },
          events: { orderBy: { createdAt: 'desc' } },
          inspections: {
            orderBy: { checkedAt: 'desc' },
            include: { items: { where: { equipmentId: equipment.id } } },
          },
        },
      }),
    ])

    type Entry = {
      id: string
      kind: 'STOCK' | 'RENTAL' | 'INSPECTION'
      date: string
      title: string
      detail: string | null
      tone: 'neutral' | 'positive' | 'negative' | 'warning'
    }

    const entries: Entry[] = []

    for (const movement of movements) {
      entries.push({
        id: `movement-${movement.id}`,
        kind: 'STOCK',
        date: movement.createdAt.toISOString(),
        title:
          movement.kind === 'MAINTENANCE'
            ? `${movement.delta > 0 ? 'Enviadas para' : 'Retornadas da'} manutenção: ${Math.abs(movement.delta)} un.`
            : `Ajuste de estoque: ${movement.delta > 0 ? '+' : ''}${movement.delta} un.`,
        detail: `${movement.note} · saldo ${movement.balance} un.${movement.createdBy ? ` · ${movement.createdBy.name}` : ''}`,
        tone: movement.kind === 'MAINTENANCE' ? 'warning' : movement.delta > 0 ? 'positive' : 'negative',
      })
    }

    for (const rental of rentals) {
      const quantity = rental.items.reduce((total, item) => total + item.quantity, 0)
      entries.push({
        id: `rental-${rental.id}`,
        kind: 'RENTAL',
        date: rental.createdAt.toISOString(),
        title: `Locação ${rental.code} · ${quantity} un.`,
        detail: `${rental.customer.name} · ${rental.siteName ?? 'obra não informada'}`,
        tone: 'neutral',
      })

      for (const event of rental.events) {
        entries.push({
          id: `event-${event.id}`,
          kind: 'RENTAL',
          date: event.createdAt.toISOString(),
          title: rental.code,
          detail: event.message,
          tone: 'neutral',
        })
      }

      for (const inspection of rental.inspections) {
        const item = inspection.items[0]
        if (!item) continue
        const issues = [
          item.damaged > 0 ? `${item.damaged} avariada(s)` : null,
          item.missing > 0 ? `${item.missing} faltando` : null,
        ].filter(Boolean)
        entries.push({
          id: `inspection-${inspection.id}`,
          kind: 'INSPECTION',
          date: inspection.checkedAt.toISOString(),
          title: `Conferência de ${inspection.kind === 'DELIVERY' ? 'entrega' : 'devolução'} · ${rental.code}`,
          detail: `${item.quantityChecked} un. conferidas${issues.length ? ` · ${issues.join(' · ')}` : ' · sem avarias'}${inspection.notes ? ` · ${inspection.notes}` : ''}`,
          tone: item.damaged > 0 || item.missing > 0 ? 'warning' : 'positive',
        })
      }
    }

    entries.sort((a, b) => b.date.localeCompare(a.date))

    res.json({ entries: entries.slice(0, 60) })
  }),
)

const stockSchema = z.object({
  kind: z.enum(['ADJUSTMENT', 'MAINTENANCE']),
  delta: z.coerce.number().int().refine((value) => value !== 0, 'Informe uma quantidade diferente de zero'),
  note: z.string().min(3, 'Descreva o motivo do ajuste'),
})

equipmentRouter.post(
  '/:id/stock',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = stockSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.equipment.findFirst({ where: { id: req.params.id, orgId } })
      if (!current) throw new HttpError(404, 'Peça não encontrada')

      const nextTotal =
        input.kind === 'ADJUSTMENT' ? current.stockTotal + input.delta : current.stockTotal
      const nextMaintenance =
        input.kind === 'MAINTENANCE' ? current.stockMaintenance + input.delta : current.stockMaintenance

      if (nextTotal < 0) throw new HttpError(400, 'O estoque total não pode ficar negativo')
      if (nextMaintenance < 0) throw new HttpError(400, 'As unidades em manutenção não podem ficar negativas')
      if (nextMaintenance > nextTotal) {
        throw new HttpError(400, 'Unidades em manutenção não podem passar do estoque total')
      }

      const updated = await tx.equipment.update({
        where: { id: current.id },
        data: { stockTotal: nextTotal, stockMaintenance: nextMaintenance },
      })

      const movement = await tx.stockMovement.create({
        data: {
          orgId,
          equipmentId: current.id,
          kind: input.kind,
          delta: input.delta,
          balance: input.kind === 'ADJUSTMENT' ? nextTotal : nextMaintenance,
          note: input.note,
          createdById: req.auth!.userId,
        },
      })

      return { updated, movement }
    })

    res.status(201).json({
      stockTotal: result.updated.stockTotal,
      stockMaintenance: result.updated.stockMaintenance,
      movement: {
        id: result.movement.id,
        kind: result.movement.kind,
        delta: result.movement.delta,
        balance: result.movement.balance,
        note: result.movement.note,
        createdAt: result.movement.createdAt.toISOString(),
      },
    })
  }),
)

const photoSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Envie uma imagem JPEG, PNG ou WebP'),
})

equipmentRouter.post(
  '/:id/photo',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = photoSchema.parse(req.body)
    const equipment = await prisma.equipment.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
    })
    if (!equipment) throw new HttpError(404, 'Peça não encontrada')

    const [, mime, payload] = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(input.dataUrl) ?? []
    if (!mime || !payload) throw new HttpError(400, 'Imagem inválida')

    const buffer = Buffer.from(payload, 'base64')
    if (buffer.byteLength > 600_000) throw new HttpError(413, 'Imagem muito grande (limite de 600 KB)')

    await fs.promises.mkdir(uploadsDir, { recursive: true })
    const extension = mime === 'jpeg' ? 'jpg' : mime
    const filename = `${equipment.id}-${Date.now()}.${extension}`
    await fs.promises.writeFile(path.join(uploadsDir, filename), buffer)

    removePhotoFile(equipment.imageUrl)
    const imageUrl = `/api/uploads/${filename}`
    await prisma.equipment.update({ where: { id: equipment.id }, data: { imageUrl } })

    res.status(201).json({ imageUrl })
  }),
)

equipmentRouter.delete(
  '/:id/photo',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const equipment = await prisma.equipment.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
    })
    if (!equipment) throw new HttpError(404, 'Peça não encontrada')

    removePhotoFile(equipment.imageUrl)
    await prisma.equipment.update({ where: { id: equipment.id }, data: { imageUrl: null } })
    res.json({ imageUrl: null })
  }),
)
