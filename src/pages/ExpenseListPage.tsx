import { Container, Title, Text, Card, Stack, Group, Badge, ActionIcon, Menu } from '@mantine/core'
import { IconDots, IconTrash } from '@tabler/icons-react'
import { useParams } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { formatPHP } from '../lib/format'

export function ExpenseListPage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const group = id ? state[id] : undefined

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>

  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

  // Combine expenses and settlements, sort by date descending
  const items = [
    ...group.expenses.map(e => ({ kind: 'expense' as const, data: e, date: e.date })),
    ...group.settlements.map(s => ({ kind: 'settlement' as const, data: s, date: s.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Expenses</Title>
      {items.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No expenses yet.</Text>
      ) : (
        <Stack>
          {items.map(item => {
            if (item.kind === 'expense') {
              const e = item.data
              return (
                <Card key={e.id} withBorder p="sm">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{e.description}</Text>
                      <Text size="sm" c="dimmed">
                        Paid by {getMemberName(e.paidBy)} · {new Date(e.date).toLocaleDateString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge>{formatPHP(e.amount)}</Badge>
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle"><IconDots size={16} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => dispatch({ type: 'DELETE_EXPENSE', payload: { groupId: group.id, expenseId: e.id } })}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </Card>
              )
            } else {
              const s = item.data
              return (
                <Card key={s.id} withBorder p="sm" bg="green.0">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>Settlement</Text>
                      <Text size="sm" c="dimmed">
                        {getMemberName(s.fromMemberId)} paid {getMemberName(s.toMemberId)} · {new Date(s.date).toLocaleDateString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge color="green">{formatPHP(s.amount)}</Badge>
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle"><IconDots size={16} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => dispatch({ type: 'DELETE_SETTLEMENT', payload: { groupId: group.id, settlementId: s.id } })}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </Card>
              )
            }
          })}
        </Stack>
      )}
    </Container>
  )
}
