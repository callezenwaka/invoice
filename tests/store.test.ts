import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref, reactive } from 'vue'
import 'fake-indexeddb/auto'
import { Store } from '../src/config/storageKeys'
import { clear, closeDatabase, get, getAll, put, remove } from '../src/utils/store'

const NAMESPACE = 'test-namespace'
const OTHER = 'other-namespace'

beforeEach(async () => {
  for (const namespace of [NAMESPACE, OTHER]) {
    for (const store of Object.values(Store)) await clear(namespace, store)
  }
})

afterEach(() => {
  closeDatabase(NAMESPACE)
  closeDatabase(OTHER)
})

describe('store', () => {
  it('round-trips a record', async () => {
    await put(NAMESPACE, Store.Invoices, { id: 'a', number: 'INV-0001' })
    expect(await get(NAMESPACE, Store.Invoices, 'a')).toMatchObject({ number: 'INV-0001' })
  })

  it('returns undefined for a missing key', async () => {
    expect(await get(NAMESPACE, Store.Invoices, 'nope')).toBeUndefined()
  })

  it('overwrites by id rather than appending', async () => {
    await put(NAMESPACE, Store.Invoices, { id: 'a', number: 'INV-0001' })
    await put(NAMESPACE, Store.Invoices, { id: 'a', number: 'INV-0002' })

    const all = await getAll(NAMESPACE, Store.Invoices)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ number: 'INV-0002' })
  })

  it('deletes', async () => {
    await put(NAMESPACE, Store.Invoices, { id: 'a' })
    await remove(NAMESPACE, Store.Invoices, 'a')
    expect(await getAll(NAMESPACE, Store.Invoices)).toEqual([])
  })

  it('stores a reactive record rather than refusing to clone it', async () => {
    // A Vue ref hands out a Proxy, and structuredClone rejects it outright —
    // every save failed with DataCloneError until the value was flattened.
    const record = ref({ id: 'a', number: 'INV-0001', items: [{ id: 'i', rate: 100 }] })
    await put(NAMESPACE, Store.Invoices, record.value)

    expect(await get(NAMESPACE, Store.Invoices, 'a')).toEqual({
      id: 'a',
      number: 'INV-0001',
      items: [{ id: 'i', rate: 100 }],
    })
  })

  it('stores a nested reactive object', async () => {
    const record = reactive({ id: 'b', items: reactive([{ id: 'i', rate: 1 }]) })
    await put(NAMESPACE, Store.Invoices, record)

    expect(await get(NAMESPACE, Store.Invoices, 'b')).toEqual({ id: 'b', items: [{ id: 'i', rate: 1 }] })
  })

  it('keeps namespaces in separate databases', async () => {
    await put(NAMESPACE, Store.Invoices, { id: 'a', number: 'MINE' })
    await put(OTHER, Store.Invoices, { id: 'a', number: 'THEIRS' })

    expect(await get(NAMESPACE, Store.Invoices, 'a')).toMatchObject({ number: 'MINE' })
    expect(await get(OTHER, Store.Invoices, 'a')).toMatchObject({ number: 'THEIRS' })
  })
})
