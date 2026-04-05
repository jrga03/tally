# Balance Entry Breakdown

Expandable per-member entry list in the dashboard Balances section, showing the individual expenses and settlements that sum to each member's displayed balance.

## Data Layer

New function `getBalanceEntries(group, memberId)` in `balance.ts`.

### BalanceEntry type

```ts
type BalanceEntry = {
  description: string
  amount: number  // net effect on balance (positive = gets back, negative = owes)
  date: string
}
```

### Logic

**Per expense:**
- If member paid: `+expense.amount`
- If member has a split: `-split.amount`
- Net = sum of both effects
- Only include if net != 0
- Description: expense description

**Per settlement:**
- If member is `from` (payer): `+settlement.amount`
- If member is `to` (receiver): `-settlement.amount`
- Description: "Paid [Name]" or "Received from [Name]"

Returns entries sorted chronologically by date. The sum of all entry amounts equals the member's balance from `calculateBalances`.

### Memoization

A single `useMemo` in the dashboard component computes a `Map<memberId, BalanceEntry[]>` for all members at once, keyed on the group's expenses and settlements arrays.

## UI Changes (GroupDashboardPage)

- **Expanded state**: `useState<Set<string>>` of member IDs (multiple cards can be open)
- **Toggle**: clicking a member name toggles their ID in the set
- **Cursor**: pointer style on member name to signal clickability
- **Chevron**: `IconChevronDown` next to member name, rotates when expanded
- **Collapse**: Mantine `Collapse` component wraps entry list, controlled by expanded set
- **Entry rows** (inside Collapse): `Stack` of rows, each with:
  - Left: description + date (dimmed, small text)
  - Right: amount (dimmed color-coded by sign, so the badge total remains the visual focus)
