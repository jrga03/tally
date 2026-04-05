# Group Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side persistence with Cloudflare D1, email/passphrase auth, and poll-based sync so group members see each other's changes automatically.

**Architecture:** Cloudflare Worker serves both the static SPA and REST API routes under `/api/*`. D1 SQLite database stores all state. The React frontend uses a rewired `useReducer` with optimistic local updates + API calls. Polling every ~15 seconds keeps clients in sync.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), React 19, Mantine 8, bcryptjs (for passphrase hashing), jose (for JWT)

**Design doc:** `docs/plans/2026-04-05-group-sync-design.md`

---

### Task 1: Set Up D1 Database and Worker Entry Point

**Files:**
- Create: `src/server/db/schema.sql`
- Create: `src/server/index.ts`
- Modify: `wrangler.jsonc`
- Modify: `package.json`

**Step 1: Add server dependencies**

```bash
npm install bcryptjs jose
npm install -D @types/bcryptjs @cloudflare/workers-types
```

**Step 2: Create the D1 schema**

Create `src/server/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_by TEXT NOT NULL REFERENCES group_members(id),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  notes TEXT,
  exact_split_meta TEXT
);

CREATE TABLE IF NOT EXISTS splits (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES group_members(id),
  amount INTEGER NOT NULL,
  PRIMARY KEY (expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_member_id TEXT NOT NULL REFERENCES group_members(id),
  to_member_id TEXT NOT NULL REFERENCES group_members(id),
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  generated_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

**Step 3: Configure D1 in wrangler.jsonc**

Add to `wrangler.jsonc`:
```jsonc
{
  // ... existing config ...
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tally-db",
      "database_id": "<placeholder — fill after wrangler d1 create>"
    }
  ],
  "vars": {
    "JWT_SECRET": "change-me-in-production"
  }
}
```

**Step 4: Create the Worker entry point**

Create `src/server/index.ts` — a minimal router that delegates to `/api/*` handlers and falls through to the static SPA for everything else:

```ts
export interface Env {
  DB: D1Database
  JWT_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url)
    }

    // Fall through to static assets (handled by wrangler assets config)
    return new Response('Not found', { status: 404 })
  },
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  // Will be filled in subsequent tasks
  return new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

**Step 5: Create the D1 database**

```bash
npx wrangler d1 create tally-db
```

Copy the `database_id` from the output into `wrangler.jsonc`.

**Step 6: Apply the schema**

```bash
npx wrangler d1 execute tally-db --local --file=src/server/db/schema.sql
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: set up D1 database schema and worker entry point"
```

---

### Task 2: Auth — Registration and Login

**Files:**
- Create: `src/server/auth.ts`
- Create: `src/server/lib/jwt.ts`
- Create: `src/server/lib/password.ts`
- Create: `src/server/lib/id.ts`
- Modify: `src/server/index.ts`

**Step 1: Create server-side ID generator**

Create `src/server/lib/id.ts`:

```ts
import { nanoid } from 'nanoid'

export function generateId(): string {
  return nanoid(21)
}

export function generateInviteCode(): string {
  return nanoid(10)
}
```

**Step 2: Create password helpers**

Create `src/server/lib/password.ts`:

```ts
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

**Step 3: Create JWT helpers**

Create `src/server/lib/jwt.ts`:

```ts
import { SignJWT, jwtVerify } from 'jose'

interface TokenPayload {
  sub: string
  email: string
  name: string
}

export async function createAccessToken(payload: TokenPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(key)
}

export async function verifyAccessToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key)
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}
```

**Step 4: Create auth route handlers**

Create `src/server/auth.ts`:

```ts
import type { Env } from './index'
import { generateId } from './lib/id'
import { hashPassword, verifyPassword } from './lib/password'
import { createAccessToken } from './lib/jwt'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function generateRefreshToken(env: Env, userId: string): Promise<string> {
  const token = generateId() + generateId() // 42 chars of randomness
  const hash = await hashPassword(token) // hash it for storage
  const id = generateId()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, hash, expiresAt, now).run()

  return `${id}:${token}` // id:token format so we can look up by id
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email?: string; password?: string; name?: string }
  const { email, password, name } = body

  if (!email || !password || !name) {
    return json({ error: 'Email, password, and name are required' }, 400)
  }

  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first()
  if (existing) {
    return json({ error: 'Email already registered' }, 409)
  }

  const id = generateId()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email.toLowerCase(), passwordHash, name.trim(), now).run()

  const accessToken = await createAccessToken({ sub: id, email: email.toLowerCase(), name: name.trim() }, env.JWT_SECRET)
  const refreshToken = await generateRefreshToken(env, id)

  return json({ accessToken, refreshToken, user: { id, email: email.toLowerCase(), name: name.trim() } })
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email?: string; password?: string }
  const { email, password } = body

  if (!email || !password) {
    return json({ error: 'Email and password are required' }, 400)
  }

  const user = await env.DB.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first<{ id: string; email: string; password_hash: string; name: string }>()

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: 'Invalid email or password' }, 401)
  }

  const accessToken = await createAccessToken({ sub: user.id, email: user.email, name: user.name }, env.JWT_SECRET)
  const refreshToken = await generateRefreshToken(env, user.id)

  return json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } })
}

export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { refreshToken?: string }
  if (!body.refreshToken) return json({ error: 'Refresh token required' }, 400)

  const [tokenId, tokenValue] = body.refreshToken.split(':')
  if (!tokenId || !tokenValue) return json({ error: 'Invalid refresh token format' }, 400)

  const stored = await env.DB.prepare(
    'SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE id = ?'
  ).bind(tokenId).first<{ id: string; user_id: string; token_hash: string; expires_at: string }>()

  if (!stored) return json({ error: 'Invalid refresh token' }, 401)
  if (new Date(stored.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(tokenId).run()
    return json({ error: 'Refresh token expired' }, 401)
  }

  const valid = await verifyPassword(tokenValue, stored.token_hash)
  if (!valid) return json({ error: 'Invalid refresh token' }, 401)

  // Rotate: delete old, create new
  await env.DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(tokenId).run()

  const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(stored.user_id).first<{ id: string; email: string; name: string }>()
  if (!user) return json({ error: 'User not found' }, 401)

  const accessToken = await createAccessToken({ sub: user.id, email: user.email, name: user.name }, env.JWT_SECRET)
  const refreshToken = await generateRefreshToken(env, user.id)

  return json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } })
}
```

**Step 5: Wire auth routes into the router**

Update `src/server/index.ts` to route `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` to the handlers.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add auth endpoints — register, login, refresh"
```

---

### Task 3: Auth Middleware and User Helpers

**Files:**
- Create: `src/server/middleware.ts`
- Modify: `src/server/index.ts`

**Step 1: Create auth middleware**

Create `src/server/middleware.ts`:

```ts
import type { Env } from './index'
import { verifyAccessToken } from './lib/jwt'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export async function authenticate(request: Request, env: Env): Promise<AuthUser | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const payload = await verifyAccessToken(token, env.JWT_SECRET)
  if (!payload) return null
  return { id: payload.sub, email: payload.email, name: payload.name }
}
```

**Step 2: Create a helper in the router that rejects unauthenticated requests**

Update `src/server/index.ts` — for all `/api/*` routes except `/api/auth/*`, call `authenticate()` and return 401 if null.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add auth middleware for protected routes"
```

---

### Task 4: Group CRUD API

**Files:**
- Create: `src/server/routes/groups.ts`
- Modify: `src/server/index.ts`

**Step 1: Implement group routes**

Create `src/server/routes/groups.ts` with handlers for:

- `POST /api/groups` — create group with member slots, caller becomes owner
- `GET /api/groups` — list groups the authenticated user belongs to
- `GET /api/groups/:id` — get full group state (members, expenses with splits, settlements)
- `PUT /api/groups/:id` — update group name (owner only)
- `DELETE /api/groups/:id` — delete group (owner only)

Key details:
- When creating a group, also create the initial member slots (as `group_members` rows with `user_id = NULL` except the creator who is linked)
- The `GET /api/groups/:id` response should return the full group in a shape similar to the current `Group` type so the frontend can consume it with minimal changes
- All routes verify the authenticated user is a member of the group

**Step 2: Wire routes into the main router**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add group CRUD API endpoints"
```

---

### Task 5: Invite and Member Linking API

**Files:**
- Create: `src/server/routes/invites.ts`
- Create: `src/server/routes/members.ts`
- Modify: `src/server/index.ts`

**Step 1: Implement invite routes**

Create `src/server/routes/invites.ts`:

- `POST /api/groups/:id/invite` — regenerate invite code (owner only), returns new code
- `GET /api/invite/:code` — get group info for invite preview (group name, member names, which are unclaimed). No auth required.
- `POST /api/invite/:code` — join group. Auth required. Returns the group with member list so the user can pick a slot to claim.

**Step 2: Implement member linking routes**

Create `src/server/routes/members.ts`:

- `PUT /api/groups/:id/members/:mid` — link authenticated user to a member slot (`user_id` is set), or unlink (any member can unlink another for passphrase reset flow)
- `DELETE /api/groups/:id/members/:mid` — remove member (owner only)

**Step 3: Wire routes and commit**

```bash
git add -A && git commit -m "feat: add invite and member linking API endpoints"
```

---

### Task 6: Expense and Settlement API

**Files:**
- Create: `src/server/routes/expenses.ts`
- Create: `src/server/routes/settlements.ts`
- Modify: `src/server/index.ts`

**Step 1: Implement expense routes**

Create `src/server/routes/expenses.ts`:

- `POST /api/groups/:id/expenses` — create expense + splits (in a transaction)
- `PUT /api/groups/:id/expenses/:eid` — update expense + replace splits (in a transaction)
- `DELETE /api/groups/:id/expenses/:eid` — delete expense (cascades to splits)

Key: use `env.DB.batch()` for transactional inserts of expense + splits.

**Step 2: Implement settlement routes**

Create `src/server/routes/settlements.ts`:

- `POST /api/groups/:id/settlements` — create settlement
- `DELETE /api/groups/:id/settlements/:sid` — delete settlement

**Step 3: Wire routes and commit**

```bash
git add -A && git commit -m "feat: add expense and settlement API endpoints"
```

---

### Task 7: Sync Endpoint

**Files:**
- Create: `src/server/routes/sync.ts`
- Modify: `src/server/index.ts`

**Step 1: Implement the sync endpoint**

Create `src/server/routes/sync.ts`:

- `GET /api/groups/:id/sync?since=<ISO timestamp>` — returns:
  ```json
  {
    "expenses": [...],      // created or updated after `since`
    "settlements": [...],   // created or updated after `since`
    "members": [...],       // all current members (cheap, always included)
    "deletedExpenseIds": [...],   // IDs of expenses deleted after `since`
    "deletedSettlementIds": [...], // IDs of settlements deleted after `since`
    "serverTime": "..."     // use as next `since` value
  }
  ```

For tracking deletions, add a `deleted_records` table:

```sql
CREATE TABLE IF NOT EXISTS deleted_records (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  record_type TEXT NOT NULL,  -- 'expense' | 'settlement'
  record_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL
);
```

Add this to `schema.sql`. When an expense or settlement is deleted, insert a row here.

**Step 2: Wire route and commit**

```bash
git add -A && git commit -m "feat: add sync endpoint with delta updates"
```

---

### Task 8: Password Reset API

**Files:**
- Create: `src/server/routes/reset.ts`
- Modify: `src/server/index.ts`

**Step 1: Implement reset routes**

Create `src/server/routes/reset.ts`:

- `POST /api/auth/reset-request` — authenticated member generates a 6-digit code for a target email. Code is stored hashed in `password_reset_codes`, expires in 1 hour.
- `POST /api/auth/reset` — unauthenticated user provides email + code + new password. Server verifies the code, updates the password hash, invalidates all refresh tokens for that user, marks the code as used.

**Step 2: Wire routes and commit**

```bash
git add -A && git commit -m "feat: add passphrase reset via member-generated codes"
```

---

### Task 9: Frontend API Client

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/authStore.ts`

**Step 1: Create auth token store**

Create `src/lib/authStore.ts` — manages access token, refresh token, and user info in localStorage:

```ts
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string; name: string } | null
}

const STORAGE_KEY = 'tally_auth'

export function getAuth(): AuthState { /* read from localStorage */ }
export function setAuth(state: AuthState): void { /* write to localStorage */ }
export function clearAuth(): void { /* remove from localStorage */ }
export function isLoggedIn(): boolean { /* check if tokens exist */ }
```

**Step 2: Create API client**

Create `src/lib/api.ts` — a thin wrapper around `fetch` that:

- Adds `Authorization: Bearer <accessToken>` to all requests
- On 401, attempts to refresh using the refresh token
- On refresh success, retries the original request
- On refresh failure, clears auth and redirects to login
- Exports typed functions for each API endpoint:
  - `api.auth.register(email, password, name)`
  - `api.auth.login(email, password)`
  - `api.auth.logout()` (clears tokens)
  - `api.groups.list()`
  - `api.groups.get(id)`
  - `api.groups.create(name, memberNames)`
  - `api.groups.update(id, name)`
  - `api.groups.delete(id)`
  - `api.groups.sync(id, since)`
  - `api.invites.preview(code)`
  - `api.invites.join(code)`
  - `api.invites.regenerate(groupId)`
  - `api.members.link(groupId, memberId)`
  - `api.members.unlink(groupId, memberId)`
  - `api.expenses.create(groupId, data)`
  - `api.expenses.update(groupId, expenseId, data)`
  - `api.expenses.delete(groupId, expenseId)`
  - `api.settlements.create(groupId, data)`
  - `api.settlements.delete(groupId, settlementId)`

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add frontend API client with auto token refresh"
```

