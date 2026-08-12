import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { Store } from '../src/config/storageKeys'
import { clear } from '../src/utils/store'
import { activeNamespaceId } from '../src/utils/namespace'
import { useClients } from '../src/composables/useClients'
import { InvoiceStatus, TaxMode } from '../src/types'
import type { Invoice } from '../src/types'

const namespace = activeNamespaceId()

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: crypto.randomUUID(),
    number: '',
    status: InvoiceStatus.Draft,
    senderId: 'sender-1',
    clientId: null,
    from: 'Sundial Studio',
    billTo: 'Northgate Studio\n4 Kiln Lane\nLeeds',
    shipTo: 'Warehouse 3',
    vatId: 'GB999',
    issuedOn: '2026-08-01',
    dueOn: '2026-08-15',
    paidOn: null,
    poNumber: '',
    currency: 'GBP',
    items: [],
    taxRate: 20,
    taxMode: TaxMode.Percentage,
    discount: 0,
    shipping: 0,
    amountPaid: 0,
    notes: '',
    terms: '',
    ...overrides,
  }
}

beforeEach(async () => {
  await clear(namespace, Store.Clients)
  await useClients().load()
})

describe('resolveFor', () => {
  it('creates a client carrying the details from the invoice', async () => {
    // The registry has nowhere else to learn them from: the address block is
    // where they are typed.
    const client = await useClients().resolveFor(invoice())

    expect(client).toMatchObject({
      name: 'Northgate Studio',
      billTo: 'Northgate Studio\n4 Kiln Lane\nLeeds',
      shipTo: 'Warehouse 3',
      vatId: 'GB999',
      currency: 'GBP',
      taxRate: 20,
    })
  })

  it('reuses the existing record rather than creating a second', async () => {
    const { resolveFor, clients } = useClients()

    const first = await resolveFor(invoice())
    const second = await resolveFor(invoice({ billTo: 'northgate studio.\nElsewhere' }))

    expect(second?.id).toBe(first?.id)
    expect(clients.value).toHaveLength(1)
  })

  it('leaves an existing record untouched', async () => {
    const { resolveFor } = useClients()

    await resolveFor(invoice())
    const again = await resolveFor(invoice({ billTo: 'Northgate Studio\nNew address' }))

    // Details are changed by editing the client, not as a side effect of saving
    // an invoice.
    expect(again?.billTo).toBe('Northgate Studio\n4 Kiln Lane\nLeeds')
  })

  it('still recognises a client after a rename', async () => {
    const { resolveFor, save, clients } = useClients()

    const created = await resolveFor(invoice())
    await save({ ...created!, name: 'Rush-Acme' })

    // The normalized name is derived, so matching follows the rename rather than
    // going stale against a stored copy.
    const again = await resolveFor(invoice({ billTo: 'rush-acme.\nTexas' }))
    expect(again?.id).toBe(created!.id)
    expect(clients.value).toHaveLength(1)
  })

  it('returns undefined when nobody is named', async () => {
    expect(await useClients().resolveFor(invoice({ billTo: '   ' }))).toBeUndefined()
  })
})

describe('suggest', () => {
  it('completes a partly typed name', async () => {
    const { resolveFor, suggest } = useClients()
    await resolveFor(invoice())

    const [match] = suggest('northg')
    // The autocomplete fills the address in, so it has to have one.
    expect(match?.billTo).toContain('Kiln Lane')
  })

  it('matches nothing for an empty term', async () => {
    expect(useClients().suggest('')).toEqual([])
  })
})

describe('nameFor', () => {
  it('reads the name from the client, never from the invoice', async () => {
    const { resolveFor, nameFor } = useClients()
    const client = await resolveFor(invoice())

    expect(nameFor(client!.id)).toBe('Northgate Studio')
  })

  it('marks an unlinked draft rather than inventing a name', () => {
    expect(useClients().nameFor(null)).toBe('—')
  })
})
