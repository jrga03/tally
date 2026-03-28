# Expense View, Edit & Notes Design

## Context

The app currently has no way to view expense details (split breakdown), edit existing expenses, or attach notes. This design adds all three features.

## Data Model

Add optional `notes` field to the `Expense` interface:

```typescript
export interface Expense {
  // ...existing fields
  notes?: string;
}
```

No migration needed — existing expenses without notes remain valid.

## Inline View (Expand Card)

- Tapping an expense card in ExpenseListPage toggles an expanded section
- Expanded section shows:
  - Split breakdown (member name + owed amount)
  - Notes (if present)
- Multiple cards can be expanded simultaneously (tracked via `Set<string>`)
- Uses Mantine `Collapse` for animation

## Shared ExpenseForm Component

Extract form logic from AddExpensePage into `src/components/ExpenseForm.tsx`:

- **Props:** `initialData?: Expense`, `onSubmit: (expense: Expense) => void`, `submitLabel: string`
- Contains: description, amount, paid by, split method, splits, date, notes textarea
- Notes field: Mantine `Textarea` with `autosize`, `minRows={2}`, `maxRows={6}`, placed after splits and before submit button

AddExpensePage and EditExpensePage become thin wrappers around this component.

## Edit Page

- **Route:** `/group/:id/expense/:expenseId/edit`
- Looks up expense by ID, renders `ExpenseForm` with `initialData` pre-filled
- On save, dispatches `EDIT_EXPENSE` action and navigates back to expense list
- Navigated to via Edit button in the expanded card view

## Balances

No special handling. Editing an expense replaces it in state; balances are computed from the current expense list on every render.

## Files

**Create:**
- `src/components/ExpenseForm.tsx`
- `src/pages/EditExpensePage.tsx`

**Modify:**
- `src/types.ts` — add `notes?: string`
- `src/pages/AddExpensePage.tsx` — use ExpenseForm
- `src/pages/ExpenseListPage.tsx` — expandable cards + edit button
- `src/App.tsx` — add edit route
