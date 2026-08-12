import { ref, shallowRef } from 'vue'
import { Store } from '../config/storageKeys'
import { getAll, put } from '../utils/store'
import { activeNamespaceId } from '../utils/namespace'
import type { Sender } from '../types'

/**
 * The senders store.
 *
 * A user may invoice as more than one business, but the common case is one, so
 * the default is applied silently — someone with a single business never meets
 * the picker.
 *
 * Nothing here invents a sender. The first one is created during setup (§5.2),
 * which is what makes `Sender.from` non-empty by construction.
 */

const senders = shallowRef<Sender[]>([])
const loaded = ref(false)

export function useSenders() {
  const namespaceId = activeNamespaceId()

  async function load(): Promise<Sender[]> {
    senders.value = await getAll<Sender>(namespaceId, Store.Senders)
    loaded.value = true
    return senders.value
  }

  async function save(sender: Sender): Promise<void> {
    await put(namespaceId, Store.Senders, sender)
    const index = senders.value.findIndex((entry) => entry.id === sender.id)
    senders.value =
      index === -1
        ? [...senders.value, sender]
        : senders.value.map((entry) => (entry.id === sender.id ? sender : entry))
  }

  /**
   * The sender new invoices are seeded from.
   *
   * Undefined only before setup has run, which the route guard prevents — so
   * callers reach this with a sender already in place.
   */
  async function defaultSender(): Promise<Sender | undefined> {
    if (!loaded.value) await load()

    return (
      senders.value.find((sender) => sender.isDefault && !sender.archived) ??
      senders.value.find((sender) => !sender.archived)
    )
  }

  function active(): Sender[] {
    return senders.value.filter((sender) => !sender.archived)
  }

  return { senders, loaded, load, save, defaultSender, active }
}
