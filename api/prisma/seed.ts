import { PrismaClient, type RentalStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { billingDays, priceForDays, round2 } from '../src/lib/pricing.js'

const prisma = new PrismaClient()

function day(offset: number) {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
}

async function main() {
  await prisma.stockMovement.deleteMany()
  await prisma.charge.deleteMany()
  await prisma.invite.deleteMany()
  await prisma.rentalEvent.deleteMany()
  await prisma.rentalItem.deleteMany()
  await prisma.rental.deleteMany()
  await prisma.kitItem.deleteMany()
  await prisma.kit.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.equipment.deleteMany()
  await prisma.category.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()

  const org = await prisma.organization.create({
    data: {
      name: 'Locadora Horizonte',
      slug: 'locadora-horizonte',
      document: '12.345.678/0001-90',
      phone: '(11) 4002-8922',
      email: 'operacao@horizonte.com.br',
      city: 'São Paulo, SP',
    },
  })

  const passwordHash = await bcrypt.hash('canteiro123', 10)
  const marina = await prisma.user.create({
    data: {
      name: 'Marina Alves',
      email: 'demo@canteiro.app',
      passwordHash,
      memberships: { create: { role: 'OWNER', orgId: org.id } },
    },
  })
  await prisma.user.create({
    data: {
      name: 'Tiago Souza',
      email: 'operador@canteiro.app',
      passwordHash,
      memberships: { create: { role: 'OPERATOR', orgId: org.id } },
    },
  })

  await prisma.invite.create({
    data: {
      orgId: org.id,
      email: 'mestre@obra.com.br',
      role: 'OPERATOR',
      invitedById: marina.id,
      expiresAt: day(10),
    },
  })

  const categorySeeds = [
    { name: 'Andaimes', slug: 'andaimes' },
    { name: 'Betoneiras', slug: 'betoneiras' },
    { name: 'Geradores', slug: 'geradores' },
    { name: 'Rompimento', slug: 'rompimento' },
    { name: 'Compactação', slug: 'compactacao' },
    { name: 'Acesso e carga', slug: 'acesso-carga' },
  ]

  const categories = new Map<string, string>()
  for (const seed of categorySeeds) {
    const category = await prisma.category.create({
      data: { ...seed, orgId: org.id },
    })
    categories.set(seed.slug, category.id)
  }

  const equipmentSeeds = [
    {
      code: 'AND-P100',
      name: 'Painel de andaime 1,00 x 1,50 m',
      category: 'andaimes',
      description: 'Quadro metálico com piso antiderrapante, aço galvanizado.',
      weightKg: 12.8,
      dailyRate: 6.5,
      weeklyRate: 32,
      monthlyRate: 98,
      replacementValue: 320,
      stockTotal: 220,
      stockMaintenance: 8,
    },
    {
      code: 'AND-P150',
      name: 'Painel de andaime 1,50 x 1,50 m',
      category: 'andaimes',
      description: 'Quadro metálico para vãos maiores.',
      weightKg: 15.4,
      dailyRate: 7.9,
      weeklyRate: 39,
      monthlyRate: 119,
      replacementValue: 390,
      stockTotal: 140,
      stockMaintenance: 4,
    },
    {
      code: 'AND-DIA',
      name: 'Diagonal de travamento 2,00 m',
      category: 'andaimes',
      weightKg: 4.2,
      dailyRate: 3.1,
      weeklyRate: 15,
      monthlyRate: 46,
      replacementValue: 120,
      stockTotal: 180,
      stockMaintenance: 2,
    },
    {
      code: 'AND-TRA',
      name: 'Travessa horizontal 1,00 m',
      category: 'andaimes',
      weightKg: 2.6,
      dailyRate: 2.4,
      weeklyRate: 12,
      monthlyRate: 36,
      replacementValue: 84,
      stockTotal: 200,
      stockMaintenance: 0,
    },
    {
      code: 'AND-SAP',
      name: 'Sapata ajustável 600 mm',
      category: 'andaimes',
      weightKg: 5.1,
      dailyRate: 3.8,
      weeklyRate: 19,
      monthlyRate: 58,
      replacementValue: 145,
      stockTotal: 160,
      stockMaintenance: 6,
    },
    {
      code: 'AND-ROD',
      name: 'Roda de poliuretano com freio',
      category: 'andaimes',
      weightKg: 1.9,
      dailyRate: 4.2,
      weeklyRate: 21,
      monthlyRate: 64,
      replacementValue: 96,
      stockTotal: 120,
      stockMaintenance: 3,
    },
    {
      code: 'AND-PIS',
      name: 'Piso metálico 0,30 x 1,50 m',
      category: 'andaimes',
      weightKg: 8.7,
      dailyRate: 4.5,
      weeklyRate: 22,
      monthlyRate: 68,
      replacementValue: 180,
      stockTotal: 150,
      stockMaintenance: 0,
    },
    {
      code: 'BET-400',
      name: 'Betoneira 400 litros',
      category: 'betoneiras',
      description: 'Motor monofásico 2 CV, com rodas para obra.',
      brand: 'CSM',
      weightKg: 128,
      dailyRate: 68,
      weeklyRate: 320,
      monthlyRate: 980,
      replacementValue: 4200,
      stockTotal: 14,
      stockMaintenance: 1,
    },
    {
      code: 'BET-150',
      name: 'Betoneira 150 litros',
      category: 'betoneiras',
      brand: 'Menegotti',
      weightKg: 62,
      dailyRate: 42,
      weeklyRate: 198,
      monthlyRate: 620,
      replacementValue: 2450,
      stockTotal: 9,
      stockMaintenance: 0,
    },
    {
      code: 'GER-5K',
      name: 'Gerador 5 kVA monofásico',
      category: 'geradores',
      brand: 'Honda',
      weightKg: 74,
      dailyRate: 96,
      weeklyRate: 460,
      monthlyRate: 1380,
      replacementValue: 6800,
      stockTotal: 8,
      stockMaintenance: 0,
    },
    {
      code: 'GER-15K',
      name: 'Gerador 15 kVA trifásico',
      category: 'geradores',
      brand: 'Branco',
      weightKg: 240,
      dailyRate: 185,
      weeklyRate: 890,
      monthlyRate: 2650,
      replacementValue: 15900,
      stockTotal: 4,
      stockMaintenance: 1,
    },
    {
      code: 'ROM-11',
      name: 'Rompedor 11 kg com maleta',
      category: 'rompimento',
      brand: 'Bosch',
      weightKg: 16,
      dailyRate: 88,
      weeklyRate: 420,
      monthlyRate: 1240,
      replacementValue: 5200,
      stockTotal: 10,
      stockMaintenance: 2,
    },
    {
      code: 'PER-30',
      name: 'Perfuratriz SDS-Max 1.500 W',
      category: 'rompimento',
      weightKg: 9.5,
      dailyRate: 72,
      weeklyRate: 345,
      monthlyRate: 1020,
      replacementValue: 3900,
      stockTotal: 7,
      stockMaintenance: 0,
    },
    {
      code: 'PLT-160',
      name: 'Placa vibratória 160 kg',
      category: 'compactacao',
      brand: 'Wacker Neuson',
      weightKg: 88,
      dailyRate: 110,
      weeklyRate: 520,
      monthlyRate: 1560,
      replacementValue: 8900,
      stockTotal: 6,
      stockMaintenance: 1,
    },
    {
      code: 'CMP-80',
      name: 'Compactador de percussão 80 kg',
      category: 'compactacao',
      weightKg: 75,
      dailyRate: 98,
      weeklyRate: 470,
      monthlyRate: 1420,
      replacementValue: 7600,
      stockTotal: 5,
      stockMaintenance: 0,
    },
    {
      code: 'ESC-6',
      name: 'Escada extensível 6 m',
      category: 'acesso-carga',
      weightKg: 18,
      dailyRate: 34,
      weeklyRate: 160,
      monthlyRate: 480,
      replacementValue: 980,
      stockTotal: 18,
      stockMaintenance: 0,
    },
    {
      code: 'TAL-500',
      name: 'Talha manual 500 kg',
      category: 'acesso-carga',
      weightKg: 12,
      dailyRate: 38,
      weeklyRate: 180,
      monthlyRate: 540,
      replacementValue: 1150,
      stockTotal: 12,
      stockMaintenance: 1,
    },
  ]

  const equipments = new Map<
    string,
    { id: string; dailyRate: number; weeklyRate: number | null; monthlyRate: number | null }
  >()
  for (const seed of equipmentSeeds) {
    const created = await prisma.equipment.create({
      data: {
        orgId: org.id,
        categoryId: categories.get(seed.category)!,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        brand: seed.brand,
        unit: seed.weightKg && seed.weightKg > 50 ? 'un' : 'pç',
        weightKg: seed.weightKg,
        dailyRate: seed.dailyRate,
        weeklyRate: seed.weeklyRate,
        monthlyRate: seed.monthlyRate,
        replacementValue: seed.replacementValue,
        stockTotal: seed.stockTotal,
        stockMaintenance: seed.stockMaintenance,
      },
    })
    equipments.set(seed.code, {
      id: created.id,
      dailyRate: created.dailyRate,
      weeklyRate: created.weeklyRate,
      monthlyRate: created.monthlyRate,
    })
  }

  await prisma.stockMovement.createMany({
    data: [
      {
        orgId: org.id,
        equipmentId: equipments.get('AND-P150')!.id,
        kind: 'ADJUSTMENT',
        delta: 6,
        balance: 140,
        note: 'Compra de reposição — NF 8842',
        createdById: marina.id,
        createdAt: day(-8),
      },
      {
        orgId: org.id,
        equipmentId: equipments.get('AND-P100')!.id,
        kind: 'MAINTENANCE',
        delta: 4,
        balance: 8,
        note: 'Lote enviado para revisão de solda',
        createdById: marina.id,
        createdAt: day(-4),
      },
    ],
  })

  const kitSeeds = [
    {
      name: 'Torre de andaime 6 m — fachada de 10 m',
      description: 'Torre de trabalho montada para acabamento de fachada.',
      heightMeters: 6,
      facadeMeters: 10,
      items: [
        { code: 'AND-P150', quantity: 28 },
        { code: 'AND-DIA', quantity: 35 },
        { code: 'AND-TRA', quantity: 56 },
        { code: 'AND-SAP', quantity: 16 },
        { code: 'AND-PIS', quantity: 84 },
      ],
    },
    {
      name: 'Cintamento leve — 12 m',
      description: 'Andaime em cintas para pintura e revisão de alvenaria.',
      heightMeters: 4,
      facadeMeters: 12,
      items: [
        { code: 'AND-P150', quantity: 24 },
        { code: 'AND-DIA', quantity: 32 },
        { code: 'AND-TRA', quantity: 48 },
        { code: 'AND-SAP', quantity: 18 },
        { code: 'AND-PIS', quantity: 72 },
      ],
    },
    {
      name: 'Frente de concretagem',
      description: 'Kit com betoneira, gerador e rompedor para etapa de concretagem.',
      items: [
        { code: 'BET-400', quantity: 1 },
        { code: 'GER-5K', quantity: 1 },
        { code: 'ROM-11', quantity: 1 },
        { code: 'PLT-160', quantity: 1 },
      ],
    },
  ]

  for (const seed of kitSeeds) {
    await prisma.kit.create({
      data: {
        orgId: org.id,
        name: seed.name,
        description: seed.description,
        heightMeters: seed.heightMeters,
        facadeMeters: seed.facadeMeters,
        items: {
          create: seed.items.map((item) => ({
            equipmentId: equipments.get(item.code)!.id,
            quantity: item.quantity,
          })),
        },
      },
    })
  }

  const customerSeeds = [
    { name: 'Construtora Vértice', city: 'São Paulo, SP', contactName: 'Rafael Pires', phone: '(11) 98812-4410', siteAddress: 'Av. Guarapiranga, 1220' },
    { name: 'Engemar Engenharia', city: 'Osasco, SP', contactName: 'Larissa Bueno', phone: '(11) 99745-2300', siteAddress: 'Rua das Acácias, 88' },
    { name: 'Rede Laje Obras', city: 'Guarulhos, SP', contactName: 'Bruno Tavares', phone: '(11) 98220-7712', siteAddress: 'Rod. Presidente Dutra, km 218' },
    { name: 'Pilar Norte Construções', city: 'Campinas, SP', contactName: 'Fernanda Lima', phone: '(19) 99120-3344', siteAddress: 'Rua Cabo Verde, 45' },
    { name: 'Reforma Brás & Filhos', city: 'São Paulo, SP', contactName: 'Osvaldo Brás', phone: '(11) 96631-8890', siteAddress: 'Rua Bresser, 901' },
    { name: 'Estaleiro Urbano', city: 'São Bernardo, SP', contactName: 'Camila Reis', phone: '(11) 97741-1020', siteAddress: 'Av. Industrial, 3300' },
  ]

  const customers: string[] = []
  for (const seed of customerSeeds) {
    const created = await prisma.customer.create({
      data: { ...seed, orgId: org.id, document: null, email: null },
    })
    customers.push(created.id)
  }

  type RentalSeed = {
    customerIndex: number
    siteName: string
    startsAt: number
    expectedReturnAt: number
    status: RentalStatus
    returnedAt?: number
    items: Array<{ code: string; quantity: number }>
    events: Array<{ type: 'CREATED' | 'ACTIVATED' | 'EXTENDED' | 'RETURN_PENDING' | 'RETURNED'; message: string; at: number }>
  }

  const rentalSeeds: RentalSeed[] = [
    {
      customerIndex: 0,
      siteName: 'Edifício Ipê — Guarapiranga',
      startsAt: -18,
      expectedReturnAt: 12,
      status: 'ACTIVE',
      items: [
        { code: 'AND-P100', quantity: 48 },
        { code: 'AND-DIA', quantity: 24 },
        { code: 'AND-TRA', quantity: 32 },
        { code: 'AND-SAP', quantity: 24 },
        { code: 'AND-PIS', quantity: 24 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Construtora Vértice', at: -18 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -17 },
      ],
    },
    {
      customerIndex: 1,
      siteName: 'Galpão Osasco — ampliação',
      startsAt: -26,
      expectedReturnAt: -3,
      status: 'RETURN_PENDING',
      items: [
        { code: 'BET-400', quantity: 2 },
        { code: 'GER-5K', quantity: 1 },
        { code: 'ROM-11', quantity: 2 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Engemar Engenharia', at: -26 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -25 },
        { type: 'EXTENDED', message: 'Prazo estendido por 10 dias', at: -12 },
        { type: 'RETURN_PENDING', message: 'Transporte agendado para recolhimento', at: -4 },
      ],
    },
    {
      customerIndex: 2,
      siteName: 'Condomínio Laje — torre B',
      startsAt: 5,
      expectedReturnAt: 40,
      status: 'QUOTED',
      items: [
        { code: 'AND-P100', quantity: 60 },
        { code: 'AND-P150', quantity: 20 },
        { code: 'AND-DIA', quantity: 30 },
        { code: 'AND-SAP', quantity: 30 },
        { code: 'AND-ROD', quantity: 24 },
      ],
      events: [{ type: 'CREATED', message: 'Proposta criada para Rede Laje Obras', at: -2 }],
    },
    {
      customerIndex: 3,
      siteName: 'Centro Logístico Pilar',
      startsAt: -9,
      expectedReturnAt: 21,
      status: 'ACTIVE',
      items: [
        { code: 'PLT-160', quantity: 3 },
        { code: 'CMP-80', quantity: 2 },
        { code: 'GER-15K', quantity: 1 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Pilar Norte Construções', at: -9 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -8 },
      ],
    },
    {
      customerIndex: 4,
      siteName: 'Reforma Brás — loja matriz',
      startsAt: -40,
      expectedReturnAt: -10,
      status: 'RETURNED',
      returnedAt: -9,
      items: [
        { code: 'AND-P100', quantity: 24 },
        { code: 'AND-DIA', quantity: 12 },
        { code: 'AND-TRA', quantity: 16 },
        { code: 'AND-SAP', quantity: 12 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Reforma Brás & Filhos', at: -40 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -39 },
        { type: 'RETURNED', message: 'Recebido no galpão: 2 painéis avariados', at: -9 },
      ],
    },
    {
      customerIndex: 5,
      siteName: 'Docas Estaleiro — pátio 3',
      startsAt: -6,
      expectedReturnAt: 2,
      status: 'ACTIVE',
      items: [
        { code: 'ESC-6', quantity: 4 },
        { code: 'TAL-500', quantity: 3 },
        { code: 'PER-30', quantity: 2 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Estaleiro Urbano', at: -6 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -6 },
      ],
    },
    {
      customerIndex: 1,
      siteName: 'Engemar — canteiro central',
      startsAt: -2,
      expectedReturnAt: 1,
      status: 'ACTIVE',
      items: [
        { code: 'AND-P100', quantity: 36 },
        { code: 'AND-DIA', quantity: 18 },
        { code: 'AND-TRA', quantity: 24 },
        { code: 'AND-ROD', quantity: 12 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Engemar Engenharia', at: -2 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -2 },
      ],
    },
    {
      customerIndex: 3,
      siteName: 'Pilar Norte — bloco 4',
      startsAt: -14,
      expectedReturnAt: -1,
      status: 'RETURN_PENDING',
      items: [
        { code: 'BET-150', quantity: 2 },
        { code: 'ROM-11', quantity: 1 },
        { code: 'PLT-160', quantity: 1 },
      ],
      events: [
        { type: 'CREATED', message: 'Locação aberta para Pilar Norte Construções', at: -14 },
        { type: 'ACTIVATED', message: 'Carga entregue na obra', at: -13 },
        { type: 'RETURN_PENDING', message: 'Devolução pendente de conferência', at: -2 },
      ],
    },
    {
      customerIndex: 0,
      siteName: 'Vértice — obra Vila Mariana',
      startsAt: 9,
      expectedReturnAt: 39,
      status: 'QUOTED',
      items: [
        { code: 'GER-15K', quantity: 1 },
        { code: 'BET-400', quantity: 1 },
        { code: 'AND-P150', quantity: 12 },
      ],
      events: [{ type: 'CREATED', message: 'Proposta criada para Construtora Vértice', at: -1 }],
    },
  ]

  let counter = 1
  const year = new Date().getUTCFullYear()

  for (const seed of rentalSeeds) {
    const startsAt = day(seed.startsAt)
    const expectedReturnAt = day(seed.expectedReturnAt)
    const days = billingDays(startsAt, expectedReturnAt)
    const periodTotal = round2(
      seed.items.reduce((total, item) => {
        const equipment = equipments.get(item.code)!
        const price = priceForDays(days, equipment)
        return total + price.total * item.quantity
      }, 0),
    )
    const depositAmount = round2(periodTotal * 0.3)
    const rentPaid = seed.status === 'RETURNED' || (seed.status === 'ACTIVE' && seed.startsAt <= -5)
    const charges = [
      {
        kind: 'RENT' as const,
        amount: periodTotal,
        dueDate: startsAt,
        status: rentPaid ? ('PAID' as const) : ('PENDING' as const),
        paidAt: rentPaid ? day(seed.startsAt + 2) : null,
        method: rentPaid ? 'PIX' : null,
        description: `Locação L-${year}-${String(counter).padStart(4, '0')} — ${days} dia(s)`,
      },
      ...(depositAmount > 0
        ? [
            {
              kind: 'DEPOSIT' as const,
              amount: depositAmount,
              dueDate: startsAt,
              status: seed.status === 'QUOTED' ? ('PENDING' as const) : ('PAID' as const),
              paidAt: seed.status === 'QUOTED' ? null : day(seed.startsAt),
              method: seed.status === 'QUOTED' ? null : 'PIX',
              description: `Caução da locação`,
            },
          ]
        : []),
      ...(seed.status === 'RETURN_PENDING'
        ? [
            {
              kind: 'LATE_FEE' as const,
              amount: 180,
              dueDate: day(seed.expectedReturnAt + 1),
              status: 'PENDING' as const,
              paidAt: null,
              method: null,
              description: 'Multa por atraso na devolução',
            },
          ]
        : []),
      ...(seed.status === 'RETURNED'
        ? [
            {
              kind: 'DAMAGE' as const,
              amount: 420,
              dueDate: day((seed.returnedAt ?? seed.expectedReturnAt) + 1),
              status: 'PENDING' as const,
              paidAt: null,
              method: null,
              description: 'Reposição de 2 painéis avariados',
            },
          ]
        : []),
    ]

    const inspections = [
      ...(seed.status !== 'QUOTED'
        ? [
            {
              kind: 'DELIVERY' as const,
              checkedAt: day(seed.startsAt + 1),
              notes: 'Carga conferida na saída do galpão.',
              items: {
                create: seed.items.map((item) => ({
                  equipmentId: equipments.get(item.code)!.id,
                  quantityExpected: item.quantity,
                  quantityChecked: item.quantity,
                })),
              },
            },
          ]
        : []),
      ...(seed.status === 'RETURNED'
        ? [
            {
              kind: 'RETURN' as const,
              checkedAt: day(seed.returnedAt ?? seed.expectedReturnAt),
              notes: 'Dois painéis voltaram amassados.',
              items: {
                create: seed.items.map((item) => ({
                  equipmentId: equipments.get(item.code)!.id,
                  quantityExpected: item.quantity,
                  quantityChecked: item.code === 'AND-P100' ? Math.max(item.quantity - 2, 0) : item.quantity,
                  damaged: item.code === 'AND-P100' ? 2 : 0,
                })),
              },
            },
          ]
        : []),
    ]

    await prisma.rental.create({
      data: {
        code: `L-${year}-${String(counter).padStart(4, '0')}`,
        orgId: org.id,
        customerId: customers[seed.customerIndex]!,
        siteName: seed.siteName,
        startsAt,
        expectedReturnAt,
        status: seed.status,
        depositAmount,
        returnedAt: seed.returnedAt !== undefined ? day(seed.returnedAt) : null,
        items: {
          create: seed.items.map((item) => {
            const equipment = equipments.get(item.code)!
            return { equipmentId: equipment.id, quantity: item.quantity, dailyRate: equipment.dailyRate }
          }),
        },
        charges: {
          create: charges.map((charge) => ({
            orgId: org.id,
            customerId: customers[seed.customerIndex]!,
            ...charge,
          })),
        },
        inspections: { create: inspections },
        events: {
          create: seed.events.map((event) => ({
            type: event.type,
            message: event.message,
            createdAt: day(event.at),
          })),
        },
      },
    })
    counter += 1
  }

  console.log('Seed concluído: Locadora Horizonte pronta para demonstração.')
  console.log('Acesso: demo@canteiro.app ou operador@canteiro.app · senha canteiro123')
  console.log(`Usuário principal: ${marina.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
