import { describe, expect, it } from 'vitest'
import { billingDays, priceForDays, round2 } from './pricing.js'

const rates = { dailyRate: 10, weeklyRate: 60, monthlyRate: 200 }

describe('billingDays', () => {
  it('conta ao menos uma diária no mesmo dia', () => {
    const date = new Date('2026-10-23T12:00:00.000Z')
    expect(billingDays(date, date)).toBe(1)
  })

  it('ignora horas e usa dias UTC', () => {
    expect(
      billingDays(new Date('2026-10-23T23:30:00.000Z'), new Date('2026-10-26T00:10:00.000Z')),
    ).toBe(3)
  })
})

describe('priceForDays', () => {
  it('cobra diária quando o período é curto', () => {
    const result = priceForDays(1, rates)
    expect(result.total).toBe(10)
    expect(result.months).toBe(0)
    expect(result.weeks).toBe(0)
    expect(result.extraDays).toBe(1)
  })

  it('usa a semana quando ela é mais barata que 7 diárias', () => {
    const result = priceForDays(7, rates)
    expect(result.total).toBe(60)
    expect(result.weeks).toBe(1)
    expect(result.extraDays).toBe(0)
  })

  it('usa o mês quando ele é mais barato que semanas avulsas', () => {
    const result = priceForDays(30, rates)
    expect(result.total).toBe(200)
    expect(result.months).toBe(1)
  })

  it('combina mês, semana e diárias no melhor arranjo', () => {
    const result = priceForDays(40, rates)
    expect(result.total).toBe(290)
    expect(result).toMatchObject({ months: 1, weeks: 1, extraDays: 3 })
  })

  it('prefere 35 diárias quando o mensal não compensa', () => {
    const result = priceForDays(35, rates)
    expect(result.total).toBe(250)
  })

  it('cai para a tabela semanal/mensal derivada quando não há preço fechado', () => {
    const result = priceForDays(30, { dailyRate: 10 })
    expect(result.total).toBe(280)
    expect(result.months).toBe(1)
  })

  it('usa 4 semanas mais 1 diária quando o mensal não é vantagem', () => {
    const result = priceForDays(29, rates)
    expect(result.total).toBe(250)
    expect(result).toMatchObject({ months: 0, weeks: 4, extraDays: 1 })
  })
})

describe('round2', () => {
  it('arredonda para centavos', () => {
    expect(round2(10.005)).toBe(10.01)
    expect(round2(10.004)).toBe(10)
  })
})
