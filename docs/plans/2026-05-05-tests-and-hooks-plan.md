# Tests and Git Hooks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Vitest unit-test suite covering the pure logic in `src/lib/` and `src/state/reducer.ts`, then wire up `pre-commit` (lint) and `pre-push` (typecheck + tests) git hooks.

**Architecture:** Vitest reuses the existing `vite.config.ts` so no test config file is needed. Tests live alongside source as `*.test.ts` and run in the default Node environment (no jsdom — pure-logic only). Hooks are managed by the already-installed Husky.

**Tech Stack:** Vitest, TypeScript 5.9, Husky 9, ESLint 9.

**Important note on TDD inversion:** The implementation under test already exists. So instead of "write failing test → implement → green", the flow is "write test → run → expect green on first run". If a test goes red, treat it as a discovered bug — STOP, surface it to the user, do not silently change production code to satisfy the test.

**Design doc:** `docs/plans/2026-05-05-tests-and-hooks-design.md`

---

## Task 1: Install Vitest and add test scripts

**Files:**
- Modify: `package.json` (add `vitest` to `devDependencies`, add `test` and `test:watch` scripts)

**Step 1: Install Vitest**

Run: `npm install --save-dev vitest`
Expected: package.json updated with `"vitest": "^X.Y.Z"` in `devDependencies`, lockfile updated.

**Step 2: Add test scripts**

Edit `package.json` `scripts` block — add these two entries (keep existing entries):
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Verify the runner works with no tests**

Run: `npm test`
Expected: Vitest prints something like `No test files found, exiting with code 1` OR exits 0 with `0 passed`. Either is fine — we're just confirming the binary is wired. If it errors with "command not found", the install failed.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install vitest and add test scripts"
```

---

## Task 2: First test — `format.test.ts` (smoke test the toolchain)

**Files:**
- Create: `src/lib/format.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { formatPHP } from './format'

describe('formatPHP', () => {
  it('formats whole pesos with two decimals', () => {
    expect(formatPHP(10000)).toBe('₱100.00')
  })

  it('formats centavos correctly', () => {
    expect(formatPHP(12345)).toBe('₱123.45')
  })

  it('formats zero', () => {
    expect(formatPHP(0)).toBe('₱0.00')
  })

  it('handles negative amounts', () => {
    expect(formatPHP(-500)).toBe('₱-5.00')
  })
})
```

**Step 2: Run the test**

Run: `npx vitest run src/lib/format.test.ts`
Expected: 4 passed. If any fail, do NOT change `format.ts` — surface the failure and stop.

**Step 3: Commit**

```bash
git add src/lib/format.test.ts
git commit -m "test: add formatPHP tests"
```

---

## Task 3: `splitEqual.test.ts`

**Files:**
- Create: `src/lib/splitEqual.test.ts`

**Note:** `splitEqual` uses `Math.random()` to distribute remainder centavos. Tests must NOT depend on which member gets the extra centavo — only on invariants (sum, value range).

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { splitEqual } from './splitEqual'

describe('splitEqual', () => {
  it('returns empty object for no members', () => {
    expect(splitEqual(10000, [])).toEqual({})
  })

  it('splits evenly when amount divides cleanly', () => {
    const result = splitEqual(900, ['a', 'b', 'c'])
    expect(result).toEqual({ a: 300, b: 300, c: 300 })
  })

  it('distributes remainder centavos so the sum equals the total', () => {
    const result = splitEqual(1000, ['a', 'b', 'c']) // 1000 / 3 = 333 rem 1
    const sum = Object.values(result).reduce((a, b) => a + b, 0)
    expect(sum).toBe(1000)
    // Each share is either floor (333) or floor+1 (334)
    for (const share of Object.values(result)) {
      expect([333, 334]).toContain(share)
    }
  })

  it('exactly one member gets the extra centavo when remainder is 1', () => {
    const result = splitEqual(1000, ['a', 'b', 'c'])
    const extras = Object.values(result).filter(v => v === 334)
    expect(extras).toHaveLength(1)
  })

  it('handles single member', () => {
    expect(splitEqual(777, ['solo'])).toEqual({ solo: 777 })
  })

  it('handles zero amount', () => {
    expect(splitEqual(0, ['a', 'b'])).toEqual({ a: 0, b: 0 })
  })

  it('returns a key for every member', () => {
    const result = splitEqual(1000, ['a', 'b', 'c', 'd'])
    expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})
```

