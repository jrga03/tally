import { useState } from 'react'
import { Container, Title, Text, Card, Stack, Group, Button, Badge, Switch } from '@mantine/core'
import { IconShare, IconCash } from '@tabler/icons-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { calculateBalances, simplifyDebts, computeRawDebts } from '../lib/balance'
import { copyShareUrl } from '../lib/sharing'
import { formatPHP } from '../lib/format'

export function GroupDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const { state } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined
  const [simplified, setSimplified] = useState(true)

  if (!group) return <Container py="md"><Text>Group not found.</Text></Container>
  const balances = calculateBalances(group)
  const debts = simplified ? simplifyDebts(group, balances) : computeRawDebts(group)
  const getMemberName = (memberId: string) =>
    group.members.find(m => m.id === memberId)?.name ?? 'Unknown'

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
          return (
            <Card key={member.id} withBorder p="sm">
              <Group justify="space-between">
                <Text>{member.name}</Text>
                <Badge color={balance > 0 ? 'green' : balance < 0 ? 'red' : 'gray'}>
                  {balance > 0 ? `gets back ${formatPHP(balance)}` : balance < 0 ? `owes ${formatPHP(Math.abs(balance))}` : 'settled up'}
                </Badge>
              </Group>
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
