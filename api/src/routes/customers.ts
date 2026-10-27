import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

export const customersRouter = Router()

customersRouter.use(requireAuth)

const customerSchema = z.object({
  name: z.string().min(2, 'Informe o nome do cliente'),
  document: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  siteAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

customersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined

    const customers = await prisma.customer.findMany({
      where: {
        orgId: req.auth!.orgId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { rentals: true } },
        rentals: {
          where: { status: { in: ['ACTIVE', 'RETURN_PENDING'] } },
          select: { id: true },
        },
      },
    })

    res.json(
      customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        document: customer.document,
        contactName: customer.contactName,
        phone: customer.phone,
        email: customer.email,
        siteAddress: customer.siteAddress,
        city: customer.city,
        notes: customer.notes,
        rentalCount: customer._count.rentals,
        openRentals: customer.rentals.length,
      })),
    )
  }),
)

customersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = customerSchema.parse(req.body)
    const created = await prisma.customer.create({
      data: { ...input, email: input.email || null, orgId: req.auth!.orgId },
    })
    res.status(201).json(created)
  }),
)

customersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = customerSchema.partial().parse(req.body)
    const current = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
    })
    if (!current) throw new HttpError(404, 'Cliente não encontrado')

    const updated = await prisma.customer.update({
      where: { id: current.id },
      data: { ...input, email: input.email || null },
    })
    res.json(updated)
  }),
)

customersRouter.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const current = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
      include: { _count: { select: { rentals: true } } },
    })
    if (!current) throw new HttpError(404, 'Cliente não encontrado')
    if (current._count.rentals > 0) {
      throw new HttpError(409, 'Cliente possui locações e não pode ser excluído')
    }

    await prisma.customer.delete({ where: { id: current.id } })
    res.json({ id: current.id })
  }),
)