---

### Task 10: Auth Context and Protected Routes

**Files:**
- Create: `src/state/AuthContext.ts`
- Create: `src/state/authContext.tsx`
- Create: `src/state/useAuth.ts`
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/RegisterPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Step 1: Create auth context**

`AuthContext` provides: `user`, `login()`, `register()`, `logout()`, `isLoading`. On mount, checks localStorage for existing tokens and validates them.

**Step 2: Create Login and Register pages**

Simple forms using Mantine components. Login: email + passphrase. Register: email + passphrase + display name. Both redirect to `/` on success. Link between each other.

**Step 3: Add route protection to App.tsx**

Wrap routes in a guard: if not logged in, show `LoginPage`. If logged in, show the normal app routes. Add `/register` route.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add auth UI — login, register, protected routes"
```

---

### Task 11: Rewire State Management to API

**Files:**
- Modify: `src/state/context.tsx`
- Modify: `src/state/reducer.ts`
- Modify: `src/state/actions.ts`
- Modify: `src/state/AppContext.ts`
- Modify: `src/lib/storage.ts`

**Step 1: Update actions to include API-backed variants**

Add new action types:
- `SET_GROUPS` — replace all groups (from API fetch)
- `SET_GROUP` — replace a single group (from API fetch)
- `SYNC_GROUP` — merge delta updates from sync endpoint
- `REMOVE_GROUP` — remove a group from local state

**Step 2: Rewire AppProvider**

Update `src/state/context.tsx`:
- On mount, fetch groups from `api.groups.list()` instead of `loadGroups()`
- `dispatch` now calls the appropriate API endpoint alongside local state update (optimistic)
- On API failure, roll back by re-fetching from server
- localStorage becomes a write-through cache: still save on every change for faster initial render, but server is the source of truth

**Step 3: Keep undo/redo as client-only**

The undo/redo history operates on local state only, within the current session. No changes needed to the history mechanism.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: rewire state management to use API with optimistic updates"
```

