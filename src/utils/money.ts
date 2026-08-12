import type { CurrencyCode } from '../config/currency'
import { EMPTY_MARKER } from './display'
/**
 * Money is held as integers in the currency's minor unit — cents, pence, yen.
 * Amounts are never floats, so accumulation drift cannot happen (spec §2.1).
 *
 * Everything a currency needs beyond its code — display name, symbol, decimal
 * places — comes from `Intl` rather than a stored table.
 */

const digitsCache = new Map<string, number>()
const nameCache = new Map<string, string>()

/**
 * Decimal places for a currency: JPY and ISK 0, most 2, KWD/BHD/JOD 3.
 *
 * No fallback, because there is no case to fall back from: every member of
 * `CurrencyCode` resolves, and nothing else can be passed.
 */
export function minorUnitDigits(currency: CurrencyCode): number {
  const cached = digitsCache.get(currency)
  if (cached !== undefined) return cached

  const digits = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits as number

  digitsCache.set(currency, digits)
  return digits
}

/** Human-readable currency name, e.g. 'JPY' → 'Japanese Yen'. */
export function currencyName(currency: CurrencyCode): string {
  const cached = nameCache.get(currency)
  if (cached !== undefined) return cached

  const name = new Intl.DisplayNames(undefined, { type: 'currency' }).of(currency) as string
  nameCache.set(currency, name)
  return name
}

/**
 * Round half away from zero — the commercial convention.
 *
 * Neither JS default does this: `Math.round(-0.5)` is `-0`, rounding toward
 * zero, and `(1.005).toFixed(2)` is `"1.00"` because 1.005 has no exact binary
 * representation.
 */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

// Plain decimal only. Exponent notation falls through to float scaling below.
const DECIMAL = /^([+-])?(\d*)(?:\.(\d*))?$/

/**
 * Convert a major-unit amount ('140.50', 140.5) into integer minor units.
 *
 * Shifts the decimal point through the digit string rather than multiplying, so
 * binary representation cannot round the wrong way: `toMinor(1.005, 'USD')` is
 * 101, where `Math.round(1.005 * 100)` gives 100.
 *
 * Returns **null** when the input is not a number, rather than zero: on a rate
 * field a silent zero means invoicing nothing, and it is indistinguishable from
 * a rate genuinely set to zero.
 */
export function toMinor(value: number | string, currency: CurrencyCode): number | null {
  const digits = minorUnitDigits(currency)
  const raw = typeof value === 'string' ? value.trim() : String(value)
  if (raw === '') return null

  const match = DECIMAL.exec(raw)
  if (!match) {
    // Exponent notation is the only other legitimate form.
    const n = Number(raw)
    return Number.isFinite(n) ? roundHalfUp(n * 10 ** digits) : null
  }

  const sign = match[1] === '-' ? -1 : 1
  const integer = match[2] || '0'
  const fraction = match[3] ?? ''

  const kept = (fraction + '0'.repeat(digits)).slice(0, digits)
  const dropped = fraction.slice(digits)

  let minor = Number(integer + kept)
  if (!Number.isFinite(minor)) return null

  // Half-up on the first discarded digit.
  if (dropped && Number(dropped[0]) >= 5) minor += 1

  return sign * minor
}

/** Convert integer minor units back to a major-unit number. Display only. */
export function toMajor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** minorUnitDigits(currency)
}

/**
 * Format an amount held in minor units.
 *
 * Negative values render negative — an overpaid invoice must not read as though
 * money is still owed. Non-numbers render as an em dash or empty string rather
 * than a stray bare symbol.
 */
export function formatMoney(
  minor: number | null | undefined,
  currency: CurrencyCode,
  dashIfEmpty = false,
): string {
  if (typeof minor !== 'number' || !Number.isFinite(minor)) {
    return dashIfEmpty ? EMPTY_MARKER : ''
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(toMajor(minor, currency))
}
