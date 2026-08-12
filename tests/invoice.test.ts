import { describe, it, expect } from 'vitest'
import {
  lineAmount,
  computeTotals,
  effectiveStatus,
  isEditable,
  isDeletable,
  isVoidable,
  canTransition,
  issueBlockers,
} from '../src/utils/invoice'
import { EffectiveStatus, InvoiceStatus, TaxMode } from '../src/types'
import type { Invoice, LineItem } from '../src/types'

let seq = 0
function item(quantity: number, rate: number): LineItem {
  seq += 1
  return { id: `item-${seq}`, description: `Line ${seq}`, quantity, rate }
}

const base = {
  items: [] as LineItem[],
  taxRate: 0,
  taxMode: TaxMode.Percentage,
  discount: 0,
  shipping: 0,
  amountPaid: 0,
}

const TODAY = new Date(2026, 7, 11) // 11 Aug 2026, local

describe('lineAmount', () => {
  it('multiplies quantity by rate in minor units', () => {
    expect(lineAmount(item(24, 9500))).toBe(228000)
  })

  it('rounds a fractional quantity to the minor unit', () => {
    // 12.5 hours at 14.03 is 175.375, which rounds half-up to 175.38.
    expect(lineAmount(item(12.5, 1403))).toBe(17538)
  })

  it('treats non-finite input as zero rather than producing NaN', () => {
    expect(lineAmount(item(NaN, 100))).toBe(0)
    expect(lineAmount(item(2, Infinity))).toBe(0)
  })
})

describe('computeTotals', () => {
  it('sums rounded lines, so printed lines add up to the printed subtotal', () => {
    const items = [
      item(1, 1),
      item(1, 1),
      item(1, 1),
    ]
    const totals = computeTotals({ ...base, items })
    expect(totals.subtotal).toBe(3)
    expect(items.reduce((sum, item) => sum + lineAmount(item), 0)).toBe(totals.subtotal)
  })

  it('applies discount before tax', () => {
    const totals = computeTotals({
      ...base,
      items: [item(1, 10000)],
      discount: 2000,
      taxRate: 20,
    })
    expect(totals).toMatchObject({
      subtotal: 10000,
      discount: 2000,
      taxable: 8000,
      tax: 1600,
      total: 9600,
    })
  })

  it('bounds a discount to the subtotal', () => {
    const totals = computeTotals({
      ...base,
      items: [item(1, 5000)],
      discount: 9999999,
      taxRate: 20,
    })
    expect(totals).toMatchObject({ discount: 5000, taxable: 0, tax: 0, total: 0 })
  })

  it('ignores a negative discount', () => {
    const totals = computeTotals({
      ...base,
      items: [item(1, 5000)],
      discount: -100,
    })
    expect(totals).toMatchObject({ discount: 0, total: 5000 })
  })

  it('treats a fixed tax as an amount, not a percentage', () => {
    const totals = computeTotals({
      ...base,
      items: [item(1, 10000)],
      taxMode: TaxMode.Fixed,
      taxRate: 750,
    })
    expect(totals).toMatchObject({ tax: 750, total: 10750 })
  })

  it('rounds percentage tax half-up', () => {
    // 1.5% of 333 is 4.995.
    expect(computeTotals({ ...base, items: [item(1, 333)], taxRate: 1.5 }).tax).toBe(5)
  })

  it('adds shipping after tax', () => {
    const totals = computeTotals({
      ...base,
      items: [item(1, 10000)],
      taxRate: 10,
      shipping: 500,
    })
    expect(totals).toMatchObject({ tax: 1000, total: 11500 })
  })

  it('reports a negative balance when overpaid', () => {
    const totals = computeTotals({
      ...base,
      items: [item(1, 10000)],
      amountPaid: 12000,
    })
    expect(totals.balanceDue).toBe(-2000)
  })

  it('handles an empty invoice without NaN', () => {
    expect(computeTotals({ ...base })).toMatchObject({
      subtotal: 0,
      tax: 0,
      total: 0,
      balanceDue: 0,
    })
  })
})