---

### Task 12: Sync Polling Hook

**Files:**
- Create: `src/hooks/useSync.ts`
- Modify: `src/components/GroupLayout.tsx`

**Step 1: Create the sync hook**

Create `src/hooks/useSync.ts`:

```ts
import { useEffect, useRef } from 'react'

export function useSync(groupId: string, onSync: (data: SyncResponse) => void) {
  // Polls GET /api/groups/:id/sync?since=<lastSync> every 15 seconds
  // Pauses when document.visibilityState === 'hidden'
  // Resumes with immediate sync when page becomes visible
  // Cleanup: stops polling when unmounted or groupId changes
}
```

**Step 2: Wire into GroupLayout**

In `GroupLayout.tsx`, call `useSync(id, (data) => dispatch({ type: 'SYNC_GROUP', payload: data }))`. This means polling starts when entering a group and stops when leaving.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add sync polling with visibility-aware pause/resume"
```

---

### Task 13: Update Group Dashboard — Invite Link + Sync Indicator

**Files:**
- Modify: `src/pages/GroupDashboardPage.tsx`

**Step 1: Replace share button with invite button**

Replace the `copyShareUrl` call with `api.invites.regenerate()` or copy the existing invite link. Use `navigator.share` or clipboard, same UX pattern as before.

**Step 2: Add sync status indicator**

Show a subtle "Last synced: X seconds ago" or a small spinner during active sync. Place it below the group title.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: replace share with invite link, add sync indicator"
```

