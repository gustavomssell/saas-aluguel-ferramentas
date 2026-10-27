import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit') as new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function formatDay(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(typeof value === 'string' ? new Date(value) : value)
}

function formatWeight(value: number) {
  if (!value) return '—'
  if (value >= 1000) return `${number.format(value / 1000)} t`
  return `${number.format(value)} kg`
}

export type ContractPdfData = {
  generatedAt: string | Date
  organization: {
    name: string
    document: string | null
    phone: string | null
    email: string | null
    city: string | null
  } | null
  rental: {
    code: string
    days: number
    startsAt: string | Date
    expectedReturnAt: string | Date
    siteName: string | null
    depositAmount: number
    periodTotal: number
    totalWeightKg: number
    customer: { name: string; city: string | null; phone: string | null }
    items: Array<{
      code: string
      name: string
      categoryName: string
      quantity: number
      weightKg: number | null
      periodTotal: number
    }>
    finance: { paidAmount: number; openAmount: number }
  }
}

const INK = '#1a1a1a'
const MUTED = '#6b6b6b'
const RULE = '#d4d4d4'

export function createContractPdf(data: ContractPdfData) {
  const { rental, organization: org } = data
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: {
      Title: `Contrato ${rental.code}`,
      Author: org?.name ?? 'Canteiro',
      Subject: 'Contrato de locação de equipamentos',
    },
  })

  const left = doc.page.margins.left
  const width = doc.page.width - left - doc.page.margins.right
  const bottom = doc.page.height - doc.page.margins.bottom
  let y = doc.page.margins.top

  const orgLines = [
    org?.document ? `CNPJ ${org.document}` : 'CNPJ não informado',
    org?.city,
    [org?.phone, org?.email].filter(Boolean).join(' · ') || null,
  ]
    .filter(Boolean)
    .join('\n')

  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(org?.name ?? 'Locadora', left, y, { width: 320 })
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text('LOCAÇÃO DE EQUIPAMENTOS', left, y + 21, { width: 320, characterSpacing: 1 })
  doc.fontSize(8).fillColor(MUTED).text(orgLines, left, y + 35, { width: 320, lineGap: 1 })

  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('CONTRATO', left + width - 160, y, {
    width: 160,
    align: 'right',
    characterSpacing: 1,
  })
  doc.font('Helvetica-Bold').fontSize(17).fillColor(INK).text(rental.code, left + width - 160, y + 10, {
    width: 160,
    align: 'right',
  })
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(`emitido em ${formatDay(data.generatedAt)}`, left + width - 160, y + 32, {
      width: 160,
      align: 'right',
    })

  y += 78
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.5).stroke(INK)
  y += 18
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(INK)
    .text('CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS', left, y, { width, align: 'center', characterSpacing: 0.4 })
  y += 28

  const gap = 24
  const colWidth = (width - gap) / 2
  const rightCol = left + colWidth + gap

  const locadora = [org?.name ?? 'Locadora', orgLines].join('\n')
  const locatario = [
    rental.customer.name,
    [rental.customer.city, rental.customer.phone].filter(Boolean).join(' · ') || 'Contato não informado',
    `Obra: ${rental.siteName ?? 'não informada'}`,
    `Período: ${formatDay(rental.startsAt)} a ${formatDay(rental.expectedReturnAt)} (${rental.days} dias)`,
  ].join('\n')

  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text('LOCADORA', left, y, { characterSpacing: 0.8 })
  doc.font('Helvetica').fontSize(8).fillColor(INK).text(locadora, left, y + 12, { width: colWidth, lineGap: 2 })
  const locadoraHeight = doc.heightOfString(locadora, { width: colWidth, lineGap: 2 })

  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text('LOCATÁRIO', rightCol, y, { characterSpacing: 0.8 })
  doc.font('Helvetica').fontSize(8).fillColor(INK).text(locatario, rightCol, y + 12, { width: colWidth, lineGap: 2 })
  const locatarioHeight = doc.heightOfString(locatario, { width: colWidth, lineGap: 2 })

  y += 12 + Math.max(locadoraHeight, locatarioHeight) + 22

  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text('EQUIPAMENTOS LOCADOS', left, y, { characterSpacing: 0.8 })
  y += 13

  const colCode = 58
  const colQty = 30
  const colWeight = 58
  const colTotal = 88
  const colDesc = width - colCode - colQty - colWeight - colTotal
  const xDesc = left + colCode
  const xQty = xDesc + colDesc
  const xWeight = xQty + colQty
  const xTotal = xWeight + colWeight

  function tableHeader() {
    doc.rect(left, y, width, 16).fill('#f1f1ef')
    doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
    doc.text('CÓDIGO', left + 4, y + 5, { width: colCode - 8 })
    doc.text('DESCRIÇÃO', xDesc, y + 5, { width: colDesc - 6 })
    doc.text('QTD.', xQty, y + 5, { width: colQty - 4, align: 'right' })
    doc.text('PESO', xWeight, y + 5, { width: colWeight - 4, align: 'right' })
    doc.text('TOTAL', xTotal, y + 5, { width: colTotal - 4, align: 'right' })
    y += 16
  }

  tableHeader()

  for (const item of rental.items) {
    const description = `${item.name} · ${item.categoryName}`
    doc.font('Helvetica').fontSize(8)
    const rowHeight = Math.max(20, doc.heightOfString(description, { width: colDesc - 6 }) + 10)

    if (y + rowHeight > bottom - 54) {
      doc.addPage()
      y = doc.page.margins.top
      tableHeader()
    }

    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item.code, left + 4, y + 5, { width: colCode - 8 })
    doc.fillColor(INK).text(description, xDesc, y + 5, { width: colDesc - 6, lineGap: 1 })
    doc
      .text(String(item.quantity), xQty, y + 5, { width: colQty - 4, align: 'right' })
      .text(formatWeight((item.weightKg ?? 0) * item.quantity), xWeight, y + 5, {
        width: colWeight - 4,
        align: 'right',
      })
      .text(brl.format(item.periodTotal), xTotal, y + 5, { width: colTotal - 4, align: 'right' })

    y += rowHeight
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).stroke(RULE)
  }

  y += 18

  const conditions = [
    ['1. Objeto.', `A locadora cede ao locatário, em regime de locação, os equipamentos descritos acima, destinados exclusivamente à obra indicada.`],
    ['2. Prazo.', `O prazo contratado é de ${rental.days} dias, contados de ${formatDay(rental.startsAt)}. A prorrogação depende de disponibilidade e deve ser solicitada antes do vencimento.`],
    ['3. Caução.', `A caução de ${brl.format(rental.depositAmount)} garante a conservação e a devolução dos equipamentos, sendo restituída após conferência de retorno, descontados eventuais danos ou faltas.`],
    ['4. Devolução.', `O locatário devolve os equipamentos limpos e em condições de uso até ${formatDay(rental.expectedReturnAt)}. Atrasos sujeitam-se à diária vigente e multa contratual.`],
    ['5. Responsabilidade.', 'O locatário responde por perda, furto, avaria ou mau uso, pelo valor de reposição de cada peça.'],
  ] as const

  const conditionsWidth = 300
  const boxWidth = width - conditionsWidth - 24
  const boxX = left + conditionsWidth + 24

  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED).text('CONDIÇÕES', left, y, { characterSpacing: 0.8 })
  y += 12

  const total = rental.periodTotal + rental.depositAmount
  const boxRows: Array<[string, string, boolean?]> = [
    [`Locação (${rental.days} dias)`, brl.format(rental.periodTotal)],
    ['Caução', brl.format(rental.depositAmount)],
    ['Total do contrato', brl.format(total), true],
    [`Recebido`, brl.format(rental.finance.paidAmount)],
    ['Em aberto', brl.format(rental.finance.openAmount)],
    ['Peso total', formatWeight(rental.totalWeightKg)],
  ]
  const boxHeight = 18 + boxRows.length * 15 + 10

  const conditionsHeight = conditions.reduce((height, [title, text]) => {
    doc.font('Helvetica-Bold').fontSize(7.5)
    const titleWidth = doc.widthOfString(title)
    doc.font('Helvetica').fontSize(7.5)
    const textHeight = doc.heightOfString(text, {
      width: conditionsWidth - titleWidth - 4,
      lineGap: 1.5,
    })
    return height + Math.max(textHeight, 10) + 6
  }, 0)

  if (y + Math.max(conditionsHeight, boxHeight) + 100 > bottom) {
    doc.addPage()
    y = doc.page.margins.top
  }

  const conditionsTop = y
  let cursor = y
  for (const [title, text] of conditions) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK)
    const titleWidth = doc.widthOfString(title)
    doc.text(title, left, cursor, { width: titleWidth + 2 })
    doc.font('Helvetica').fontSize(7.5).fillColor('#3f3f3f')
    doc.text(text, left + titleWidth + 4, cursor, { width: conditionsWidth - titleWidth - 4, lineGap: 1.5 })
    cursor = doc.y + 6
  }

  doc.rect(boxX, conditionsTop - 6, boxWidth, boxHeight).lineWidth(0.8).stroke('#9a9a9a')
  let boxY = conditionsTop + 4
  for (const [label, value, strong] of boxRows) {
    doc
      .font(strong ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(strong ? 9 : 8)
      .fillColor(strong ? INK : MUTED)
      .text(label, boxX + 10, boxY, { width: boxWidth - 90 })
    doc
      .font(strong ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(strong ? 9 : 8)
      .fillColor(INK)
      .text(value, boxX + boxWidth - 90, boxY, { width: 80, align: 'right' })
    boxY += 15
  }

  y = Math.max(cursor, conditionsTop + boxHeight) + 34

  if (y + 80 > bottom) {
    doc.addPage()
    y = doc.page.margins.top
  }

  const signatureWidth = (width - gap) / 2
  doc.moveTo(left, y).lineTo(left + signatureWidth, y).lineWidth(0.8).stroke('#9a9a9a')
  doc.moveTo(left + signatureWidth + gap, y).lineTo(left + width, y).lineWidth(0.8).stroke('#9a9a9a')
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
  doc.text(`${org?.name ?? 'Locadora'}\nLocadora`, left, y + 5, { width: signatureWidth, align: 'center' })
  doc.text(`${rental.customer.name}\nLocatário`, left + signatureWidth + gap, y + 5, {
    width: signatureWidth,
    align: 'center',
  })

  const footer = `${rental.code} · gerado em ${formatDay(data.generatedAt)} pelo Canteiro · documento sem valor fiscal`
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#9a9a9a')
    .text(footer, left, doc.page.height - doc.page.margins.bottom - 10, { width, align: 'center' })

  return doc
}
