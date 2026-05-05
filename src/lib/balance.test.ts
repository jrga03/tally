import { describe, it, expect } from 'vitest'
import {
  calculateBalances,
  getBalanceEntries,
  computeRawDebts,
  simplifyDebts,
} from './balance'
import type { Group, Expense, Settlement } from '../types'

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Test Group',
    members: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
    ],
    expenses: [],
    settlements: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: 'e' + Math.random().toString(36).slice(2),
    description: 'item',
    amount: 0,
    paidBy: 'a',
    splits: [],
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function settlement(over: Partial<Settlement>): Settlement {
  return {
    id: 's' + Math.random().toString(36).slice(2),
    fromMemberId: 'a',
    toMemberId: 'b',
    amount: 0,
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('calculateBalances', () => {
  it('returns all-zero balances for an empty group', () => {
    const balances = calculateBalances(makeGroup())
    expect(balances.get('a')).toBe(0)
    expect(balances.get('b')).toBe(0)
    expect(balances.get('c')).toBe(0)
  })

  it('credits the payer and debits each split member', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 900,
        paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 },
        ],
      })],
    })
    const balances = calculateBalances(group)
    expect(balances.get('a')).toBe(600)
    expect(balances.get('b')).toBe(-300)
    expect(balances.get('c')).toBe(-300)
  })

  it('balances always sum to zero', () => {
    const group = makeGroup({
      expenses: [
        expense({ amount: 1500, paidBy: 'a', splits: [
          { memberId: 'a', amount: 500 },
          { memberId: 'b', amount: 500 },
          { memberId: 'c', amount: 500 },
        ]}),
        expense({ amount: 600, paidBy: 'b', splits: [
          { memberId: 'a', amount: 200 },
          { memberId: 'b', amount: 200 },
          { memberId: 'c', amount: 200 },
        ]}),
      ],
      settlements: [settlement({ fromMemberId: 'c', toMemberId: 'a', amount: 100 })],
    })
    const balances = calculateBalances(group)
    const sum = Array.from(balances.values()).reduce((s, v) => s + v, 0)
    expect(sum).toBe(0)
  })

  it('settlements offset balances', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 600, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
        ],
      })],
      settlements: [settlement({ fromMemberId: 'b', toMemberId: 'a', amount: 300 })],
    })
    const balances = calculateBalances(group)
    expect(balances.get('a')).toBe(0)
    expect(balances.get('b')).toBe(0)
  })
})

describe('getBalanceEntries', () => {
  it('returns empty arrays for a group with no activity', () => {
    const entries = getBalanceEntries(makeGroup())
    expect(entries.get('a')).toEqual([])
  })

  it('records payer credit and split debit on the same expense', () => {
    const group = makeGroup({
      expenses: [expense({
        id: 'x', description: 'Dinner', date: '2026-02-01',
        amount: 600, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
        ],
      })],
    })
    const entries = getBalanceEntries(group)
    expect(entries.get('a')).toEqual([
      { description: 'Dinner', amount: 300, date: '2026-02-01' },
    ])
    expect(entries.get('b')).toEqual([
      { description: 'Dinner', amount: -300, date: '2026-02-01' },
    ])
  })

  it('produces settlement entries with from/to descriptions', () => {
    const group = makeGroup({
      settlements: [settlement({
        fromMemberId: 'b', toMemberId: 'a', amount: 100, date: '2026-03-01',
      })],
    })
    const entries = getBalanceEntries(group)
    expect(entries.get('b')).toEqual([
      { description: 'Paid Alice', amount: 100, date: '2026-03-01' },
    ])
    expect(entries.get('a')).toEqual([
      { description: 'Received from Bob', amount: -100, date: '2026-03-01' },
    ])
  })

  it('sorts entries by date ascending', () => {
    const group = makeGroup({
      expenses: [
        expense({ description: 'Late', date: '2026-03-01', amount: 100, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 50 }, { memberId: 'b', amount: 50 }] }),
        expense({ description: 'Early', date: '2026-01-01', amount: 100, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 50 }, { memberId: 'b', amount: 50 }] }),
      ],
    })
    const dates = entries(group, 'a').map(e => e.date)
    expect(dates).toEqual(['2026-01-01', '2026-03-01'])
  })
})

