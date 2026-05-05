import { describe, it, expect } from 'vitest'
import { splitEqual } from './splitEqual'

describe('splitEqual', () => {
  it('returns empty object for no members', () => {
    expect(splitEqual(10000, [])).toEqual({})
  })

  it('splits evenly when amount divides cleanly', () => {
    const result = splitEqual(900, ['a', 'b', 'c'])
    expect(result).toEqual({ a: 300, b: 300, c: 300 })
  })

  it('distributes remainder centavos so the sum equals the total', () => {
    const result = splitEqual(1000, ['a', 'b', 'c']) // 1000 / 3 = 333 rem 1
    const sum = Object.values(result).reduce((a, b) => a + b, 0)
    expect(sum).toBe(1000)
    // Each share is either floor (333) or floor+1 (334)
    for (const share of Object.values(result)) {
      expect([333, 334]).toContain(share)
    }
  })

  it('exactly one member gets the extra centavo when remainder is 1', () => {
    const result = splitEqual(1000, ['a', 'b', 'c'])
    const extras = Object.values(result).filter(v => v === 334)
    expect(extras).toHaveLength(1)
  })

  it('handles single member', () => {
    expect(splitEqual(777, ['solo'])).toEqual({ solo: 777 })
  })

  it('handles zero amount', () => {
    expect(splitEqual(0, ['a', 'b'])).toEqual({ a: 0, b: 0 })
  })

  it('returns a key for every member', () => {
    const result = splitEqual(1000, ['a', 'b', 'c', 'd'])
    expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})
