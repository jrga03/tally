# Delete Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a UI for deleting groups from the home page, with a confirmation modal and an undo toast.

**Architecture:** State support already exists (`DELETE_GROUP` is already wired in `actions.ts` and `reducer.ts`). This plan adds (1) a new `DeleteGroupModal` component, (2) a trailing `IconDots` menu on each home-page group card that opens the modal, and (3) a Mantine `notifications` toast with an Undo button that calls the existing `undo()` from `useApp()` (since `DELETE_GROUP` already flows through the history stack).

**Tech Stack:** React 19, TypeScript, Mantine 8 (`@mantine/core`, `@mantine/notifications`), `@tabler/icons-react`. No test framework in this project — verification is manual via `npm run dev`.

**Design doc:** `docs/plans/2026-05-05-delete-groups-design.md`

---

## Context for Implementer

**App layout you'll touch:**
- `src/pages/HomePage.tsx` — lists groups; each is a `<Card>` you can tap to navigate. Has `CreateGroupModal` and `ImportGroupModal` mounted at the bottom — follow the same pattern for `DeleteGroupModal`.
- `src/components/CreateGroupModal.tsx` — reference for modal style (`opened`, `onClose`, `dispatch` from `useApp()`).
- `src/state/useApp.ts` exposes `{ state, dispatch, undo, redo, canUndo, canRedo }`. Both `dispatch` and `undo` are needed.
- `src/state/actions.ts:5` defines `DELETE_GROUP` (no changes needed).
- `src/state/reducer.ts:13` handles `DELETE_GROUP` (no changes needed).

**Mantine notifications:**
- Globally mounted in `src/main.tsx:48` at `position="top-center"`.
- Pattern reference in `src/components/ReloadPrompt.tsx:35` and `src/components/ExpenseForm.tsx:263`.
- `notifications.show()` returns an id string that we'll use to dismiss the toast when Undo is clicked.

