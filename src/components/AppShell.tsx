import { AppShell as MantineAppShell, Group, Title, ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core'
import { IconArrowBackUp, IconArrowForwardUp, IconArrowLeft, IconSun, IconMoon } from '@tabler/icons-react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useApp } from '../state/useApp'

export function AppShell() {
  const { undo, redo, canUndo, canRedo } = useApp()
  const { id } = useParams()
  const { toggleColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light')

  return (
    <MantineAppShell header={{ height: 56 }} styles={{ root: { minHeight: '100dvh' }, main: { minHeight: '100dvh' } }}>
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            {id && (
              <ActionIcon variant="subtle" component={Link} to="/">
                <IconArrowLeft size={20} />
              </ActionIcon>
            )}
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Title order={3}>Tally</Title>
            </Link>
            <ActionIcon variant="subtle" onClick={toggleColorScheme}>
              {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
            </ActionIcon>
          </Group>
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
