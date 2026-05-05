# Delete Groups

Add a UI for deleting groups from the home page, with a confirmation modal and an undo toast.

## Background

The state layer already supports deletion: `DELETE_GROUP` is defined in `actions.ts` and handled in `reducer.ts`. No UI dispatches it. This design adds the trigger only.

The in-app undo/redo buttons (`AppShell.tsx`) are gated to render only inside a group, so a user deleting from the home page has no visible undo path. The toast covers that gap by calling `undo()` from `useApp()` directly.

## User Flow

1. On the home page, each group card has a trailing `IconDots` menu button.
2. Tap → Mantine `<Menu>` opens with one item: **Delete group** (red, `IconTrash`).
3. Tap Delete → confirmation modal:
   - Title: `Delete '<group name>'?`
   - Body: `<X> expenses, <Y> settlements, and <Z> members will be permanently deleted.`
   - Buttons: `Cancel` and a destructive `Delete`.
4. Confirm → dispatch `DELETE_GROUP` → modal closes → toast: `Group '<name>' deleted` with an **Undo** action button (autoClose ~5s).
5. Tap Undo in toast → call `undo()` from `useApp()` → group reappears, toast dismisses.

## Architecture

### New: `src/components/DeleteGroupModal.tsx`

Props: `{ group: Group | null; onClose: () => void }` (open state derived from `group !== null`).

Responsibilities:
- Render the confirmation modal (Mantine `<Modal>`).
- Compute and display the counts from `group.expenses.length`, `group.settlements.length`, `group.members.length`.
- On confirm: dispatch `DELETE_GROUP`, close modal, fire the undo toast.

### Modified: `src/pages/HomePage.tsx`

- New state: `const [groupToDelete, setGroupToDelete] = useState<Group | null>(null)`.
- Each group card gets a trailing `<Menu>` with an `ActionIcon` trigger (`IconDots`). The menu item sets `groupToDelete` to that group.
- The `ActionIcon` uses `stopPropagation` on click so the card's navigate-to-group does not fire.
- Render `<DeleteGroupModal group={groupToDelete} onClose={() => setGroupToDelete(null)} />` once at the bottom.

### Toast with Undo

Uses `notifications.show` from `@mantine/notifications` (already wired in `main.tsx`). The notification's `message` includes a Mantine `<Button variant="subtle">` calling `undo()` and `notifications.hide(id)`.

## Why DELETE_GROUP through the existing history works

Every reducer action already pushes onto the history stack via `history.ts`. Calling `undo()` after a `DELETE_GROUP` restores the previous state, which contains the group. No new state-layer code needed.

## Error Handling

None required. The `groupId` comes from a group object we already hold, the reducer is pure, and missing-group is impossible by construction.

## Known Limitation (Accepted)

If the user dispatches another action between deleting and tapping Undo, `undo()` reverts that intermediate action too. This matches existing undo behavior throughout the app and is not a regression.

## Testing Plan (Manual)

No test suite in the project — verify in dev server.

- Delete a group with expenses, settlements, and members → counts in modal are correct, group disappears, toast appears.
- Tap **Undo** in the toast → group reappears with all expenses/settlements/members intact.
- Tap ⋯ on a card → card does not navigate.
- Cancel from modal → no state change.
- Let toast auto-dismiss → group stays deleted; refresh the page → still gone (localStorage).
- Dark mode → modal and toast styling look correct.
