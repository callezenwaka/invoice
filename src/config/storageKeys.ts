/**
 * Storage identifiers.
 *
 * Each namespace gets its own IndexedDB database rather than a shared one with a
 * namespace column: isolation needs no filtering at every call site, and removing
 * a namespace is a single `deleteDatabase`.
 *
 * This is a namespace, not security. There is no auth, any namespace can be
 * selected, and browser storage is readable in devtools.
 */

export const DB_PREFIX = 'invoice'

/** Bumping this runs `onupgradeneeded`, which is where any schema change lands. */
export const DB_VERSION = 1

export function databaseName(namespaceId: string): string {
  return `${DB_PREFIX}:${namespaceId}`
}

export const Store = {
  Invoices: 'invoices',
  Senders: 'senders',
  Clients: 'clients',
} as const
export type Store = (typeof Store)[keyof typeof Store]

export const ALL_STORES: readonly Store[] = Object.values(Store)

/** Records the active namespace. Outside the per-namespace database by definition. */
export const ACTIVE_NAMESPACE_KEY = 'invoice.namespace'