---

### Task 14: Update Home Page

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/components/CreateGroupModal.tsx`
- Remove: `src/components/ImportGroupModal.tsx`

**Step 1: Update HomePage**

- Remove the Import button and `ImportGroupModal`
- Groups now come from the API-backed state (already wired in Task 11)
- Add a loading skeleton while groups are being fetched

**Step 2: Update CreateGroupModal**

- `handleCreate` now calls `api.groups.create()` instead of dispatching locally
- IDs are generated server-side (21-char nanoids), so remove the local `generateId()` call for the group

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: update home page and create group to use API"
```

---

### Task 15: Update Expense and Settlement Pages

**Files:**
- Modify: `src/pages/AddExpensePage.tsx`
- Modify: `src/pages/EditExpensePage.tsx`
- Modify: `src/pages/SettleUpPage.tsx`
- Modify: `src/pages/ExpenseListPage.tsx`

**Step 1: Update AddExpensePage**

`handleSubmit` calls `api.expenses.create()` instead of local dispatch. Keep optimistic local dispatch for instant feedback.

**Step 2: Update EditExpensePage**

Same pattern — `api.expenses.update()`.

**Step 3: Update SettleUpPage**

`handleSubmit` calls `api.settlements.create()`.

**Step 4: Update ExpenseListPage**

