/**
 * Presentation helpers.
 *
 * The empty marker lives here so a screen never renders a bare blank where a
 * value is expected — an empty cell reads as a rendering fault, whereas a dash
 * reads as "nothing here".
 *
 * It marks absence only. Anything that stands in for a value the user should
 * have supplied belongs in validation, not here.
 */

export const EMPTY_MARKER = '—'

export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_MARKER
  const text = String(value).trim()
  return text === '' ? EMPTY_MARKER : text
}
