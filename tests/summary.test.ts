import { describe, it, expect } from 'vitest'
import { summarise, summariseClients, filterByStatus, byIssueDate } from '../src/utils/summary'
import { EffectiveStatus, InvoiceStatus, TaxMode } from '../src/types'
import type { Client, Invoice, InvoiceStatus as Status } from '../src/types'

const TODAY = new Date(2026, 7, 11) // 11 Aug 2026, local

let seq = 0

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  seq += 1
  return {
    id: `invoice-${seq}`,
    number: `INV-${String(seq).padStart(4, '0')}`,
    status: InvoiceStatus.Draft as Status,
    senderId: 'sender-1',
    clientId: null,
    from: 'Sundial Studio',
    billTo: 'Northgate Studio',
    shipTo: '',
    vatId: '',
    issuedOn: '2026-08-01',
    dueOn: '2026-08-20',
    paidOn: null,
    poNumber: '',
    currency: 'GBP',
    items: [{ id: 'a', description: 'Work', quantity: 1, rate: 10000 }],
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

describe('summarise', () => {
  it('counts every status, including derived overdue', () => {
    const { counts } = summarise(
      [
        invoice(),
        invoice({ status: InvoiceStatus.Sent, dueOn: '2026-08-20' }),
        invoice({ status: InvoiceStatus.Sent, dueOn: '2026-08-01' }),
        invoice({ status: InvoiceStatus.Paid, paidOn: '2026-08-05' }),
        invoice({ status: InvoiceStatus.Void }),
      ],
      TODAY,
    )

    expect(counts).toMatchObject({
      all: 5,
      [InvoiceStatus.Draft]: 1,
      [InvoiceStatus.Sent]: 1,
      [EffectiveStatus.Overdue]: 1,
      [InvoiceStatus.Paid]: 1,
      [InvoiceStatus.Void]: 1,
    })
  })

  it('reports money per currency and never combines them', () => {
    const { outstanding } = summarise(
      [
        invoice({ status: InvoiceStatus.Sent, currency: 'GBP' }),
        invoice({ status: InvoiceStatus.Sent, currency: 'EUR' }),
        invoice({ status: InvoiceStatus.Sent, currency: 'GBP' }),
      ],
      TODAY,
    )

    expect(outstanding).toHaveLength(2)
    expect(outstanding.find((entry) => entry.currency === 'GBP')?.amount).toBe(20000)
    expect(outstanding.find((entry) => entry.currency === 'EUR')?.amount).toBe(10000)
  })

  it('counts only the unpaid part of a partly paid invoice', () => {
    const { outstanding } = summarise(
      [invoice({ status: InvoiceStatus.Sent, amountPaid: 4000 })],
      TODAY,
    )
    expect(outstanding[0].amount).toBe(6000)
  })

  it('treats overdue as a subset of outstanding, not a separate bucket', () => {
    const summary = summarise(
      [
        invoice({ status: InvoiceStatus.Sent, dueOn: '2026-08-01' }),
        invoice({ status: InvoiceStatus.Sent, dueOn: '2026-08-30' }),
      ],
      TODAY,
    )

    expect(summary.outstanding[0].amount).toBe(20000)
    expect(summary.overdue[0].amount).toBe(10000)
  })

  it('excludes drafts, paid and void from outstanding', () => {
    const summary = summarise(
      [
        invoice(),
        invoice({ status: InvoiceStatus.Paid, paidOn: '2026-08-05' }),
        invoice({ status: InvoiceStatus.Void }),
      ],
      TODAY,
    )
    expect(summary.outstanding).toEqual([])
  })

  it('windows recent payments by the date recorded', () => {
    const summary = summarise(
      [
        invoice({ status: InvoiceStatus.Paid, paidOn: '2026-08-05' }),
        invoice({ status: InvoiceStatus.Paid, paidOn: '2026-06-01' }),
      ],
      TODAY,
    )
    expect(summary.paidRecently).toHaveLength(1)
    expect(summary.paidRecently[0].amount).toBe(10000)
  })

  it('averages days to pay from real dates', () => {
    const summary = summarise(
      [
        invoice({ status: InvoiceStatus.Paid, issuedOn: '2026-08-01', paidOn: '2026-08-11' }),
        invoice({ status: InvoiceStatus.Paid, issuedOn: '2026-08-01', paidOn: '2026-08-21' }),
      ],
      TODAY,
    )
    expect(summary.averageDaysToPay).toBe(15)
  })

  it('reports no average when nothing has been paid', () => {
    expect(summarise([invoice()], TODAY).averageDaysToPay).toBeNull()
  })

  it('ignores a payment dated before issue rather than averaging a negative wait', () => {
    const summary = summarise(
      [invoice({ status: InvoiceStatus.Paid, issuedOn: '2026-08-10', paidOn: '2026-08-01' })],
      TODAY,
    )
    expect(summary.averageDaysToPay).toBeNull()
  })

  it('handles an empty list', () => {
    const summary = summarise([], TODAY)
    expect(summary).toMatchObject({ outstanding: [], overdue: [], averageDaysToPay: null })
    expect(summary.counts.all).toBe(0)
  })
})

describe('summariseClients', () => {
  const northgate: Client = {
    id: 'client-1',
    name: 'Northgate Studio',
    billTo: 'Northgate Studio',
    shipTo: '',
    vatId: '',
    currency: 'GBP',
    taxRate: 0,
    archived: false,
  }

  it('matches invoices on the client id', () => {
    const list = [
      invoice({ clientId: 'client-1', status: InvoiceStatus.Sent }),
      invoice({ clientId: 'client-1' }),
    ]

    const [summary] = summariseClients([northgate], list, TODAY)
    expect(summary.invoiceCount).toBe(2)
  })

  it('ignores an unlinked draft', () => {
    // A draft with nobody named belongs to no client.
    expect(summariseClients([northgate], [invoice({ clientId: null })], TODAY)[0].invoiceCount).toBe(0)
  })

  it('counts only unsettled invoices toward outstanding', () => {
    const list = [
      invoice({ clientId: 'client-1', status: InvoiceStatus.Sent }),
      invoice({ clientId: 'client-1', status: InvoiceStatus.Paid, paidOn: '2026-08-05' }),
      invoice({ clientId: 'client-1' }),
    ]

    const [summary] = summariseClients([northgate], list, TODAY)
    expect(summary.invoiceCount).toBe(3)
    expect(summary.outstanding).toEqual([{ currency: 'GBP', amount: 10000 }])
  })

  it('reports the most recent issue date', () => {
    const list = [
      invoice({ clientId: 'client-1', issuedOn: '2026-06-01' }),
      invoice({ clientId: 'client-1', issuedOn: '2026-08-01' }),
    ]
    expect(summariseClients([northgate], list, TODAY)[0].lastInvoiced).toBe('2026-08-01')
  })

  it('includes a client with no invoices', () => {
    const [summary] = summariseClients([northgate], [], TODAY)
    expect(summary).toMatchObject({ invoiceCount: 0, outstanding: [], lastInvoiced: null })
  })

  it('omits archived clients', () => {
    expect(summariseClients([{ ...northgate, archived: true }], [], TODAY)).toEqual([])
  })

  it('does not attribute another client’s invoices', () => {
    const list = [invoice({ clientId: 'client-2', status: InvoiceStatus.Sent })]
    expect(summariseClients([northgate], list, TODAY)[0].invoiceCount).toBe(0)
  })
})

describe('filterByStatus', () => {
  it('filters on the derived status, not the stored one', () => {
    const list = [
      invoice({ status: InvoiceStatus.Sent, dueOn: '2026-08-01' }),
      invoice({ status: InvoiceStatus.Sent, dueOn: '2026-08-30' }),
    ]

    expect(filterByStatus(list, EffectiveStatus.Overdue, TODAY)).toHaveLength(1)
    expect(filterByStatus(list, InvoiceStatus.Sent, TODAY)).toHaveLength(1)
  })

  it('returns everything for all', () => {
    const list = [invoice(), invoice({ status: InvoiceStatus.Void })]
    expect(filterByStatus(list, 'all', TODAY)).toHaveLength(2)
  })
})

describe('byIssueDate', () => {
  it('sorts newest first without mutating the input', () => {
    const list = [invoice({ issuedOn: '2026-06-01' }), invoice({ issuedOn: '2026-08-01' })]
    const original = [...list]

    expect(byIssueDate(list).map((entry) => entry.issuedOn)).toEqual(['2026-08-01', '2026-06-01'])
    expect(list).toEqual(original)
  })
})
