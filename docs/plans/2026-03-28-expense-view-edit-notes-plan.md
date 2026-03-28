# Expense View, Edit & Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline expense viewing (expand card to see splits + notes), full-page expense editing, and a notes field to expenses.

**Architecture:** Extract the existing AddExpensePage form into a shared ExpenseForm component. Add an expandable detail section to expense cards in ExpenseListPage. Create a new EditExpensePage as a thin wrapper around ExpenseForm. Add a `notes` optional field to the Expense type.

**Tech Stack:** React 19, TypeScript, Mantine 8, React Router v7, dayjs

---

### Task 1: Add `notes` field to Expense type

**Files:**
- Modify: `src/types.ts:15-23`

**Step 1: Add notes to Expense interface**

In `src/types.ts`, add `notes?: string` to the Expense interface:

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
}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors (field is optional, so existing code is unaffected)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add optional notes field to Expense type"
```

---

### Task 2: Extract ExpenseForm component

**Files:**
- Create: `src/components/ExpenseForm.tsx`
- Modify: `src/pages/AddExpensePage.tsx`

**Step 1: Create ExpenseForm component**

Create `src/components/ExpenseForm.tsx` with the form logic extracted from AddExpensePage. The component accepts props for initial data and submit handling:

```tsx
import { Text, TextInput, NumberInput, Select, SegmentedControl, Checkbox, Button, Stack, Group, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { DatePickerInput } from '@mantine/dates'
import dayjs from 'dayjs'
import { useState } from 'react'
import type { Expense, Split, Member } from '../types'

type SplitMethod = 'equal' | 'exact' | 'percentage'

interface ExpenseFormProps {
  members: Member[]
  initialData?: Expense
  onSubmit: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  submitLabel: string
}

export function ExpenseForm({ members, initialData, onSubmit, submitLabel }: ExpenseFormProps) {
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [amount, setAmount] = useState<number | string>(
    initialData ? initialData.amount / 100 : ''
  )
  const [paidBy, setPaidBy] = useState<string | null>(initialData?.paidBy ?? null)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    initialData
      ? new Set(initialData.splits.map(s => s.memberId))
      : new Set(members.map(m => m.id))
  )
  const [exactAmounts, setExactAmounts] = useState<Record<string, number | string>>(
    initialData && initialData.splits.length > 0
      ? Object.fromEntries(initialData.splits.map(s => [s.memberId, s.amount / 100]))
      : {}
  )
  const [percentages, setPercentages] = useState<Record<string, number | string>>({})
  const [date, setDate] = useState<string | null>(
    initialData ? dayjs(initialData.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  )
  const [notes, setNotes] = useState(initialData?.notes ?? '')

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const buildSplits = (): Split[] | null => {
    const amountCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
    const selected = members.filter(m => selectedMembers.has(m.id))
    if (selected.length === 0 || amountCentavos <= 0) return null

    if (splitMethod === 'equal') {
      const share = Math.floor(amountCentavos / selected.length)
      const remainder = amountCentavos - share * selected.length
      return selected.map((m, i) => ({
        memberId: m.id,
        amount: share + (i < remainder ? 1 : 0),
      }))
    }

    if (splitMethod === 'exact') {
      const splits = selected.map(m => ({
        memberId: m.id,
        amount: Math.round(Number(exactAmounts[m.id] || 0) * 100),
      }))
      const total = splits.reduce((sum, s) => sum + s.amount, 0)
      if (total !== amountCentavos) return null
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = selected.map(m => {
        const pct = Number(percentages[m.id] || 0)
        return { memberId: m.id, amount: Math.round((pct / 100) * amountCentavos) }
      })
      const totalPct = selected.reduce((sum, m) => sum + Number(percentages[m.id] || 0), 0)
      if (Math.abs(totalPct - 100) > 0.01) return null
      return splits
    }

    return null
  }

  const handleSubmit = () => {
    const splits = buildSplits()
    if (!splits) {
      if (splitMethod === 'exact') {
        const amountCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
        const selected = members.filter(m => selectedMembers.has(m.id))
        const total = selected.reduce((sum, m) => sum + Math.round(Number(exactAmounts[m.id] || 0) * 100), 0)
        if (amountCentavos > 0 && total !== amountCentavos) {
          const diff = (total - amountCentavos) / 100
          notifications.show({
            color: 'red',
            title: 'Split amounts don\u2019t match',
            message: `The split total is \u20b1${(total / 100).toFixed(2)} but the expense is \u20b1${(amountCentavos / 100).toFixed(2)} (${diff > 0 ? '+' : ''}\u20b1${diff.toFixed(2)})`,
          })
        }
      }
      return
    }
    if (!paidBy || !description.trim() || !date) return

    onSubmit({
      description: description.trim(),
      amount: Math.round((typeof amount === 'number' ? amount : 0) * 100),
      paidBy,
      splits,
      date: new Date(date).toISOString(),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Stack>
      <TextInput label="Description" value={description} onChange={e => setDescription(e.currentTarget.value)} />
      <NumberInput label="Amount (₱)" value={amount} onChange={v => setAmount(v)} min={0} decimalScale={2} />
      <Select
        label="Paid by"
        data={members.map(m => ({ value: m.id, label: m.name }))}
        value={paidBy}
        onChange={setPaidBy}
      />
      <DatePickerInput label="Date" value={date} onChange={setDate} />

      <SegmentedControl
        value={splitMethod}
        onChange={v => setSplitMethod(v as SplitMethod)}
        data={[
          { label: 'Equal', value: 'equal' },
          { label: 'Exact', value: 'exact' },
          { label: '%', value: 'percentage' },
        ]}
      />

      <Text fw={500} size="sm">Split among</Text>
      <Stack gap="xs">
        {members.map(m => (
          <Group key={m.id} justify="space-between">
            <Checkbox
              label={m.name}
              checked={selectedMembers.has(m.id)}
              onChange={() => toggleMember(m.id)}
            />
            {splitMethod === 'exact' && selectedMembers.has(m.id) && (
              <NumberInput
                size="xs"
                w={100}
                placeholder="₱0.00"
                value={exactAmounts[m.id] ?? ''}
                onChange={v => setExactAmounts(prev => ({ ...prev, [m.id]: v }))}
                decimalScale={2}
              />
            )}
            {splitMethod === 'percentage' && selectedMembers.has(m.id) && (
              <NumberInput
                size="xs"
                w={80}
                placeholder="%"
                value={percentages[m.id] ?? ''}
                onChange={v => setPercentages(prev => ({ ...prev, [m.id]: v }))}
                suffix="%"
              />
            )}
          </Group>
        ))}
      </Stack>

      <Textarea
        label="Notes"
        placeholder="Add notes (optional)"
        value={notes}
        onChange={e => setNotes(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={6}
      />

      <Button onClick={handleSubmit}>{submitLabel}</Button>
    </Stack>
  )
}
```

**Step 2: Refactor AddExpensePage to use ExpenseForm**

Replace `src/pages/AddExpensePage.tsx` with:

```tsx
import { Container, Title } from '@mantine/core'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { generateId } from '../lib/id'
import { ExpenseForm } from '../components/ExpenseForm'
import type { Expense } from '../types'

export function AddExpensePage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined

  if (!group) return <Container py="md">Group not found.</Container>

  const handleSubmit = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        groupId: group.id,
        expense: {
          ...data,
          id: generateId(),
          createdAt: new Date().toISOString(),
        },
      },
    })
    navigate(`/group/${id}`)
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Add Expense</Title>
      <ExpenseForm
        members={group.members}
        onSubmit={handleSubmit}
        submitLabel="Add Expense"
      />
    </Container>
  )
}
```

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Manual smoke test**

Run: `npm run dev`
Verify: Navigate to add expense page, create an expense with notes. Confirm it works identically to before (plus the new notes field).

**Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx src/pages/AddExpensePage.tsx
git commit -m "refactor: extract ExpenseForm component from AddExpensePage"
```

