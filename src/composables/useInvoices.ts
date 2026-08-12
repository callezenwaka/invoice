import { ref, shallowRef } from 'vue'
import { Store } from '../config/storageKeys'
import { get, getAll, put, remove } from '../utils/store'
import { activeNamespaceId } from '../utils/namespace'
import { canTransition, isDeletable } from '../utils/invoice'
import { nextNumber } from '../utils/numbering'
import { toISODate } from '../utils/date'
import { InvoiceStatus } from '../types'
import type { Invoice, Sender } from '../types'

/**
 * The invoices store.
 *
 * Saving is an upsert by id, so editing and re-saving updates one record rather
 * than accumulating copies. Numbers are drawn at issue, and issued invoices are
 * voided rather than deleted so the series stays gapless.
 */

const invoices = shallowRef<Invoice[]>([])
const loaded = ref(false)

export function useInvoices() {
  const namespaceId = activeNamespaceId()

  async function load(): Promise<Invoice[]> {
    invoices.value = await getAll<Invoice>(namespaceId, Store.Invoices)
    loaded.value = true
    return invoices.value
  }

  async function find(id: string): Promise<Invoice | undefined> {
    return get<Invoice>(namespaceId, Store.Invoices, id)
  }

  /** Stores exactly what it is given: no field is filled in on the way through. */
  async function save(invoice: Invoice): Promise<Invoice> {
    await put(namespaceId, Store.Invoices, invoice)

    const index = invoices.value.findIndex((entry) => entry.id === invoice.id)
    invoices.value =
      index === -1
        ? [invoice, ...invoices.value]
        : invoices.value.map((entry) => (entry.id === invoice.id ? invoice : entry))

    return invoice
  }

  /**
   * Rejects a move the lifecycle does not allow.
   *
   * Throws rather than returning the invoice untouched: the UI only offers legal
   * transitions, so arriving here with an illegal one is a bug — and a bug that
   * silently returns its input is indistinguishable from success.
   */
  function requireTransition(invoice: Invoice, to: InvoiceStatus) {
    if (!canTransition(invoice.status, to)) {
      throw new Error(`Cannot move invoice ${invoice.id} from ${invoice.status} to ${to}`)
    }
  }

  /**
   * Moves a draft to `sent` and assigns its number.
   *
   * The number is drawn here rather than at creation, so drafts that are never
   * issued leave no hole in the series. It is assigned unconditionally: a draft
   * has no number, and keeping an existing one would mean the state machine had
   * been bypassed.
   */
  async function issue(invoice: Invoice, sender: Sender): Promise<Invoice> {
    requireTransition(invoice, InvoiceStatus.Sent)
    if (!loaded.value) await load()

    const series = invoices.value
      .filter((entry) => entry.senderId === sender.id)
      .map((entry) => entry.number)

    return save({
      ...invoice,
      number: nextNumber(series, sender.numberPrefix),
      status: InvoiceStatus.Sent,
    })
  }

  async function markPaid(invoice: Invoice, paidOn = toISODate()): Promise<Invoice> {
    requireTransition(invoice, InvoiceStatus.Paid)
    return save({ ...invoice, status: InvoiceStatus.Paid, paidOn })
  }

  /** Keeps the number, so voiding never opens a gap. */
  async function voidInvoice(invoice: Invoice): Promise<Invoice> {
    requireTransition(invoice, InvoiceStatus.Void)
    return save({ ...invoice, status: InvoiceStatus.Void })
  }

  /** Only a draft can be removed; anything issued is a record. */
  async function destroy(invoice: Invoice): Promise<boolean> {
    if (!isDeletable(invoice.status)) return false

    await remove(namespaceId, Store.Invoices, invoice.id)
    invoices.value = invoices.value.filter((entry) => entry.id !== invoice.id)
    return true
  }

  return { invoices, loaded, load, find, save, issue, markPaid, voidInvoice, destroy }
}

