import { describe, expect, it } from 'vitest'
import { createContractPdf, type ContractPdfData } from './contractPdf.js'

const data: ContractPdfData = {
  generatedAt: '2026-10-27T12:00:00.000Z',
  organization: {
    name: 'Locadora Horizonte',
    document: '12.345.678/0001-90',
    phone: '(11) 4002-8922',
    email: 'operacao@horizonte.com.br',
    city: 'São Paulo, SP',
  },
  rental: {
    code: 'L-2026-0001',
    days: 30,
    startsAt: '2026-10-01T00:00:00.000Z',
    expectedReturnAt: '2026-10-31T00:00:00.000Z',
    siteName: 'Edifício Ipê — Guarapiranga',
    depositAmount: 300,
    periodTotal: 1000,
    totalWeightKg: 1234.5,
    customer: { name: 'Construtora Vértice', city: 'São Paulo, SP', phone: '(11) 98812-4410' },
    items: [
      {
        code: 'AND-P100',
        name: 'Painel de andaime 1,00 x 1,50 m',
        categoryName: 'Andaimes',
        quantity: 48,
        weightKg: 12.8,
        periodTotal: 480,
      },
      {
        code: 'AND-DIA',
        name: 'Diagonal de travamento 2,00 m',
        categoryName: 'Andaimes',
        quantity: 24,
        weightKg: 4.2,
        periodTotal: 120,
      },
    ],
    finance: { paidAmount: 700, openAmount: 600 },
  },
}

describe('createContractPdf', () => {
  it('gera um arquivo PDF válido', async () => {
    const doc = createContractPdf(data)
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    const ended = new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve())
      doc.on('error', reject)
    })

    doc.end()
    await ended

    const pdf = Buffer.concat(chunks)
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(1500)
  })

  it('sobrevive a uma locação com muitos itens e quebra de página', async () => {
    const many = {
      ...data,
      rental: {
        ...data.rental,
        items: Array.from({ length: 40 }, (_, index) => ({
          code: `AND-${index}`,
          name: `Peça de andaime ${index} com descrição longa para testar a quebra de linha`,
          categoryName: 'Andaimes',
          quantity: index + 1,
          weightKg: 10,
          periodTotal: 100,
        })),
      },
    } satisfies ContractPdfData

    const doc = createContractPdf(many)
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    const ended = new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve())
      doc.on('error', reject)
    })

    doc.end()
    await ended

    const pdf = Buffer.concat(chunks)
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(4000)
  })
})