---

### Task 3: Add inline expand to expense cards

**Files:**
- Modify: `src/pages/ExpenseListPage.tsx`

**Step 1: Add expandable detail section to expense cards**

Update `src/pages/ExpenseListPage.tsx` to track expanded cards and show split breakdown + notes:

```tsx
import { Container, Title, Text, Card, Stack, Group, Badge, ActionIcon, Menu, Collapse, Divider } from '@mantine/core'
import { IconDots, IconTrash, IconChevronDown, IconChevronUp, IconEdit } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { formatPHP } from '../lib/format'

export function ExpenseListPage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>

  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

  const toggleExpand = (expenseId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(expenseId)) next.delete(expenseId)
      else next.add(expenseId)
      return next
    })
  }

  // Combine expenses and settlements, sort by date descending
  const items = [
    ...group.expenses.map(e => ({ kind: 'expense' as const, data: e, date: e.date })),
    ...group.settlements.map(s => ({ kind: 'settlement' as const, data: s, date: s.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Expenses</Title>
      {items.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No expenses yet.</Text>
      ) : (
        <Stack>
          {items.map(item => {
            if (item.kind === 'expense') {
              const e = item.data
              const isExpanded = expandedIds.has(e.id)
              return (
                <Card key={e.id} withBorder p="sm" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(e.id)}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{e.description}</Text>
                      <Text size="sm" c="dimmed">
                        Paid by {getMemberName(e.paidBy)} · {new Date(e.date).toLocaleDateString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge>{formatPHP(e.amount)}</Badge>
                      {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle" onClick={ev => ev.stopPropagation()}>
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={(ev: React.MouseEvent) => {
                              ev.stopPropagation()
                              navigate(`/group/${id}/expense/${e.id}/edit`)
                            }}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={(ev: React.MouseEvent) => {
                              ev.stopPropagation()
                              dispatch({ type: 'DELETE_EXPENSE', payload: { groupId: group.id, expenseId: e.id } })
                            }}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
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
                      {e.notes && (
                        <>
                          <Divider my="xs" />
                          <Text size="sm" fw={500}>Notes</Text>
                          <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</Text>
                        </>
                      )}
                    </Stack>
                  </Collapse>
                </Card>
              )
            } else {
              const s = item.data
              return (
                <Card key={s.id} withBorder p="sm" bg="green.0">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>Settlement</Text>
                      <Text size="sm" c="dimmed">
                        {getMemberName(s.fromMemberId)} paid {getMemberName(s.toMemberId)} · {new Date(s.date).toLocaleDateString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge color="green">{formatPHP(s.amount)}</Badge>
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle"><IconDots size={16} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => dispatch({ type: 'DELETE_SETTLEMENT', payload: { groupId: group.id, settlementId: s.id } })}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </Card>
              )
            }
          })}
        </Stack>
      )}
    </Container>
  )
}
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Manual smoke test**

Verify: Tap an expense card to expand/collapse. Check split breakdown displays. Check notes display (if any). Verify multiple cards can be open. Verify the 3-dot menu still works (stopPropagation prevents card toggle). Verify Edit option in menu.

**Step 4: Commit**

```bash
git add src/pages/ExpenseListPage.tsx
git commit -m "feat: add inline expand to expense cards with split breakdown and notes"
```

---

### Task 4: Create EditExpensePage and add route

**Files:**
- Create: `src/pages/EditExpensePage.tsx`
- Modify: `src/App.tsx:1-26`

**Step 1: Create EditExpensePage**

Create `src/pages/EditExpensePage.tsx`:

```tsx
import { Container, Title } from '@mantine/core'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { ExpenseForm } from '../components/ExpenseForm'
import type { Expense } from '../types'

