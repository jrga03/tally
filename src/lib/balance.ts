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
