import { Theme, THEME_STORAGE_KEY } from '../config/theme'

export { Theme }
export type { Theme as ThemeValue }

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


function isTheme(value: unknown): value is Theme {
  return value === Theme.Light || value === Theme.Dark
}

export function storedTheme(): Theme {
  if (typeof localStorage === 'undefined') return Theme.Light
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(stored) ? stored : Theme.Light
}

/** Matches --color-bg in tokens.css, which is what the browser chrome sits against. */
const CHROME_COLOR: Record<Theme, string> = {
  [Theme.Light]: '#f2f2f3',
  [Theme.Dark]: '#17181a',
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme

    // The static tag in index.html covers first paint; this keeps the address
    // bar in step once a theme is chosen, since the choice is explicit rather
    // than derived from prefers-color-scheme.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', CHROME_COLOR[theme])
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }
}

export function toggleTheme(): Theme {
  const next = storedTheme() === Theme.Dark ? Theme.Light : Theme.Dark
  applyTheme(next)
  return next
}
