import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { env } from '../env.js'

export type TokenPayload = {
  sub: string
  orgId: string
  role: Role
  membershipId: string
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload
}
