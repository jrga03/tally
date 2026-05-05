import { describe, it, expect } from 'vitest'
import { formatPHP } from './format'

describe('formatPHP', () => {
  it('formats whole pesos with two decimals', () => {
    expect(formatPHP(10000)).toBe('₱100.00')
  })

  it('formats centavos correctly', () => {
    expect(formatPHP(12345)).toBe('₱123.45')
  })

  it('formats zero', () => {
    expect(formatPHP(0)).toBe('₱0.00')
  })

  it('handles negative amounts', () => {
    expect(formatPHP(-500)).toBe('₱-5.00')
  })
})
