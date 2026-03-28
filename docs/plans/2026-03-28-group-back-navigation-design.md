# Group Back Navigation Design

## Problem

When inside a group view, there is no UI to navigate back to the group list. Users must rely on the browser back button.

## Solution

Modify `AppShell.tsx` to add back navigation when inside a group:

1. **Back arrow icon** (`IconArrowLeft`) — appears before the "Tally" title only when inside a group (`id` exists in params). Navigates to `/`.
2. **Clickable "Tally" title** — wrapped in a Link to `/`, always clickable. Styled as plain text (no underline/color change) to keep current look.

## Visual

Inside a group:
```
[←] Tally          [theme] [undo] [redo]
```

On home page:
```
Tally [theme]
```

## Scope

- Single file change: `src/components/AppShell.tsx`
- Add `IconArrowLeft` import from `@tabler/icons-react`
- Use `useNavigate` or `Link` from `react-router-dom` for navigation
