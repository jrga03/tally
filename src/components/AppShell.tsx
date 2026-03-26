import { AppShell as MantineAppShell, Group, Title, ActionIcon } from '@mantine/core'
import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react'
import { Outlet, useParams } from 'react-router-dom'
import { useApp } from '../state/useApp'

export function AppShell() {
  const { undo, redo, canUndo, canRedo } = useApp()
  const { id } = useParams()

  return (
    <MantineAppShell header={{ height: 56 }}>
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Tally</Title>
          {id && (
            <Group gap="xs">
              <ActionIcon variant="subtle" disabled={!canUndo} onClick={undo}>
                <IconArrowBackUp size={20} />
              </ActionIcon>
              <ActionIcon variant="subtle" disabled={!canRedo} onClick={redo}>
                <IconArrowForwardUp size={20} />
              </ActionIcon>
            </Group>
          )}
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  )
}
