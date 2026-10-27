import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export const OCCUPYING_STATUSES = ['QUOTED', 'ACTIVE', 'RETURN_PENDING'] as const

export function overlapFilter(from: Date, to: Date): Prisma.RentalWhereInput {
  return {
    status: { in: [...OCCUPYING_STATUSES] },
    startsAt: { lt: to },
    OR: [
      { status: 'QUOTED', expectedReturnAt: { gt: from } },
      { status: { in: ['ACTIVE', 'RETURN_PENDING'] } },
    ],
  }
}

export async function reservedByEquipment(
  orgId: string,
  from: Date,
  to: Date,
  options: { excludeRentalId?: string } = {},
): Promise<Map<string, number>> {
  const grouped = await prisma.rentalItem.groupBy({
    by: ['equipmentId'],
    where: {
      rental: {
        orgId,
        ...overlapFilter(from, to),
        ...(options.excludeRentalId ? { id: { not: options.excludeRentalId } } : {}),
      },
    },
    _sum: { quantity: true },
  })

  return new Map(grouped.map((row) => [row.equipmentId, row._sum.quantity ?? 0]))
}
