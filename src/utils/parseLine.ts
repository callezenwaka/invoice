import { toMinor } from './money'
import type { CurrencyCode } from '../config/currency'

/**
 * Command-line item entry (spec §5.3): `12h discovery @ 140` becomes a line item.
 *
 * This is a convenience over the normal fields, never a replacement. It is a
 * heuristic and has known limits, accepted rather than engineered around:
 *
 *   - A description opening with a number is misread — `2026 audit @ 500` takes
 *     2026 as the quantity.
 *   - The unit is parsed then discarded: `12h` and `12 days` both give 12.
 *
 * The mitigation is showing the caller what was understood *before* commit, so a
 * misparse costs a keystroke rather than producing a wrong invoice.
 */

export interface ParsedLine {
  description: string
  quantity: number
  /** Minor units. */
  rate: number
}

// An optional currency symbol may sit between the marker and the number —
// `@ $140`, `@ £140`, `@ CA$140`. Without this the symbol blocks the match and
// the fallback below leaves `@ $` stranded in the description.
const TRAILING_RATE = /@\s*[^\d\s.,]{0,3}\s*([\d.,]+)\s*$/
const LEADING_QUANTITY = /^([\d.]+)\s*(h|hr|hrs|hour|hours|x|×|d|day|days)?\b\s*/i
const TRAILING_NUMBER = /([\d.,]+)\s*$/
const LEADING_FILLER = /^(of|for)\s+/i
const TRAILING_FILLER = /\s+(at|for)$/i

export function parseLine(text: string, currency: CurrencyCode): ParsedLine | null {
  const raw = (text ?? '').trim()
  if (!raw) return null

  let rest = raw
  let quantity = 1
  let rate = 0
  let sawRate = false

  // `@ 140` is the explicit rate marker, so read it first.
  const at = TRAILING_RATE.exec(rest)
  if (at) {
    const parsed = toMinor(at[1].replace(/,/g, ''), currency)
    // A rate was written and could not be read — reject the line rather than
    // committing one with a rate of zero.
    if (parsed === null) return null
    rate = parsed
    rest = rest.slice(0, at.index).trim()
    sawRate = true
  }

  const lead = LEADING_QUANTITY.exec(rest)
  if (lead) {
    const parsed = Number(lead[1])
    if (Number.isFinite(parsed) && parsed > 0) quantity = parsed
    rest = rest.slice(lead[0].length).trim()
  }

  // Without an explicit marker, a number at the end is taken as the rate.
  if (!sawRate) {
    const trailing = TRAILING_NUMBER.exec(rest)
    if (trailing) {
      const parsed = toMinor(trailing[1].replace(/,/g, ''), currency)
      if (parsed === null) return null
      rate = parsed
      rest = rest.slice(0, trailing.index).trim()
    }
  }

  rest = rest.replace(LEADING_FILLER, '').replace(TRAILING_FILLER, '').trim()

  // Nothing usable at all — neither words nor a number.
  if (!rest && !rate) return null

  return { description: rest, quantity, rate }
}