**Step 2: Run the test**

Run: `npx vitest run src/lib/splitEqual.test.ts`
Expected: 7 passed.

**Step 3: Commit**

```bash
git add src/lib/splitEqual.test.ts
git commit -m "test: add splitEqual tests"
```

---

## Task 4: `balance.test.ts` part 1 — `calculateBalances` and `getBalanceEntries`

**Files:**
- Create: `src/lib/balance.test.ts`

**Note:** Build a small fixture-builder helper at the top of the file to keep tests readable. `Group` requires `id`, `name`, `members`, `expenses`, `settlements`, `createdAt`. Use trivial values.

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import {
  calculateBalances,
  getBalanceEntries,
  computeRawDebts,
  simplifyDebts,
} from './balance'
import type { Group, Expense, Settlement } from '../types'

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Test Group',
    members: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
    ],
    expenses: [],
    settlements: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: 'e' + Math.random().toString(36).slice(2),
    description: 'item',
    amount: 0,
    paidBy: 'a',
    splits: [],
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function settlement(over: Partial<Settlement>): Settlement {
  return {
    id: 's' + Math.random().toString(36).slice(2),
    fromMemberId: 'a',
    toMemberId: 'b',
    amount: 0,
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('calculateBalances', () => {
  it('returns all-zero balances for an empty group', () => {
    const balances = calculateBalances(makeGroup())
    expect(balances.get('a')).toBe(0)
    expect(balances.get('b')).toBe(0)
    expect(balances.get('c')).toBe(0)
  })

  it('credits the payer and debits each split member', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 900,
        paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 },
        ],
      })],
    })
    const balances = calculateBalances(group)
    expect(balances.get('a')).toBe(600)
    expect(balances.get('b')).toBe(-300)
    expect(balances.get('c')).toBe(-300)
  })

  it('balances always sum to zero', () => {
    const group = makeGroup({
      expenses: [
        expense({ amount: 1500, paidBy: 'a', splits: [
          { memberId: 'a', amount: 500 },
          { memberId: 'b', amount: 500 },
          { memberId: 'c', amount: 500 },
        ]}),
        expense({ amount: 600, paidBy: 'b', splits: [
          { memberId: 'a', amount: 200 },
          { memberId: 'b', amount: 200 },
          { memberId: 'c', amount: 200 },
        ]}),
      ],
      settlements: [settlement({ fromMemberId: 'c', toMemberId: 'a', amount: 100 })],
    })
    const balances = calculateBalances(group)
    const sum = Array.from(balances.values()).reduce((s, v) => s + v, 0)
    expect(sum).toBe(0)
  })

  it('settlements offset balances', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 600, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
        ],
      })],
      settlements: [settlement({ fromMemberId: 'b', toMemberId: 'a', amount: 300 })],
    })
    const balances = calculateBalances(group)
    expect(balances.get('a')).toBe(0)
    expect(balances.get('b')).toBe(0)
  })
})

describe('getBalanceEntries', () => {
  it('returns empty arrays for a group with no activity', () => {
    const entries = getBalanceEntries(makeGroup())
    expect(entries.get('a')).toEqual([])
  })

  it('records payer credit and split debit on the same expense', () => {
    const group = makeGroup({
      expenses: [expense({
        id: 'x', description: 'Dinner', date: '2026-02-01',
        amount: 600, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
        ],
      })],
    })
    const entries = getBalanceEntries(group)
    expect(entries.get('a')).toEqual([
      { description: 'Dinner', amount: 300, date: '2026-02-01' },
    ])
    expect(entries.get('b')).toEqual([
      { description: 'Dinner', amount: -300, date: '2026-02-01' },
    ])
  })

  it('produces settlement entries with from/to descriptions', () => {
    const group = makeGroup({
      settlements: [settlement({
        fromMemberId: 'b', toMemberId: 'a', amount: 100, date: '2026-03-01',
      })],
    })
    const entries = getBalanceEntries(group)
    expect(entries.get('b')).toEqual([
      { description: 'Paid Alice', amount: 100, date: '2026-03-01' },
    ])
    expect(entries.get('a')).toEqual([
      { description: 'Received from Bob', amount: -100, date: '2026-03-01' },
    ])
  })

  it('sorts entries by date ascending', () => {
    const group = makeGroup({
      expenses: [
        expense({ description: 'Late', date: '2026-03-01', amount: 100, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 50 }, { memberId: 'b', amount: 50 }] }),
        expense({ description: 'Early', date: '2026-01-01', amount: 100, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 50 }, { memberId: 'b', amount: 50 }] }),
      ],
    })
    const dates = entries(group, 'a').map(e => e.date)
    expect(dates).toEqual(['2026-01-01', '2026-03-01'])
  })
})

