import { useState } from 'react'
import { Modal, Text, Card, Stack, Group, Button, SegmentedControl, Badge } from '@mantine/core'
import type { Expense, Settlement } from '../types'
import type { ConflictPair, ConflictResolution, MergeResult } from '../lib/merge'

interface Props {
  opened: boolean
  mergeResult: MergeResult
  onResolve: (resolutions: ConflictResolution[]) => void
  onCancel: () => void
}

export function MergeConflictModal({ opened, mergeResult, onResolve, onCancel }: Props) {
  const { expenseConflicts, settlementConflicts, merged } = mergeResult
  const memberMap = new Map(merged.members.map(m => [m.id, m]))

  const [picks, setPicks] = useState<Record<string, 'local' | 'incoming'>>(() => {
    const initial: Record<string, 'local' | 'incoming'> = {}
    for (const c of expenseConflicts) initial[c.local.id] = 'local'
    for (const c of settlementConflicts) initial[c.local.id] = 'local'
    return initial
  })

  const setPick = (id: string, pick: 'local' | 'incoming') => {
    setPicks(prev => ({ ...prev, [id]: pick }))
  }

  const handleConfirm = () => {
    const resolutions: ConflictResolution[] = [
      ...expenseConflicts.map(c => ({
        type: 'expense' as const,
        id: c.local.id,
        pick: picks[c.local.id] ?? 'local',
      })),
      ...settlementConflicts.map(c => ({
        type: 'settlement' as const,
        id: c.local.id,
        pick: picks[c.local.id] ?? 'local',
      })),
    ]
    onResolve(resolutions)
  }

  const getMemberName = (id: string) => memberMap.get(id)?.name ?? id

  return (
    <Modal opened={opened} onClose={onCancel} title="Merge Conflicts" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Some items were modified on both sides. Choose which version to keep for each.
        </Text>

        {expenseConflicts.map(conflict => (
          <ExpenseConflictCard
            key={conflict.local.id}
            conflict={conflict}
            pick={picks[conflict.local.id] || 'local'}
            onPick={pick => setPick(conflict.local.id, pick)}
            getMemberName={getMemberName}
          />
        ))}

        {settlementConflicts.map(conflict => (
          <SettlementConflictCard
            key={conflict.local.id}
            conflict={conflict}
            pick={picks[conflict.local.id] || 'local'}
            onPick={pick => setPick(conflict.local.id, pick)}
            getMemberName={getMemberName}
          />
        ))}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm merge</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function DiffText({ label, local, incoming }: { label: string; local: string; incoming: string }) {
  const differs = local !== incoming
  return (
    <Text size="sm">
      <Text span fw={500}>{label}: </Text>
      <Text span c={differs ? undefined : 'dimmed'}>{local}</Text>
      {differs && (
        <>
          <Text span c="dimmed"> → </Text>
          <Text span>{incoming}</Text>
        </>
      )}
    </Text>
  )
}

function ExpenseConflictCard({
  conflict,
  pick,
  onPick,
  getMemberName,
}: {
  conflict: ConflictPair<Expense>
  pick: 'local' | 'incoming'
  onPick: (pick: 'local' | 'incoming') => void
  getMemberName: (id: string) => string
}) {
  const { local, incoming } = conflict
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Badge variant="light">Expense</Badge>
          <SegmentedControl
            size="xs"
            value={pick}
            onChange={v => onPick(v as 'local' | 'incoming')}
            data={[
              { label: 'Mine', value: 'local' },
              { label: 'Theirs', value: 'incoming' },
            ]}
          />
        </Group>
        <DiffText label="Description" local={local.description} incoming={incoming.description} />
        <DiffText label="Amount" local={String(local.amount)} incoming={String(incoming.amount)} />
        <DiffText label="Paid by" local={getMemberName(local.paidBy)} incoming={getMemberName(incoming.paidBy)} />
        <DiffText label="Date" local={local.date} incoming={incoming.date} />
      </Stack>
    </Card>
  )
}

function SettlementConflictCard({
  conflict,
  pick,
  onPick,
  getMemberName,
}: {
  conflict: ConflictPair<Settlement>
  pick: 'local' | 'incoming'
  onPick: (pick: 'local' | 'incoming') => void
  getMemberName: (id: string) => string
}) {
  const { local, incoming } = conflict
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Badge variant="light" color="green">Settlement</Badge>
          <SegmentedControl
            size="xs"
            value={pick}
            onChange={v => onPick(v as 'local' | 'incoming')}
            data={[
              { label: 'Mine', value: 'local' },
              { label: 'Theirs', value: 'incoming' },
            ]}
          />
        </Group>
        <DiffText label="From" local={getMemberName(local.fromMemberId)} incoming={getMemberName(incoming.fromMemberId)} />
        <DiffText label="To" local={getMemberName(local.toMemberId)} incoming={getMemberName(incoming.toMemberId)} />
        <DiffText label="Amount" local={String(local.amount)} incoming={String(incoming.amount)} />
        <DiffText label="Date" local={local.date} incoming={incoming.date} />
      </Stack>
    </Card>
  )
}
