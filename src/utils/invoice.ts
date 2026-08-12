import { roundHalfUp } from './money'
import { addDays, isBefore, toISODate } from './date'
import { EffectiveStatus, InvoiceStatus, TaxMode } from '../types'
import type { Invoice, LineItem, Sender, Totals } from '../types'

/**
 * Everything derived from an invoice: its figures and its state.
 *
 * All money is integer minor units. Nothing here reads the DOM or storage, so
 * an invoice's arithmetic and lifecycle can be reasoned about — and tested —
 * on their own.
 */

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * A blank draft, seeded from a sender.
 *
 * The sender's details are copied in rather than referenced, because they are
 * the document rather than a lookup — see the snapshot rule. The due date comes
 * from the sender's own terms. The number stays empty: it is drawn from the
 * series when the invoice is issued, so abandoned drafts consume none.
 */
export function newInvoice(sender: Sender, issuedOn: string = toISODate()): Invoice {
  const dueOn = addDays(issuedOn, sender.paymentTermDays)
  // Unreachable via the default; a caller passing a malformed date is a bug, and
  // a due date quietly equal to the issue date would hide it.
  if (dueOn === null) throw new Error(`newInvoice: "${issuedOn}" is not an ISO date`)

  return {
    id: crypto.randomUUID(),
    number: '',
    status: InvoiceStatus.Draft,
    senderId: sender.id,
    clientId: null,

    from: sender.from,
    billTo: '',
    shipTo: '',
    vatId: '',

    issuedOn,
    dueOn,
    paidOn: null,
    poNumber: '',

    currency: sender.currency,
    items: [newLineItem()],
    taxRate: sender.taxRate,
    taxMode: TaxMode.Percentage,
    discount: 0,
    shipping: 0,
    amountPaid: 0,

    notes: sender.notes,
    terms: sender.terms,
  }
}

export function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0 }
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

/** A single line's amount, rounded to the minor unit. */
export function lineAmount(item: Pick<LineItem, 'quantity' | 'rate'>): number {
  return roundHalfUp(finite(item.quantity) * finite(item.rate))
}

type TotalsInput = Pick<
  Invoice,
  'items' | 'taxRate' | 'taxMode' | 'discount' | 'shipping' | 'amountPaid'
>

/**
 * Lines are rounded individually and the subtotal is the sum of those rounded
 * amounts. Summing unrounded values instead would print lines that do not add
 * up to the printed total, which is the discrepancy a client notices.
 */
export function computeTotals(invoice: TotalsInput): Totals {
  const subtotal = invoice.items.reduce((sum, item) => sum + lineAmount(item), 0)

  // Bounded to the subtotal so tax and total cannot go negative.
  const discount = clamp(integer(invoice.discount), 0, Math.max(subtotal, 0))
  const taxable = subtotal - discount

  const tax =
    invoice.taxMode === 'percentage'
      ? roundHalfUp((taxable * finite(invoice.taxRate)) / 100)
      : integer(invoice.taxRate)

  const shipping = integer(invoice.shipping)
  const amountPaid = integer(invoice.amountPaid)
  const total = taxable + tax + shipping

  return {
    subtotal,
    discount,
    taxable,
    tax,
    shipping,
    total,
    amountPaid,
    // Signed: negative means the invoice has been overpaid.
    balanceDue: total - amountPaid,
  }
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

export interface IssueBlocker {
  field: 'from' | 'billTo' | 'items' | 'dueOn'
  message: string
}

/**
 * What stops this invoice being issued, if anything.
 *
 * Checked once, here, because issuing is the only moment these values are final
 * and the only moment they matter. A draft is free to be incomplete — that is
 * what a draft is — so nothing upstream needs to prevent a field being cleared.
 *
 * Returns the specific reasons rather than a boolean, so the caller can say what
 * is wrong instead of only that something is.
 */
export function issueBlockers(invoice: Invoice): IssueBlocker[] {
  const blockers: IssueBlocker[] = []

  if (!invoice.from.trim()) {
    blockers.push({ field: 'from', message: 'An issuer address is needed' })
  }

  if (!invoice.billTo.trim()) {
    blockers.push({ field: 'billTo', message: 'A client is needed' })
  }

  // A blank row is scaffolding the builder adds, not something to invoice for.
  const hasLine = invoice.items.some((item) => item.description.trim() !== '' || item.rate !== 0)
  if (!hasLine) {
    blockers.push({ field: 'items', message: 'At least one line item is needed' })
  }

  if (invoice.dueOn && invoice.issuedOn && isBefore(invoice.dueOn, invoice.issuedOn)) {
    blockers.push({ field: 'dueOn', message: 'The due date is before the issue date' })
  }

  return blockers
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type StatusInput = Pick<Invoice, 'status' | 'dueOn'>

/**
 * `Overdue` is derived rather than stored, so it stays accurate as the clock
 * moves without anything having to rewrite records.
 *
 * Only an unpaid, issued invoice can fall overdue — a paid or voided one never
 * does, however long ago its due date was.
 */
export function effectiveStatus(invoice: StatusInput, today: Date = new Date()): EffectiveStatus {
  if (invoice.status === InvoiceStatus.Sent && isBefore(invoice.dueOn, toISODate(today))) {
    return EffectiveStatus.Overdue
  }
  return invoice.status
}

/** A draft is a working document. Anything issued is a record. */
export function isEditable(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.Draft
}

/**
 * Only drafts can be removed. Issued invoices are voided instead, keeping their
 * number so the series stays gapless — several jurisdictions audit for that.
 */
export function isDeletable(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.Draft
}

/** Voiding is the correction path: void the original, issue a replacement. */
export function isVoidable(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.Sent || status === InvoiceStatus.Paid
}

const ALLOWED: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.Draft]: [InvoiceStatus.Sent],
  [InvoiceStatus.Sent]: [InvoiceStatus.Paid, InvoiceStatus.Void],
  [InvoiceStatus.Paid]: [InvoiceStatus.Void],
  [InvoiceStatus.Void]: [],
}

/** Movement is one-way: nothing reopens once issued. */
export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return ALLOWED[from].includes(to)
}

// ---------------------------------------------------------------------------

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function integer(value: unknown): number {
  return roundHalfUp(finite(value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
