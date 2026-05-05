import { describe, it, expect } from 'vitest'
import { appReducer, type AppState } from './reducer'
import type { Group, Expense, Settlement, Member } from '../types'

const member = (id: string, name: string): Member => ({ id, name })

const baseGroup = (id = 'g1'): Group => ({
  id,
  name: 'Group ' + id,
  members: [member('a', 'Alice'), member('b', 'Bob')],
  expenses: [],
  settlements: [],
  createdAt: '2026-01-01T00:00:00Z',
})

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  description: 'Lunch',
  amount: 1000,
  paidBy: 'a',
  splits: [
    { memberId: 'a', amount: 500 },
    { memberId: 'b', amount: 500 },
  ],
  date: '2026-01-02',
  createdAt: '2026-01-02T00:00:00Z',
  ...over,
})

const settlement = (over: Partial<Settlement> = {}): Settlement => ({
  id: 's1',
  fromMemberId: 'b',
  toMemberId: 'a',
  amount: 500,
  date: '2026-01-03',
  createdAt: '2026-01-03T00:00:00Z',
  ...over,
})

describe('appReducer', () => {
  describe('CREATE_GROUP / IMPORT_GROUP / MERGE_GROUP', () => {
    it('adds a new group keyed by id', () => {
      const next = appReducer({}, { type: 'CREATE_GROUP', payload: baseGroup('g1') })
      expect(next).toEqual({ g1: baseGroup('g1') })
    })

    it('IMPORT_GROUP behaves like CREATE_GROUP', () => {
      const next = appReducer({}, { type: 'IMPORT_GROUP', payload: baseGroup('g1') })
      expect(next.g1).toEqual(baseGroup('g1'))
    })

    it('MERGE_GROUP overwrites the group at the same id', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const merged: Group = { ...baseGroup('g1'), name: 'Renamed' }
      const next = appReducer(initial, { type: 'MERGE_GROUP', payload: merged })
      expect(next.g1.name).toBe('Renamed')
    })
  })

  describe('DELETE_GROUP', () => {
    it('removes the group from state', () => {
      const initial: AppState = { g1: baseGroup('g1'), g2: baseGroup('g2') }
      const next = appReducer(initial, {
        type: 'DELETE_GROUP', payload: { groupId: 'g1' },
      })
      expect(next).toEqual({ g2: baseGroup('g2') })
    })

    it('is a no-op when the group does not exist', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'DELETE_GROUP', payload: { groupId: 'missing' },
      })
      expect(next).toEqual({ g1: baseGroup('g1') })
    })
  })

  describe('ADD_MEMBER / REMOVE_MEMBER', () => {
    it('adds a member to the group', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'ADD_MEMBER',
        payload: { groupId: 'g1', member: member('c', 'Carol') },
      })
      expect(next.g1.members.map(m => m.id)).toEqual(['a', 'b', 'c'])
    })

    it('removes a member from the group', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'REMOVE_MEMBER',
        payload: { groupId: 'g1', memberId: 'a' },
      })
      expect(next.g1.members.map(m => m.id)).toEqual(['b'])
    })

    it('is a no-op for an unknown group', () => {
      const next = appReducer({}, {
        type: 'ADD_MEMBER',
        payload: { groupId: 'missing', member: member('c', 'Carol') },
      })
      expect(next).toEqual({})
    })
  })

  describe('ADD_EXPENSE / EDIT_EXPENSE / DELETE_EXPENSE', () => {
    it('adds an expense', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'ADD_EXPENSE',
        payload: { groupId: 'g1', expense: expense() },
      })
      expect(next.g1.expenses).toEqual([expense()])
    })

    it('edits an expense in place', () => {
      const initial: AppState = {
        g1: { ...baseGroup('g1'), expenses: [expense({ id: 'e1' })] },
      }
      const updated = expense({ id: 'e1', description: 'Brunch' })
      const next = appReducer(initial, {
        type: 'EDIT_EXPENSE',
        payload: { groupId: 'g1', expense: updated },
      })
      expect(next.g1.expenses).toEqual([updated])
    })

    it('deletes an expense', () => {
      const initial: AppState = {
        g1: { ...baseGroup('g1'),
          expenses: [expense({ id: 'e1' }), expense({ id: 'e2' })] },
      }
      const next = appReducer(initial, {
        type: 'DELETE_EXPENSE',
        payload: { groupId: 'g1', expenseId: 'e1' },
      })
      expect(next.g1.expenses.map(e => e.id)).toEqual(['e2'])
    })
  })

  describe('ADD_SETTLEMENT / DELETE_SETTLEMENT', () => {
    it('adds a settlement', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'ADD_SETTLEMENT',
        payload: { groupId: 'g1', settlement: settlement() },
      })
      expect(next.g1.settlements).toEqual([settlement()])
    })

    it('deletes a settlement', () => {
      const initial: AppState = {
        g1: { ...baseGroup('g1'),
          settlements: [settlement({ id: 's1' }), settlement({ id: 's2' })] },
      }
      const next = appReducer(initial, {
        type: 'DELETE_SETTLEMENT',
        payload: { groupId: 'g1', settlementId: 's1' },
      })
      expect(next.g1.settlements.map(s => s.id)).toEqual(['s2'])
    })
  })

  it('returns state unchanged for unknown actions', () => {
    const initial: AppState = { g1: baseGroup('g1') }
    // @ts-expect-error — deliberately invalid action for default-case test
    const next = appReducer(initial, { type: 'UNKNOWN', payload: {} })
    expect(next).toBe(initial)
  })
})
