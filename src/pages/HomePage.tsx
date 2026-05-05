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
