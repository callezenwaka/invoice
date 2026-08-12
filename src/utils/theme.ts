/**
 * Theme selection.
 *
 * Light is the default. Dark is an explicit choice rather than a reflection of
 * `prefers-color-scheme`, so the app looks the same on every machine until the
 * user says otherwise.
 *
 * The choice is applied as `data-theme` on the root element, which is where
 * `tokens.css` reads it.
 */

export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const
export type Theme = (typeof Theme)[keyof typeof Theme]

const STORAGE_KEY = 'invoice.theme'

function isTheme(value: unknown): value is Theme {
  return value === Theme.Light || value === Theme.Dark
}

export function storedTheme(): Theme {
  if (typeof localStorage === 'undefined') return Theme.Light
  const stored = localStorage.getItem(STORAGE_KEY)
  return isTheme(stored) ? stored : Theme.Light
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme)
  }
}

export function toggleTheme(): Theme {
  const next = storedTheme() === Theme.Dark ? Theme.Light : Theme.Dark
  applyTheme(next)
  return next
}
