# Tally — Splitwise Clone Design

## Overview

Tally is a static, mobile-first web app for splitting expenses among groups of friends. No backend, no auth — everything runs in the browser using localStorage for persistence and compressed URL hashes for sharing state between users.

Currency: PHP (Philippine Peso) only, stored as centavos (integers).

## Data Model

```typescript
interface Group {
  id: string;           // nanoid, 8 chars
  name: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  createdAt: string;    // ISO date
}

interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;       // in centavos
  paidBy: string;       // member ID
  splits: Split[];      // only includes involved members
  date: string;         // ISO date
  createdAt: string;
}

interface Split {
  memberId: string;
  amount: number;       // in centavos
}

interface Settlement {
  id: string;
  fromMemberId: string; // who paid
  toMemberId: string;   // who received
  amount: number;       // in centavos
  date: string;
  createdAt: string;
}
```

Split types are derived from how the UI populates the `splits` array:
- **Equal** — divide evenly across selected members
- **Exact amounts** — user enters each person's share
- **Percentage** — user enters percentages, converted to amounts

## Pages & Navigation

| Route | View | Purpose |
|---|---|---|
| `/` | Home | List of groups + "Create Group" button |
| `/group/:id` | Group Dashboard | Members, balances, who owes whom |
| `/group/:id/expenses` | Expense List | All expenses & settlements chronologically |
| `/group/:id/add-expense` | Add Expense | Form: description, amount, paid by, split method |
| `/group/:id/settle` | Settle Up | Pick two members, enter amount, record payment |

Navigation: bottom tab bar on group views (Dashboard / Expenses / Add). "Settle Up" accessed from Dashboard via button next to each balance.

## State Management & Storage

### localStorage

```
tally_groups → { [groupId]: Group }
```

### Reducer actions

- `CREATE_GROUP`, `DELETE_GROUP`
- `ADD_MEMBER`, `REMOVE_MEMBER`
- `ADD_EXPENSE`, `EDIT_EXPENSE`, `DELETE_EXPENSE`
- `ADD_SETTLEMENT`, `DELETE_SETTLEMENT`
- `IMPORT_GROUP` (from URL, triggers overwrite prompt)

### Undo/Redo

History stack wrapping the reducer, per session (not persisted or shared):

```typescript
interface History {
  past: Group[];      // previous states
  present: Group;     // current state
  future: Group[];    // undone states
}
```

- Every action pushes current state onto `past`, clears `future`
- Undo: pop `past` into `present`, push old `present` onto `future`
- Redo: pop `future` into `present`, push old `present` onto `past`
- Capped at 50 entries
- UI: undo/redo buttons in top nav bar

## URL Sharing

### Share flow

1. `JSON.stringify` the group
2. Compress with pako (zlib)
3. Base64url-encode
4. Append as URL hash: `/group/:id#eJzLyS8q...`
5. Copy to clipboard / native share sheet

### Import flow

1. Detect hash on route load
2. Decode base64url → decompress with pako → parse JSON
3. Check if group ID exists in localStorage
4. If exists → prompt: "You already have this group. Replace with the shared version?"
5. Save to localStorage, strip hash, redirect to `/group/:id`

## Balance Calculation & Debt Simplification

### Balance calculation

For each group, iterate expenses and settlements to compute net balances:

1. For each expense: payer is owed their share by each split member
2. For each settlement: reduce debt between the two members
3. Result: `Map<memberId, number>` of net balances (positive = owed, negative = owes)

### Debt simplification (greedy algorithm)

1. Collect positive balances (creditors) and negative balances (debtors)
2. Sort both descending by amount
3. Match largest debtor with largest creditor
4. Settle by the smaller amount, reduce both, repeat
5. Result: minimal list of "Person A pays Person B X"

### Member exclusion

Members not selected in an expense's split are excluded from that calculation entirely. The Add Expense form has member checkboxes (all checked by default).

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | react-router-dom |
| UI library | Mantine |
| State | React Context + useReducer with undo/redo history |
| Persistence | localStorage |
| Sharing | pako + base64url in URL hash |
| IDs | nanoid (8 chars) |
| Currency | PHP only, centavos (integers) |
| Deployment | Static site (Vercel, Netlify, GitHub Pages, etc.) |
