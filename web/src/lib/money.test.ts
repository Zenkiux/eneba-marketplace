import { describe, expect, it } from 'vitest'
import { formatCents } from './money'

describe('formatCents', () => {
  it.each([
    [1234, '€12.34'],
    [0, '€0.00'],
    [5, '€0.05'],
    [100, '€1.00'],
    [123456789, '€1,234,567.89'],
    [-899, '-€8.99'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected)
  })

  it('formats other currencies', () => {
    expect(formatCents(1999, 'USD')).toBe('US$19.99')
    expect(formatCents(1999, 'GBP')).toBe('£19.99')
  })

  it('rejects fractional cents', () => {
    expect(() => formatCents(12.5)).toThrow(RangeError)
  })
})