Delete expense calls `api.expenses.delete()`.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: update expense and settlement pages to use API"
```

---

### Task 16: Invite Join Flow UI

**Files:**
- Create: `src/pages/InvitePage.tsx`
- Modify: `src/App.tsx`

**Step 1: Create InvitePage**

Route: `/invite/:code`

Flow:
1. Fetch group preview via `api.invites.preview(code)` — shows group name and member list
2. If not logged in, show login/register prompt (redirect back to invite after auth)
3. If logged in, show member list with unclaimed slots
4. User picks "I'm [name]" to claim a slot, or "I'm new" to create a new member
5. On selection, call `api.invites.join(code)` then `api.members.link(groupId, memberId)`
6. Redirect to `/group/:id`

**Step 2: Add route to App.tsx**

Add `<Route path="/invite/:code" element={<InvitePage />} />`.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add invite join flow with member slot claiming"
```

---

### Task 17: Account Page

**Files:**
- Create: `src/pages/AccountPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

**Step 1: Create AccountPage**

Route: `/account`

Shows: display name (editable), email (read-only), change passphrase form, logout button.

**Step 2: Add user menu to AppShell**

Replace or augment the header: add a user avatar/initial on the right side that links to `/account`. Show when logged in.

**Step 3: Add route to App.tsx**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add account page with profile and passphrase management"
```

