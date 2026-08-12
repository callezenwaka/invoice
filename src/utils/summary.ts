import { computeTotals, effectiveStatus } from './invoice'
import { daysBetween, toISODate, addDays } from './date'
import { EffectiveStatus, InvoiceStatus } from '../types'
import type { Client, Invoice } from '../types'
import type { CurrencyCode } from '../config/currency'

/**
 * Dashboard figures, derived from a set of invoices.
 *
 * Money is reported **per currency, never combined**. The app holds no exchange
 * rates, and inventing one to produce a single headline number would put a
 * figure on a financial screen that nothing supports.
 */

export interface CurrencyAmount {
  currency: CurrencyCode
  amount: number
}

export interface Summary {
  /** Unpaid balance on everything issued and not yet settled. */
  outstanding: CurrencyAmount[]
  /** The part of `outstanding` already past its due date. */
  overdue: CurrencyAmount[]
  /** Settled within the window, by the date payment was recorded. */
  paidRecently: CurrencyAmount[]
  /** Mean days from issue to payment, or null when nothing has been paid. */
  averageDaysToPay: number | null
  counts: Record<EffectiveStatus | 'all', number>
}

const RECENT_WINDOW_DAYS = 30

export function summarise(
  invoices: readonly Invoice[],
  today: Date = new Date(),
  windowDays = RECENT_WINDOW_DAYS,
): Summary {
  const outstanding = new Map<CurrencyCode, number>()
  const overdue = new Map<CurrencyCode, number>()
  const paidRecently = new Map<CurrencyCode, number>()
  const paymentGaps: number[] = []

  const counts: Record<EffectiveStatus | 'all', number> = {
    all: invoices.length,
    [InvoiceStatus.Draft]: 0,
    [InvoiceStatus.Sent]: 0,
    [InvoiceStatus.Paid]: 0,
    [InvoiceStatus.Void]: 0,
    [EffectiveStatus.Overdue]: 0,
  }

  // `toISODate` always yields a parseable date, so this cannot be null.
  const cutoff = addDays(toISODate(today), -windowDays) as string

  for (const invoice of invoices) {
    const status = effectiveStatus(invoice, today)
    counts[status] += 1

    const { total, balanceDue } = computeTotals(invoice)

    if (status === InvoiceStatus.Sent || status === EffectiveStatus.Overdue) {
      add(outstanding, invoice.currency, balanceDue)
      if (status === EffectiveStatus.Overdue) add(overdue, invoice.currency, balanceDue)
    }

    if (invoice.status === InvoiceStatus.Paid && invoice.paidOn) {
      if (invoice.paidOn >= cutoff) add(paidRecently, invoice.currency, total)

      // Both dates are needed, and a payment recorded before issue is bad data
      // rather than a negative wait.
      const gap = daysBetween(invoice.issuedOn, invoice.paidOn)
      // Unmeasurable, or dated before issue — excluded rather than averaged in.
      if (gap !== null && gap >= 0) paymentGaps.push(gap)
    }
  }

  return {
    outstanding: sorted(outstanding),
    overdue: sorted(overdue),
    paidRecently: sorted(paidRecently),
    averageDaysToPay: paymentGaps.length
      ? Math.round(paymentGaps.reduce((sum, gap) => sum + gap, 0) / paymentGaps.length)
      : null,
    counts,
  }
}

function add(target: Map<CurrencyCode, number>, currency: CurrencyCode, amount: number) {
  target.set(currency, (target.get(currency) ?? 0) + amount)
}

/** Largest first, so the most significant currency leads a tile. */
function sorted(totals: Map<CurrencyCode, number>): CurrencyAmount[] {
  return [...totals]
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

export interface ClientSummary {
  client: Client
  invoiceCount: number
  outstanding: CurrencyAmount[]
  /** ISO date of the most recent invoice, or null if there are none. */
  lastInvoiced: string | null
}

/**
 * Per-client figures for the clients list.
 *
 * Invoices are matched on `clientId`. An invoice carries no copy of the client's
 * name, so there is one link and nothing to reconcile.
 */
export function summariseClients(
  clients: readonly Client[],
  invoices: readonly Invoice[],
  today: Date = new Date(),
): ClientSummary[] {
  return clients
    .filter((client) => !client.archived)
    .map((client) => {
      const theirs = invoices.filter((invoice) => invoice.clientId === client.id)
      const outstanding = new Map<CurrencyCode, number>()
      let lastInvoiced: string | null = null

      for (const invoice of theirs) {
        const status = effectiveStatus(invoice, today)
        if (status === InvoiceStatus.Sent || status === EffectiveStatus.Overdue) {
          add(outstanding, invoice.currency, computeTotals(invoice).balanceDue)
        }
        if (invoice.issuedOn && (!lastInvoiced || invoice.issuedOn > lastInvoiced)) {
          lastInvoiced = invoice.issuedOn
        }
      }

      return {
        client,
        invoiceCount: theirs.length,
        outstanding: sorted(outstanding),
        lastInvoiced,
      }
    })
    .sort((a, b) => (a.lastInvoiced ?? '') < (b.lastInvoiced ?? '') ? 1 : -1)
}

/** Filters the list by an effective status, or returns it whole for 'all'. */
export function filterByStatus(
  invoices: readonly Invoice[],
  filter: EffectiveStatus | 'all',
  today: Date = new Date(),
): Invoice[] {
  if (filter === 'all') return [...invoices]
  return invoices.filter((invoice) => effectiveStatus(invoice, today) === filter)
}

/** Newest first — the order the dashboard reads in. */
export function byIssueDate(invoices: readonly Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : a.issuedOn > b.issuedOn ? -1 : 0))
}
