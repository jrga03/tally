import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Modal, Text, Group, Button } from '@mantine/core'
import { decompressGroup } from '../lib/sharing'
import { useApp } from '../state/useApp'
import type { Group as GroupType } from '../types'

export function ImportHandler() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { state, dispatch } = useApp()
  const [pendingGroup, setPendingGroup] = useState<GroupType | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [hash] = useState(() => window.location.hash.slice(1))

  useEffect(() => {
    if (!hash) return

    try {
      const group = decompressGroup(hash)
      if (state[group.id]) {
        setPendingGroup(group)
        setShowPrompt(true)
      } else {
        dispatch({ type: 'IMPORT_GROUP', payload: group })
        navigate(`/group/${group.id}`, { replace: true })
      }
    } catch {
      // Invalid hash, ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  const handleReplace = () => {
    if (!pendingGroup) return
    dispatch({ type: 'IMPORT_GROUP', payload: pendingGroup })
    setShowPrompt(false)
    navigate(`/group/${pendingGroup.id}`, { replace: true })
  }

  const handleKeep = () => {
    setShowPrompt(false)
    navigate(`/group/${id}`, { replace: true })
  }

  return (
    <Modal opened={showPrompt} onClose={handleKeep} title="Group Already Exists">
      <Text mb="md">
        You already have this group. Replace it with the shared version?
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={handleKeep}>Keep mine</Button>
        <Button onClick={handleReplace}>Replace</Button>
      </Group>
    </Modal>
  )
}
