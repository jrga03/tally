# Exact Split: Shared Amounts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the "Exact" split mode to support a shared-by-all amount and sub-group shared entries (via modal), with a live remaining indicator and metadata storage for edit round-tripping.

**Architecture:** Add `SubGroupEntry` and `ExactSplitMeta` types. Store metadata on `Expense` for edit reconstruction. All new UI lives inside `ExpenseForm.tsx` (conditional on exact mode). Sub-group modal uses Mantine's `Modal`. Flat `Split[]` remains the balance calculation source of truth. Remainder centavos distributed randomly via Fisher-Yates shuffle.

**Tech Stack:** React 19, TypeScript, Mantine 8, nanoid

---

### Task 1: Add types to data model

**Files:**
- Modify: `src/types.ts`

**Step 1: Add SubGroupEntry, ExactSplitMeta interfaces and update Expense**

Add before the `Settlement` interface in `src/types.ts`:

```typescript
export interface SubGroupEntry {
  id: string;
  amount: number;        // centavos
  memberIds: string[];
  label?: string;
}

export interface ExactSplitMeta {
  individualAmounts: Record<string, number>;  // memberId -> centavos
  sharedAmount: number;                        // centavos
  subGroups: SubGroupEntry[];
}
```

Add `exactSplitMeta?: ExactSplitMeta` to the `Expense` interface, after `notes`:

```typescript
export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splits: Split[];
  date: string;
  createdAt: string;
  notes?: string;
  exactSplitMeta?: ExactSplitMeta;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors (new field is optional)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add SubGroupEntry and ExactSplitMeta types to Expense"
```

---

### Task 2: Add remainder distribution utility

**Files:**
- Create: `src/lib/splitEqual.ts`

**Step 1: Create the utility**

Create `src/lib/splitEqual.ts`:

```typescript
/**
 * Splits an amount in centavos equally among memberIds.
 * Remainder centavos are distributed randomly (Fisher-Yates shuffle).
 * Returns a Record<memberId, centavos>.
 */
export function splitEqual(amountCentavos: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) return {}
  const share = Math.floor(amountCentavos / memberIds.length)
  const remainder = amountCentavos - share * memberIds.length

  // Fisher-Yates shuffle to randomize who gets remainder centavos
  const shuffled = [...memberIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const result: Record<string, number> = {}
  for (const id of memberIds) {
    result[id] = share
  }
  for (let i = 0; i < remainder; i++) {
    result[shuffled[i]] += 1
  }
  return result
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/splitEqual.ts
git commit -m "feat: add splitEqual utility with random remainder distribution"
```

---

### Task 3: Add new state and remaining indicator to ExpenseForm

**Files:**
- Modify: `src/components/ExpenseForm.tsx`

**Step 1: Add imports**

Add to existing imports in `ExpenseForm.tsx`:

```typescript
import { Modal } from '@mantine/core'  // add Modal to the existing Mantine import
import { generateId } from '../lib/id'
import type { SubGroupEntry } from '../types'
```

**Step 2: Add new state hooks**

After the existing `notes` state (line 38), add:

```typescript
const [sharedAmount, setSharedAmount] = useState<number | string>(
  initialData?.exactSplitMeta ? initialData.exactSplitMeta.sharedAmount / 100 : ''
)
const [subGroups, setSubGroups] = useState<SubGroupEntry[]>(
  initialData?.exactSplitMeta?.subGroups ?? []
)
const [modalOpen, setModalOpen] = useState(false)
const [editingSubGroup, setEditingSubGroup] = useState<SubGroupEntry | null>(null)
```

**Step 3: Restore individual exact amounts from metadata when editing**

Update the `exactAmounts` initializer (line 29-33) to prefer `exactSplitMeta.individualAmounts` when available:

```typescript
const [exactAmounts, setExactAmounts] = useState<Record<string, number | string>>(
  initialData?.exactSplitMeta
    ? Object.fromEntries(
        Object.entries(initialData.exactSplitMeta.individualAmounts).map(([id, centavos]) => [id, centavos / 100])
      )
    : initialData && initialData.splits.length > 0
      ? Object.fromEntries(initialData.splits.map(s => [s.memberId, s.amount / 100]))
      : {}
)
```

**Step 4: Add remaining amount computation**

