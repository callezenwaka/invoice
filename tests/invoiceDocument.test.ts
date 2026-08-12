import { describe, it, expect } from 'vitest'
import { invoiceDocument } from '../src/utils/invoiceDocument'
import { pdfFilename } from '../src/utils/pdf'
import { InvoiceStatus, TaxMode } from '../src/types'
import type { Invoice, Sender } from '../src/types'

const sender: Sender = {
  id: 'sender-1',
  name: 'Sundial Studio',
  from: 'Sundial Studio\n12 Bridge St',
  logo: null,
  vatId: 'GB123456789',
  numberPrefix: 'INV-',
  paymentTermDays: 21,
  notes: '',
  terms: '',
  taxRate: 20,
  currency: 'GBP',
  isDefault: true,
  archived: false,
}

const invoice: Invoice = {
  id: 'invoice-1',
  number: 'INV-0007',
  status: InvoiceStatus.Sent,
  senderId: sender.id,
  clientId: 'client-1',
  from: sender.from,
  billTo: 'Northgate Studio\n4 Kiln Lane',
  shipTo: '',
  vatId: '',
  issuedOn: '2026-07-08',
  dueOn: '2026-07-22',
  paidOn: null,
  poNumber: '',
  currency: 'GBP',
  items: [
    { id: 'a', description: 'Component audit', quantity: 24, rate: 9500 },
    { id: 'b', description: 'Documentation pass', quantity: 8, rate: 9500 },
  ],
  taxRate: 20,
  taxMode: TaxMode.Percentage,
  discount: 0,
  shipping: 0,
  amountPaid: 0,
  notes: '',
  terms: '',
}

/** Flattens the definition so assertions can look for content anywhere in it. */
function flatten(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((entry) => flatten(entry, out))
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => flatten(entry, out))
  }
  return out
}

function textOf(definition: unknown): string {
  return flatten(definition).join('\n')
}

describe('invoiceDocument', () => {
  it('is A4, not Letter', () => {
    expect(invoiceDocument({ invoice, sender }).pageSize).toBe('A4')
  })

  it('repeats the table header across pages', () => {
    const doc = invoiceDocument({ invoice, sender })
    const table = JSON.stringify(doc.content)
    expect(table).toContain('"headerRows":1')
  })

  it('carries the invoice identity and both addresses', () => {
    const text = textOf(invoiceDocument({ invoice, sender }))
    expect(text).toContain('INV-0007')
    expect(text).toContain('Northgate Studio')
    expect(text).toContain('Sundial Studio')
    expect(text).toContain('2026-07-08')
    expect(text).toContain('2026-07-22')
  })

  it('prints the snapshot on the invoice, never the current profile', () => {
    // Editing a sender must never rewrite an invoice already issued. There is no
    // fallback to the live record: setup guarantees the snapshot is populated.
    const renamed = { ...sender, from: 'Renamed Studio\nElsewhere' }
    const text = textOf(invoiceDocument({ invoice, sender: renamed }))

    expect(text).toContain('Sundial Studio')
    expect(text).not.toContain('Renamed Studio')
  })


  it('omits optional blocks that are empty', () => {
    const text = textOf(invoiceDocument({ invoice, sender }))
    expect(text).not.toContain('Shipped to')
    expect(text).not.toContain('Notes')
    expect(text).not.toContain('Terms')
    expect(text).not.toContain('PO')
  })

  it('includes optional blocks when they have content', () => {
    const full = {
      ...invoice,
      shipTo: 'Warehouse 3',
      poNumber: 'PO-99',
      notes: 'Thank you',
      terms: 'Late fees apply',
      discount: 5000,
      shipping: 1200,
      amountPaid: 10000,
    }
    const text = textOf(invoiceDocument({ invoice: full, sender }))

    for (const expected of ['Shipped to', 'Warehouse 3', 'PO-99', 'Notes', 'Thank you', 'Terms']) {
      expect(text).toContain(expected)
    }
    expect(text).toContain('Discount')
    expect(text).toContain('Shipping')
    expect(text).toContain('Amount paid')
  })

  it('labels a percentage tax with its rate and a fixed tax without one', () => {
    expect(textOf(invoiceDocument({ invoice, sender }))).toContain('Tax 20%')

    const fixed = { ...invoice, taxMode: TaxMode.Fixed, taxRate: 750 }
    const text = textOf(invoiceDocument({ invoice: fixed, sender }))
    expect(text).toContain('Tax')
    expect(text).not.toContain('Tax 750%')
  })

  it('embeds a logo only when one is supplied', () => {
    const withLogo = JSON.stringify(
      invoiceDocument({ invoice, sender, logo: 'data:image/png;base64,AAAA' }),
    )
    expect(withLogo).toContain('data:image/png;base64,AAAA')

    expect(JSON.stringify(invoiceDocument({ invoice, sender }))).not.toContain('"image"')
  })

  it('fixes a light palette rather than reading theme tokens', () => {
    // A themed document would emit a dark invoice for a user in dark mode.
    const serialised = JSON.stringify(invoiceDocument({ invoice, sender }))
    expect(serialised).not.toContain('var(--')
  })

  it('survives an invoice with no line items', () => {
    const empty = { ...invoice, items: [] }
    expect(() => invoiceDocument({ invoice: empty, sender })).not.toThrow()
  })
})

describe('pdfFilename', () => {
  it('names the file after the invoice', () => {
    expect(pdfFilename('INV-0007')).toBe('INV-0007.pdf')
  })

  it('strips characters a filesystem would reject', () => {
    expect(pdfFilename('INV/0007:A')).toBe('INV-0007-A.pdf')
  })

  it('falls back when the number is blank', () => {
    expect(pdfFilename('   ')).toBe('invoice.pdf')
  })
})
