import { describe, expect, it } from 'vitest'
import type { Equipment } from './types'
import { calculateKit, roleLabel } from './kitCalculator'

function equipment(
  overrides: Partial<Equipment> & Pick<Equipment, 'id' | 'code' | 'name'>,
): Equipment {
  return {
    description: null,
    brand: null,
    unit: 'pç',
    weightKg: 1,
    dailyRate: 1,
    weeklyRate: null,
    monthlyRate: null,
    replacementValue: 100,
    stockTotal: 100,
    stockMaintenance: 0,
    imageUrl: null,
    active: true,
    reservedToday: 0,
    availableToday: 100,
    inFieldToday: 0,
    category: { id: 'cat-andaimes', name: 'Andaimes', slug: 'andaimes' },
    ...overrides,
  }
}

const catalog: Equipment[] = [
  equipment({ id: 'p100', code: 'AND-P100', name: 'Painel de andaime 1,00 x 1,50 m', weightKg: 12.8, dailyRate: 6.5 }),
  equipment({ id: 'p150', code: 'AND-P150', name: 'Painel de andaime 1,50 x 1,50 m', weightKg: 15.4, dailyRate: 7.9 }),
  equipment({ id: 'diag', code: 'AND-DIA', name: 'Diagonal de travamento 2,00 m', weightKg: 4.2, dailyRate: 3.1 }),
  equipment({ id: 'trav', code: 'AND-TRA', name: 'Travessa horizontal 1,00 m', weightKg: 2.6, dailyRate: 2.4 }),
  equipment({ id: 'sap', code: 'AND-SAP', name: 'Sapata ajustável 600 mm', weightKg: 5.1, dailyRate: 3.8 }),
  equipment({ id: 'roda', code: 'AND-ROD', name: 'Roda de poliuretano com freio', weightKg: 1.9, dailyRate: 4.2 }),
  equipment({ id: 'piso', code: 'AND-PIS', name: 'Piso metálico 0,30 x 1,50 m', weightKg: 8.7, dailyRate: 4.5 }),
]

describe('calculateKit', () => {
  it('converte altura e fachada em vãos e níveis', () => {
    const result = calculateKit({ heightMeters: 6, facadeMeters: 10, useWheels: false }, catalog)
    expect(result).toMatchObject({ bays: 7, levels: 4, towerHeight: 6, facadeLength: 10.5 })
    expect(result.platformArea).toBeCloseTo(9.45, 5)
  })

  it('calcula quantidades por função e escolhe o painel de 1,50 m', () => {
    const result = calculateKit({ heightMeters: 6, facadeMeters: 10, useWheels: false }, catalog)
    const byRole = Object.fromEntries(result.lines.map((line) => [line.role, line]))

    expect(byRole.module).toMatchObject({ code: 'AND-P150', quantity: 28 })
    expect(byRole.bracing.quantity).toBe(35)
    expect(byRole.horizontal.quantity).toBe(56)
    expect(byRole.base.quantity).toBe(16)
    expect(byRole.plank.quantity).toBe(84)
    expect(byRole.wheel).toBeUndefined()
    expect(result.warnings).toEqual([])
  })

  it('soma peso e diária do kit completo', () => {
    const result = calculateKit({ heightMeters: 6, facadeMeters: 10, useWheels: false }, catalog)
    expect(result.weightTotalKg).toBeCloseTo(1536.2, 1)
    expect(result.dailyTotal).toBeCloseTo(902.9, 1)
  })

  it('troca sapatas por rodízios quando a torre é móvel', () => {
    const result = calculateKit({ heightMeters: 6, facadeMeters: 10, useWheels: true }, catalog)
    const byRole = Object.fromEntries(result.lines.map((line) => [line.role, line]))
    expect(byRole.wheel.quantity).toBe(16)
    expect(byRole.base).toBeUndefined()
  })

  it('garante uma torre mínima de 1 vão por 2 níveis', () => {
    const result = calculateKit({ heightMeters: 0, facadeMeters: 0, useWheels: false }, catalog)
    expect(result).toMatchObject({ bays: 1, levels: 2, facadeLength: 1.5, towerHeight: 3 })
  })

  it('avisa quando falta uma função no catálogo', () => {
    const semDiagonal = catalog.filter((item) => item.id !== 'diag')
    const result = calculateKit({ heightMeters: 6, facadeMeters: 10, useWheels: false }, semDiagonal)
    expect(result.warnings).toContain('Nenhuma peça com função "diagonal" encontrada no catálogo.')
  })

  it('ignora peças inativas', () => {
    const inativos = catalog.map((item) => (item.id === 'p150' ? { ...item, active: false } : item))
    const result = calculateKit({ heightMeters: 6, facadeMeters: 10, useWheels: false }, inativos)
    const module = result.lines.find((line) => line.role === 'module')
    expect(module?.code).toBe('AND-P100')
  })
})

describe('roleLabel', () => {
  it('traduz as funções do kit', () => {
    expect(roleLabel('module')).toBe('painel/quadro')
    expect(roleLabel('wheel')).toBe('rodízio')
    expect(roleLabel('plank')).toBe('piso')
  })
})
