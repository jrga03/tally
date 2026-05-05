import { Modal, Button, Group, Stack, Text } from '@mantine/core'
import { useApp } from '../state/useApp'
import type { Group as GroupType } from '../types'

interface Props {
  group: GroupType | null
  onClose: () => void
}

export function DeleteGroupModal({ group, onClose }: Props) {
  const { dispatch } = useApp()

  const handleDelete = () => {
    if (!group) return
    dispatch({ type: 'DELETE_GROUP', payload: { groupId: group.id } })
    onClose()
  }

  return (
    <Modal opened={group !== null} onClose={onClose} title={group ? <>Delete <strong>{group.name}</strong>?</> : null}>
      {group && (
        <Stack>
          <Text size="sm">
            {group.expenses.length} expenses, {group.settlements.length} settlements, and{' '}
            {group.members.length} members will be permanently deleted.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={onClose}>Cancel</Button>
            <Button color="red" onClick={handleDelete}>Delete</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
