import type { Column, Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { Invoice, Sender } from '../types'
import { computeTotals } from './invoice'
import { formatMoney } from './money'
import { orDash } from './display'

/**
 * Builds the pdfmake definition for an invoice.
 *
 * Pure: an invoice in, a document description out. Nothing here reads the DOM,
 * storage or the clock, so the document a client receives can be asserted
 * exactly, without a browser.
 *
 * The layout is deliberately separate from the on-screen one. A printed invoice
 * is a fixed-width page with a repeating table header; the editor is a
 * responsive form. Sharing markup between them is what makes print output
 * fragile.
 */

/**
 * Fixed and light, never read from theme tokens: a themed document would emit a
 * dark invoice for a user in dark mode.
 */
const INK = '#1d1f20'
const MUTED = '#6b6f72'
const RULE = '#d4d4d7'
const ACCENT = '#41617f'

export interface DocumentInput {
  invoice: Invoice
  sender: Sender
  /** Data URL. pdfmake embeds images by URI, so the caller decodes the blob. */
  logo?: string | null
}

export function invoiceDocument({ invoice, sender, logo }: DocumentInput): TDocumentDefinitions {
  const totals = computeTotals(invoice)
  const money = (minor: number) => formatMoney(minor, invoice.currency)

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: INK, lineHeight: 1.25 },

    content: [
      masthead(invoice, sender, logo),
      { text: '', margin: [0, 0, 0, 14] },
      parties(invoice),
      { text: '', margin: [0, 0, 0, 16] },
      items(invoice, money),
      totalsBlock(totals, money, invoice),
      footnotes(invoice),
    ],

    footer: (current, total) => ({
      margin: [40, 12, 40, 0],
      columns: [
        { text: invoice.number, color: MUTED, fontSize: 8 },
        { text: `${current} / ${total}`, alignment: 'right', color: MUTED, fontSize: 8 },
      ],
    }),

    styles: {
      title: { fontSize: 26, bold: true, characterSpacing: 1 },
      label: { fontSize: 7.5, color: MUTED, characterSpacing: 0.8, bold: true },
      tableHeader: { fontSize: 7.5, color: MUTED, characterSpacing: 0.8, bold: true },
      total: { fontSize: 15, bold: true },
    },
  }
}

function masthead(invoice: Invoice, sender: Sender, logo?: string | null): Content {
  const issuer: Content[] = [
    { text: 'Issued by', style: 'label', margin: [0, 0, 0, 3] },
    { text: invoice.from, preserveLeadingSpaces: true },
  ]

  if (sender.vatId) issuer.push({ text: sender.vatId, color: MUTED, margin: [0, 3, 0, 0] })

  return {
    columns: [
      logo
        ? { width: 108, stack: [{ image: logo, fit: [96, 48] }, { stack: issuer, margin: [0, 10, 0, 0] }] }
        : { width: '*', stack: issuer },
      logo ? { width: '*', stack: [] } : { width: 0, text: '' },
      {
        width: 'auto',
        stack: [
          { text: 'INVOICE', style: 'title', alignment: 'right' },
          { text: invoice.number, alignment: 'right', color: MUTED, margin: [0, 2, 0, 0] },
        ],
      },
    ],
    columnGap: 16,
  }
}

function parties(invoice: Invoice): Content {
  const meta: Content[] = [
    { text: 'Details', style: 'label', margin: [0, 0, 0, 3] },
    metaRow('Issued', invoice.issuedOn),
    metaRow('Due', invoice.dueOn),
  ]

  if (invoice.poNumber) meta.push(metaRow('PO', invoice.poNumber))
  meta.push(metaRow('Currency', invoice.currency))

  const columns: Column[] = [
    {
      width: '*',
      stack: [
        { text: 'Billed to', style: 'label', margin: [0, 0, 0, 3] },
        { text: invoice.billTo, preserveLeadingSpaces: true },
        ...(invoice.vatId
          ? [{ text: invoice.vatId, color: MUTED, margin: [0, 3, 0, 0] } satisfies Content]
          : []),
      ],
    },
  ]

  if (invoice.shipTo.trim()) {
    columns.push({
      width: '*',
      stack: [
        { text: 'Shipped to', style: 'label', margin: [0, 0, 0, 3] },
        { text: invoice.shipTo, preserveLeadingSpaces: true },
      ],
    })
  }

  columns.push({ width: 150, stack: meta })

  return { columns, columnGap: 16 }
}

