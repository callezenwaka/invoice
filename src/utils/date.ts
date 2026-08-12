/**
 * Dates are ISO `YYYY-MM-DD` strings in the user's local calendar.
 *
 * Deliberately not `toISOString().split('T')[0]`, which converts to UTC first:
 * west of Greenwich that returns yesterday's date for most of the evening, so a
 * new invoice would be dated a day early.
 */

export function toISODate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** ISO dates are lexicographically ordered, so string comparison is enough. */
export function isBefore(a: string, b: string): boolean {
  return Boolean(a) && Boolean(b) && a < b
}

/**
 * Whole days from `from` to `to`; negative if `to` precedes `from`.
 *
 * Returns **null** when either date is unparseable. Zero would be worse than
 * useless here: it is a real answer meaning "paid the same day", so a parse
 * failure would be indistinguishable from a genuine result and would drag any
 * average toward it.
 */
export function daysBetween(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}

/**
 * Add days to an ISO date.
 *
 * Returns **null** on an unparseable date. Returning the input unchanged would
 * silently produce a due date equal to the issue date.
 */
export function addDays(date: string, days: number): string | null {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}
