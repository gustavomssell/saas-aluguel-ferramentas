import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

export const teamRouter = Router()

teamRouter.use(requireAuth)

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
}

const ROLE_ORDER = { OWNER: 0, ADMIN: 1, OPERATOR: 2 } as const

function serializeOrg(org: {
  id: string
  name: string
  slug: string
  document: string | null
  phone: string | null
  email: string | null
  city: string | null
}) {
  return org
}

teamRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId
    const [organization, memberships, invites] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, slug: true, document: true, phone: true, email: true, city: true },
      }),
      prisma.membership.findMany({
        where: { orgId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.invite.findMany({
        where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    if (!organization) throw new HttpError(404, 'Locadora não encontrada')

    const members = memberships
      .map((membership) => ({
        membershipId: membership.id,
        userId: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        roleLabel: ROLE_LABEL[membership.role],
        joinedAt: membership.createdAt,
        isCurrentUser: membership.userId === req.auth!.userId,
      }))
      .sort((a, b) => {
        if (a.role !== b.role) return ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
        return a.name.localeCompare(b.name, 'pt-BR')
      })

    res.json({
      organization: { ...serializeOrg(organization), role: req.auth!.role },
      members,
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        roleLabel: ROLE_LABEL[invite.role],
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      })),
    })
  }),
)

const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  role: z.enum(['OWNER', 'ADMIN', 'OPERATOR']).default('OPERATOR'),
})

teamRouter.post(
  '/invites',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = inviteSchema.parse(req.body)
    const orgId = req.auth!.orgId
    const email = input.email.toLowerCase()

    if (req.auth!.role === 'ADMIN' && input.role === 'OWNER') {
      throw new HttpError(403, 'Somente o proprietário pode convidar outro proprietário')
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const membership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId } },
      })
      if (membership) throw new HttpError(409, 'Este e-mail já pertence à equipe')

      const created = await prisma.membership.create({
        data: { userId: existingUser.id, orgId, role: input.role },
        include: { user: { select: { id: true, name: true, email: true } } },
      })

      res.status(201).json({
        type: 'member',
        member: {
          membershipId: created.id,
          userId: created.user.id,
          name: created.user.name,
          email: created.user.email,
          role: created.role,
          roleLabel: ROLE_LABEL[created.role],
          joinedAt: created.createdAt,
          isCurrentUser: false,
        },
      })
      return
    }

    const pending = await prisma.invite.findFirst({
      where: { orgId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    })
    if (pending) throw new HttpError(409, 'Já existe um convite pendente para este e-mail')

    const invite = await prisma.invite.create({
      data: {
        orgId,
        email,
        role: input.role,
        invitedById: req.auth!.userId,
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      },
    })

    res.status(201).json({
      type: 'invite',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        roleLabel: ROLE_LABEL[invite.role],
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    })
  }),
)

teamRouter.delete(
  '/invites/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const invite = await prisma.invite.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId, acceptedAt: null },
    })
    if (!invite) throw new HttpError(404, 'Convite não encontrado')
    await prisma.invite.delete({ where: { id: invite.id } })
    res.status(204).end()
  }),
)

const roleSchema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'OPERATOR']) })

teamRouter.patch(
  '/members/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = roleSchema.parse(req.body)
    const orgId = req.auth!.orgId

    const membership = await prisma.membership.findFirst({
      where: { id: req.params.id, orgId },
      include: { user: { select: { name: true } } },
    })
    if (!membership) throw new HttpError(404, 'Membro não encontrado')

    if (membership.role === 'OWNER') {
      throw new HttpError(409, 'O proprietário da locadora não pode ser alterado')
    }
    if (req.auth!.role === 'ADMIN' && (input.role === 'OWNER' || membership.role === 'ADMIN')) {
      throw new HttpError(403, 'Administradores não podem alterar outros administradores')
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { role: input.role },
    })

    res.json({
      membershipId: updated.id,
      role: updated.role,
      roleLabel: ROLE_LABEL[updated.role],
    })
  }),
)

teamRouter.delete(
  '/members/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const membership = await prisma.membership.findFirst({
      where: { id: req.params.id, orgId: req.auth!.orgId },
    })
    if (!membership) throw new HttpError(404, 'Membro não encontrado')
    if (membership.userId === req.auth!.userId) throw new HttpError(409, 'Você não pode remover a si mesmo')
    if (membership.role === 'OWNER') throw new HttpError(409, 'O proprietário não pode ser removido')
    if (req.auth!.role === 'ADMIN' && membership.role === 'ADMIN') {
      throw new HttpError(403, 'Administradores não podem remover outros administradores')
    }

    await prisma.membership.delete({ where: { id: membership.id } })
    res.status(204).end()
  }),
)

const orgSchema = z.object({
  name: z.string().min(2, 'Informe o nome da locadora').optional(),
  document: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  city: z.string().optional().nullable(),
})

teamRouter.patch(
  '/organization',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = orgSchema.parse(req.body)
    const org = await prisma.organization.update({
      where: { id: req.auth!.orgId },
      data: {
        name: input.name,
        document: input.document,
        phone: input.phone,
        city: input.city,
        email: input.email === '' ? null : input.email,
      },
      select: { id: true, name: true, slug: true, document: true, phone: true, email: true, city: true },
    })
    res.json(org)
  }),
)