function metaRow(label: string, value: string): Content {
  return {
    columns: [
      { text: label, color: MUTED, width: 58 },
      { text: orDash(value), width: '*' },
    ],
    margin: [0, 0, 0, 2],
  }
}

function items(invoice: Invoice, money: (minor: number) => string): Content {
  const header = ['Description', 'Qty', 'Rate', 'Amount'].map((text, index) => ({
    text,
    style: 'tableHeader' as const,
    alignment: index === 0 ? ('left' as const) : ('right' as const),
    margin: [0, 0, 0, 4] as [number, number, number, number],
  }))

  const rows = invoice.items.map((item) => [
    { text: orDash(item.description) },
    { text: String(item.quantity), alignment: 'right' as const },
    { text: money(item.rate), alignment: 'right' as const },
    { text: money(Math.round(item.quantity * item.rate)), alignment: 'right' as const },
  ])

  return {
    table: {
      // Repeats across every page, so a long invoice stays readable.
      headerRows: 1,
      widths: ['*', 44, 72, 82],
      body: [header, ...rows],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.4),
      vLineWidth: () => 0,
      hLineColor: (i) => (i <= 1 ? INK : RULE),
      paddingTop: () => 5,
      paddingBottom: () => 5,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  }
}

function totalsBlock(
  totals: ReturnType<typeof computeTotals>,
  money: (minor: number) => string,
  invoice: Invoice,
): Content {
  const rows: [string, string][] = [['Subtotal', money(totals.subtotal)]]

  if (totals.discount) rows.push(['Discount', `−${money(totals.discount)}`])
  if (totals.tax) {
    const label = invoice.taxMode === 'percentage' ? `Tax ${invoice.taxRate}%` : 'Tax'
    rows.push([label, money(totals.tax)])
  }
  if (totals.shipping) rows.push(['Shipping', money(totals.shipping)])
  rows.push(['Total', money(totals.total)])
  if (totals.amountPaid) rows.push(['Amount paid', `−${money(totals.amountPaid)}`])

  return {
    margin: [0, 18, 0, 0],
    columns: [
      { width: '*', text: '' },
      {
        width: 216,
        stack: [
          {
            table: {
              widths: ['*', 'auto'],
              body: rows.map(([label, value]) => [
                { text: label, color: MUTED },
                { text: value, alignment: 'right' as const },
              ]),
            },
            layout: {
              hLineWidth: (i, node) => (i === node.table.body.length - 1 ? 0.7 : 0),
              vLineWidth: () => 0,
              hLineColor: () => RULE,
              paddingTop: () => 3,
              paddingBottom: () => 3,
              paddingLeft: () => 0,
              paddingRight: () => 0,
            },
          },
          {
            margin: [0, 8, 0, 0],
            columns: [
              { text: 'Balance due', style: 'label', margin: [0, 6, 0, 0] },
              {
                text: money(totals.balanceDue),
                style: 'total',
                alignment: 'right',
                color: ACCENT,
              },
            ],
          },
        ],
      },
    ],
  }
}

function footnotes(invoice: Invoice): Content {
  const blocks: Content[] = []

  if (invoice.notes.trim()) {
    blocks.push({ text: 'Notes', style: 'label', margin: [0, 0, 0, 3] })
    blocks.push({ text: invoice.notes, color: MUTED, preserveLeadingSpaces: true })
  }

  if (invoice.terms.trim()) {
    blocks.push({ text: 'Terms', style: 'label', margin: [0, blocks.length ? 10 : 0, 0, 3] })
    blocks.push({ text: invoice.terms, color: MUTED, preserveLeadingSpaces: true })
  }

  return blocks.length ? { stack: blocks, margin: [0, 26, 0, 0] } : { text: '' }
}
