import { ALL_STORES, DB_VERSION, Store, databaseName } from '../config/storageKeys'

/**
 * A thin promise wrapper over IndexedDB.
 *
 * Small enough not to warrant a dependency, and deliberately dumb: it moves
 * records in and out and knows nothing about what they mean.
 */

const connections = new Map<string, Promise<IDBDatabase>>()

export function openDatabase(namespaceId: string): Promise<IDBDatabase> {
  const name = databaseName(namespaceId)

  const existing = connections.get(name)
  if (existing) return existing

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
      }
    }

    request.onsuccess = () => {
      const db = request.result
      // Another tab upgrading needs this one to let go.
      db.onversionchange = () => {
        db.close()
        connections.delete(name)
      }
      resolve(db)
    }

    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Database ${name} is blocked by another tab`))
  })

  connections.set(name, opening)
  // A failed open must not be cached, or every later call inherits the failure.
  opening.catch(() => connections.delete(name))

  return opening
}

/**
 * Strips anything that is not data before it reaches IndexedDB.
 *
 * A Vue `ref` hands out a reactive Proxy, and `structuredClone` refuses to clone
 * one — the write fails with `DataCloneError` and nothing is saved. Records here
 * are plain JSON (strings, numbers, booleans, null, arrays, objects), so a round
 * trip yields exactly the record with no framework wrapper attached.
 *
 * The constraint that makes this safe: no `Date`, no `undefined`, no `Map`, no
 * `Blob`. Dates are ISO strings and absences are `null` throughout, so nothing
 * currently violates it.
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function run<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function get<T>(namespaceId: string, store: Store, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase(namespaceId)
  return run<T | undefined>(db.transaction(store, 'readonly').objectStore(store).get(key))
}

export async function getAll<T>(namespaceId: string, store: Store): Promise<T[]> {
  const db = await openDatabase(namespaceId)
  return run<T[]>(db.transaction(store, 'readonly').objectStore(store).getAll())
}

export async function put<T>(namespaceId: string, store: Store, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openDatabase(namespaceId)
  const tx = db.transaction(store, 'readwrite')
  const record = toPlain(value)
  await run(
    key === undefined ? tx.objectStore(store).put(record) : tx.objectStore(store).put(record, key),
  )
  await complete(tx)
}

export async function remove(namespaceId: string, store: Store, key: IDBValidKey): Promise<void> {
  const db = await openDatabase(namespaceId)
  const tx = db.transaction(store, 'readwrite')
  await run(tx.objectStore(store).delete(key))
  await complete(tx)
}

export async function keys(namespaceId: string, store: Store): Promise<IDBValidKey[]> {
  const db = await openDatabase(namespaceId)
  return run(db.transaction(store, 'readonly').objectStore(store).getAllKeys())
}

export async function clear(namespaceId: string, store: Store): Promise<void> {
  const db = await openDatabase(namespaceId)
  const tx = db.transaction(store, 'readwrite')
  await run(tx.objectStore(store).clear())
  await complete(tx)
}

/** Closes the cached connection. Tests and user switching need this. */
export function closeDatabase(namespaceId: string): void {
  const name = databaseName(namespaceId)
  const pending = connections.get(name)
  connections.delete(name)
  pending?.then((db) => db.close()).catch(() => {})
}

function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}
