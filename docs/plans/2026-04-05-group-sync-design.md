# Group Sync Design

## Overview

Add server-side persistence and real-time sync so group members can see each other's changes without manually sharing URLs. Built on Cloudflare Workers + D1 (SQLite at the edge), with simple email/passphrase auth for accountability.

## Stack

- **Backend**: Cloudflare Workers (existing wrangler setup)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React SPA with Mantine (unchanged)
- **Auth**: Email/passphrase with JWT access tokens + refresh tokens

## Database Schema

```sql
users
  id              TEXT PRIMARY KEY          -- 21-char nanoid
  email           TEXT UNIQUE NOT NULL
  password_hash   TEXT NOT NULL
  name            TEXT NOT NULL
  created_at      TEXT NOT NULL             -- ISO 8601

refresh_tokens
  id              TEXT PRIMARY KEY          -- 21-char nanoid
  user_id         TEXT REFERENCES users(id)
  token_hash      TEXT NOT NULL
  expires_at      TEXT NOT NULL
  created_at      TEXT NOT NULL

groups
  id              TEXT PRIMARY KEY          -- 21-char nanoid
  name            TEXT NOT NULL
  invite_code     TEXT UNIQUE NOT NULL      -- short random string, reusable
  created_at      TEXT NOT NULL

group_members
  group_id        TEXT REFERENCES groups(id)
  user_id         TEXT REFERENCES users(id) -- nullable: unlinked slots have no user
  name            TEXT NOT NULL             -- display name (set by creator, updatable)
  role            TEXT DEFAULT 'member'     -- 'owner' | 'member'
  joined_at       TEXT NOT NULL
  PRIMARY KEY (group_id, user_id)

expenses
  id              TEXT PRIMARY KEY          -- 21-char nanoid
  group_id        TEXT REFERENCES groups(id)
  description     TEXT NOT NULL
  amount          INTEGER NOT NULL          -- centavos
  paid_by         TEXT NOT NULL             -- group_members reference
  date            TEXT NOT NULL
  created_at      TEXT NOT NULL
  updated_at      TEXT NOT NULL
  notes           TEXT
  exact_split_meta TEXT                     -- JSON blob, nullable

splits
  expense_id      TEXT REFERENCES expenses(id)
  member_id       TEXT NOT NULL             -- group_members reference
  amount          INTEGER NOT NULL          -- centavos
  PRIMARY KEY (expense_id, member_id)

settlements
  id              TEXT PRIMARY KEY          -- 21-char nanoid
  group_id        TEXT REFERENCES groups(id)
  from_member_id  TEXT NOT NULL
  to_member_id    TEXT NOT NULL
  amount          INTEGER NOT NULL          -- centavos
  date            TEXT NOT NULL
  created_at      TEXT NOT NULL
  updated_at      TEXT NOT NULL
```

All IDs are 21-character nanoids. Amounts stored as integers (centavos) to avoid floating-point issues.

## Auth

### Registration
1. User submits email + passphrase + display name
2. Worker hashes passphrase with bcrypt, inserts into `users`
3. Returns JWT access token (15-min expiry) + refresh token (30-day expiry)

### Login
1. User submits email + passphrase
2. Worker verifies hash, returns token pair

### Token Refresh
- `POST /api/auth/refresh` accepts a refresh token
- Returns a new access + refresh token pair (rotation: old refresh token is invalidated)
- Client stores both tokens in localStorage
- Client auto-refreshes when a request gets a 401

### Passphrase Reset
- No email service required
- Any group member can generate a one-time reset code for another member's email
- The locked-out user enters the code and sets a new passphrase
- Reset codes expire after a set time

## API Routes