function entries(group: Group, memberId: string) {
  return getBalanceEntries(group).get(memberId)!
}
```

**Step 2: Run the test**

Run: `npx vitest run src/lib/balance.test.ts`
Expected: all passed.

**Step 3: Commit**

```bash
git add src/lib/balance.test.ts
git commit -m "test: add calculateBalances and getBalanceEntries tests"
```

---

## Task 5: `balance.test.ts` part 2 — `computeRawDebts` and `simplifyDebts`

**Files:**
- Modify: `src/lib/balance.test.ts` (append two new `describe` blocks; reuse the helpers added in Task 4)

**Step 1: Append the tests**

Add these blocks to the end of `src/lib/balance.test.ts`:

```ts
describe('computeRawDebts', () => {
  it('returns no debts for an empty group', () => {
    expect(computeRawDebts(makeGroup())).toEqual([])
  })

  it('records a debt from each non-payer split member to the payer', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 900, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 },
        ],
      })],
    })
    const debts = computeRawDebts(group)
    expect(debts).toContainEqual({ fromMemberId: 'b', toMemberId: 'a', amount: 300 })
    expect(debts).toContainEqual({ fromMemberId: 'c', toMemberId: 'a', amount: 300 })
    expect(debts).toHaveLength(2)
  })

  it('nets opposing debts between the same pair', () => {
    // a pays 600 split between a/b (b owes a 300)
    // then b pays 400 split between a/b (a owes b 200)
    // net: b owes a 100
    const group = makeGroup({
      expenses: [
        expense({ amount: 600, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 }] }),
        expense({ amount: 400, paidBy: 'b',
          splits: [{ memberId: 'a', amount: 200 }, { memberId: 'b', amount: 200 }] }),
      ],
    })
    const debts = computeRawDebts(group)
    expect(debts).toEqual([{ fromMemberId: 'b', toMemberId: 'a', amount: 100 }])
  })

  it('settlements reduce debts', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 600, paidBy: 'a',
        splits: [{ memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 }],
      })],
      settlements: [settlement({ fromMemberId: 'b', toMemberId: 'a', amount: 300 })],
    })
    expect(computeRawDebts(group)).toEqual([])
  })

  it('drops debts at or below the threshold (≤0.005)', () => {
    // Construct a near-zero residual via opposing debts that don't quite cancel.
    // Sub-threshold debts must not appear in the output.
    const group = makeGroup({
      expenses: [
        expense({ amount: 1, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 0.5 }, { memberId: 'b', amount: 0.5 }] }),
      ],
      settlements: [settlement({ fromMemberId: 'b', toMemberId: 'a', amount: 0.499 })],
    })
    const debts = computeRawDebts(group)
    // 0.5 - 0.499 = 0.001, below the 0.005 threshold
    expect(debts).toEqual([])
  })

  it('sorts debts by amount descending', () => {
    const group = makeGroup({
      expenses: [
        expense({ amount: 100, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 50 }, { memberId: 'b', amount: 50 }] }),
        expense({ amount: 1000, paidBy: 'a',
          splits: [{ memberId: 'a', amount: 500 }, { memberId: 'c', amount: 500 }] }),
      ],
    })
    const amounts = computeRawDebts(group).map(d => d.amount)
    expect(amounts).toEqual([500, 50])
  })
})

