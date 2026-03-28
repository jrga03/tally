# Dark/Light Mode Toggle

## Summary

Add an in-app toggle for switching between dark and light mode, placed in the AppShell header bar next to the undo/redo buttons.

## Approach

Use Mantine's built-in `useMantineColorScheme()` hook. It provides `colorScheme`, `setColorScheme`, and `toggleColorScheme()` with automatic localStorage persistence.

## UI

- `ActionIcon` in the AppShell header
- Shows `IconSun` in dark mode (click to go light)
- Shows `IconMoon` in light mode (click to go dark)

## Behavior

- Two states: light and dark (no auto/system option)
- Preference persisted to localStorage automatically by Mantine
- Survives refreshes and revisits

## Files Changed

- `src/components/AppShell.tsx` — add toggle button using `useMantineColorScheme` hook
