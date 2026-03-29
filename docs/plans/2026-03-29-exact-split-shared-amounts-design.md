# Exact Split: Shared Amounts Feature

> **Status:** Implemented (2026-03-29)

## Summary

Extend the "Exact" split mode in ExpenseForm to support shared amounts on top of per-person exact inputs. Users can specify a shared-by-all amount (split equally among all selected members) and add sub-group shared entries (split equally among a subset of members, managed via a modal).

Each person's final split = individual exact amount + shared-by-all share + sum of sub-group shares they're in.

## Data Model

New types added to `types.ts`:

```typescript
export interface SubGroupEntry {
  id: string
  amount: number        // centavos
  memberIds: string[]
  label?: string
}

export interface ExactSplitMeta {
  individualAmounts: Record<string, number>  // memberId -> centavos
  sharedAmount: number                        // centavos, split among all selected
  subGroups: SubGroupEntry[]
}
```

`Expense` gets an optional field:

```typescript
export interface Expense {
  // ... existing fields unchanged
  exactSplitMeta?: ExactSplitMeta
}
```

- `individualAmounts` stored in metadata to avoid reverse-computing from flat splits (fragile due to remainder distribution).
- Flat `Split[]` remains the source of truth for balance calculations. Nothing downstream changes.
- `exactSplitMeta` is optional — existing expenses and non-exact modes are unaffected. No migration needed.

## Centavo Remainder Handling

When dividing shared amounts equally, remainders (e.g., 100 centavos / 3 = 33 each, 1 left over) are distributed by randomly picking which member(s) get the +1 centavo. Members are shuffled before distributing the remainder so it doesn't always fall on the same person. Since the flat `Split[]` is computed once at save time and stored, the randomness doesn't cause inconsistency.

## UI Layout (Exact mode only)

When "Exact" is selected in the SegmentedControl, the form shows:

### 1. Remaining Indicator

- Displayed at the top of the split section, always visible in Exact mode.
- Shows e.g. "₱45.00 remaining" or "₱10.00 over" (red when negative/over).
- Updates live as any input changes.
- Formula: `remaining = expenseTotal - (sum of individual exact inputs + sharedAmount + sum of sub-group amounts)`

### 2. Per-Person Exact Inputs (existing, unchanged)

- Member checkboxes with individual NumberInputs next to each selected member.

### 3. Shared by All

- Single NumberInput labeled "Shared by all".
- Helper text: "₱X.XX each across N members".
- Divides among currently selected members only.

### 4. Sub-Group Splits

- List of added entries as compact cards showing:
  - Optional label (bold) or "Shared split" as fallback
  - Amount and member names (e.g. "₱300.00 — Jason, Maria (₱150.00 each)")
  - Tap to edit (re-opens modal), delete icon to remove
- "Add shared split" button at the bottom opens modal.
- Mobile-first, not overwhelming.

### 5. Modal: Add Shared Split

- One modal per entry (tap "Add shared split", fill one entry, save, repeat).
- Fields:
  - Optional label TextInput
  - Amount NumberInput
  - Member checkboxes (only shows members selected in the main form)
  - Save / Cancel buttons

## Computation

For each selected member, final split in centavos:

```
individual exact input
+ floor(sharedAmount / allSelectedCount) + (random remainder)
+ for each sub-group they're in:
    floor(subGroupAmount / subGroupMemberCount) + (random remainder)
```

### Validation

- **Live:** remaining indicator (can go negative, purely informational).
- **On submit:** strict check — if remaining != 0, show notification with discrepancy and block submission.
- Sub-group entries with 0 members or 0 amount are ignored/stripped.

## Edit Flow

When editing an expense with `exactSplitMeta`:

1. Split method set to `'exact'`
2. Selected members restored from flat `Split[]` member IDs
3. Individual exact amounts restored from `exactSplitMeta.individualAmounts` (centavos -> PHP)
4. Shared-by-all amount restored from `exactSplitMeta.sharedAmount` (centavos -> PHP)
5. Sub-group entries restored from `exactSplitMeta.subGroups` as-is

When editing an expense **without** `exactSplitMeta` (old expenses):

- Falls back to current behavior — flat split amounts go into individual exact inputs, shared and sub-group sections start empty.
