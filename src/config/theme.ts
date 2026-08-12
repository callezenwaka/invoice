/**
 * Theme constants.
 *
 * Separate from `utils/theme.ts` because these are also read by the pre-paint
 * script that `vite.config.ts` injects, and the Vite config is typechecked
 * without the DOM lib — anything touching `document` cannot be imported there.
 *
 * Keeping them here means the key and the default exist once, rather than being
 * hand-copied into the HTML where they would silently drift.
 */

export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const
export type Theme = (typeof Theme)[keyof typeof Theme]

export const THEME_STORAGE_KEY = 'invoice.theme'
