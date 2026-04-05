import type { Group } from '../types'

export interface Balance {
  memberId: string
  amount: number // positive = is owed, negative = owes
}

export interface DebtSettlement {
  fromMemberId: string
  toMemberId: string
  amount: number
}

export interface BalanceEntry {
  description: string
  amount: number // net effect on balance (positive = gets back, negative = owes)
  date: string
}

export function calculateBalances(group: Group): Map<string, number> {
  const balances = new Map<string, number>()

  // Initialize all members to 0
  for (const member of group.members) {
    balances.set(member.id, 0)
  }

  // Process expenses
  for (const expense of group.expenses) {
    // Payer gets credit for total amount
    const payerBalance = balances.get(expense.paidBy) ?? 0
    balances.set(expense.paidBy, payerBalance + expense.amount)

    // Each split member owes their share
    for (const split of expense.splits) {
      const memberBalance = balances.get(split.memberId) ?? 0
      balances.set(split.memberId, memberBalance - split.amount)
    }
  }

  // Process settlements
  for (const settlement of group.settlements) {
    const fromBalance = balances.get(settlement.fromMemberId) ?? 0
    balances.set(settlement.fromMemberId, fromBalance + settlement.amount)

    const toBalance = balances.get(settlement.toMemberId) ?? 0
    balances.set(settlement.toMemberId, toBalance - settlement.amount)
  }

  return balances
}

export function getBalanceEntries(group: Group): Map<string, BalanceEntry[]> {
  const entriesMap = new Map<string, BalanceEntry[]>()

  for (const member of group.members) {
    entriesMap.set(member.id, [])
  }

  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

  for (const expense of group.expenses) {
    for (const member of group.members) {
      let amount = 0
      if (expense.paidBy === member.id) {
        amount += expense.amount
      }
      const split = expense.splits.find(s => s.memberId === member.id)
      if (split) {
        amount -= split.amount
      }
      if (amount !== 0) {
        entriesMap.get(member.id)!.push({
          description: expense.description,
          amount,
          date: expense.date,
        })
      }
    }
  }

  for (const settlement of group.settlements) {
    if (settlement.amount !== 0) {
      entriesMap.get(settlement.fromMemberId)?.push({
        description: `Paid ${getMemberName(settlement.toMemberId)}`,
        amount: settlement.amount,
        date: settlement.date,
      })
      entriesMap.get(settlement.toMemberId)?.push({
        description: `Received from ${getMemberName(settlement.fromMemberId)}`,
        amount: -settlement.amount,
        date: settlement.date,
      })
    }
  }

  for (const [, entries] of entriesMap) {
    entries.sort((a, b) => a.date.localeCompare(b.date))
  }

  return entriesMap
}

export function computeRawDebts(group: Group): DebtSettlement[] {
  // Track pairwise debts: key is "fromId->toId", value is amount
  const pairwise = new Map<string, number>()

  const addDebt = (from: string, to: string, amount: number) => {
    // Always store in canonical direction; net opposing debts
    const key = `${from}->${to}`
    const reverseKey = `${to}->${from}`
    const existing = pairwise.get(key) ?? 0
    const reverse = pairwise.get(reverseKey) ?? 0

    if (reverse > 0) {
      // Net against the reverse direction
      if (amount <= reverse) {
        pairwise.set(reverseKey, reverse - amount)
      } else {
        pairwise.delete(reverseKey)
        pairwise.set(key, existing + amount - reverse)
      }
    } else {
      pairwise.set(key, existing + amount)
    }
  }

  // Process expenses: each split member owes the payer their share
  for (const expense of group.expenses) {
    for (const split of expense.splits) {
      if (split.memberId !== expense.paidBy) {
        addDebt(split.memberId, expense.paidBy, split.amount)
      }
    }
  }

  // Process settlements: reduce debts
  for (const settlement of group.settlements) {
    addDebt(settlement.toMemberId, settlement.fromMemberId, settlement.amount)
  }

  const settlements: DebtSettlement[] = []
  for (const [key, amount] of pairwise) {
    if (amount > 0.005) {
      const [fromMemberId, toMemberId] = key.split('->')
      settlements.push({ fromMemberId, toMemberId, amount })
    }
  }

  return settlements.sort((a, b) => b.amount - a.amount)
}

export function simplifyDebts(group: Group, precomputedBalances?: Map<string, number>): DebtSettlement[] {
  const balances = precomputedBalances ?? calculateBalances(group)
  const debtors: { memberId: string; amount: number }[] = []
  const creditors: { memberId: string; amount: number }[] = []

  for (const [memberId, amount] of balances) {
    if (amount < 0) {
      debtors.push({ memberId, amount: Math.abs(amount) })
    } else if (amount > 0) {
      creditors.push({ memberId, amount })
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const settlements: DebtSettlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const settleAmount = Math.min(debtors[i].amount, creditors[j].amount)
    if (settleAmount > 0) {
      settlements.push({
        fromMemberId: debtors[i].memberId,
        toMemberId: creditors[j].memberId,
        amount: settleAmount,
      })
    }
    debtors[i].amount -= settleAmount
    creditors[j].amount -= settleAmount

    if (debtors[i].amount === 0) i++
    if (creditors[j].amount === 0) j++
  }

  return settlements
}
