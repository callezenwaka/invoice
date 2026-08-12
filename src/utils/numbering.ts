/**
 * Invoice numbering (spec §2.4).
 *
 * One sequential series per sender. Numbers are never reused: voiding keeps the
 * number so the run stays gapless, which several jurisdictions audit for.
 */

const DEFAULT_PAD = 4

/**
 * Highest sequence value already used in a series.
 *
 * Reads the trailing digits of each number carrying the prefix, so `INV-0007`
 * yields 7. Entries that do not match the prefix belong to another series and
 * are ignored.
 */
export function highestSequence(existing: readonly string[], prefix = ''): number {
  let highest = 0

  for (const number of existing) {
    if (typeof number !== 'string') continue
    const trimmed = number.trim()
    if (prefix && !trimmed.startsWith(prefix)) continue

    const match = /(\d+)\s*$/.exec(trimmed.slice(prefix.length))
    if (!match) continue

    const value = Number(match[1])
    if (Number.isFinite(value) && value > highest) highest = value
  }

  return highest
}

/**
 * Next number in a series.
 *
 * Derived from the highest number used rather than a count, so a voided or
 * deleted invoice never causes a number to be issued twice.
 */
export function nextNumber(existing: readonly string[], prefix = '', pad = DEFAULT_PAD): string {
  const next = highestSequence(existing, prefix) + 1
  return `${prefix}${String(next).padStart(pad, '0')}`
}
