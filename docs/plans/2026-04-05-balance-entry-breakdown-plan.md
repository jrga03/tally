# Balance Entry Breakdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add expandable per-member entry lists in the dashboard Balances section, showing expenses and settlements that sum to each member's balance.

**Architecture:** New `getBalanceEntries` function in `balance.ts` computes a flat chronological list of entries per member. Dashboard memoizes entries for all members, toggles visibility per member via `Collapse`.

**Tech Stack:** React 19, Mantine 8 (`Collapse`, `Text`, `Group`, `Stack`), Tabler Icons (`IconChevronDown`)

---

### Task 1: Add `BalanceEntry` type and `getBalanceEntries` function

**Files:**
- Modify: `src/lib/balance.ts:1-12` (add type after existing interfaces)
- Modify: `src/lib/balance.ts:14-45` (add function after `calculateBalances`)

**Step 1: Add the `BalanceEntry` type after the existing interfaces**

Add after line 12 in `src/lib/balance.ts`:

```ts
export interface BalanceEntry {
  description: string
  amount: number // net effect on balance (positive = gets back, negative = owes)
  date: string
}
```

**Step 2: Add the `getBalanceEntries` function**

Add after `calculateBalances` (after line 45) in `src/lib/balance.ts`:

```ts
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
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```
git add src/lib/balance.ts
git commit -m "feat: add getBalanceEntries function for per-member balance breakdown"
```

---

### Task 2: Add expandable entry list to dashboard

**Files:**
- Modify: `src/pages/GroupDashboardPage.tsx`

**Step 1: Update imports**

Replace line 1-2 in `GroupDashboardPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Container, Title, Text, Card, Stack, Group, Button, Badge, Switch, Collapse } from '@mantine/core'
```

Replace line 6:

```tsx
import { calculateBalances, simplifyDebts, computeRawDebts, getBalanceEntries } from '../lib/balance'
```

Add after the existing icon import (line 3):

```tsx
import { IconShare, IconCash, IconChevronDown } from '@tabler/icons-react'
```

**Step 2: Add expanded state and memoized entries**

After the `simplified` state (line 15), add:

```tsx
const [expanded, setExpanded] = useState<Set<string>>(new Set())
```

After the `getMemberName` helper (line 21), add:

```tsx
const allEntries = useMemo(
  () => getBalanceEntries(group),
  [group.expenses, group.settlements, group.members]
)

const toggleExpanded = (memberId: string) => {
  setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    return next
  })
}
```

**Step 3: Replace the member card rendering**

Replace lines 34-46 (the `group.members.map` block) with:

```tsx
{group.members.map(member => {
  const balance = balances.get(member.id) ?? 0
  const isExpanded = expanded.has(member.id)
  const entries = allEntries.get(member.id) ?? []
  return (
    <Card key={member.id} withBorder p="sm">
      <Group justify="space-between">
        <Group
          gap={4}
          style={{ cursor: balance !== 0 ? 'pointer' : undefined }}
          onClick={() => balance !== 0 && toggleExpanded(member.id)}
        >
          {balance !== 0 && (
            <IconChevronDown
              size={16}
              style={{
                transform: isExpanded ? 'rotate(180deg)' : undefined,
                transition: 'transform 200ms',
              }}
            />
          )}
          <Text>{member.name}</Text>
        </Group>
        <Badge color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}>
          {balance > 0 ? `gets back ${formatPHP(balance)}` : balance < 0 ? `owes ${formatPHP(Math.abs(balance))}` : 'settled up'}
        </Badge>
      </Group>
      <Collapse in={isExpanded}>
        <Stack gap={4} mt="xs" ml={20}>
          {entries.map((entry, i) => (
            <Group key={i} justify="space-between">
              <div>
                <Text size="xs">{entry.description}</Text>
                <Text size="xs" c="dimmed">{entry.date}</Text>
              </div>
              <Text size="xs" c={entry.amount > 0 ? 'green.4' : 'red.4'}>
                {entry.amount > 0 ? '+' : ''}{formatPHP(Math.abs(entry.amount))}
              </Text>
            </Group>
          ))}
        </Stack>
      </Collapse>
    </Card>
  )
})}
```

**Step 4: Run typecheck and dev server**

Run: `npm run typecheck`
Expected: No errors

Run: `npm run dev`
Expected: App loads, balances section shows chevrons, clicking a member name expands entries

**Step 5: Manual verification**

1. Create a group with 2+ members and a few expenses
2. Verify each member card shows a chevron (except settled-up members)
3. Click a member name — entry list expands with descriptions, dates, and dimmed colored amounts
4. Verify entry amounts sum to the badge total
5. Click again — collapses
6. Verify multiple cards can be expanded simultaneously

**Step 6: Commit**

```
git add src/pages/GroupDashboardPage.tsx
git commit -m "feat: add expandable balance entry breakdown to dashboard"
```
