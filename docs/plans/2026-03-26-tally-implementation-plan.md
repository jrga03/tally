# Tally Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static, mobile-first Splitwise clone (PWA) that lets users split expenses in groups, with localStorage persistence and compressed URL sharing.

**Architecture:** React 19 + TypeScript SPA using React Context + useReducer for state, Mantine for UI, react-router-dom for routing. Data stored in localStorage, shared via pako-compressed URL hashes. Undo/redo via history stack wrapper around the reducer.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Mantine 8, react-router-dom 7, pako 2, nanoid 5, vite-plugin-pwa

---

### Task 1: Project Setup — Install Dependencies & Configure

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `index.html`
- Delete: `src/App.css`

**Step 1: Install dependencies**

Run:
```bash
npm install react-router-dom@7 @mantine/core@8 @mantine/hooks@8 pako nanoid
npm install -D @types/pako vite-plugin-pwa
```

**Step 2: Install Mantine PostCSS preset**

Run:
```bash
npm install -D postcss postcss-preset-mantine postcss-simple-vars
```

**Step 3: Create PostCSS config**

Create `postcss.config.cjs`:
```js
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};
```

**Step 4: Update `index.html`**

Change the title to "Tally" and add the Mantine color scheme meta tag:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#228be6" />
    <title>Tally</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Update `src/main.tsx` with Mantine and Router providers**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
```

**Step 6: Replace `src/App.tsx` with a placeholder**

```tsx
import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Tally Home</div>} />
    </Routes>
  )
}

export default App
```

**Step 7: Delete `src/App.css` and clean up `src/index.css`**

Delete `src/App.css`. Replace `src/index.css` with an empty file or minimal reset (Mantine handles global styles).

**Step 8: Verify the app runs**

Run: `npm run dev`
Expected: App loads at localhost with "Tally Home" text, no errors in console.

**Step 9: Commit**

```bash
git add .
git commit -m "feat: configure project with Mantine, React Router, and dependencies"
```

---

### Task 2: Data Types & localStorage Utilities

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/storage.ts`
- Create: `src/lib/id.ts`

**Step 1: Create `src/types.ts`**

```typescript
export interface Group {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splits: Split[];
  date: string;
  createdAt: string;
}

export interface Split {
  memberId: string;
  amount: number;
}

export interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  createdAt: string;
}
```

**Step 2: Create `src/lib/id.ts`**

```typescript
import { nanoid } from 'nanoid'

export function generateId(): string {
  return nanoid(8)
}
```

**Step 3: Create `src/lib/storage.ts`**

```typescript
import type { Group } from '../types'

const STORAGE_KEY = 'tally_groups'

export function loadGroups(): Record<string, Group> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveGroups(groups: Record<string, Group>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
}
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

**Step 5: Commit**

```bash
git add src/types.ts src/lib/storage.ts src/lib/id.ts
git commit -m "feat: add data types, ID generation, and localStorage utilities"
```

---

### Task 3: State Management — Reducer with Undo/Redo

**Files:**
- Create: `src/state/actions.ts`
- Create: `src/state/reducer.ts`
- Create: `src/state/history.ts`
- Create: `src/state/context.tsx`

**Step 1: Create `src/state/actions.ts`**

```typescript
import type { Group, Member, Expense, Settlement } from '../types'

export type Action =
  | { type: 'CREATE_GROUP'; payload: Group }
  | { type: 'DELETE_GROUP'; payload: { groupId: string } }
  | { type: 'ADD_MEMBER'; payload: { groupId: string; member: Member } }
  | { type: 'REMOVE_MEMBER'; payload: { groupId: string; memberId: string } }
  | { type: 'ADD_EXPENSE'; payload: { groupId: string; expense: Expense } }
  | { type: 'EDIT_EXPENSE'; payload: { groupId: string; expense: Expense } }
  | { type: 'DELETE_EXPENSE'; payload: { groupId: string; expenseId: string } }
  | { type: 'ADD_SETTLEMENT'; payload: { groupId: string; settlement: Settlement } }
  | { type: 'DELETE_SETTLEMENT'; payload: { groupId: string; settlementId: string } }
  | { type: 'IMPORT_GROUP'; payload: Group }