---

### Task 18: Remove Legacy Sharing/Import Code

**Files:**
- Remove: `src/components/ImportHandler.tsx`
- Remove: `src/components/ImportGroupModal.tsx`
- Remove: `src/components/MergeConflictModal.tsx`
- Modify: `src/components/GroupLayout.tsx` — remove `<ImportHandler />`
- Modify: `src/lib/sharing.ts` — keep `compressGroup`/`decompressGroup` for migration, remove `buildShareUrl`/`copyShareUrl`

**Step 1: Remove components and clean up imports**

**Step 2: Commit**

```bash
git add -A && git commit -m "refactor: remove legacy URL-based sharing and merge conflict UI"
```

---

### Task 19: Migration Flow for Existing localStorage Users

**Files:**
- Create: `src/components/MigrationPrompt.tsx`
- Modify: `src/state/authContext.tsx`

**Step 1: Create MigrationPrompt**

Shown after login/register if `localStorage` contains `tally_groups` data:

1. Display: "You have X existing groups. Migrate them to your account?"
2. On confirm: for each group, call `api.groups.create()` with the group data. Server deduplicates by checking if a group with the same ID exists.
3. On success: clear `tally_groups` from localStorage
4. On dismiss: keep data but mark as read-only (set a `tally_migration_dismissed` flag)

**Step 2: Trigger migration check in auth context**

After successful login/register, check for localStorage data and show the prompt.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add one-time migration flow for localStorage users"
```

---

### Task 20: Password Reset UI

**Files:**
- Create: `src/pages/ResetPassphrasePage.tsx`
- Create: `src/components/GenerateResetCodeModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/LoginPage.tsx`

**Step 1: Create reset passphrase page**

Route: `/reset-passphrase`

Form: email + reset code + new passphrase. Calls `api.auth.reset()`.

**Step 2: Create generate reset code modal**

Accessible from within a group's member list (or a settings section). Any member can enter another member's email to generate a code. Shows the code to copy and share.

**Step 3: Add "Forgot passphrase?" link to login page**

Links to `/reset-passphrase` with instructions to ask a group member for a code.

**Step 4: Add routes and commit**

```bash
git add -A && git commit -m "feat: add passphrase reset UI"
```

---

### Task 21: End-to-End Testing and Polish

**Files:**
- Various

**Step 1: Manual test the full flow**

1. Register two accounts
2. Account A creates a group with member slots
3. Account A shares invite link
4. Account B opens invite, claims a slot
5. Account A adds an expense — verify it appears on Account B within 15 seconds
6. Account B adds a settlement — verify it appears on Account A
7. Test passphrase reset flow
8. Test migration flow (create localStorage data, register, migrate)

**Step 2: Fix any issues found**

**Step 3: Apply schema to production D1**

```bash
npx wrangler d1 execute tally-db --remote --file=src/server/db/schema.sql
```

**Step 4: Set JWT_SECRET as a Cloudflare secret**

```bash
npx wrangler secret put JWT_SECRET
```

**Step 5: Deploy**

```bash
npm run deploy
```

**Step 6: Final commit**

```bash
git add -A && git commit -m "feat: group sync — complete implementation"
```