describe('issueBlockers', () => {
  function draft(overrides: Partial<Invoice> = {}): Invoice {
    return {
      id: 'invoice-1',
      number: '',
      status: InvoiceStatus.Draft,
      senderId: 'sender-1',
      clientId: 'client-1',
      from: 'Sundial Studio\n12 Bridge St',
      billTo: 'Northgate Studio',
      shipTo: '',
      vatId: '',
      issuedOn: '2026-08-01',
      dueOn: '2026-08-15',
      paidOn: null,
      poNumber: '',
      currency: 'GBP',
      items: [item(1, 10000)],
      taxRate: 0,
      taxMode: TaxMode.Percentage,
      discount: 0,
      shipping: 0,
      amountPaid: 0,
      notes: '',
      terms: '',
      ...overrides,
    }
  }

  it('passes a complete invoice', () => {
    expect(issueBlockers(draft())).toEqual([])
  })

  it('requires an issuer address', () => {
    // The field is an editable textarea, so setup guarantees only its first value.
    expect(issueBlockers(draft({ from: '   ' })).map((b) => b.field)).toContain('from')
  })

  it('requires a client', () => {
    expect(issueBlockers(draft({ billTo: '' })).map((b) => b.field)).toContain('billTo')
  })

  it('rejects an invoice of nothing but blank rows', () => {
    const blank = { id: 'x', description: '  ', quantity: 1, rate: 0 }
    expect(issueBlockers(draft({ items: [blank] })).map((b) => b.field)).toContain('items')
  })

  it('accepts a line carrying only a description', () => {
    const described = { id: 'x', description: 'Consulting', quantity: 1, rate: 0 }
    expect(issueBlockers(draft({ items: [described] }))).toEqual([])
  })

  it('rejects a due date before the issue date', () => {
    expect(
      issueBlockers(draft({ issuedOn: '2026-08-10', dueOn: '2026-08-01' })).map((b) => b.field),
    ).toContain('dueOn')
  })

  it('accepts a due date equal to the issue date', () => {
    expect(issueBlockers(draft({ issuedOn: '2026-08-01', dueOn: '2026-08-01' }))).toEqual([])
  })

  it('reports every reason at once, not just the first', () => {
    expect(issueBlockers(draft({ from: '', billTo: '', items: [] }))).toHaveLength(3)
  })
})

describe('effectiveStatus', () => {
  it('derives overdue from the due date', () => {
    expect(effectiveStatus({ status: InvoiceStatus.Sent, dueOn: '2026-08-01' }, TODAY)).toBe(
      EffectiveStatus.Overdue,
    )
  })

  it('leaves a sent invoice alone until the due date has passed', () => {
    expect(effectiveStatus({ status: InvoiceStatus.Sent, dueOn: '2026-08-20' }, TODAY)).toBe(
      InvoiceStatus.Sent,
    )
    // Due today is not yet overdue.
    expect(effectiveStatus({ status: InvoiceStatus.Sent, dueOn: '2026-08-11' }, TODAY)).toBe(
      InvoiceStatus.Sent,
    )
  })

  it('never marks paid, void or draft as overdue', () => {
    for (const status of [InvoiceStatus.Paid, InvoiceStatus.Void, InvoiceStatus.Draft]) {
      expect(effectiveStatus({ status, dueOn: '2020-01-01' }, TODAY)).toBe(status)
    }
  })

  it('tolerates a missing due date', () => {
    expect(effectiveStatus({ status: InvoiceStatus.Sent, dueOn: '' }, TODAY)).toBe(
      InvoiceStatus.Sent,
    )
  })
})

describe('lifecycle rules', () => {
  it('allows editing only a draft', () => {
    expect(isEditable(InvoiceStatus.Draft)).toBe(true)
    for (const status of [InvoiceStatus.Sent, InvoiceStatus.Paid, InvoiceStatus.Void]) {
      expect(isEditable(status)).toBe(false)
    }
  })

  it('allows deleting only a draft, so numbering stays gapless', () => {
    expect(isDeletable(InvoiceStatus.Draft)).toBe(true)
    expect(isDeletable(InvoiceStatus.Sent)).toBe(false)
    expect(isDeletable(InvoiceStatus.Paid)).toBe(false)
  })

  it('allows voiding anything already issued', () => {
    expect(isVoidable(InvoiceStatus.Sent)).toBe(true)
    expect(isVoidable(InvoiceStatus.Paid)).toBe(true)
    expect(isVoidable(InvoiceStatus.Draft)).toBe(false)
    expect(isVoidable(InvoiceStatus.Void)).toBe(false)
  })

  it('permits the forward moves', () => {
    expect(canTransition(InvoiceStatus.Draft, InvoiceStatus.Sent)).toBe(true)
    expect(canTransition(InvoiceStatus.Sent, InvoiceStatus.Paid)).toBe(true)
    expect(canTransition(InvoiceStatus.Sent, InvoiceStatus.Void)).toBe(true)
    expect(canTransition(InvoiceStatus.Paid, InvoiceStatus.Void)).toBe(true)
  })

  it('refuses to reopen or skip', () => {
    expect(canTransition(InvoiceStatus.Sent, InvoiceStatus.Draft)).toBe(false)
    expect(canTransition(InvoiceStatus.Paid, InvoiceStatus.Sent)).toBe(false)
    expect(canTransition(InvoiceStatus.Draft, InvoiceStatus.Paid)).toBe(false)
    expect(canTransition(InvoiceStatus.Void, InvoiceStatus.Sent)).toBe(false)
  })
})
