import { describe, it, expect } from 'vitest'
import { parseLine } from '../src/utils/parseLine'

describe('parseLine', () => {
  it('parses the documented form', () => {
    expect(parseLine('12h discovery @ 140', 'USD')).toEqual({
      description: 'discovery',
      quantity: 12,
      rate: 14000,
    })
  })

  it('accepts the units it knows, discarding the unit itself', () => {
    for (const input of ['3 hrs research @ 90', '3 days research @ 90', '3x research @ 90']) {
      expect(parseLine(input, 'USD')).toMatchObject({ quantity: 3, description: 'research' })
    }
  })

  it('takes a trailing number as the rate when @ is absent', () => {
    expect(parseLine('consulting 190', 'USD')).toEqual({
      description: 'consulting',
      quantity: 1,
      rate: 19000,
    })
  })

  it('strips filler words', () => {
    expect(parseLine('4h of design @ 120', 'USD')).toMatchObject({ description: 'design' })
  })

  it('handles thousands separators and decimals in the rate', () => {
    expect(parseLine('deposit @ 4,200.50', 'USD')).toMatchObject({ rate: 420050 })
  })

  it('tolerates a currency symbol before the rate', () => {
    for (const input of ['12h design @ $140', '12h design @ £140', '12h design @ CA$140']) {
      expect(parseLine(input, 'USD')).toEqual({
        description: 'design',
        quantity: 12,
        rate: 14000,
      })
    }
  })

  it('scales the rate by the currency', () => {
    expect(parseLine('deposit @ 480000', 'JPY')).toMatchObject({ rate: 480000 })
    expect(parseLine('deposit @ 480000', 'USD')).toMatchObject({ rate: 48000000 })
  })

  it('defaults quantity to one', () => {
    expect(parseLine('retainer @ 4200', 'USD')).toMatchObject({ quantity: 1 })
  })

  it('leaves the description empty rather than inventing one', () => {
    // Naming it something would put words on an invoice the user never wrote.
    expect(parseLine('@ 500', 'USD')).toEqual({ description: '', quantity: 1, rate: 50000 })
  })

  it('returns null for nothing usable', () => {
    expect(parseLine('', 'USD')).toBeNull()
    expect(parseLine('   ', 'USD')).toBeNull()
  })

  // The known limits, asserted so they are a documented contract rather than a
  // surprise. Each is why the UI must show a parse hint before committing.
  describe('known limits', () => {
    it('misreads a description opening with a number', () => {
      expect(parseLine('2026 audit @ 500', 'USD')).toMatchObject({
        quantity: 2026,
        description: 'audit',
      })
    })

    it('discards the unit, so hours and days are indistinguishable', () => {
      const hours = parseLine('12h work @ 100', 'USD')
      const days = parseLine('12 days work @ 100', 'USD')
      expect(hours).toEqual(days)
    })
  })
})
