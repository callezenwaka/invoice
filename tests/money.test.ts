import { describe, it, expect } from 'vitest'
import {
  minorUnitDigits,
  currencyName,
  roundHalfUp,
  toMinor,
  toMajor,
  formatMoney,
} from '../src/utils/money'

describe('minorUnitDigits', () => {
  it('reads decimal places from the currency, not a constant', () => {
    expect(minorUnitDigits('USD')).toBe(2)
    expect(minorUnitDigits('GBP')).toBe(2)
    expect(minorUnitDigits('JPY')).toBe(0)
    expect(minorUnitDigits('ISK')).toBe(0)
    expect(minorUnitDigits('KWD')).toBe(3)
    expect(minorUnitDigits('BHD')).toBe(3)
  })

})

describe('currencyName', () => {
  it('resolves real names', () => {
    expect(currencyName('JPY')).toMatch(/yen/i)
    expect(currencyName('NOK')).toMatch(/krone/i)
  })

})

describe('roundHalfUp', () => {
  it('rounds halves away from zero in both directions', () => {
    expect(roundHalfUp(0.5)).toBe(1)
    expect(roundHalfUp(1.5)).toBe(2)
    expect(roundHalfUp(2.5)).toBe(3)
    // Math.round(-0.5) is -0 and Math.round(-2.5) is -2, both toward zero.
    expect(roundHalfUp(-0.5)).toBe(-1)
    expect(roundHalfUp(-2.5)).toBe(-3)
  })

  it('leaves integers alone', () => {
    expect(roundHalfUp(7)).toBe(7)
    expect(roundHalfUp(-7)).toBe(-7)
  })

  it('returns 0 for non-finite input', () => {
    expect(roundHalfUp(NaN)).toBe(0)
    expect(roundHalfUp(Infinity)).toBe(0)
  })
})

describe('toMinor', () => {
  it('scales by the currency, not a fixed factor', () => {
    expect(toMinor(140.5, 'USD')).toBe(14050)
    expect(toMinor(528000, 'JPY')).toBe(528000)
    expect(toMinor(1.234, 'KWD')).toBe(1234)
  })

  it('avoids the float-representation rounding bug', () => {
    // The reason the point is shifted through the digit string:
    expect(Math.round(1.005 * 100)).toBe(100) // wrong
    expect((1.005).toFixed(2)).toBe('1.00') // also wrong
    expect(toMinor(1.005, 'USD')).toBe(101) // correct, half-up
  })

  it('accepts strings as typed by a user', () => {
    expect(toMinor('140.50', 'USD')).toBe(14050)
    expect(toMinor('  99.99  ', 'USD')).toBe(9999)
    expect(toMinor('.5', 'USD')).toBe(50)
    expect(toMinor('12', 'USD')).toBe(1200)
  })

  it('rounds excess precision half-up', () => {
    expect(toMinor('1.004', 'USD')).toBe(100)
    expect(toMinor('1.005', 'USD')).toBe(101)
    expect(toMinor('1.006', 'USD')).toBe(101)
    // JPY keeps no fraction at all.
    expect(toMinor('100.4', 'JPY')).toBe(100)
    expect(toMinor('100.5', 'JPY')).toBe(101)
  })

  it('handles negatives symmetrically', () => {
    expect(toMinor('-1.005', 'USD')).toBe(-101)
    expect(toMinor(-140.5, 'USD')).toBe(-14050)
  })

  it('returns null rather than zero for input that is not a number', () => {
    // Zero is a legitimate rate, so it cannot double as "unreadable" — the
    // caller has to decide what an unusable entry means.
    expect(toMinor('abc', 'USD')).toBeNull()
    expect(toMinor('£140', 'USD')).toBeNull()
  })

  it('treats an empty field as absent, not as zero', () => {
    expect(toMinor('', 'USD')).toBeNull()
    expect(toMinor('   ', 'USD')).toBeNull()
  })
})

describe('toMajor', () => {
  it('round-trips with toMinor', () => {
    for (const [value, currency] of [
      [140.5, 'USD'],
      [528000, 'JPY'],
      [1.234, 'KWD'],
    ] as const) {
      const minor = toMinor(value, currency)
      expect(minor).not.toBeNull()
      expect(toMajor(minor as number, currency)).toBe(value)
    }
  })
})

describe('formatMoney', () => {
  it('uses the currency’s own decimal places', () => {
    // JPY has no minor unit, so no decimal separator should appear at all.
    expect(formatMoney(528000, 'JPY')).not.toMatch(/\./)
    expect(formatMoney(14050, 'USD')).toMatch(/140\.50/)
    expect(formatMoney(1234, 'KWD')).toMatch(/1\.234/)
  })

  it('keeps the sign — an overpayment is not money owed', () => {
    const negative = formatMoney(-5000, 'USD')
    expect(negative).toMatch(/[-−]/)
    expect(formatMoney(5000, 'USD')).not.toMatch(/[-−]/)
  })

  it('renders nothing rather than a stray symbol for empty values', () => {
    expect(formatMoney(null, 'USD')).toBe('')
    expect(formatMoney(undefined, 'USD')).toBe('')
    expect(formatMoney(NaN, 'USD')).toBe('')
    expect(formatMoney(null, 'USD', true)).toBe('—')
  })


})
