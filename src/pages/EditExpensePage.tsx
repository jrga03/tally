import { Container, Title } from '@mantine/core'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../state/useApp'
import { ExpenseForm } from '../components/ExpenseForm'
import type { Expense } from '../types'

export function EditExpensePage() {
  const { id, expenseId } = useParams<{ id: string; expenseId: string }>()
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const group = id ? state[id] : undefined
  const expense = group?.expenses.find(e => e.id === expenseId)

  if (!group) return <Container py="md">Group not found.</Container>
  if (!expense) return <Container py="md">Expense not found.</Container>

  const handleSubmit = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    dispatch({
      type: 'EDIT_EXPENSE',
      payload: {
        groupId: group.id,
        expense: {
          ...data,
          id: expense.id,
          createdAt: expense.createdAt,
        },
      },
    })
    navigate(`/group/${id}/expenses`)
  }

  return (
    <Container size="xs" py="md" pb={80}>
      <Title order={2} mb="md">Edit Expense</Title>
      <ExpenseForm
        members={group.members}
        initialData={expense}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </Container>
  )
}