function entries(group: Group, memberId: string) {
  return getBalanceEntries(group).get(memberId)!
}

describe('computeRawDebts', () => {
  it('returns no debts for an empty group', () => {
    expect(computeRawDebts(makeGroup())).toEqual([])
  })

  it('records a debt from each non-payer split member to the payer', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 900, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 },
        ],
      })],
    })
    const debts = computeRawDebts(group)
    expect(debts).toContainEqual({ fromMemberId: 'b', toMemberId: 'a', amount: 300 })
    expect(debts).toContainEqual({ fromMemberId: 'c', toMemberId: 'a', amount: 300 })
    expect(debts).toHaveLength(2)
  })

  it('nets opposing debts between the same pair', () => {
    // a pays 600 split between a/b (b owes a 300)
    // then b pays 400 split between a/b (a owes b 200)
    // net: b owes a 100
    const group = makeGroup({
      expenses: [
        expense({ amount: 600, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 }] }),
        expense({ amount: 400, paidBy: 'b',
          splits: [{ memberId: 'a', amount: 200 }, { memberId: 'b', amount: 200 }] }),
      ],
    })
    const debts = computeRawDebts(group)
    expect(debts).toEqual([{ fromMemberId: 'b', toMemberId: 'a', amount: 100 }])
  })

  it('settlements reduce debts', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 600, paidBy: 'a',
        splits: [{ memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 }],
      })],
      settlements: [settlement({ fromMemberId: 'b', toMemberId: 'a', amount: 300 })],
    })
    expect(computeRawDebts(group)).toEqual([])
  })

  it('drops debts at or below the threshold (≤0.005)', () => {
    // Construct a near-zero residual via opposing debts that don't quite cancel.
    // Sub-threshold debts must not appear in the output.
    const group = makeGroup({
      expenses: [
        expense({ amount: 1, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 0.5 }, { memberId: 'b', amount: 0.5 }] }),
      ],
      settlements: [settlement({ fromMemberId: 'b', toMemberId: 'a', amount: 0.499 })],
    })
    const debts = computeRawDebts(group)
    // 0.5 - 0.499 = 0.001, below the 0.005 threshold
    expect(debts).toEqual([])
  })

  it('sorts debts by amount descending', () => {
    const group = makeGroup({
      expenses: [
        expense({ amount: 100, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 50 }, { memberId: 'b', amount: 50 }] }),
        expense({ amount: 1000, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 500 }, { memberId: 'c', amount: 500 }] }),
      ],
    })
    const amounts = computeRawDebts(group).map(d => d.amount)
    expect(amounts).toEqual([500, 50])
  })
})

describe('simplifyDebts', () => {
  it('returns no settlements for a balanced group', () => {
    expect(simplifyDebts(makeGroup())).toEqual([])
  })

  it('produces at most N-1 settlements for N members with non-zero balance', () => {
    // 4 members, all imbalanced
    const group: Group = {
      ...makeGroup(),
      members: [
        { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
        { id: 'c', name: 'C' }, { id: 'd', name: 'D' },
      ],
      expenses: [expense({
        amount: 1200, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 }, { memberId: 'd', amount: 300 },
        ],
      })],
    }
    const settlements = simplifyDebts(group)
    expect(settlements.length).toBeLessThanOrEqual(3)
  })

  it('settlement amounts cancel the original balances', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 900, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 },
        ],
      })],
    })
    const balances = calculateBalances(group)
    const settlements = simplifyDebts(group, balances)

    // Apply settlements to balances and verify they all become 0.
    const adjusted = new Map(balances)
    for (const s of settlements) {
      adjusted.set(s.fromMemberId, adjusted.get(s.fromMemberId)! + s.amount)
      adjusted.set(s.toMemberId, adjusted.get(s.toMemberId)! - s.amount)
    }
    for (const v of adjusted.values()) {
      expect(Math.abs(v)).toBeLessThan(0.001)
    }
  })

  it('uses precomputedBalances if provided', () => {
    // Pass artificial balances; should not call calculateBalances internally.
    const group = makeGroup()
    const balances = new Map<string, number>([
      ['a', 100], ['b', -100],
    ])
    const settlements = simplifyDebts(group, balances)
    expect(settlements).toEqual([
      { fromMemberId: 'b', toMemberId: 'a', amount: 100 },
    ])
  })
})
