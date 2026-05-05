# Tests and Git Hooks — Design

**Date:** 2026-05-05

## Goal

Establish a unit-test suite for Tally's pure logic and wire up git hooks so lint runs on every commit and typecheck + tests run on every push.

## Scope

- **In scope:** unit tests for pure functions in `src/lib/` and the reducer in `src/state/reducer.ts`. Pre-commit hook running lint. Pre-push hook running typecheck + tests.
- **Out of scope:** component tests, page tests, E2E/browser tests, CI configuration, coverage thresholds.

## Decisions

### Test framework: Vitest

Vitest is the de-facto choice for Vite projects. It reuses `vite.config.ts`, runs TypeScript out of the box, has a Jest-compatible API, and needs no extra Babel/SWC configuration. Jest would require additional setup to handle ESM + TS in this stack, and `node --test` lacks the ergonomics for the kind of assertion-heavy tests we'll write.

### Hook scope

- **Pre-commit: lint only.** Runs `npm run lint` on the whole project. Eslint is fast (~1s) on this codebase, and `lint-staged` is unnecessary at this size.
- **Pre-push: typecheck + tests.** Both need a full TypeScript pass anyway, so they bundle naturally. Push is the right gate for slower checks; commits stay snappy.
- The existing `.husky/pre-commit` (which currently runs `npx tsc -b`) is replaced — typecheck moves to pre-push.

### Test target list

Tests focus on observable behavior, not implementation details.

- `src/lib/balance.test.ts` — covers `calculateBalances`, `computeRawDebts`, `simplifyDebts`, `getBalanceEntries`. The most critical file: any regression here means wrong money.
- `src/lib/splitEqual.test.ts` — penny-rounding edge cases for equal splits.
- `src/lib/sharing.test.ts` — `encode → decode` round-trip for pako-compressed group URLs.
- `src/lib/merge.test.ts` — union merge of disjoint groups, conflict detection on divergent edits, deterministic resolution.
- `src/lib/format.test.ts` — currency / amount formatting.
- `src/state/reducer.test.ts` — one block per action: ADD_EXPENSE, EDIT_EXPENSE, DELETE_EXPENSE, settlement actions, group create/delete.

Excluded: `storage.ts` (thin localStorage wrapper), `id.ts` (nanoid wrapper), `state/history.ts` (low-risk; revisit if it ever has bugs), and all components/pages.

## Setup details

Add Vitest as a devDependency. Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Tests live next to source as `*.test.ts`. No new Vitest config file — Vite config is auto-discovered.

`.husky/pre-commit` becomes:

```sh
npm run lint
```

`.husky/pre-push` is created with:

```sh
npm run typecheck
npm run test
```

## Risks

- **React Compiler:** `babel-plugin-react-compiler` runs through Vite. Pure-logic tests do not import React, so the compiler does not run on them — no interaction.
- **Mantine / jsdom:** none of the test targets import Mantine or touch the DOM. No jsdom environment, no CSS mocking needed.
- **Husky install:** `npm run prepare` (already wired in `package.json`) installs hooks and sets executable bits on hook files.

## Future work (not in this change)

- GitHub Actions CI running the same commands.
- Component / page tests with `@testing-library/react`.
- Playwright E2E tests for the install + share-via-URL flows.
- Coverage reporting and thresholds.