```
Auth
  POST   /api/auth/register          -- create account
  POST   /api/auth/login             -- get tokens
  POST   /api/auth/refresh           -- rotate tokens
  POST   /api/auth/reset-request     -- generate reset code (by a group member)
  POST   /api/auth/reset             -- set new passphrase with reset code

Groups
  POST   /api/groups                 -- create group
  GET    /api/groups                 -- list my groups
  GET    /api/groups/:id             -- get full group state
  PUT    /api/groups/:id             -- update group name
  DELETE /api/groups/:id             -- delete group (owner only)

Invites
  POST   /api/groups/:id/invite      -- regenerate invite code (owner only)
  GET    /api/invite/:code           -- get group info for invite preview
  POST   /api/invite/:code           -- join group via invite code

Members
  PUT    /api/groups/:id/members/:mid    -- link/unlink account to member slot
  DELETE /api/groups/:id/members/:mid    -- remove member (owner only)

Expenses
  POST   /api/groups/:id/expenses            -- add expense
  PUT    /api/groups/:id/expenses/:eid       -- edit expense
  DELETE /api/groups/:id/expenses/:eid       -- delete expense

Settlements
  POST   /api/groups/:id/settlements         -- add settlement
  DELETE /api/groups/:id/settlements/:sid    -- delete settlement

Sync
  GET    /api/groups/:id/sync?since=<ts>     -- get changes since timestamp
```

All routes except auth require a valid access token. All group routes verify the user is a member.

## Sync Mechanism

### Polling
- Client polls `GET /api/groups/:id/sync?since=<timestamp>` every ~15 seconds
- Server returns expenses and settlements created or updated after the timestamp
- Client merges changes into local state

### Polling Lifecycle
- Polling runs only while the user is on a group route (`/group/:id`)
- Polling pauses when the page is hidden (via `document.visibilitychange`)
- Polling resumes immediately when the page becomes visible again (with an instant sync to catch up)
- Navigating away from the group stops polling

### Optimistic Updates
- User actions dispatch locally for instant UI feedback
- Simultaneously POST to the API
- On API failure, roll back the local state

## Group Flow

### Creating a Group
1. Logged-in user creates a group, becomes owner
2. Adds member slots with names (placeholder names, not yet linked to accounts)
3. Gets a reusable invite link to share

### Joining a Group
1. Someone opens the invite link (`/invite/{code}`)
2. If not logged in, prompted to register or login
3. After auth, they see the list of unlinked member names
4. They either claim an existing slot or choose "I'm new" to create a new slot
5. Their account is linked to the chosen member slot

### Invite Codes
- One active invite code per group, reusable
- Owner can regenerate to invalidate the old code
- No expiry — valid until regenerated

### Ownership
- Group creator is owner
- If owner leaves, earliest-joined member is auto-promoted
- Deleted accounts revert to unlinked member slots (name preserved, balances intact)

## UI Changes

### New Screens
- **Login/Register page** — email, passphrase, display name (register only). Shown when unauthenticated.
- **Account page** — view/edit display name, change passphrase, logout. Accessible from app header.

### Modified Screens
- **Home page** — fetches groups from API instead of localStorage. Loading state while fetching.
- **Group dashboard** — source of truth is the server. Sync status indicator (last synced / syncing spinner). Invite button replaces share-via-URL button.
- **Add/Edit expense** — member selectors use real user display names from group membership. Form submits to API.
- **Settle up page** — same as above, real users instead of local member IDs.

### Removed Flows
- **Share via URL hash** — replaced by invite links
- **Import handler** — no longer needed (server is source of truth)
- **Merge conflict modal** — no longer needed (no local/incoming conflicts)

### State Management
- `useReducer` pattern stays, rewired to fetch from API on load
- Optimistic local dispatch + API call on user actions
- localStorage becomes a cache for faster initial render (show stale data, then refresh from server)
- Undo/redo stays as a client-only session feature

## Migration (Existing localStorage Users)

1. On first load after update, app detects localStorage data with no auth session
2. Prompts: "You have existing groups. Sign up to migrate them to your account."
3. After registration, client POSTs each local group to the API
4. Server deduplicates by group ID — if group already exists (another member migrated first), merges using union-by-ID logic for expenses and settlements
5. Migrating user is added to `group_members` and prompted to claim a member slot
6. On success, localStorage is cleared
7. If dismissed, localStorage data is kept read-only (viewable but no new actions without an account)
