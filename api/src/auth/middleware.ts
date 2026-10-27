import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../lib/http.js'
import { verifyToken } from './jwt.js'
import './types.js'

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Autenticação necessária'))
    return
  }

  try {
    const payload = verifyToken(header.slice(7))
    req.auth = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      membershipId: payload.membershipId,
    }
    next()
  } catch {
    next(new HttpError(401, 'Sessão expirada ou inválida'))
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new HttpError(401, 'Autenticação necessária'))
      return
    }
    if (!roles.includes(req.auth.role)) {
      next(new HttpError(403, 'Seu perfil não permite esta ação'))
      return
    }
    next()
  }
}
