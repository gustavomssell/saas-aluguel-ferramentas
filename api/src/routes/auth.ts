import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError, asyncHandler } from '../lib/http.js'
import { requireAuth } from '../auth/middleware.js'
import { signToken } from '../auth/jwt.js'

export const authRouter = Router()

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function uniqueSlug(base: string) {
  const seed = slugify(base) || 'locadora'
  let candidate = seed
  let attempt = 1
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    attempt += 1
    candidate = `${seed}-${attempt}`
  }
  return candidate
}

async function sessionFor(userId: string, orgId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    include: { org: true, user: true },
  })

  if (!membership) throw new HttpError(403, 'Você não tem acesso a esta locadora')

  const token = signToken({
    sub: membership.userId,
    orgId: membership.orgId,
    role: membership.role,
    membershipId: membership.id,
  })

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { org: true },
    orderBy: { createdAt: 'asc' },
  })

  return {
    token,
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
    },
    organization: {
      id: membership.org.id,
      name: membership.org.name,
      slug: membership.org.slug,
      role: membership.role,
    },
    memberships: memberships.map((item) => ({
      organizationId: item.org.id,
      name: item.org.name,
      slug: item.org.slug,
      role: item.role,
    })),
  }
}

const registerSchema = z.object({
  orgName: z.string().optional(),
  name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Use ao menos 8 caracteres'),
})

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body)
    const email = input.email.toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new HttpError(409, 'Já existe uma conta com este e-mail')

    const invites = await prisma.invite.findMany({
      where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    })
    const orgName = input.orgName?.trim() ?? ''
    if (invites.length === 0 && orgName.length < 2) {
      throw new HttpError(422, 'Informe o nome da locadora')
    }

    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await prisma.user.create({
      data: { name: input.name, email, passwordHash },
    })

    let orgId: string

    if (invites.length > 0) {
      for (const invite of invites) {
        await prisma.membership.create({
          data: { userId: user.id, orgId: invite.orgId, role: invite.role },
        })
        await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })
      }
      orgId = invites[0]!.orgId
    } else {
      const slug = await uniqueSlug(orgName)
      const organization = await prisma.organization.create({ data: { name: orgName, slug } })
      const membership = await prisma.membership.create({
        data: { userId: user.id, orgId: organization.id, role: 'OWNER' },
      })
      orgId = membership.orgId
    }

    const session = await sessionFor(user.id, orgId)
    res.status(201).json(session)
  }),
)

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { memberships: { orderBy: { createdAt: 'asc' } } },
    })

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, 'E-mail ou senha incorretos')
    }

    if (user.memberships.length === 0) throw new HttpError(403, 'Usuário sem locadora vinculada')

    const session = await sessionFor(user.id, user.memberships[0]!.orgId)
    res.json(session)
  }),
)

const switchSchema = z.object({ organizationId: z.string().min(1) })

authRouter.post(
  '/switch-org',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = switchSchema.parse(req.body)
    const session = await sessionFor(req.auth!.userId, input.organizationId)
    res.json(session)
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await sessionFor(req.auth!.userId, req.auth!.orgId)
    res.json(session)
  }),
)
