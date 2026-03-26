import { Container, Title, Select, NumberInput, Button, Stack } from '@mantine/core'
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { generateId } from '../lib/id'

export function SettleUpPage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const group = id ? state[id] : undefined

  const [from, setFrom] = useState<string | null>(searchParams.get('from'))
  const [to, setTo] = useState<string | null>(searchParams.get('to'))
  const [amount, setAmount] = useState<number | string>(
    searchParams.get('amount') ? Number(searchParams.get('amount')) / 100 : ''
  )

  if (!group) return <Container py="md">Group not found.</Container>

  const handleSubmit = () => {
    const numAmount = typeof amount === 'number' ? amount : Number(amount)
    if (!from || !to || !numAmount || numAmount <= 0 || from === to) return

    dispatch({
      type: 'ADD_SETTLEMENT',
      payload: {
        groupId: group.id,
        settlement: {
          id: generateId(),
          fromMemberId: from,
          toMemberId: to,
          amount: Math.round(numAmount * 100),
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
    })
    navigate(`/group/${id}`)
  }

  const memberData = group.members.map(m => ({ value: m.id, label: m.name }))

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Settle Up</Title>
      <Stack>
        <Select label="Who paid" data={memberData} value={from} onChange={setFrom} />
        <Select label="Paid to" data={memberData} value={to} onChange={setTo} />
        <NumberInput label="Amount (₱)" value={amount} onChange={v => setAmount(v)} min={0} decimalScale={2} />
        <Button onClick={handleSubmit}>Record Settlement</Button>
      </Stack>
    </Container>
  )
}
