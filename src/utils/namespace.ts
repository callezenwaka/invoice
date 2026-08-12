import { ACTIVE_NAMESPACE_KEY } from '../config/storageKeys'

/**
 * The namespace every record is scoped to.
 *
 * Deliberately not called a user: there is no auth, no account and no profile,
 * so naming it after an entity the system does not have would invite code that
 * assumes one. If accounts are ever added, a user would *own* a namespace —
 * they would be two different things.
 *
 * It is not security. Any namespace can be selected and browser storage is
 * readable in devtools.
 */

/** Injectable so tests need no DOM. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStore(): KeyValueStore | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function activeNamespaceId(store: KeyValueStore | null = defaultStore()): string {
  if (!store) return 'default'

  const existing = store.getItem(ACTIVE_NAMESPACE_KEY)
  if (existing) return existing

  const created = crypto.randomUUID()
  store.setItem(ACTIVE_NAMESPACE_KEY, created)
  return created
}

export function setActiveNamespaceId(id: string, store: KeyValueStore | null = defaultStore()): void {
  store?.setItem(ACTIVE_NAMESPACE_KEY, id)
}

/**
 * Whether the browser has agreed to keep this origin's storage.
 *
 * `denied` and `failed` are distinct on purpose. Denial is the case that matters:
 * WebKit clears script-writable storage after seven days without a visit, so a
 * denied request means the invoice history has an expiry date — and a caller
 * that cannot tell denial from a thrown error cannot say so.
 */
export type PersistenceOutcome =
  | { status: 'persisted' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'failed'; error: unknown }

export async function requestPersistence(): Promise<PersistenceOutcome> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { status: 'unsupported' }
  }

  try {
    if (await navigator.storage.persisted?.()) return { status: 'persisted' }
    return (await navigator.storage.persist())
      ? { status: 'persisted' }
      : { status: 'denied' }
  } catch (error) {
    return { status: 'failed', error }
  }
}

export type EstimateOutcome =
  | { status: 'ok'; usage: number; quota: number }
  | { status: 'unsupported' }
  | { status: 'failed'; error: unknown }

/** Usage against quota, for warning before a write starts failing. */
export async function storageEstimate(): Promise<EstimateOutcome> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { status: 'unsupported' }
  }

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { status: 'ok', usage, quota }
  } catch (error) {
    return { status: 'failed', error }
  }
}