export function EditExpensePage() {
  const { id, expenseId } = useParams<{ id: string; expenseId: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined
  const expense = group?.expenses.find(e => e.id === expenseId)

  if (!group) return <Container py="md">Group not found.</Container>
  if (!expense) return <Container py="md">Expense not found.</Container>

  const handleSubmit = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    dispatch({
      type: 'EDIT_EXPENSE',
      payload: {
        groupId: group.id,
        expense: {
          ...data,
          id: expense.id,
          createdAt: expense.createdAt,
        },
      },
    })
    navigate(`/group/${id}/expenses`)
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Edit Expense</Title>
      <ExpenseForm
        members={group.members}
        initialData={expense}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </Container>
  )
}
```

**Step 2: Add route in App.tsx**

Add the import and route to `src/App.tsx`:

```tsx
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { GroupLayout } from './components/GroupLayout'
import { HomePage } from './pages/HomePage'
import { GroupDashboardPage } from './pages/GroupDashboardPage'
import { AddExpensePage } from './pages/AddExpensePage'
import { EditExpensePage } from './pages/EditExpensePage'
import { ExpenseListPage } from './pages/ExpenseListPage'
import { SettleUpPage } from './pages/SettleUpPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/group/:id" element={<GroupLayout />}>
          <Route index element={<GroupDashboardPage />} />
          <Route path="expenses" element={<ExpenseListPage />} />
          <Route path="add-expense" element={<AddExpensePage />} />
          <Route path="expense/:expenseId/edit" element={<EditExpensePage />} />
          <Route path="settle" element={<SettleUpPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
```

**Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Manual smoke test**

Verify: From expense list, expand a card, click 3-dot menu > Edit. Confirm it navigates to edit page with pre-filled data. Edit fields and save. Confirm it navigates back to expense list. Confirm the expense is updated. Confirm balances recompute correctly.

**Step 5: Commit**

```bash
git add src/pages/EditExpensePage.tsx src/App.tsx
git commit -m "feat: add edit expense page with routing"
```
