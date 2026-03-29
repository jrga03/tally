# Tally

A mobile-first expense splitting app (Splitwise clone) built as a static PWA. Create groups, split expenses, track balances, and share via compressed URLs — all without a backend.

## Features

- **Groups** — Create groups with multiple members
- **Expense splitting** — Equal, exact amount, or percentage-based splits (with shared-by-all and sub-group shared splits in exact mode)
- **Balance tracking** — Per-member balances with greedy debt simplification
- **Settlements** — Record payments between members to settle debts
- **URL sharing** — Share groups via pako-compressed URL hashes (no server needed)
- **Smart merging** — Union merge when importing shared groups, with conflict resolution for divergent edits
- **Undo/Redo** — Full history stack for all actions
- **Dark mode** — Toggle between light and dark themes
- **Notes** — Optional notes on expenses
- **Offline support** — PWA with service worker for offline use
- **iOS/Android installable** — Add to home screen as a standalone app

## Tech Stack

- React 19 + TypeScript 5.9
- Vite 8 (with React Compiler)
- Mantine 8 (UI components)
- react-router-dom 7
- pako (compression for URL sharing)
- nanoid (ID generation)
- vite-plugin-pwa (service worker + manifest)

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/       # Shared UI components
│   ├── AppShell.tsx          # Top-level layout with header + undo/redo
│   ├── CreateGroupModal.tsx  # Modal for creating new groups
│   ├── ExpenseForm.tsx       # Expense form with split modes + sub-group modal
│   ├── GroupLayout.tsx       # Group view layout with bottom tabs
│   ├── ImportHandler.tsx     # URL hash import with union merge
│   └── MergeConflictModal.tsx # Conflict resolution UI for divergent edits
├── lib/              # Utilities
│   ├── balance.ts            # Balance calculation + debt simplification
│   ├── merge.ts              # Union merge logic for shared groups
│   ├── format.ts             # Currency formatting (PHP centavos)
│   ├── id.ts                 # nanoid wrapper
│   ├── sharing.ts            # Pako compress/decompress + URL building
│   ├── splitEqual.ts         # Equal split with fair remainder distribution
│   └── storage.ts            # localStorage persistence
├── pages/            # Route pages
│   ├── AddExpensePage.tsx     # Add expense with split options
│   ├── EditExpensePage.tsx    # Edit existing expense
│   ├── ExpenseListPage.tsx    # Chronological expense/settlement list
│   ├── GroupDashboardPage.tsx # Balances + simplified debts
│   ├── HomePage.tsx           # Group list + create
│   └── SettleUpPage.tsx       # Record settlements
├── state/            # State management
│   ├── actions.ts            # Action type definitions
│   ├── AppContext.ts         # Context type definition
│   ├── context.tsx           # React Context + AppProvider
│   ├── history.ts            # Undo/redo history stack
│   ├── reducer.ts            # App state reducer
│   └── useApp.ts             # Custom hook for accessing context
├── types.ts          # Shared TypeScript interfaces
├── App.tsx           # Route definitions
└── main.tsx          # Entry point with providers
```

## Data Model

All amounts are stored in **centavos** (integer) to avoid floating-point issues. The UI converts to/from pesos for display and input.

- **Group** — contains members, expenses, and settlements
- **Expense** — amount paid by one member, split among selected members
- **ExactSplitMeta** — metadata for exact splits: individual amounts, shared-by-all amount, and sub-group shared amounts
- **Settlement** — direct payment from one member to another
- **Split** — how much each member owes for an expense

## How Sharing Works

1. Group data is JSON-serialized and compressed with pako (deflate)
2. Compressed bytes are base64url-encoded into the URL hash
3. Recipients opening the URL get a smart union merge:
   - **New group** — imported directly
   - **Existing group, no conflicts** — silently merged (additions from both sides combined)
   - **Existing group, conflicts** — a conflict resolution modal lets the user pick "Mine" or "Theirs" per item

No server is involved — the entire group state travels in the URL.
