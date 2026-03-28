import { Container, Title, Text, TextInput, NumberInput, Select, SegmentedControl, Checkbox, Button, Stack, Group } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { generateId } from '../lib/id'
import type { Split } from '../types'

type SplitMethod = 'equal' | 'exact' | 'percentage'

export function AddExpensePage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number | string>('')
  const [paidBy, setPaidBy] = useState<string | null>(null)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(group?.members.map(m => m.id) ?? [])
  )
  const [exactAmounts, setExactAmounts] = useState<Record<string, number | string>>({})
  const [percentages, setPercentages] = useState<Record<string, number | string>>({})
  const [date, setDate] = useState<string | null>(dayjs().format('YYYY-MM-DD'))

  if (!group) return <Container py="md">Group not found.</Container>

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const buildSplits = (): Split[] | null => {
    const amountCentavos = typeof amount === 'number' ? Math.round(amount * 100) : 0
    const members = group.members.filter(m => selectedMembers.has(m.id))
    if (members.length === 0 || amountCentavos <= 0) return null

    if (splitMethod === 'equal') {
      const share = Math.floor(amountCentavos / members.length)
      const remainder = amountCentavos - share * members.length
      return members.map((m, i) => ({
        memberId: m.id,
        amount: share + (i < remainder ? 1 : 0),
      }))
    }

    if (splitMethod === 'exact') {
      const splits = members.map(m => ({
        memberId: m.id,
        amount: Math.round(Number(exactAmounts[m.id] || 0) * 100),
      }))
      const total = splits.reduce((sum, s) => sum + s.amount, 0)
      if (total !== amountCentavos) return null
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = members.map(m => {
        const pct = Number(percentages[m.id] || 0)
        return { memberId: m.id, amount: Math.round((pct / 100) * amountCentavos) }
      })
      const totalPct = members.reduce((sum, m) => sum + Number(percentages[m.id] || 0), 0)
      if (Math.abs(totalPct - 100) > 0.01) return null
      return splits
    }

    return null
  }

  const handleSubmit = () => {
    const splits = buildSplits()
    if (!splits || !paidBy || !description.trim() || !date) return

    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        groupId: group.id,
        expense: {
          id: generateId(),
          description: description.trim(),
          amount: Math.round((typeof amount === 'number' ? amount : 0) * 100),
          paidBy,
          splits,
          date: new Date(date).toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
    })
    navigate(`/group/${id}`)
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Add Expense</Title>
      <Stack>
        <TextInput label="Description" value={description} onChange={e => setDescription(e.currentTarget.value)} />
        <NumberInput label="Amount (₱)" value={amount} onChange={v => setAmount(v)} min={0} decimalScale={2} />
        <Select
          label="Paid by"
          data={group.members.map(m => ({ value: m.id, label: m.name }))}
          value={paidBy}
          onChange={setPaidBy}
        />
        <DatePickerInput label="Date" value={date} onChange={setDate} />

        <SegmentedControl
          value={splitMethod}
          onChange={v => setSplitMethod(v as SplitMethod)}
          data={[
            { label: 'Equal', value: 'equal' },
            { label: 'Exact', value: 'exact' },
            { label: '%', value: 'percentage' },
          ]}
        />

        <Text fw={500} size="sm">Split among</Text>
        <Stack gap="xs">
          {group.members.map(m => (
            <Group key={m.id} justify="space-between">
              <Checkbox
                label={m.name}
                checked={selectedMembers.has(m.id)}
                onChange={() => toggleMember(m.id)}
              />
              {splitMethod === 'exact' && selectedMembers.has(m.id) && (
                <NumberInput
                  size="xs"
                  w={100}
                  placeholder="₱0.00"
                  value={exactAmounts[m.id] ?? ''}
                  onChange={v => setExactAmounts(prev => ({ ...prev, [m.id]: v }))}
                  decimalScale={2}
                />
              )}
              {splitMethod === 'percentage' && selectedMembers.has(m.id) && (
                <NumberInput
                  size="xs"
                  w={80}
                  placeholder="%"
                  value={percentages[m.id] ?? ''}
                  onChange={v => setPercentages(prev => ({ ...prev, [m.id]: v }))}
                  suffix="%"
                />
              )}
            </Group>
          ))}
        </Stack>

        <Button onClick={handleSubmit}>Add Expense</Button>
      </Stack>
    </Container>
  )
}