Add a computed value after the state hooks, before `toggleMember`:

```typescript
const remainingCentavos = (() => {
  if (splitMethod !== 'exact') return null
  const totalCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
  if (totalCentavos <= 0) return null

  const individualTotal = members
    .filter(m => selectedMembers.has(m.id))
    .reduce((sum, m) => sum + Math.round(Number(exactAmounts[m.id] || 0) * 100), 0)
  const sharedCentavos = Math.round(Number(sharedAmount || 0) * 100)
  const subGroupTotal = subGroups.reduce((sum, sg) => sum + sg.amount, 0)

  return totalCentavos - individualTotal - sharedCentavos - subGroupTotal
})()
```

**Step 5: Add remaining indicator to the JSX**

Insert after the `SegmentedControl` closing tag (line 136) and before the `<Text fw={500} size="sm">Split among</Text>` line:

```tsx
{remainingCentavos !== null && (
  <Text
    size="sm"
    fw={600}
    c={remainingCentavos === 0 ? 'green' : remainingCentavos < 0 ? 'red' : 'yellow'}
    ta="center"
  >
    {remainingCentavos === 0
      ? 'Fully allocated'
      : remainingCentavos > 0
        ? `₱${(remainingCentavos / 100).toFixed(2)} remaining`
        : `₱${(Math.abs(remainingCentavos) / 100).toFixed(2)} over`}
  </Text>
)}
```

**Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "feat: add shared split state and remaining indicator to ExpenseForm"
```

---

### Task 4: Add "Shared by all" UI section

**Files:**
- Modify: `src/components/ExpenseForm.tsx`

**Step 1: Add the shared-by-all section**

Insert after the closing `</Stack>` of the member list (line 169) and before the `<Textarea` for notes:

```tsx
{splitMethod === 'exact' && (
  <Stack gap="xs">
    <NumberInput
      label="Shared by all"
      placeholder="₱0.00"
      value={sharedAmount}
      onChange={v => setSharedAmount(v)}
      min={0}
      decimalScale={2}
    />
    {typeof sharedAmount === 'number' && sharedAmount > 0 && selectedMembers.size > 0 && (
      <Text size="xs" c="dimmed">
        ₱{(sharedAmount / selectedMembers.size).toFixed(2)} each across {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''}
      </Text>
    )}
  </Stack>
)}
```

**Step 2: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npm run dev`
Verify: Switch to Exact mode, see the "Shared by all" input appear. Type a value. Confirm the helper text updates with per-person amount.

**Step 3: Commit**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "feat: add shared-by-all amount input in exact split mode"
```

---

### Task 5: Add sub-group modal

**Files:**
- Modify: `src/components/ExpenseForm.tsx`

**Step 1: Add modal state helpers**

Add these functions after `toggleMember` and before `buildSplits`:

```typescript
const openAddSubGroup = () => {
  setEditingSubGroup(null)
  setModalOpen(true)
}

const openEditSubGroup = (sg: SubGroupEntry) => {
  setEditingSubGroup(sg)
  setModalOpen(true)
}

const deleteSubGroup = (id: string) => {
  setSubGroups(prev => prev.filter(sg => sg.id !== id))
}

