import { useMemo, useState } from 'react'
import { Container, Title, Text, Card, Stack, Group, Button, Badge, Switch, Collapse } from '@mantine/core'
import { IconShare, IconCash, IconChevronDown } from '@tabler/icons-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { calculateBalances, simplifyDebts, computeRawDebts, getBalanceEntries } from '../lib/balance'
import { copyShareUrl } from '../lib/sharing'
import { formatPHP } from '../lib/format'

export function GroupDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const { state } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined
  const [simplified, setSimplified] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>
  const balances = calculateBalances(group)
  const debts = simplified ? simplifyDebts(group, balances) : computeRawDebts(group)
  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

  const allEntries = useMemo(
    () => getBalanceEntries(group),
    [group.expenses, group.settlements, group.members]
  )

  const toggleExpanded = (memberId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Group justify="space-between" mb="md">
        <Title order={2}>{group.name}</Title>
        <Button variant="light" leftSection={<IconShare size={16} />} onClick={() => copyShareUrl(group)}>
          Share
        </Button>
      </Group>

      <Title order={4} mb="xs">Balances</Title>
      <Stack mb="lg">
        {group.members.map(member => {
          const balance = balances.get(member.id) ?? 0
          const isExpanded = expanded.has(member.id)
          const entries = allEntries.get(member.id) ?? []
          return (
            <Card key={member.id} withBorder p="sm">
              <Group justify="space-between">
                <Group
                  gap={4}
                  style={{ cursor: balance !== 0 ? 'pointer' : undefined }}
                  onClick={() => balance !== 0 && toggleExpanded(member.id)}
                >
                  {balance !== 0 && (
                    <IconChevronDown
                      size={16}
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : undefined,
                        transition: 'transform 200ms',
                      }}
                    />
                  )}
                  <Text>{member.name}</Text>
                </Group>
                <Badge color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}>
                  {balance > 0 ? `gets back ${formatPHP(balance)}` : balance < 0 ? `owes ${formatPHP(Math.abs(balance))}` : 'settled up'}
                </Badge>
              </Group>
              <Collapse in={isExpanded}>
                <Stack gap={4} mt="xs" ml={20}>
                  {entries.map((entry, i) => (
                    <Group key={i} justify="space-between">
                      <div>
                        <Text size="xs">{entry.description}</Text>
                        <Text size="xs" c="dimmed">{new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </div>
                      <Text size="xs" c={entry.amount > 0 ? 'green.4' : 'red.4'}>
                        {entry.amount > 0 ? '+' : '−'}{formatPHP(Math.abs(entry.amount))}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Collapse>
            </Card>
          )
        })}
      </Stack>

      {debts.length > 0 && (
        <>
          <Group justify="space-between" mb="xs">
            <Title order={4}>Settle Up</Title>
            <Switch
              label="Simplify"
              checked={simplified}
              onChange={(e) => setSimplified(e.currentTarget.checked)}
              size="sm"
            />
          </Group>
          <Stack>
            {debts.map((debt, i) => (
              <Card key={i} withBorder p="sm">
                <Group justify="space-between">
                  <Text size="sm">
                    {getMemberName(debt.fromMemberId)} owes {getMemberName(debt.toMemberId)}
                  </Text>
                  <Group gap="xs">
                    <Text fw={600}>{formatPHP(debt.amount)}</Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconCash size={14} />}
                      onClick={() => navigate(`/group/${id}/settle?from=${debt.fromMemberId}&to=${debt.toMemberId}&amount=${debt.amount}`)}
                    >
                      Settle
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {debts.length === 0 && group.expenses.length > 0 && (
        <Text c="dimmed" ta="center">All settled up!</Text>
      )}
    </Container>
  )
}