describe('simplifyDebts', () => {
  it('returns no settlements for a balanced group', () => {
    expect(simplifyDebts(makeGroup())).toEqual([])
  })

  it('produces at most N-1 settlements for N members with non-zero balance', () => {
    // 4 members, all imbalanced
    const group: Group = {
      ...makeGroup(),
      members: [
        { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
        { id: 'c', name: 'C' }, { id: 'd', name: 'D' },
      ],
      expenses: [expense({
        amount: 1200, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 }, { memberId: 'd', amount: 300 },
        ],
      })],
    }
    const settlements = simplifyDebts(group)
    expect(settlements.length).toBeLessThanOrEqual(3)
  })

  it('settlement amounts cancel the original balances', () => {
    const group = makeGroup({
      expenses: [expense({
        amount: 900, paidBy: 'a',
        splits: [
          { memberId: 'a', amount: 300 },
          { memberId: 'b', amount: 300 },
          { memberId: 'c', amount: 300 },
        ],
      })],
    })
    const balances = calculateBalances(group)
    const settlements = simplifyDebts(group, balances)

    // Apply settlements to balances and verify they all become 0.
    const adjusted = new Map(balances)
    for (const s of settlements) {
      adjusted.set(s.fromMemberId, adjusted.get(s.fromMemberId)! + s.amount)
      adjusted.set(s.toMemberId, adjusted.get(s.toMemberId)! - s.amount)
    }
    for (const v of adjusted.values()) {
      expect(Math.abs(v)).toBeLessThan(0.001)
    }
  })

  it('uses precomputedBalances if provided', () => {
    // Pass artificial balances; should not call calculateBalances internally.
    const group = makeGroup()
    const balances = new Map<string, number>([
      ['a', 100], ['b', -100],
    ])
    const settlements = simplifyDebts(group, balances)
    expect(settlements).toEqual([
      { fromMemberId: 'b', toMemberId: 'a', amount: 100 },
    ])
  })
})
```

**Step 2: Run the tests**

Run: `npx vitest run src/lib/balance.test.ts`
Expected: all tests in this file passed.

**Step 3: Commit**

```bash
git add src/lib/balance.test.ts
git commit -m "test: add computeRawDebts and simplifyDebts tests"
```

---

## Task 6: `sharing.test.ts` — round-trip

**Files:**
- Create: `src/lib/sharing.test.ts`

**Note:** Only test `compressGroup`/`decompressGroup`. Skip `buildShareUrl` and `copyShareUrl` (depend on `window.location`, `navigator.share`, `navigator.clipboard` — DOM-only).

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { compressGroup, decompressGroup } from './sharing'
import type { Group } from '../types'

const fixture: Group = {
  id: 'g1',
  name: 'Trip to Tokyo',
  members: [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' },
  ],
  expenses: [
    {
      id: 'e1',
      description: 'Sushi',
      amount: 5000,
      paidBy: 'm1',
      splits: [
        { memberId: 'm1', amount: 2500 },
        { memberId: 'm2', amount: 2500 },
      ],
      date: '2026-04-01',
      createdAt: '2026-04-01T12:00:00Z',
      notes: 'Best toro of the trip',
    },
  ],
  settlements: [
    {
      id: 's1',
      fromMemberId: 'm2',
      toMemberId: 'm1',
      amount: 2500,
      date: '2026-04-02',
      createdAt: '2026-04-02T09:00:00Z',
    },
  ],
  createdAt: '2026-03-30T00:00:00Z',
}

describe('compressGroup / decompressGroup', () => {
  it('round-trips an empty group', () => {
    const empty: Group = {
      id: 'g0', name: '', members: [], expenses: [], settlements: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    expect(decompressGroup(compressGroup(empty))).toEqual(empty)
  })

  it('round-trips a populated group', () => {
    expect(decompressGroup(compressGroup(fixture))).toEqual(fixture)
  })

  it('preserves unicode in names and notes', () => {
    const unicodeGroup: Group = {
      ...fixture,
      name: '東京旅行 🗼',
      members: [
        { id: 'm1', name: 'アリス' },
        { id: 'm2', name: 'ボブ' },
      ],
    }
    expect(decompressGroup(compressGroup(unicodeGroup))).toEqual(unicodeGroup)
  })

  it('produces a base64url string with no padding or unsafe characters', () => {
    const encoded = compressGroup(fixture)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('produces a string shorter than the raw JSON', () => {
    const encoded = compressGroup(fixture)
    const raw = JSON.stringify(fixture)
    expect(encoded.length).toBeLessThan(raw.length)
  })
})
```