const handleSaveSubGroup = (entry: SubGroupEntry) => {
  if (editingSubGroup) {
    setSubGroups(prev => prev.map(sg => sg.id === entry.id ? entry : sg))
  } else {
    setSubGroups(prev => [...prev, entry])
  }
  setModalOpen(false)
  setEditingSubGroup(null)
}
```

**Step 2: Add the SubGroupModal as an inline component**

Add this component definition inside `ExpenseForm`, right before the `return (` statement. This keeps it co-located since it's tightly coupled to form state:

```tsx
const SubGroupModal = () => {
  const [label, setLabel] = useState(editingSubGroup?.label ?? '')
  const [sgAmount, setSgAmount] = useState<number | string>(
    editingSubGroup ? editingSubGroup.amount / 100 : ''
  )
  const [sgMembers, setSgMembers] = useState<Set<string>>(
    new Set(editingSubGroup?.memberIds ?? [])
  )

  const toggleSgMember = (memberId: string) => {
    setSgMembers(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const handleSave = () => {
    const amountCentavos = typeof sgAmount === 'number' ? Math.round(sgAmount * 100) : 0
    if (amountCentavos <= 0 || sgMembers.size === 0) return
    handleSaveSubGroup({
      id: editingSubGroup?.id ?? generateId(),
      amount: amountCentavos,
      memberIds: Array.from(sgMembers),
      label: label.trim() || undefined,
    })
  }

  return (
    <Modal
      opened={modalOpen}
      onClose={() => { setModalOpen(false); setEditingSubGroup(null) }}
      title={editingSubGroup ? 'Edit shared split' : 'Add shared split'}
      size="sm"
    >
      <Stack>
        <TextInput
          label="Label (optional)"
          placeholder="e.g. Appetizer"
          value={label}
          onChange={e => setLabel(e.currentTarget.value)}
        />
        <NumberInput
          label="Amount (₱)"
          placeholder="₱0.00"
          value={sgAmount}
          onChange={v => setSgAmount(v)}
          min={0}
          decimalScale={2}
        />
        <Text fw={500} size="sm">Split among</Text>
        <Stack gap="xs">
          {members.filter(m => selectedMembers.has(m.id)).map(m => (
            <Checkbox
              key={m.id}
              label={m.name}
              checked={sgMembers.has(m.id)}
              onChange={() => toggleSgMember(m.id)}
            />
          ))}
        </Stack>
        {typeof sgAmount === 'number' && sgAmount > 0 && sgMembers.size > 0 && (
          <Text size="xs" c="dimmed">
            ₱{(sgAmount / sgMembers.size).toFixed(2)} each across {sgMembers.size} member{sgMembers.size !== 1 ? 's' : ''}
          </Text>
        )}
        <Button onClick={handleSave}>
          {editingSubGroup ? 'Save' : 'Add'}
        </Button>
      </Stack>
    </Modal>
  )
}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "feat: add sub-group shared split modal component"
```

---

### Task 6: Add sub-group entries list UI and wire modal

**Files:**
- Modify: `src/components/ExpenseForm.tsx`

**Step 1: Add icon imports**

Add to imports at top of file:

```typescript
import { IconTrash, IconEdit } from '@tabler/icons-react'
import { ActionIcon, Card } from '@mantine/core'  // add ActionIcon and Card to existing Mantine import
```

**Step 2: Add sub-group list and button to JSX**

Insert after the "Shared by all" section (the `{splitMethod === 'exact' && (...)}` block from Task 4) and before the `<Textarea` for notes:

```tsx
{splitMethod === 'exact' && subGroups.length > 0 && (
  <Stack gap="xs">
    <Text fw={500} size="sm">Shared splits</Text>
    {subGroups.map(sg => {
      const memberNames = sg.memberIds
        .map(id => members.find(m => m.id === id)?.name ?? 'Unknown')
        .join(', ')
      const perPerson = sg.memberIds.length > 0 ? sg.amount / sg.memberIds.length / 100 : 0
      return (
        <Card key={sg.id} withBorder p="xs">
          <Group justify="space-between" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                {sg.label || 'Shared split'}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                ₱{(sg.amount / 100).toFixed(2)} — {memberNames} (₱{perPerson.toFixed(2)} each)
              </Text>
            </div>
            <Group gap={4} wrap="nowrap">
              <ActionIcon variant="subtle" size="sm" onClick={() => openEditSubGroup(sg)}>
                <IconEdit size={14} />
              </ActionIcon>
              <ActionIcon variant="subtle" size="sm" color="red" onClick={() => deleteSubGroup(sg.id)}>
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          </Group>
        </Card>
      )
    })}
  </Stack>
)}

{splitMethod === 'exact' && (
  <Button variant="light" size="xs" onClick={openAddSubGroup}>
    Add shared split
  </Button>
)}
```

**Step 3: Add the modal render**

Insert `<SubGroupModal />` right before the closing `</Stack>` of the form return (before the submit button or after it — either works, modals are portaled). Place it just before `<Button onClick={handleSubmit}>`:

```tsx
<SubGroupModal />
<Button onClick={handleSubmit}>{submitLabel}</Button>
```

**Step 4: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npm run dev`
Verify: In Exact mode, click "Add shared split". Modal opens. Fill in label, amount, select members. Click Add. Entry appears in list. Click edit icon — modal pre-fills. Click delete icon — entry removed. Remaining indicator updates with sub-group amounts.

**Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "feat: add sub-group entries list and wire modal in exact mode"
```

---

### Task 7: Update buildSplits and handleSubmit

**Files:**
- Modify: `src/components/ExpenseForm.tsx`

**Step 1: Add splitEqual import**

```typescript
import { splitEqual } from '../lib/splitEqual'
```

**Step 2: Replace the exact branch in buildSplits**

Replace the existing `if (splitMethod === 'exact') { ... }` block (lines 63-71) with:

```typescript
if (splitMethod === 'exact') {
  const selectedIds = selected.map(m => m.id)

  // Start with individual exact amounts
  const totals: Record<string, number> = {}
  for (const m of selected) {
    totals[m.id] = Math.round(Number(exactAmounts[m.id] || 0) * 100)
  }

  // Add shared-by-all amount
  const sharedCentavos = Math.round(Number(sharedAmount || 0) * 100)
  if (sharedCentavos > 0) {
    const sharedSplits = splitEqual(sharedCentavos, selectedIds)
    for (const id of selectedIds) {
      totals[id] += sharedSplits[id]
    }
  }

  // Add sub-group amounts
  for (const sg of subGroups) {
    if (sg.amount > 0 && sg.memberIds.length > 0) {
      const sgSplits = splitEqual(sg.amount, sg.memberIds)
      for (const id of sg.memberIds) {
        if (totals[id] !== undefined) {
          totals[id] += sgSplits[id]
        }
      }
    }
  }

  const splits = selected.map(m => ({ memberId: m.id, amount: totals[m.id] }))
  const total = splits.reduce((sum, s) => sum + s.amount, 0)
  if (total !== amountCentavos) return null
  return splits
}
```

**Step 3: Update handleSubmit to include exactSplitMeta**

Update the `onSubmit` call in `handleSubmit` (around line 106-113) to include metadata when using exact mode with shared amounts:

```typescript
const exactSplitMeta = splitMethod === 'exact' && (
  (typeof sharedAmount === 'number' && sharedAmount > 0) || subGroups.length > 0
)
  ? {
      individualAmounts: Object.fromEntries(
        members
          .filter(m => selectedMembers.has(m.id))
          .map(m => [m.id, Math.round(Number(exactAmounts[m.id] || 0) * 100)])
      ),
      sharedAmount: Math.round(Number(sharedAmount || 0) * 100),
      subGroups: subGroups.filter(sg => sg.amount > 0 && sg.memberIds.length > 0),
    }
  : undefined

onSubmit({
  description: description.trim(),
  amount: Math.round((typeof amount === 'number' ? amount : 0) * 100),
  paidBy,
  splits,
  date: new Date(date).toISOString(),
  notes: notes.trim() || undefined,
  exactSplitMeta,
})
```

**Step 4: Update the error notification in handleSubmit**

The existing error notification (lines 89-101) computes the total from only individual amounts. Update it to include shared and sub-group amounts:

```typescript
if (splitMethod === 'exact') {
  const amountCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
  const selected = members.filter(m => selectedMembers.has(m.id))
  const individualTotal = selected.reduce((sum, m) => sum + Math.round(Number(exactAmounts[m.id] || 0) * 100), 0)
  const sharedCentavos = Math.round(Number(sharedAmount || 0) * 100)
  const subGroupTotal = subGroups.reduce((sum, sg) => sum + sg.amount, 0)
  const total = individualTotal + sharedCentavos + subGroupTotal
  if (amountCentavos > 0 && total !== amountCentavos) {
    const diff = (total - amountCentavos) / 100
    notifications.show({
      color: 'red',
      title: 'Split amounts don\u2019t match',
      message: `The split total is \u20b1${(total / 100).toFixed(2)} but the expense is \u20b1${(amountCentavos / 100).toFixed(2)} (${diff > 0 ? '+' : ''}\u20b1${diff.toFixed(2)})`,
    })
  }
}
```

**Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Manual smoke test**

Run: `npm run dev`
Verify:
1. Create expense in Exact mode with only individual amounts — works as before
2. Create expense with individual amounts + shared-by-all — remaining indicator tracks correctly, submits when balanced
3. Create expense with individual + shared + sub-groups — all three layers sum correctly
4. Try to submit when not balanced — error notification shows correct discrepancy
5. Check the expense in the expense list — split amounts shown correctly

**Step 7: Commit**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "feat: update buildSplits and handleSubmit for shared amounts with metadata"
```

---

### Task 8: Verify edit flow round-trips correctly

**Files:**
- No new changes needed (Task 3 Step 3 already handles restoring from metadata)

**Step 1: Manual verification**

Run: `npm run dev`

Test these scenarios:
1. Create expense with shared-by-all + sub-groups in Exact mode
2. Open it in Edit → confirm individual amounts, shared amount, and sub-group entries are all restored
3. Modify a sub-group entry, save → confirm changes persist
4. Edit an old expense (no `exactSplitMeta`) → confirm it falls back to flat amounts in individual inputs, shared and sub-group sections empty
5. Switch from Exact to Equal and back → confirm shared/sub-group state is preserved

**Step 2: Commit (only if any fixes were needed)**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "fix: address edit flow issues for shared split metadata"
```

---

### Task 9: Update ExpenseListPage split breakdown display

**Files:**
- Modify: `src/pages/ExpenseListPage.tsx`

**Step 1: Add shared split detail to expanded expense cards**

In the `Collapse` section where splits are displayed (lines 88-106), add detail about shared amounts after the per-person split breakdown, when `exactSplitMeta` is present:

```tsx
<Collapse in={isExpanded}>
  <Divider my="sm" />
  <Stack gap="xs">
    <Text size="sm" fw={500}>Split breakdown</Text>
    {e.splits.map(s => (
      <Group key={s.memberId} justify="space-between">
        <Text size="sm">{getMemberName(s.memberId)}</Text>
        <Text size="sm" c="dimmed">{formatPHP(s.amount)}</Text>
      </Group>
    ))}
    {e.exactSplitMeta && (
      <>
        <Divider my="xs" />
        <Text size="sm" fw={500}>How it was split</Text>
        {e.exactSplitMeta.sharedAmount > 0 && (
          <Text size="xs" c="dimmed">
            Shared by all: {formatPHP(e.exactSplitMeta.sharedAmount)}
          </Text>
        )}
        {e.exactSplitMeta.subGroups.map(sg => (
          <Text key={sg.id} size="xs" c="dimmed">
            {sg.label || 'Shared split'}: {formatPHP(sg.amount)} — {sg.memberIds.map(id => getMemberName(id)).join(', ')}
          </Text>
        ))}
      </>
    )}
    {e.notes && (
      <>
        <Divider my="xs" />
        <Text size="sm" fw={500}>Notes</Text>
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</Text>
      </>
    )}
  </Stack>
</Collapse>
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Manual smoke test**

Verify: Expand an expense created with shared amounts. Confirm "How it was split" section appears showing shared-by-all and sub-group details. Expand an old expense without metadata — confirm no extra section appears.

**Step 4: Commit**

```bash
git add src/pages/ExpenseListPage.tsx
git commit -m "feat: show shared split details in expense card breakdown"
```

---

### Task 10: Update related documentation

**Files:**
- Modify: `docs/plans/2026-03-28-expense-view-edit-notes-design.md`
- Modify: `docs/plans/2026-03-29-exact-split-shared-amounts-design.md`

**Step 1: Add note to expense-view-edit-notes design**

Append to the end of `docs/plans/2026-03-28-expense-view-edit-notes-design.md`:

```markdown

## Subsequent Changes

- **2026-03-29:** The Exact split mode was extended with shared-by-all amounts and sub-group shared entries. See `2026-03-29-exact-split-shared-amounts-design.md` for details. The ExpenseForm now includes additional state for shared splits, a sub-group modal, and a remaining indicator. The `Expense` type has an optional `exactSplitMeta` field. The ExpenseListPage shows shared split details in the expanded breakdown.
```

**Step 2: Mark the shared amounts design as implemented**

Add to the top of `docs/plans/2026-03-29-exact-split-shared-amounts-design.md`, right after the `# Exact Split: Shared Amounts Feature` heading:

```markdown

> **Status:** Implemented (2026-03-29)
```

**Step 3: Commit**

```bash
git add docs/plans/
git commit -m "docs: update related docs for shared amounts feature"
```
