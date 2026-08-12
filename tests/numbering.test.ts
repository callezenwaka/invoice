import { describe, it, expect } from 'vitest'
import { highestSequence, nextNumber } from '../src/utils/numbering'

describe('highestSequence', () => {
  it('reads the trailing digits', () => {
    expect(highestSequence(['INV-0001', 'INV-0007', 'INV-0003'], 'INV-')).toBe(7)
  })

  it('ignores other series', () => {
    // Two senders, two runs. The second sender's numbers must not advance the first.
    expect(highestSequence(['INV-0004', 'ACME-0099'], 'INV-')).toBe(4)
    expect(highestSequence(['INV-0004', 'ACME-0099'], 'ACME-')).toBe(99)
  })

  it('handles an empty or unnumbered series', () => {
    expect(highestSequence([], 'INV-')).toBe(0)
    expect(highestSequence(['INV-draft'], 'INV-')).toBe(0)
  })

  it('works without a prefix', () => {
    expect(highestSequence(['1', '12', '5'])).toBe(12)
  })
})

describe('nextNumber', () => {
  it('starts a new series at one', () => {
    expect(nextNumber([], 'INV-')).toBe('INV-0001')
  })

  it('continues from the highest, not the count', () => {
    // The count is 2 but the highest is 7 — counting would reissue INV-0003.
    expect(nextNumber(['INV-0001', 'INV-0007'], 'INV-')).toBe('INV-0008')
  })

  it('never reuses a voided number', () => {
    // INV-0003 was voided and is gone from the active set; the run must not
    // fill the hole, because gapless auditing requires numbers stay unique.
    const afterVoid = ['INV-0001', 'INV-0002', 'INV-0004']
    expect(nextNumber(afterVoid, 'INV-')).toBe('INV-0005')
  })

  it('keeps series independent per sender', () => {
    const all = ['INV-0009', 'ACME-0002']
    expect(nextNumber(all, 'INV-')).toBe('INV-0010')
    expect(nextNumber(all, 'ACME-')).toBe('ACME-0003')
  })

  it('respects the padding width and grows past it', () => {
    expect(nextNumber(['INV-0001'], 'INV-', 2)).toBe('INV-02')
    expect(nextNumber(['INV-9999'], 'INV-')).toBe('INV-10000')
  })
})