```

**Step 2: Create `src/state/reducer.ts`**

```typescript
import type { Group } from '../types'
import type { Action } from './actions'

export type AppState = Record<string, Group>

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_GROUP':
    case 'IMPORT_GROUP':
      return { ...state, [action.payload.id]: action.payload }

    case 'DELETE_GROUP': {
      const { [action.payload.groupId]: _, ...rest } = state
      return rest
    }

    case 'ADD_MEMBER': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          members: [...group.members, action.payload.member],
        },
      }
    }

    case 'REMOVE_MEMBER': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          members: group.members.filter(m => m.id !== action.payload.memberId),
        },
      }
    }

    case 'ADD_EXPENSE': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          expenses: [...group.expenses, action.payload.expense],
        },
      }
    }

    case 'EDIT_EXPENSE': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          expenses: group.expenses.map(e =>
            e.id === action.payload.expense.id ? action.payload.expense : e
          ),
        },
      }
    }

    case 'DELETE_EXPENSE': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          expenses: group.expenses.filter(e => e.id !== action.payload.expenseId),
        },
      }
    }

    case 'ADD_SETTLEMENT': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          settlements: [...group.settlements, action.payload.settlement],
        },
      }
    }

    case 'DELETE_SETTLEMENT': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          settlements: group.settlements.filter(s => s.id !== action.payload.settlementId),
        },
      }
    }

    default:
      return state
  }
}
```

**Step 3: Create `src/state/history.ts`**

```typescript
import type { AppState } from './reducer'

const MAX_HISTORY = 50

export interface HistoryState {
  past: AppState[]
  present: AppState
  future: AppState[]
}

export function createHistory(initial: AppState): HistoryState {
  return { past: [], present: initial, future: [] }
}

export function pushState(history: HistoryState, next: AppState): HistoryState {
  if (next === history.present) return history
  return {
    past: [...history.past.slice(-MAX_HISTORY + 1), history.present],
    present: next,
    future: [],
  }
}

export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history
  const next = history.future[0]
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  }
}
```

**Step 4: Create `src/state/context.tsx`**

```tsx
import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { appReducer, type AppState } from './reducer'
import type { Action } from './actions'
import { createHistory, pushState, undo as undoHistory, redo as redoHistory, type HistoryState } from './history'
import { loadGroups, saveGroups } from '../lib/storage'

interface AppContextValue {
  state: AppState
  dispatch: (action: Action) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const initialState = loadGroups()
  const historyRef = useRef<HistoryState>(createHistory(initialState))
  const [state, baseDispatch] = useReducer(appReducer, initialState)

  // Keep history in sync
  const dispatch = useCallback((action: Action) => {
    baseDispatch(action)
  }, [])

  // After each reducer run, push to history
  useEffect(() => {
    historyRef.current = pushState(historyRef.current, state)
    saveGroups(state)
  }, [state])

  const [, forceRender] = useReducer(x => x + 1, 0)

  const handleUndo = useCallback(() => {
    const next = undoHistory(historyRef.current)
    if (next !== historyRef.current) {
      historyRef.current = next
      // We need to replace reducer state — dispatch a synthetic IMPORT for each group
      // Simpler: use a state setter pattern
      baseDispatch({ type: 'IMPORT_GROUP' as Action['type'], payload: null as never })
    }
  }, [])

  // Actually, a cleaner approach: use useState instead of useReducer at the top level
  // and wrap the reducer manually. Let me simplify.

  return null // placeholder — will be implemented properly below
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
```

**IMPORTANT: The context implementation above is a rough sketch.** The actual implementation should use `useState` for the history state directly, applying the reducer manually:

```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { appReducer, type AppState } from './reducer'
import type { Action } from './actions'
import { createHistory, pushState, undo as undoHistory, redo as redoHistory, type HistoryState } from './history'
import { loadGroups, saveGroups } from '../lib/storage'

interface AppContextValue {
  state: AppState
  dispatch: (action: Action) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(loadGroups()))