**Conventions to follow:**
- All amounts are stored in centavos (not used here, but don't be surprised reading nearby code).
- Per `CLAUDE.md` user instructions: never include a `Co-Authored-By` line in commit messages.

---

## Task 1: Add deletion with confirmation modal

Build the `DeleteGroupModal` component and wire it into the home page via a `IconDots` menu on each group card. Stops here — no toast yet.

**Files:**
- Create: `src/components/DeleteGroupModal.tsx`
- Modify: `src/pages/HomePage.tsx`

### Step 1: Create the DeleteGroupModal component

Create `src/components/DeleteGroupModal.tsx`:

```tsx
import { Modal, Button, Group, Stack, Text } from '@mantine/core'
import { useApp } from '../state/useApp'
import type { Group as GroupType } from '../types'

interface Props {
  group: GroupType | null
  onClose: () => void
}

export function DeleteGroupModal({ group, onClose }: Props) {
  const { dispatch } = useApp()

  const handleDelete = () => {
    if (!group) return
    dispatch({ type: 'DELETE_GROUP', payload: { groupId: group.id } })
    onClose()
  }

  return (
    <Modal opened={group !== null} onClose={onClose} title={group ? `Delete '${group.name}'?` : ''}>
      {group && (
        <Stack>
          <Text size="sm">
            {group.expenses.length} expenses, {group.settlements.length} settlements, and{' '}
            {group.members.length} members will be permanently deleted.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={onClose}>Cancel</Button>
            <Button color="red" onClick={handleDelete}>Delete</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
```

Note: `opened` is derived from `group !== null` so the parent only manages one piece of state.

### Step 2: Wire the menu and modal into HomePage

Modify `src/pages/HomePage.tsx`. Replace the entire file with:

```tsx
import { Container, Title, Text, Button, Card, Stack, Group, Menu, ActionIcon } from '@mantine/core'
import { IconDownload, IconPlus, IconDots, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { CreateGroupModal } from '../components/CreateGroupModal'
import { ImportGroupModal } from '../components/ImportGroupModal'
import { DeleteGroupModal } from '../components/DeleteGroupModal'
import type { Group as GroupType } from '../types'

export function HomePage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [createOpened, setCreateOpened] = useState(false)
  const [importOpened, setImportOpened] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<GroupType | null>(null)
  const groups = Object.values(state)

  return (
    <Container size="xs" py="md" pb={80}>
      <Group justify="space-between" mb="md">
        <Title order={2}>Your Groups</Title>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => setImportOpened(true)}>
            Import
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
            New
          </Button>
        </Group>
      </Group>

      {groups.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No groups yet. Create one to get started!
        </Text>
      ) : (
        <Stack>
          {groups.map(group => (
            <Card key={group.id} withBorder onClick={() => navigate(`/group/${group.id}`)} style={{ cursor: 'pointer' }}>
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={600}>{group.name}</Text>
                  <Text size="sm" c="dimmed">
                    {group.members.length} members · {group.expenses.length} expenses
                  </Text>
                </div>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={e => e.stopPropagation()}
                      aria-label="Group actions"
                    >
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown onClick={e => e.stopPropagation()}>
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={e => {
                        e.stopPropagation()
                        setGroupToDelete(group)
                      }}
                    >
                      Delete group
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <CreateGroupModal opened={createOpened} onClose={() => setCreateOpened(false)} />
      <ImportGroupModal opened={importOpened} onClose={() => setImportOpened(false)} />
      <DeleteGroupModal group={groupToDelete} onClose={() => setGroupToDelete(null)} />
    </Container>
  )
}
```

Key changes vs. the original:
- New imports: `Menu`, `ActionIcon`, `IconDots`, `IconTrash`, `DeleteGroupModal`, `Group as GroupType`.
- Card body wrapped in a `<Group justify="space-between" wrap="nowrap">` so the menu sits at the right edge.
- `stopPropagation` is on the `ActionIcon`, the `Menu.Dropdown`, and the `Menu.Item` to prevent the card's click from firing.
- `withinPortal` on the menu so the dropdown isn't clipped by the card.

### Step 3: Verify in the browser

Run: `npm run dev`

Manual checks (open the dev server URL):
1. Each group card now shows a ⋯ icon on the right.
2. Tapping ⋯ does **not** navigate into the group — the menu opens.
3. The menu shows a single red "Delete group" item.
4. Clicking "Delete group" opens the confirmation modal with the title `Delete '<name>'?` and the counts line.
5. Clicking **Cancel** closes the modal; the group remains.
6. Clicking the red **Delete** button removes the group from the list.
7. Refresh the page → deleted group stays gone (localStorage was updated).
8. Repeat in dark mode (sun/moon toggle in header) → modal and menu styling look correct.

If anything is off, fix it before committing.

### Step 4: Type-check and lint

Run: `npm run build`
Expected: clean build, no TypeScript errors.

Run: `npm run lint`
Expected: no new lint errors.

### Step 5: Commit

```bash
git add src/components/DeleteGroupModal.tsx src/pages/HomePage.tsx
git commit -m "feat: allow deleting groups from home page"
```

---

## Task 2: Add undo toast after deletion

Show a Mantine notification with an Undo button after a successful deletion. Tapping Undo calls the existing `undo()` from `useApp()`, which restores the group via the existing history stack.

**Files:**
- Modify: `src/components/DeleteGroupModal.tsx`

### Step 1: Update DeleteGroupModal to fire the undo toast

Replace the contents of `src/components/DeleteGroupModal.tsx` with:

```tsx
import { Modal, Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useApp } from '../state/useApp'
import type { Group as GroupType } from '../types'

interface Props {
  group: GroupType | null
  onClose: () => void
}

export function DeleteGroupModal({ group, onClose }: Props) {
  const { dispatch, undo } = useApp()

  const handleDelete = () => {
    if (!group) return
    const deletedName = group.name
    dispatch({ type: 'DELETE_GROUP', payload: { groupId: group.id } })
    onClose()

    const id = notifications.show({
      message: (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm">Group '{deletedName}' deleted</Text>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => {
              undo()
              notifications.hide(id)
            }}
          >
            Undo
          </Button>
        </Group>
      ),
      autoClose: 5000,
    })
  }

  return (
    <Modal opened={group !== null} onClose={onClose} title={group ? `Delete '${group.name}'?` : ''}>
      {group && (
        <Stack>
          <Text size="sm">
            {group.expenses.length} expenses, {group.settlements.length} settlements, and{' '}
            {group.members.length} members will be permanently deleted.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={onClose}>Cancel</Button>
            <Button color="red" onClick={handleDelete}>Delete</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
```

Notes:
- `deletedName` is captured **before** `onClose()` so the toast text doesn't depend on `group` still being set.
- The `id` self-reference inside the `onClick` works because the closure runs later — `id` is assigned by then. Standard Mantine pattern.
- `size="compact-xs"` gives the Undo button a tight footprint that fits on a phone-width toast.

### Step 2: Verify in the browser

Run (or keep running): `npm run dev`

Manual checks:
1. Delete a group → modal closes, toast appears at the top with the message and an **Undo** button.
2. Tap **Undo** → group reappears in the list, toast dismisses immediately.
3. Delete another group, do nothing → after ~5 seconds the toast auto-closes; group stays deleted.
4. Verify toast in dark mode looks correct.
5. Edge: delete a group, then before the toast expires, tap **Undo** → group restored. Refresh page → group is still there.

### Step 3: Type-check and lint

Run: `npm run build`
Expected: clean build.

Run: `npm run lint`
Expected: no new lint errors.

### Step 4: Commit

```bash
git add src/components/DeleteGroupModal.tsx
git commit -m "feat: add undo toast for group deletion"
```

---

## Final Verification Sweep

After both tasks are committed, run through this once more end-to-end:

- [ ] Create a fresh test group with a few expenses and settlements.
- [ ] Delete it via ⋯ menu → counts in modal match what you added.
- [ ] Click Cancel → group still there.
- [ ] Click Delete → group gone, toast appears.
- [ ] Click Undo → group back with all data intact (open it and confirm expenses + balances).
- [ ] Delete again, let toast expire → refresh → group really gone (localStorage).
- [ ] Tap ⋯ on a group card → does not open the group.
- [ ] Dark mode pass: menu, modal, toast.
- [ ] On a phone-width window (or device emulator): the ⋯ button, modal buttons, and toast Undo button all remain tappable and unclipped.

If anything fails, fix it as a follow-up commit.
