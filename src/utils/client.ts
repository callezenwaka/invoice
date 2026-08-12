/**
 * Client identity.
 *
 * `normalizeKey` exists for one purpose: recognising a name already on file as
 * it is typed, so `Northgate Studio`, `Northgate Studio.` and `northgate studio`
 * resolve to one record rather than creating three.
 *
 * It is not an identity. Invoices link to a client by id; nothing groups on a
 * name.
 */


/** Trimmed, lowercased, inner whitespace collapsed, trailing punctuation dropped. */
export function normalizeKey(name: string): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim()
}