  const dispatch = useCallback((action: Action) => {
    setHistory(prev => {
      const nextState = appReducer(prev.present, action)
      const nextHistory = pushState(prev, nextState)
      saveGroups(nextHistory.present)
      return nextHistory
    })
  }, [])

  const undo = useCallback(() => {
    setHistory(prev => {
      const next = undoHistory(prev)
      saveGroups(next.present)
      return next
    })
  }, [])

  const redo = useCallback(() => {
    setHistory(prev => {
      const next = redoHistory(prev)
      saveGroups(next.present)
      return next
    })
  }, [])

  return (
    <AppContext.Provider value={{
      state: history.present,
      dispatch,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
```

**Step 5: Wire up AppProvider in `src/main.tsx`**

Wrap `<BrowserRouter>` with `<AppProvider>`.

**Step 6: Verify build**

Run: `npm run build`
Expected: No type errors.

**Step 7: Commit**

```bash
git add src/state/
git commit -m "feat: add state reducer with undo/redo history and context provider"
```

---

### Task 4: Balance Calculation & Debt Simplification

**Files:**
- Create: `src/lib/balance.ts`

**Step 1: Create `src/lib/balance.ts`**

```typescript
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

export function simplifyDebts(group: Group): DebtSettlement[] {
  const balances = calculateBalances(group)
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/balance.ts
git commit -m "feat: add balance calculation and greedy debt simplification"
```

---

### Task 5: URL Sharing — Compress/Decompress Utilities

**Files:**
- Create: `src/lib/sharing.ts`

**Step 1: Create `src/lib/sharing.ts`**

```typescript
import pako from 'pako'
import type { Group } from '../types'

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function compressGroup(group: Group): string {
  const json = JSON.stringify(group)
  const compressed = pako.deflate(json)
  return toBase64Url(compressed)
}

export function decompressGroup(encoded: string): Group {
  const bytes = fromBase64Url(encoded)
  const json = pako.inflate(bytes, { to: 'string' })
  return JSON.parse(json)
}

export function buildShareUrl(group: Group): string {
  const compressed = compressGroup(group)
  return `${window.location.origin}/group/${group.id}#${compressed}`
}

export async function copyShareUrl(group: Group): Promise<void> {
  const url = buildShareUrl(group)
  if (navigator.share) {
    await navigator.share({ title: `Tally — ${group.name}`, url })
  } else {
    await navigator.clipboard.writeText(url)
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/sharing.ts
git commit -m "feat: add pako compression and URL sharing utilities"
```

---

### Task 6: Shared Layout & Navigation Shell

**Files:**
- Create: `src/components/AppShell.tsx`
- Create: `src/components/GroupLayout.tsx`

**Step 1: Create `src/components/AppShell.tsx`**

Top-level layout with the app header. Includes undo/redo buttons when inside a group.

```tsx
import { AppShell as MantineAppShell, Group, Title, ActionIcon } from '@mantine/core'
import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react'
import { Outlet, useParams } from 'react-router-dom'
import { useApp } from '../state/context'

export function AppShell() {
  const { undo, redo, canUndo, canRedo } = useApp()
  const { id } = useParams()

  return (
    <MantineAppShell header={{ height: 56 }}>
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Tally</Title>
          {id && (
            <Group gap="xs">
              <ActionIcon variant="subtle" disabled={!canUndo} onClick={undo}>
                <IconArrowBackUp size={20} />
              </ActionIcon>
              <ActionIcon variant="subtle" disabled={!canRedo} onClick={redo}>
                <IconArrowForwardUp size={20} />
              </ActionIcon>
            </Group>
          )}
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  )
}
```

**NOTE:** This requires `@tabler/icons-react`. Install it:

```bash
npm install @tabler/icons-react
```

**Step 2: Create `src/components/GroupLayout.tsx`**

Layout for group views with bottom tab navigation.

```tsx
import { Tabs } from '@mantine/core'
import { IconDashboard, IconReceipt, IconPlus } from '@tabler/icons-react'
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom'

export function GroupLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const getTab = () => {
    if (location.pathname.endsWith('/add-expense')) return 'add'
    if (location.pathname.endsWith('/expenses')) return 'expenses'
    return 'dashboard'
  }

  return (
    <>
      <Outlet />
      <Tabs
        value={getTab()}
        onChange={value => {
          if (value === 'dashboard') navigate(`/group/${id}`)
          else if (value === 'expenses') navigate(`/group/${id}/expenses`)
          else if (value === 'add') navigate(`/group/${id}/add-expense`)
        }}
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}
      >
        <Tabs.List grow>
          <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
            Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="expenses" leftSection={<IconReceipt size={16} />}>
            Expenses
          </Tabs.Tab>
          <Tabs.Tab value="add" leftSection={<IconPlus size={16} />}>
            Add
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </>
  )
}
```

**Step 3: Wire up routes in `src/App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { GroupLayout } from './components/GroupLayout'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<div>Home — groups list</div>} />
        <Route path="/group/:id" element={<GroupLayout />}>
          <Route index element={<div>Dashboard</div>} />
          <Route path="expenses" element={<div>Expenses</div>} />
          <Route path="add-expense" element={<div>Add Expense</div>} />
          <Route path="settle" element={<div>Settle Up</div>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
```

**Step 4: Verify the app runs**

Run: `npm run dev`
Expected: Navigation shell renders, tabs switch between placeholder views.

**Step 5: Commit**

```bash
git add src/components/ src/App.tsx
git commit -m "feat: add app shell with header, undo/redo, and bottom tab navigation"
```

---

### Task 7: Home Page — Groups List & Create Group

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/components/CreateGroupModal.tsx`

**Step 1: Create `src/components/CreateGroupModal.tsx`**

Modal with a form to enter group name and initial member names.

```tsx
import { Modal, TextInput, Button, Stack, ActionIcon, Group } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useApp } from '../state/context'
import { generateId } from '../lib/id'
import { useNavigate } from 'react-router-dom'

interface Props {
  opened: boolean
  onClose: () => void
}

export function CreateGroupModal({ opened, onClose }: Props) {
  const { dispatch } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [memberNames, setMemberNames] = useState(['', ''])

  const addMember = () => setMemberNames(prev => [...prev, ''])
  const removeMember = (index: number) =>
    setMemberNames(prev => prev.filter((_, i) => i !== index))
  const updateMember = (index: number, value: string) =>
    setMemberNames(prev => prev.map((n, i) => (i === index ? value : n)))

  const handleCreate = () => {
    const trimmedName = name.trim()
    const members = memberNames
      .map(n => n.trim())
      .filter(n => n.length > 0)
      .map(n => ({ id: generateId(), name: n }))

    if (!trimmedName || members.length < 2) return

    const group = {
      id: generateId(),
      name: trimmedName,
      members,
      expenses: [],
      settlements: [],
      createdAt: new Date().toISOString(),
    }

    dispatch({ type: 'CREATE_GROUP', payload: group })
    onClose()
    setName('')
    setMemberNames(['', ''])
    navigate(`/group/${group.id}`)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Create Group">
      <Stack>
        <TextInput label="Group name" value={name} onChange={e => setName(e.currentTarget.value)} />
        {memberNames.map((memberName, i) => (
          <Group key={i} gap="xs">
            <TextInput
              style={{ flex: 1 }}
              label={i === 0 ? 'Members' : undefined}
              placeholder={`Member ${i + 1}`}
              value={memberName}
              onChange={e => updateMember(i, e.currentTarget.value)}
            />
            {memberNames.length > 2 && (
              <ActionIcon variant="subtle" color="red" onClick={() => removeMember(i)} mt={i === 0 ? 24 : 0}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        ))}
        <Button variant="light" onClick={addMember}>Add member</Button>
        <Button onClick={handleCreate}>Create group</Button>
      </Stack>
    </Modal>
  )
}
```

**Step 2: Create `src/pages/HomePage.tsx`**

```tsx
import { Container, Title, Text, Button, Card, Stack, Group } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/context'
import { CreateGroupModal } from '../components/CreateGroupModal'

export function HomePage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [createOpened, setCreateOpened] = useState(false)
  const groups = Object.values(state)

  return (
    <Container size="xs" py="md" pb={80}>
      <Group justify="space-between" mb="md">
        <Title order={2}>Your Groups</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
          New
        </Button>
      </Group>

      {groups.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No groups yet. Create one to get started!
        </Text>
      ) : (
        <Stack>
          {groups.map(group => (
            <Card key={group.id} withBorder onClick={() => navigate(`/group/${group.id}`)} style={{ cursor: 'pointer' }}>
              <Text fw={600}>{group.name}</Text>
              <Text size="sm" c="dimmed">
                {group.members.length} members · {group.expenses.length} expenses
              </Text>
            </Card>
          ))}
        </Stack>
      )}

      <CreateGroupModal opened={createOpened} onClose={() => setCreateOpened(false)} />
    </Container>
  )
}
```

**Step 3: Wire up in `src/App.tsx`**

Replace the Home route placeholder with `<HomePage />`.

**Step 4: Verify**

Run: `npm run dev`
Expected: Home page shows empty state, create modal works, group appears in list after creation.

**Step 5: Commit**

```bash
git add src/pages/HomePage.tsx src/components/CreateGroupModal.tsx src/App.tsx
git commit -m "feat: add home page with group list and create group modal"
```

---

### Task 8: Group Dashboard — Balances & Simplified Debts

**Files:**
- Create: `src/pages/GroupDashboardPage.tsx`

**Step 1: Create `src/pages/GroupDashboardPage.tsx`**

Shows members, net balances, simplified debts, share button, and settle-up links.

```tsx
import { Container, Title, Text, Card, Stack, Group, Button, Badge } from '@mantine/core'
import { IconShare, IconCash } from '@tabler/icons-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/context'
import { calculateBalances, simplifyDebts } from '../lib/balance'
import { copyShareUrl } from '../lib/sharing'

function formatPHP(centavos: number): string {
  return `₱${(centavos / 100).toFixed(2)}`
}

export function GroupDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const { state } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>

  const balances = calculateBalances(group)
  const debts = simplifyDebts(group)
  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

  return (
    <Container size="xs" py="md" pb={80}>
      <Group justify="space-between" mb="md">
        <Title order={2}>{group.name}</Title>
        <Button variant="light" leftSection={<IconShare size={16} />} onClick={() => copyShareUrl(group)}>
          Share
        </Button>
      </Group>

      <Title order={4} mb="xs">Balances</Title>
      <Stack mb="lg">
        {group.members.map(member => {
          const balance = balances.get(member.id) ?? 0
          return (
            <Card key={member.id} withBorder p="sm">
              <Group justify="space-between">
                <Text>{member.name}</Text>
                <Badge color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}>
                  {balance >= 0 ? '+' : ''}{formatPHP(balance)}
                </Badge>
              </Group>
            </Card>
          )
        })}
      </Stack>

      {debts.length > 0 && (
        <>
          <Title order={4} mb="xs">Settle Up</Title>
          <Stack>
            {debts.map((debt, i) => (
              <Card key={i} withBorder p="sm">
                <Group justify="space-between">
                  <Text size="sm">
                    {getMemberName(debt.fromMemberId)} owes {getMemberName(debt.toMemberId)}
                  </Text>
                  <Group gap="xs">
                    <Text fw={600}>{formatPHP(debt.amount)}</Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconCash size={14} />}
                      onClick={() => navigate(`/group/${id}/settle?from=${debt.fromMemberId}&to=${debt.toMemberId}&amount=${debt.amount}`)}
                    >
                      Settle
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {debts.length === 0 && group.expenses.length > 0 && (
        <Text c="dimmed" ta="center">All settled up!</Text>
      )}
    </Container>
  )
}
```

**Step 2: Wire up in `src/App.tsx`**

Replace the Dashboard placeholder with `<GroupDashboardPage />`.

**Step 3: Verify**

Run: `npm run dev`
Expected: Group dashboard shows members, balances, simplified debts.

**Step 4: Commit**

```bash
git add src/pages/GroupDashboardPage.tsx src/App.tsx
git commit -m "feat: add group dashboard with balances and debt simplification"
```

---

### Task 9: Add Expense Page

**Files:**
- Create: `src/pages/AddExpensePage.tsx`

**Step 1: Create `src/pages/AddExpensePage.tsx`**

Form with: description, amount (in pesos, converted to centavos), paid by (select), split method (equal/exact/percentage), member checkboxes, date.

```tsx
import { Container, Title, TextInput, NumberInput, Select, SegmentedControl, Checkbox, Button, Stack, Group } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/context'
import { generateId } from '../lib/id'
import type { Split } from '../types'

type SplitMethod = 'equal' | 'exact' | 'percentage'

export function AddExpensePage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [paidBy, setPaidBy] = useState<string | null>(null)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(group?.members.map(m => m.id) ?? [])
  )
  const [exactAmounts, setExactAmounts] = useState<Record<string, number | ''>>({})
  const [percentages, setPercentages] = useState<Record<string, number | ''>>({})
  const [date, setDate] = useState<Date | null>(new Date())

  if (!group) return <Container py="md">Group not found.</Container>

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
    const members = group.members.filter(m => selectedMembers.has(m.id))
    if (members.length === 0 || amountCentavos <= 0) return null

    if (splitMethod === 'equal') {
      const share = Math.floor(amountCentavos / members.length)
      const remainder = amountCentavos - share * members.length
      return members.map((m, i) => ({
        memberId: m.id,
        amount: share + (i < remainder ? 1 : 0),
      }))
    }

    if (splitMethod === 'exact') {
      const splits = members.map(m => ({
        memberId: m.id,
        amount: Math.round((typeof exactAmounts[m.id] === 'number' ? exactAmounts[m.id] : 0) * 100),
      }))
      const total = splits.reduce((sum, s) => sum + s.amount, 0)
      if (total !== amountCentavos) return null
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = members.map(m => {
        const pct = typeof percentages[m.id] === 'number' ? percentages[m.id] : 0
        return { memberId: m.id, amount: Math.round((pct / 100) * amountCentavos) }
      })
      const totalPct = members.reduce((sum, m) => sum + (typeof percentages[m.id] === 'number' ? percentages[m.id] : 0), 0)
      if (Math.abs(totalPct - 100) > 0.01) return null
      return splits
    }

    return null
  }

  const handleSubmit = () => {
    const splits = buildSplits()
    if (!splits || !paidBy || !description.trim() || !date) return

    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        groupId: group.id,
        expense: {
          id: generateId(),
          description: description.trim(),
          amount: Math.round((typeof amount === 'number' ? amount : 0) * 100),
          paidBy,
          splits,
          date: date.toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
    })
    navigate(`/group/${id}`)
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Add Expense</Title>
      <Stack>
        <TextInput label="Description" value={description} onChange={e => setDescription(e.currentTarget.value)} />
        <NumberInput label="Amount (₱)" value={amount} onChange={setAmount} min={0} decimalScale={2} />
        <Select
          label="Paid by"
          data={group.members.map(m => ({ value: m.id, label: m.name }))}
          value={paidBy}
          onChange={setPaidBy}
        />
        <DateInput label="Date" value={date} onChange={setDate} />

        <SegmentedControl
          value={splitMethod}
          onChange={v => setSplitMethod(v as SplitMethod)}
          data={[
            { label: 'Equal', value: 'equal' },
            { label: 'Exact', value: 'exact' },
            { label: '%', value: 'percentage' },
          ]}
        />

        <Checkbox.Group label="Split among">
          <Stack mt="xs">
            {group.members.map(m => (
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
        </Checkbox.Group>

        <Button onClick={handleSubmit}>Add Expense</Button>
      </Stack>
    </Container>
  )
}
```

**NOTE:** This uses `@mantine/dates`. Install it:

```bash
npm install @mantine/dates dayjs
```

And add `import '@mantine/dates/styles.css'` to `src/main.tsx`.

**Step 2: Wire up in `src/App.tsx`**

Replace the Add Expense placeholder.

**Step 3: Verify**

Run: `npm run dev`
Expected: Add expense form renders, equal/exact/percentage splits work, expense appears in dashboard balances.

**Step 4: Commit**

```bash
git add src/pages/AddExpensePage.tsx src/App.tsx src/main.tsx
git commit -m "feat: add expense page with equal, exact, and percentage splits"
```

---

### Task 10: Expense List Page

**Files:**
- Create: `src/pages/ExpenseListPage.tsx`

**Step 1: Create `src/pages/ExpenseListPage.tsx`**

Chronological list of all expenses and settlements with ability to delete.

```tsx
import { Container, Title, Text, Card, Stack, Group, Badge, ActionIcon, Menu } from '@mantine/core'
import { IconDots, IconTrash } from '@tabler/icons-react'
import { useParams } from 'react-router-dom'
import { useApp } from '../state/context'

function formatPHP(centavos: number): string {
  return `₱${(centavos / 100).toFixed(2)}`
}

export function ExpenseListPage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const group = id ? state[id] : undefined

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>

  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

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
              return (
                <Card key={e.id} withBorder p="sm">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{e.description}</Text>
                      <Text size="sm" c="dimmed">
                        Paid by {getMemberName(e.paidBy)} · {new Date(e.date).toLocaleDateString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge>{formatPHP(e.amount)}</Badge>
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle"><IconDots size={16} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => dispatch({ type: 'DELETE_EXPENSE', payload: { groupId: group.id, expenseId: e.id } })}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
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

**Step 2: Wire up in `src/App.tsx`**

Replace the Expenses placeholder.

**Step 3: Verify**

Run: `npm run dev`
Expected: Expense list shows expenses and settlements, delete works, undo restores.

**Step 4: Commit**

```bash
git add src/pages/ExpenseListPage.tsx src/App.tsx
git commit -m "feat: add expense list page with delete and chronological ordering"
```

---

### Task 11: Settle Up Page

**Files:**
- Create: `src/pages/SettleUpPage.tsx`

**Step 1: Create `src/pages/SettleUpPage.tsx`**

Form to record a settlement. Pre-fills from/to/amount from query params if provided.

```tsx
import { Container, Title, Select, NumberInput, Button, Stack } from '@mantine/core'
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/context'
import { generateId } from '../lib/id'

export function SettleUpPage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const group = id ? state[id] : undefined

  const [from, setFrom] = useState<string | null>(searchParams.get('from'))
  const [to, setTo] = useState<string | null>(searchParams.get('to'))
  const [amount, setAmount] = useState<number | ''>(
    searchParams.get('amount') ? Number(searchParams.get('amount')) / 100 : ''
  )

  if (!group) return <Container py="md">Group not found.</Container>

  const handleSubmit = () => {
    if (!from || !to || typeof amount !== 'number' || amount <= 0 || from === to) return

    dispatch({
      type: 'ADD_SETTLEMENT',
      payload: {
        groupId: group.id,
        settlement: {
          id: generateId(),
          fromMemberId: from,
          toMemberId: to,
          amount: Math.round(amount * 100),
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
    })
    navigate(`/group/${id}`)
  }

  const memberData = group.members.map(m => ({ value: m.id, label: m.name }))

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Settle Up</Title>
      <Stack>
        <Select label="Who paid" data={memberData} value={from} onChange={setFrom} />
        <Select label="Paid to" data={memberData} value={to} onChange={setTo} />
        <NumberInput label="Amount (₱)" value={amount} onChange={setAmount} min={0} decimalScale={2} />
        <Button onClick={handleSubmit}>Record Settlement</Button>
      </Stack>
    </Container>
  )
}
```

**Step 2: Wire up in `src/App.tsx`**

Replace the Settle Up placeholder.

**Step 3: Verify**

Run: `npm run dev`
Expected: Settle up form works, pre-fills from dashboard links, settlement appears in expense list and affects balances.

**Step 4: Commit**

```bash
git add src/pages/SettleUpPage.tsx src/App.tsx
git commit -m "feat: add settle up page with pre-filled query params"
```

---

### Task 12: URL Import Flow

**Files:**
- Create: `src/components/ImportHandler.tsx`
- Modify: `src/pages/GroupDashboardPage.tsx`

**Step 1: Create `src/components/ImportHandler.tsx`**

Component that detects a hash in the URL, decompresses it, and either imports or prompts the user.

```tsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Modal, Text, Group, Button } from '@mantine/core'
import { decompressGroup } from '../lib/sharing'
import { useApp } from '../state/context'
import type { Group as GroupType } from '../types'

export function ImportHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()
  const { state, dispatch } = useApp()
  const [pendingGroup, setPendingGroup] = useState<GroupType | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const hash = location.hash.slice(1)
    if (!hash) return

    try {
      const group = decompressGroup(hash)
      if (state[group.id]) {
        setPendingGroup(group)
        setShowPrompt(true)
      } else {
        dispatch({ type: 'IMPORT_GROUP', payload: group })
        navigate(`/group/${group.id}`, { replace: true })
      }
    } catch {
      // Invalid hash, ignore
    }
  }, []) // Only run on mount

  const handleReplace = () => {
    if (!pendingGroup) return
    dispatch({ type: 'IMPORT_GROUP', payload: pendingGroup })
    setShowPrompt(false)
    navigate(`/group/${pendingGroup.id}`, { replace: true })
  }

  const handleKeep = () => {
    setShowPrompt(false)
    navigate(`/group/${id}`, { replace: true })
  }

  return (
    <Modal opened={showPrompt} onClose={handleKeep} title="Group Already Exists">
      <Text mb="md">
        You already have this group. Replace it with the shared version?
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={handleKeep}>Keep mine</Button>
        <Button onClick={handleReplace}>Replace</Button>
      </Group>
    </Modal>
  )
}
```

**Step 2: Add `<ImportHandler />` to `GroupLayout`**

Render it inside the group layout so it activates on any group route.

**Step 3: Verify**

1. Create a group, add an expense
2. Click Share, copy URL
3. Open URL in incognito → group imports automatically
4. Open URL in same browser → prompt appears

**Step 4: Commit**

```bash
git add src/components/ImportHandler.tsx src/components/GroupLayout.tsx
git commit -m "feat: add URL import with duplicate group detection and replace prompt"
```

---

### Task 13: PWA Setup

**Files:**
- Modify: `vite.config.ts`
- Create: `public/manifest.json` (auto-generated by plugin)

**Step 1: Configure `vite-plugin-pwa` in `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tally',
        short_name: 'Tally',
        description: 'Split expenses with friends',
        theme_color: '#228be6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
```

**Step 2: Create placeholder PWA icons**

Create `public/icon-192.png` and `public/icon-512.png` — can be simple colored squares as placeholders. Use any tool or online generator.

**Step 3: Verify**

Run: `npm run build && npm run preview`
Expected: Service worker registers, app is installable (check DevTools > Application > Manifest).

**Step 4: Commit**

```bash
git add vite.config.ts public/
git commit -m "feat: configure PWA with vite-plugin-pwa and service worker"
```

---

### Task 14: Final Polish & Cleanup

**Files:**
- Modify: various files for small fixes
- Delete: `src/assets/` (unused Vite/React logos)

**Step 1: Delete unused boilerplate**

Remove `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png` and the `src/assets/` directory.

**Step 2: Add `formatPHP` as a shared utility**

Create `src/lib/format.ts`:

```typescript
export function formatPHP(centavos: number): string {
  return `₱${(centavos / 100).toFixed(2)}`
}
```

Update `GroupDashboardPage.tsx` and `ExpenseListPage.tsx` to import from `../lib/format` instead of defining inline.

**Step 3: Verify full flow**

Run: `npm run dev`

Test:
1. Create a group with 3 members
2. Add an expense with equal split
3. Add an expense with exact amounts
4. Add an expense excluding one member
5. Check balances on dashboard
6. Record a settlement
7. Share the group, open in incognito
8. Undo/redo an action
9. Build succeeds: `npm run build`

**Step 4: Commit**

```bash
git add .
git commit -m "chore: clean up boilerplate and extract shared utilities"
```
