import type { Role } from '@prisma/client'

export type AuthContext = {
  userId: string
  orgId: string
  role: Role
  membershipId: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}
