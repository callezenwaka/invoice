import type { CurrencyCode } from './config/currency'

export type { CurrencyCode }

/** Shared types. Money fields are integers in the currency's minor unit (spec §2.1). */

/**
 * Enumerations use the const-object pattern rather than TypeScript `enum`:
 * `erasableSyntaxOnly` is enabled in tsconfig.app.json, and enums emit runtime
 * code so they are not erasable. Call sites read the same — `InvoiceStatus.Draft` —
 * and each name is both a value and a type.
 */

export const InvoiceStatus = {
  Draft: 'draft',
  Sent: 'sent',
  Paid: 'paid',
  Void: 'void',
} as const
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

/** `Overdue` is derived from the due date and never stored (spec §2.2). */
export const EffectiveStatus = {
  ...InvoiceStatus,
  Overdue: 'overdue',
} as const
export type EffectiveStatus = (typeof EffectiveStatus)[keyof typeof EffectiveStatus]

export const TaxMode = {
  Percentage: 'percentage',
  Fixed: 'fixed',
} as const
export type TaxMode = (typeof TaxMode)[keyof typeof TaxMode]

export interface LineItem {
  id: string
  description: string
  /** May be fractional — 12.5 hours. */
  quantity: number
  /** Minor units. */
  rate: number
}

export interface Invoice {
  id: string
  number: string
  status: InvoiceStatus

  /** References, for grouping only. The fields below are the document (spec §2.5). */
  senderId: string
  /** Null only while a draft has nobody named; issuing requires one. */
  clientId: string | null

  // Snapshot — populated from the profile at creation, frozen at issue.
  from: string
  billTo: string
  shipTo: string
  vatId: string

  issuedOn: string
  dueOn: string
  paidOn: string | null
  poNumber: string

  currency: CurrencyCode
  items: LineItem[]
  /** Percentage (e.g. 20) when `taxMode` is 'percentage'; minor units when 'fixed'. */
  taxRate: number
  taxMode: TaxMode
  /** Minor units. */
  discount: number
  /** Minor units. */
  shipping: number
  /** Minor units. */
  amountPaid: number

  notes: string
  terms: string
}

export interface Sender {
  id: string
  name: string
  from: string
  /**
   * Data URL. Branding is read live rather than snapshotted onto each invoice,
   * so a reissued invoice carries the current mark — see spec §2.5. The
   * financial facts stay snapshotted; the logo is not one of them.
   */
  logo: string | null
  vatId: string
  /** Series prefix — numbering runs per sender (spec §2.4). */
  numberPrefix: string
  /** Days from issue to due, set at setup. No global default stands in for it. */
  paymentTermDays: number
  notes: string
  terms: string
  taxRate: number
  currency: CurrencyCode
  isDefault: boolean
  archived: boolean
}

export interface Client {
  id: string
  /** Free to change. Identity is `id`, which never moves. */
  name: string
  billTo: string
  shipTo: string
  vatId: string
  currency: CurrencyCode
  taxRate: number
  archived: boolean
}

export interface Totals {
  subtotal: number
  discount: number
  taxable: number
  tax: number
  shipping: number
  total: number
  amountPaid: number
  /** Negative when the invoice has been overpaid. */
  balanceDue: number
}
