import type { Equipment } from './types'

export type KitRole = 'module' | 'bracing' | 'horizontal' | 'base' | 'wheel' | 'plank'

export type CalculatorInput = {
  heightMeters: number
  facadeMeters: number
  useWheels: boolean
}

export type CalculatorLine = {
  equipmentId: string
  code: string
  name: string
  role: KitRole
  quantity: number
  unitWeightKg: number
  unitDailyRate: number
  rule: string
}

export type CalculatorResult = {
  bays: number
  levels: number
  towerHeight: number
  facadeLength: number
  platformArea: number
  weightTotalKg: number
  dailyTotal: number
  lines: CalculatorLine[]
  warnings: string[]
}

const BAY_WIDTH = 1.5
const LEVEL_HEIGHT = 1.5
const PLANK_WIDTH = 0.9

function panelWidth(equipment: Equipment) {
  const match = equipment.name.match(/(\d+[.,]\d+)\s*x/)
  return match ? Number(match[1].replace(',', '.')) : Number.NaN
}

function chooseVariant(role: KitRole, equipments: Equipment[]) {
  if (role === 'module') {
    const candidates = equipments
      .map((equipment) => ({ equipment, width: panelWidth(equipment) }))
      .filter((item) => Number.isFinite(item.width))
      .sort((a, b) => Math.abs(a.width - BAY_WIDTH) - Math.abs(b.width - BAY_WIDTH))
    if (candidates.length > 0) return candidates[0].equipment
  }
  return equipments[0]
}

function roleOf(equipment: Equipment): KitRole | null {
  const label = `${equipment.code} ${equipment.name}`.toLowerCase()
  if (/roda|rodízio|rodizio/.test(label)) return 'wheel'
  if (/sapata|base|castelo/.test(label)) return 'base'
  if (/diagonal|contravento/.test(label)) return 'bracing'
  if (/travessa|barra|horizontal/.test(label)) return 'horizontal'
  if (/piso|prancha|assoalho|tablado/.test(label)) return 'plank'
  if (/painel|quadro|torre|andaime|portal/.test(label)) return 'module'
  return null
}

export function calculateKit(input: CalculatorInput, equipments: Equipment[]): CalculatorResult {
  const heightMeters = Math.max(input.heightMeters || 0, 0)
  const facadeMeters = Math.max(input.facadeMeters || 0, 0)

  const bays = Math.max(Math.ceil(facadeMeters / BAY_WIDTH), 1)
  const levels = Math.max(Math.ceil(heightMeters / LEVEL_HEIGHT), 2)
  const frames = bays + 1
  const towerHeight = levels * LEVEL_HEIGHT
  const facadeLength = bays * BAY_WIDTH

  const roleQuantities: Record<KitRole, { quantity: number; rule: string }> = {
    module: { quantity: bays * levels, rule: `${bays} vão(ões) × ${levels} nível(is)` },
    bracing: { quantity: bays * levels + bays, rule: 'Contraventamento por vão e nível + travamento de topo' },
    horizontal: { quantity: bays * levels * 2, rule: 'Duas travessas por vão em cada nível' },
    base: {
      quantity: input.useWheels ? 0 : frames * 2,
      rule: 'Dois pés por montante vertical',
    },
    wheel: {
      quantity: input.useWheels ? frames * 2 : 0,
      rule: 'Dois rodízios com freio por montante',
    },
    plank: { quantity: bays * levels * Math.ceil(PLANK_WIDTH / 0.3), rule: `Plataforma de ${PLANK_WIDTH.toFixed(2)} m por vão e nível` },
  }

  const lines: CalculatorLine[] = []
  const warnings: string[] = []

  const available = equipments.filter((equipment) => equipment.active)
  const byRole = new Map<KitRole, Equipment[]>()
  for (const equipment of available) {
    const role = roleOf(equipment)
    if (!role) continue
    byRole.set(role, [...(byRole.get(role) ?? []), equipment])
  }

  for (const [role, candidates] of byRole) {
    const rule = roleQuantities[role]
    if (rule.quantity <= 0) continue
    const equipment = chooseVariant(role, candidates)
    lines.push({
      equipmentId: equipment.id,
      code: equipment.code,
      name: equipment.name,
      role,
      quantity: rule.quantity,
      unitWeightKg: equipment.weightKg ?? 0,
      unitDailyRate: equipment.dailyRate,
      rule: rule.rule,
    })
  }

  const roles: KitRole[] = ['module', 'bracing', 'horizontal', 'plank', input.useWheels ? 'wheel' : 'base']
  for (const role of roles) {
    if (!lines.some((line) => line.role === role)) {
      warnings.push(`Nenhuma peça com função "${roleLabel(role)}" encontrada no catálogo.`)
    }
  }

  const weightTotalKg = lines.reduce((total, line) => total + line.unitWeightKg * line.quantity, 0)
  const dailyTotal = lines.reduce((total, line) => total + line.unitDailyRate * line.quantity, 0)

  return {
    bays,
    levels,
    towerHeight,
    facadeLength,
    platformArea: facadeLength * PLANK_WIDTH,
    weightTotalKg,
    dailyTotal,
    lines,
    warnings,
  }
}

export function roleLabel(role: KitRole) {
  const labels: Record<KitRole, string> = {
    module: 'painel/quadro',
    bracing: 'diagonal',
    horizontal: 'travessa',
    base: 'sapata',
    wheel: 'rodízio',
    plank: 'piso',
  }
  return labels[role]
}

export const roleColors: Record<KitRole, string> = {
  module: 'var(--status-active)',
  bracing: 'var(--primary)',
  horizontal: 'var(--status-available)',
  base: 'var(--chart-5)',
  wheel: 'var(--status-late)',
  plank: 'var(--muted-foreground)',
}
