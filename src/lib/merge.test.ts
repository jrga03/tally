import { describe, it, expect } from 'vitest'
import { mergeGroups, applyResolutions } from './merge'
import type { Group, Expense, Settlement } from '../types'

function baseGroup(over: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Trip',
    members: [
      { id: 'm1', name: 'Alice' },
      { id: 'm2', name: 'Bob' },
    ],
    expenses: [],
    settlements: [],
    createdAt: '2026-03-01T00:00:00Z',
    ...over,
  }
}

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'e1',
    description: 'Item',
    amount: 1000,
    paidBy: 'm1',
    splits: [
      { memberId: 'm1', amount: 500 },
      { memberId: 'm2', amount: 500 },
    ],
    date: '2026-03-01',
    createdAt: '2026-03-01T00:00:00Z',
    ...over,
  }
}

function sett(over: Partial<Settlement>): Settlement {
  return {
    id: 's1',
    fromMemberId: 'm2',
    toMemberId: 'm1',
    amount: 500,
    date: '2026-03-02',
    createdAt: '2026-03-02T00:00:00Z',
    ...over,
  }
}

describe('mergeGroups', () => {
  it('takes the union of disjoint expenses', () => {
    const local = baseGroup({ expenses: [exp({ id: 'e-local' })] })
    const incoming = baseGroup({ expenses: [exp({ id: 'e-incoming' })] })

    const result = mergeGroups(local, incoming)
    const ids = result.merged.expenses.map(e => e.id).sort()
    expect(ids).toEqual(['e-incoming', 'e-local'])
    expect(result.hasConflicts).toBe(false)
  })

  it('takes the union of disjoint settlements', () => {
    const local = baseGroup({ settlements: [sett({ id: 's-local' })] })
    const incoming = baseGroup({ settlements: [sett({ id: 's-incoming' })] })
    const result = mergeGroups(local, incoming)
    const ids = result.merged.settlements.map(s => s.id).sort()
    expect(ids).toEqual(['s-incoming', 's-local'])
  })

  it('unions members by id, with incoming name winning on conflict', () => {
    const local = baseGroup({
      members: [
        { id: 'm1', name: 'Alice' },
        { id: 'm2', name: 'Bob (old)' },
      ],
    })
    const incoming = baseGroup({
      members: [
        { id: 'm2', name: 'Bob (new)' },
        { id: 'm3', name: 'Carol' },
      ],
    })
    const result = mergeGroups(local, incoming)
    const byId = Object.fromEntries(result.merged.members.map(m => [m.id, m.name]))
    expect(byId).toEqual({ m1: 'Alice', m2: 'Bob (new)', m3: 'Carol' })
  })

  it('does not flag identical same-id expenses as conflicts', () => {
    const e = exp({ id: 'shared' })
    const result = mergeGroups(
      baseGroup({ expenses: [e] }),
      baseGroup({ expenses: [{ ...e }] }),
    )
    expect(result.hasConflicts).toBe(false)
    expect(result.expenseConflicts).toEqual([])
    expect(result.merged.expenses).toHaveLength(1)
  })

  it('flags divergent same-id expenses as conflicts', () => {
    const localE = exp({ id: 'shared', amount: 1000 })
    const incomingE = exp({ id: 'shared', amount: 2000 })
    const result = mergeGroups(
      baseGroup({ expenses: [localE] }),
      baseGroup({ expenses: [incomingE] }),
    )
    expect(result.hasConflicts).toBe(true)
    expect(result.expenseConflicts).toEqual([{ local: localE, incoming: incomingE }])
    // Local copy stays in `merged.expenses` until resolved
    expect(result.merged.expenses).toEqual([localE])
  })

  it('flags divergent same-id settlements as conflicts', () => {
    const localS = sett({ id: 'shared', amount: 100 })
    const incomingS = sett({ id: 'shared', amount: 200 })
    const result = mergeGroups(
      baseGroup({ settlements: [localS] }),
      baseGroup({ settlements: [incomingS] }),
    )
    expect(result.hasConflicts).toBe(true)
    expect(result.settlementConflicts).toEqual([{ local: localS, incoming: incomingS }])
  })

  it('uses incoming name and earliest createdAt for the merged group', () => {
    const local = baseGroup({ name: 'Old', createdAt: '2026-02-01T00:00:00Z' })
    const incoming = baseGroup({ name: 'New', createdAt: '2026-01-01T00:00:00Z' })
    const result = mergeGroups(local, incoming)
    expect(result.merged.name).toBe('New')
    expect(result.merged.createdAt).toBe('2026-01-01T00:00:00Z')
  })
})

describe('applyResolutions', () => {
  it("keeps the local copy when resolution picks 'local'", () => {
    const localE = exp({ id: 'shared', amount: 1000 })
    const incomingE = exp({ id: 'shared', amount: 2000 })
    const merge = mergeGroups(
      baseGroup({ expenses: [localE] }),
      baseGroup({ expenses: [incomingE] }),
    )
    const resolved = applyResolutions(merge, [
      { type: 'expense', id: 'shared', pick: 'local' },
    ])
    expect(resolved.expenses).toEqual([localE])
  })

  it("swaps in the incoming copy when resolution picks 'incoming'", () => {
    const localE = exp({ id: 'shared', amount: 1000 })
    const incomingE = exp({ id: 'shared', amount: 2000 })
    const merge = mergeGroups(
      baseGroup({ expenses: [localE] }),
      baseGroup({ expenses: [incomingE] }),
    )
    const resolved = applyResolutions(merge, [
      { type: 'expense', id: 'shared', pick: 'incoming' },
    ])
    expect(resolved.expenses).toEqual([incomingE])
  })

  it("swaps in the incoming settlement when resolution picks 'incoming'", () => {
    const localS = sett({ id: 'shared', amount: 100 })
    const incomingS = sett({ id: 'shared', amount: 200 })
    const merge = mergeGroups(
      baseGroup({ settlements: [localS] }),
      baseGroup({ settlements: [incomingS] }),
    )
    const resolved = applyResolutions(merge, [
      { type: 'settlement', id: 'shared', pick: 'incoming' },
    ])
    expect(resolved.settlements).toEqual([incomingS])
  })
})
