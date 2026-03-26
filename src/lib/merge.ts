import type { Group, Expense, Settlement } from '../types'

export interface ConflictPair<T> {
  local: T
  incoming: T
}

export interface ConflictResolution {
  type: 'expense' | 'settlement'
  id: string
  pick: 'local' | 'incoming'
}

export interface MergeResult {
  merged: Group
  expenseConflicts: ConflictPair<Expense>[]
  settlementConflicts: ConflictPair<Settlement>[]
  hasConflicts: boolean
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function mergeGroups(local: Group, incoming: Group): MergeResult {
  // Members: union by ID, prefer incoming name on conflict
  const memberMap = new Map(local.members.map(m => [m.id, m]))
  for (const m of incoming.members) {
    memberMap.set(m.id, m)
  }
  const members = Array.from(memberMap.values())

  // Expenses: union by ID, conflicts when same ID but different content
  const localExpenseMap = new Map(local.expenses.map(e => [e.id, e]))
  const expenseConflicts: ConflictPair<Expense>[] = []
  const mergedExpenses = [...local.expenses]

  for (const incomingExpense of incoming.expenses) {
    const localExpense = localExpenseMap.get(incomingExpense.id)
    if (!localExpense) {
      mergedExpenses.push(incomingExpense)
    } else if (!deepEqual(localExpense, incomingExpense)) {
      expenseConflicts.push({ local: localExpense, incoming: incomingExpense })
    }
  }

  // Settlements: union by ID, conflicts when same ID but different content
  const localSettlementMap = new Map(local.settlements.map(s => [s.id, s]))
  const settlementConflicts: ConflictPair<Settlement>[] = []
  const mergedSettlements = [...local.settlements]

  for (const incomingSettlement of incoming.settlements) {
    const localSettlement = localSettlementMap.get(incomingSettlement.id)
    if (!localSettlement) {
      mergedSettlements.push(incomingSettlement)
    } else if (!deepEqual(localSettlement, incomingSettlement)) {
      settlementConflicts.push({ local: localSettlement, incoming: incomingSettlement })
    }
  }

  const hasConflicts = expenseConflicts.length > 0 || settlementConflicts.length > 0

  const merged: Group = {
    id: local.id,
    name: incoming.name,
    members,
    expenses: mergedExpenses,
    settlements: mergedSettlements,
    createdAt: local.createdAt < incoming.createdAt ? local.createdAt : incoming.createdAt,
  }

  return { merged, expenseConflicts, settlementConflicts, hasConflicts }
}

export function applyResolutions(mergeResult: MergeResult, resolutions: ConflictResolution[]): Group {
  let { expenses, settlements } = mergeResult.merged

  for (const res of resolutions) {
    if (res.type === 'expense' && res.pick === 'incoming') {
      const conflict = mergeResult.expenseConflicts.find(c => c.local.id === res.id)
      if (conflict) {
        expenses = expenses.map(e => e.id === res.id ? conflict.incoming : e)
      }
    }
    if (res.type === 'settlement' && res.pick === 'incoming') {
      const conflict = mergeResult.settlementConflicts.find(c => c.local.id === res.id)
      if (conflict) {
        settlements = settlements.map(s => s.id === res.id ? conflict.incoming : s)
      }
    }
  }

  return { ...mergeResult.merged, expenses, settlements }
}
