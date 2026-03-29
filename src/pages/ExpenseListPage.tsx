import { Container, Title, Text, Card, Stack, Group, Badge, ActionIcon, Menu, Collapse, Divider } from '@mantine/core'
import { IconDots, IconTrash, IconChevronDown, IconChevronUp, IconEdit } from '@tabler/icons-react'
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { formatPHP } from '../lib/format'

export function ExpenseListPage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>

  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

  const toggleExpand = (expenseId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(expenseId)) next.delete(expenseId)
      else next.add(expenseId)
      return next
    })
  }

  // Combine expenses and settlements, sort by date descending
  const items = useMemo(() => [
    ...group.expenses.map(e => ({ kind: 'expense' as const, data: e, date: e.date })),
    ...group.settlements.map(s => ({ kind: 'settlement' as const, data: s, date: s.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [group.expenses, group.settlements])

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
              const isExpanded = expandedIds.has(e.id)
              return (
                <Card key={e.id} withBorder p="sm" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(e.id)}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{e.description}</Text>
                      <Text size="sm" c="dimmed">
                        Paid by {getMemberName(e.paidBy)} · {new Date(e.date).toLocaleDateString()}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge>{formatPHP(e.amount)}</Badge>
                      {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle" onClick={ev => ev.stopPropagation()}>
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={(ev: React.MouseEvent) => {
                              ev.stopPropagation()
                              navigate(`/group/${id}/expense/${e.id}/edit`)
                            }}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={(ev: React.MouseEvent) => {
                              ev.stopPropagation()
                              dispatch({ type: 'DELETE_EXPENSE', payload: { groupId: group.id, expenseId: e.id } })
                            }}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                  <Collapse in={isExpanded}>
                    <Divider my="sm" />
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>Split breakdown</Text>
                      {e.splits.map(s => (
                        <Group key={s.memberId} justify="space-between">
                          <Text size="sm">{getMemberName(s.memberId)}</Text>
                          <Text size="sm" c="dimmed">{formatPHP(s.amount)}</Text>
                        </Group>
                      ))}
                      {e.exactSplitMeta && (
                        <>
                          <Divider my="xs" />
                          <Text size="sm" fw={500}>How it was split</Text>
                          {e.exactSplitMeta.sharedAmount > 0 && (
                            <Text size="xs" c="dimmed">
                              Shared by all: {formatPHP(e.exactSplitMeta.sharedAmount)}
                            </Text>
                          )}
                          {e.exactSplitMeta.subGroups.map(sg => (
                            <Text key={sg.id} size="xs" c="dimmed">
                              {sg.label || 'Shared split'}: {formatPHP(sg.amount)} — {sg.memberIds.map(id => getMemberName(id)).join(', ')}
                            </Text>
                          ))}
                        </>
                      )}
                      {e.notes && (
                        <>
                          <Divider my="xs" />
                          <Text size="sm" fw={500}>Notes</Text>
                          <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</Text>
                        </>
                      )}
                    </Stack>
                  </Collapse>
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
