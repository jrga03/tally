import { Container, Title } from '@mantine/core'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { generateId } from '../lib/id'
import { ExpenseForm } from '../components/ExpenseForm'
import type { Expense } from '../types'

export function AddExpensePage() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined

  if (!group) return <Container py="md">Group not found.</Container>

  const handleSubmit = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        groupId: group.id,
        expense: {
          ...data,
          id: generateId(),
          createdAt: new Date().toISOString(),
        },
      },
    })
    navigate(`/group/${id}`)
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Add Expense</Title>
      <ExpenseForm
        members={group.members}
        onSubmit={handleSubmit}
        submitLabel="Add Expense"
      />
    </Container>
  )
}
