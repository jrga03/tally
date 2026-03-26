import { Modal, TextInput, Button, Stack, ActionIcon, Group } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useApp } from '../state/useApp'
import { generateId } from '../lib/id'
import { useNavigate } from 'react-router-dom'

interface Props {
  opened: boolean
  onClose: () => void
}

export function CreateGroupModal({ opened, onClose }: Props) {
  const { dispatch } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [memberNames, setMemberNames] = useState(['', ''])

  const addMember = () => setMemberNames(prev => [...prev, ''])
  const removeMember = (index: number) =>
    setMemberNames(prev => prev.filter((_, i) => i !== index))
  const updateMember = (index: number, value: string) =>
    setMemberNames(prev => prev.map((n, i) => (i === index ? value : n)))

  const handleCreate = () => {
    const trimmedName = name.trim()
    const members = memberNames
      .map(n => n.trim())
      .filter(n => n.length > 0)
      .map(n => ({ id: generateId(), name: n }))

    if (!trimmedName || members.length < 2) return

    const group = {
      id: generateId(),
      name: trimmedName,
      members,
      expenses: [],
      settlements: [],
      createdAt: new Date().toISOString(),
    }

    dispatch({ type: 'CREATE_GROUP', payload: group })
    onClose()
    setName('')
    setMemberNames(['', ''])
    navigate(`/group/${group.id}`)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Create Group">
      <Stack>
        <TextInput label="Group name" value={name} onChange={e => setName(e.currentTarget.value)} />
        {memberNames.map((memberName, i) => (
          <Group key={i} gap="xs">
            <TextInput
              style={{ flex: 1 }}
              label={i === 0 ? 'Members' : undefined}
              placeholder={`Member ${i + 1}`}
              value={memberName}
              onChange={e => updateMember(i, e.currentTarget.value)}
            />
            {memberNames.length > 2 && (
              <ActionIcon variant="subtle" color="red" onClick={() => removeMember(i)} mt={i === 0 ? 24 : 0}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        ))}
        <Button variant="light" onClick={addMember}>Add member</Button>
        <Button onClick={handleCreate}>Create group</Button>
      </Stack>
    </Modal>
  )
}
