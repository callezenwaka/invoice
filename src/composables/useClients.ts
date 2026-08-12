import { ref, shallowRef } from 'vue'
import { Store } from '../config/storageKeys'
import { getAll, put } from '../utils/store'
import { activeNamespaceId } from '../utils/namespace'
import { normalizeKey } from '../utils/client'
import { EMPTY_MARKER } from '../utils/display'
import type { Client, Invoice } from '../types'

/**
 * The client registry.
 *
 * Details are mutable; `id` is not. Everything — the invoice link, grouping,
 * totals — keys on the id, so a client can be renamed, moved or merged without
 * anything needing reconciliation.
 *
 * The normalized name is derived here rather than stored, so it cannot fall out
 * of step with the name. It is a typing convenience and identifies nothing.
 */

const clients = shallowRef<Client[]>([])
const loaded = ref(false)

export function useClients() {
  const namespaceId = activeNamespaceId()

  async function load(): Promise<Client[]> {
    clients.value = await getAll<Client>(namespaceId, Store.Clients)
    loaded.value = true
    return clients.value
  }

  async function save(client: Client): Promise<void> {
    await put(namespaceId, Store.Clients, client)
    const index = clients.value.findIndex((entry) => entry.id === client.id)
    clients.value =
      index === -1
        ? [...clients.value, client]
        : clients.value.map((entry) => (entry.id === client.id ? client : entry))
  }

  function findByName(name: string): Client | undefined {
    const key = normalizeKey(name)
    return key ? clients.value.find((client) => normalizeKey(client.name) === key) : undefined
  }

  /** Name matches for the Bill To field, most recently useful first. */
  function suggest(term: string, limit = 5): Client[] {
    const key = normalizeKey(term)
    if (!key) return []

    return clients.value
      .filter((client) => !client.archived && normalizeKey(client.name).includes(key))
      .slice(0, limit)
  }

  /**
   * Resolves the invoice's addressee to a client record, creating it if new.
   *
   * The record is populated from the invoice, because that is the only place the
   * details exist — the address block is where they are typed. Creating a client
   * with empty fields would leave the registry showing nothing and the
   * autocomplete filling nothing.
   *
   * An existing client is returned untouched: what is stored is the detail
   * captured when the client was first invoiced, and it changes only when
   * edited directly.
   *
   * Returns undefined only when nobody has been named.
   */
  async function resolveFor(invoice: Invoice): Promise<Client | undefined> {
    const name = firstLine(invoice.billTo)
    if (!name) return undefined
    if (!loaded.value) await load()

    const existing = findByName(name)
    if (existing) return existing

    const client: Client = {
      id: crypto.randomUUID(),
      name,
      billTo: invoice.billTo.trim(),
      shipTo: invoice.shipTo.trim(),
      vatId: invoice.vatId.trim(),
      currency: invoice.currency,
      taxRate: invoice.taxRate,
      archived: false,
    }

    await save(client)
    return client
  }

  function byId(id: string | null): Client | undefined {
    return id ? clients.value.find((client) => client.id === id) : undefined
  }

  /** The display name for an invoice — read from the client, never copied onto it. */
  function nameFor(id: string | null): string {
    return byId(id)?.name ?? EMPTY_MARKER
  }

  return { clients, loaded, load, save, findByName, suggest, resolveFor, byId, nameFor }
}

function firstLine(value: string): string {
  return (
    value
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  )
}