**Step 2: Run the test**

Run: `npx vitest run src/lib/sharing.test.ts`
Expected: 5 passed. (Node 18+ provides `btoa`/`atob` globally; if any test fails with `btoa is not defined`, surface it — we'd then need a polyfill or jsdom env, but it should not be needed.)

**Step 3: Commit**

```bash
git add src/lib/sharing.test.ts
git commit -m "test: add compressGroup/decompressGroup round-trip tests"
```

---

## Task 7: `merge.test.ts`

**Files:**
- Create: `src/lib/merge.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { mergeGroups, applyResolutions } from './merge'
import type { Group, Expense, Settlement } from '../types'

function baseGroup(over: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Trip',
    members: [
      { id: 'm1', name: 'Alice' },
      { id: 'm2', name: 'Bob' },
    ],
    expenses: [],
    settlements: [],
    createdAt: '2026-03-01T00:00:00Z',
    ...over,
  }
}

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'e1',
    description: 'Item',
    amount: 1000,
    paidBy: 'm1',
    splits: [
      { memberId: 'm1', amount: 500 },
      { memberId: 'm2', amount: 500 },
    ],
    date: '2026-03-01',
    createdAt: '2026-03-01T00:00:00Z',
    ...over,
  }
}

function sett(over: Partial<Settlement>): Settlement {
  return {
    id: 's1',
    fromMemberId: 'm2',
    toMemberId: 'm1',
    amount: 500,
    date: '2026-03-02',
    createdAt: '2026-03-02T00:00:00Z',
    ...over,
  }
}

describe('mergeGroups', () => {
  it('takes the union of disjoint expenses', () => {
    const local = baseGroup({ expenses: [exp({ id: 'e-local' })] })
    const incoming = baseGroup({ expenses: [exp({ id: 'e-incoming' })] })

    const result = mergeGroups(local, incoming)
    const ids = result.merged.expenses.map(e => e.id).sort()
    expect(ids).toEqual(['e-incoming', 'e-local'])
    expect(result.hasConflicts).toBe(false)
  })

  it('takes the union of disjoint settlements', () => {
    const local = baseGroup({ settlements: [sett({ id: 's-local' })] })
    const incoming = baseGroup({ settlements: [sett({ id: 's-incoming' })] })
    const result = mergeGroups(local, incoming)
    const ids = result.merged.settlements.map(s => s.id).sort()
    expect(ids).toEqual(['s-incoming', 's-local'])
  })

  it('unions members by id, with incoming name winning on conflict', () => {
    const local = baseGroup({
      members: [
        { id: 'm1', name: 'Alice' },
        { id: 'm2', name: 'Bob (old)' },
      ],
    })
    const incoming = baseGroup({
      members: [
        { id: 'm2', name: 'Bob (new)' },
        { id: 'm3', name: 'Carol' },
      ],
    })
    const result = mergeGroups(local, incoming)
    const byId = Object.fromEntries(result.merged.members.map(m => [m.id, m.name]))
    expect(byId).toEqual({ m1: 'Alice', m2: 'Bob (new)', m3: 'Carol' })
  })

  it('does not flag identical same-id expenses as conflicts', () => {
    const e = exp({ id: 'shared' })
    const result = mergeGroups(
      baseGroup({ expenses: [e] }),
      baseGroup({ expenses: [{ ...e }] }),
    )
    expect(result.hasConflicts).toBe(false)
    expect(result.expenseConflicts).toEqual([])
    expect(result.merged.expenses).toHaveLength(1)
  })

  it('flags divergent same-id expenses as conflicts', () => {
    const localE = exp({ id: 'shared', amount: 1000 })
    const incomingE = exp({ id: 'shared', amount: 2000 })
    const result = mergeGroups(
      baseGroup({ expenses: [localE] }),
      baseGroup({ expenses: [incomingE] }),
    )
    expect(result.hasConflicts).toBe(true)
    expect(result.expenseConflicts).toEqual([{ local: localE, incoming: incomingE }])
    // Local copy stays in `merged.expenses` until resolved
    expect(result.merged.expenses).toEqual([localE])
  })

  it('flags divergent same-id settlements as conflicts', () => {
    const localS = sett({ id: 'shared', amount: 100 })
    const incomingS = sett({ id: 'shared', amount: 200 })
    const result = mergeGroups(
      baseGroup({ settlements: [localS] }),
      baseGroup({ settlements: [incomingS] }),
    )
    expect(result.hasConflicts).toBe(true)
    expect(result.settlementConflicts).toEqual([{ local: localS, incoming: incomingS }])
  })

  it('uses incoming name and earliest createdAt for the merged group', () => {
    const local = baseGroup({ name: 'Old', createdAt: '2026-02-01T00:00:00Z' })
    const incoming = baseGroup({ name: 'New', createdAt: '2026-01-01T00:00:00Z' })
    const result = mergeGroups(local, incoming)
    expect(result.merged.name).toBe('New')
    expect(result.merged.createdAt).toBe('2026-01-01T00:00:00Z')
  })
})

describe('applyResolutions', () => {
  it("keeps the local copy when resolution picks 'local'", () => {
    const localE = exp({ id: 'shared', amount: 1000 })
    const incomingE = exp({ id: 'shared', amount: 2000 })
    const merge = mergeGroups(
      baseGroup({ expenses: [localE] }),
      baseGroup({ expenses: [incomingE] }),
    )
    const resolved = applyResolutions(merge, [
      { type: 'expense', id: 'shared', pick: 'local' },
    ])
    expect(resolved.expenses).toEqual([localE])
  })

  it("swaps in the incoming copy when resolution picks 'incoming'", () => {
    const localE = exp({ id: 'shared', amount: 1000 })
    const incomingE = exp({ id: 'shared', amount: 2000 })
    const merge = mergeGroups(
      baseGroup({ expenses: [localE] }),
      baseGroup({ expenses: [incomingE] }),
    )
    const resolved = applyResolutions(merge, [
      { type: 'expense', id: 'shared', pick: 'incoming' },
    ])
    expect(resolved.expenses).toEqual([incomingE])
  })

  it("swaps in the incoming settlement when resolution picks 'incoming'", () => {
    const localS = sett({ id: 'shared', amount: 100 })
    const incomingS = sett({ id: 'shared', amount: 200 })
    const merge = mergeGroups(
      baseGroup({ settlements: [localS] }),
      baseGroup({ settlements: [incomingS] }),
    )
    const resolved = applyResolutions(merge, [
      { type: 'settlement', id: 'shared', pick: 'incoming' },
    ])
    expect(resolved.settlements).toEqual([incomingS])
  })
})
```

**Step 2: Run the test**

Run: `npx vitest run src/lib/merge.test.ts`
Expected: all passed.

**Step 3: Commit**

```bash
git add src/lib/merge.test.ts
git commit -m "test: add mergeGroups and applyResolutions tests"
```

---

## Task 8: `reducer.test.ts`

**Files:**
- Create: `src/state/reducer.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { appReducer, type AppState } from './reducer'
import type { Group, Expense, Settlement, Member } from '../types'

const member = (id: string, name: string): Member => ({ id, name })

const baseGroup = (id = 'g1'): Group => ({
  id,
  name: 'Group ' + id,
  members: [member('a', 'Alice'), member('b', 'Bob')],
  expenses: [],
  settlements: [],
  createdAt: '2026-01-01T00:00:00Z',
})

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  description: 'Lunch',
  amount: 1000,
  paidBy: 'a',
  splits: [
    { memberId: 'a', amount: 500 },
    { memberId: 'b', amount: 500 },
  ],
  date: '2026-01-02',
  createdAt: '2026-01-02T00:00:00Z',
  ...over,
})

const settlement = (over: Partial<Settlement> = {}): Settlement => ({
  id: 's1',
  fromMemberId: 'b',
  toMemberId: 'a',
  amount: 500,
  date: '2026-01-03',
  createdAt: '2026-01-03T00:00:00Z',
  ...over,
})

describe('appReducer', () => {
  describe('CREATE_GROUP / IMPORT_GROUP / MERGE_GROUP', () => {
    it('adds a new group keyed by id', () => {
      const next = appReducer({}, { type: 'CREATE_GROUP', payload: baseGroup('g1') })
      expect(next).toEqual({ g1: baseGroup('g1') })
    })

    it('IMPORT_GROUP behaves like CREATE_GROUP', () => {
      const next = appReducer({}, { type: 'IMPORT_GROUP', payload: baseGroup('g1') })
      expect(next.g1).toEqual(baseGroup('g1'))
    })

    it('MERGE_GROUP overwrites the group at the same id', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const merged: Group = { ...baseGroup('g1'), name: 'Renamed' }
      const next = appReducer(initial, { type: 'MERGE_GROUP', payload: merged })
      expect(next.g1.name).toBe('Renamed')
    })
  })

  describe('DELETE_GROUP', () => {
    it('removes the group from state', () => {
      const initial: AppState = { g1: baseGroup('g1'), g2: baseGroup('g2') }
      const next = appReducer(initial, {
        type: 'DELETE_GROUP', payload: { groupId: 'g1' },
      })
      expect(next).toEqual({ g2: baseGroup('g2') })
    })

    it('is a no-op when the group does not exist', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'DELETE_GROUP', payload: { groupId: 'missing' },
      })
      expect(next).toEqual({ g1: baseGroup('g1') })
    })
  })

  describe('ADD_MEMBER / REMOVE_MEMBER', () => {
    it('adds a member to the group', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'ADD_MEMBER',
        payload: { groupId: 'g1', member: member('c', 'Carol') },
      })
      expect(next.g1.members.map(m => m.id)).toEqual(['a', 'b', 'c'])
    })

    it('removes a member from the group', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'REMOVE_MEMBER',
        payload: { groupId: 'g1', memberId: 'a' },
      })
      expect(next.g1.members.map(m => m.id)).toEqual(['b'])
    })

    it('is a no-op for an unknown group', () => {
      const next = appReducer({}, {
        type: 'ADD_MEMBER',
        payload: { groupId: 'missing', member: member('c', 'Carol') },
      })
      expect(next).toEqual({})
    })
  })

  describe('ADD_EXPENSE / EDIT_EXPENSE / DELETE_EXPENSE', () => {
    it('adds an expense', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'ADD_EXPENSE',
        payload: { groupId: 'g1', expense: expense() },
      })
      expect(next.g1.expenses).toEqual([expense()])
    })

    it('edits an expense in place', () => {
      const initial: AppState = {
        g1: { ...baseGroup('g1'), expenses: [expense({ id: 'e1' })] },
      }
      const updated = expense({ id: 'e1', description: 'Brunch' })
      const next = appReducer(initial, {
        type: 'EDIT_EXPENSE',
        payload: { groupId: 'g1', expense: updated },
      })
      expect(next.g1.expenses).toEqual([updated])
    })

    it('deletes an expense', () => {
      const initial: AppState = {
        g1: { ...baseGroup('g1'),
          expenses: [expense({ id: 'e1' }), expense({ id: 'e2' })] },
      }
      const next = appReducer(initial, {
        type: 'DELETE_EXPENSE',
        payload: { groupId: 'g1', expenseId: 'e1' },
      })
      expect(next.g1.expenses.map(e => e.id)).toEqual(['e2'])
    })
  })

  describe('ADD_SETTLEMENT / DELETE_SETTLEMENT', () => {
    it('adds a settlement', () => {
      const initial: AppState = { g1: baseGroup('g1') }
      const next = appReducer(initial, {
        type: 'ADD_SETTLEMENT',
        payload: { groupId: 'g1', settlement: settlement() },
      })
      expect(next.g1.settlements).toEqual([settlement()])
    })

    it('deletes a settlement', () => {
      const initial: AppState = {
        g1: { ...baseGroup('g1'),
          settlements: [settlement({ id: 's1' }), settlement({ id: 's2' })] },
      }
      const next = appReducer(initial, {
        type: 'DELETE_SETTLEMENT',
        payload: { groupId: 'g1', settlementId: 's1' },
      })
      expect(next.g1.settlements.map(s => s.id)).toEqual(['s2'])
    })
  })

  it('returns state unchanged for unknown actions', () => {
    const initial: AppState = { g1: baseGroup('g1') }
    // @ts-expect-error — deliberately invalid action for default-case test
    const next = appReducer(initial, { type: 'UNKNOWN', payload: {} })
    expect(next).toBe(initial)
  })
})
```

**Step 2: Run the test**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: all passed.

**Step 3: Commit**

```bash
git add src/state/reducer.test.ts
git commit -m "test: add appReducer action tests"
```

---

## Task 9: Verify the full suite + lint + typecheck

**Files:** none.

**Step 1: Run the whole test suite**

Run: `npm test`
Expected: all test files green.

**Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors. If lint flags any of the test files (e.g. unused vars in fixture builders), fix in-place and re-run.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: clean exit. If errors appear in test files, fix and re-run.

**Step 4: Commit any test-file fixes (if any were needed)**

```bash
git add src/
git commit -m "test: fix lint/typecheck issues in tests"
```
(Skip if nothing changed.)

---

## Task 10: Wire up pre-commit hook (lint)

**Files:**
- Modify: `.husky/pre-commit`

**Step 1: Replace the hook contents**

The current `.husky/pre-commit` contains `npx tsc -b` only. Replace its entire content with:

```sh
npm run lint
```

**Step 2: Verify it runs**

Run: `.husky/pre-commit`
Expected: same output as `npm run lint` — 0 errors.

**Step 3: Commit (this triggers the hook itself)**

```bash
git add .husky/pre-commit
git commit -m "chore: run lint on pre-commit"
```
Expected: the commit succeeds and you can see lint output before the commit message.

---

## Task 11: Add pre-push hook (typecheck + tests)

**Files:**
- Create: `.husky/pre-push`

**Step 1: Create the hook**

Create `.husky/pre-push` with content:

```sh
npm run typecheck
npm run test
```

**Step 2: Make sure it's executable**

Run: `chmod +x .husky/pre-push`
Expected: no output. (Husky v9 uses standard hook files; the executable bit must be set.)

**Step 3: Verify it runs**

Run: `.husky/pre-push`
Expected: typecheck passes, then full vitest run passes.

**Step 4: Commit**

```bash
git add .husky/pre-push
git commit -m "chore: run typecheck and tests on pre-push"
```

---

## Task 12: End-to-end verification

**Files:** none.

**Step 1: Confirm pre-commit fires on a real commit**

Make a no-op change (e.g. add a trailing blank line to `README.md`), then:
```bash
git add README.md
git commit -m "test: verify pre-commit hook"
```
Expected: lint output appears, commit succeeds.

Then revert the no-op:
```bash
git revert --no-edit HEAD
```
(Or: leave it. The point is to confirm the hook runs.)

**Step 2: Confirm pre-push fires**

Run: `git push --dry-run`
Expected: hook runs typecheck + tests before the dry push reports its result.

**Step 3: Sanity-check that a failing lint blocks a commit**

Temporarily introduce a lint error (e.g. `const x = 1` with `no-unused-vars` in some file), `git add`, then `git commit -m "should fail"`. Expected: commit is rejected. Revert the lint error.

**Step 4: Sanity-check that a failing test blocks a push**

Temporarily flip an assertion in any test (e.g. change `expect(...).toBe(0)` to `.toBe(1)`), commit, then `git push --dry-run`. Expected: push is rejected. Revert the change.

**Step 5: No commit needed for this task** unless steps 1 / 3 / 4 left stray commits on the branch — clean those up before finishing.

---

## Done

When all tasks pass:
- 6 test files cover every pure function in `src/lib/` (except trivial `id.ts`/`storage.ts`) and every reducer action.
- `npm test`, `npm run lint`, `npm run typecheck` all green.
- `pre-commit` blocks lint failures.
- `pre-push` blocks typecheck or test failures.

If at any point a test goes red on its first run, **stop and report it** — that is a real bug in the production code, not a test problem.
