import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Modal, Text, Group, Button } from '@mantine/core'
import { decompressGroup } from '../lib/sharing'
import { useApp } from '../state/context'
import type { Group as GroupType } from '../types'

export function ImportHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()
  const { state, dispatch } = useApp()
  const [pendingGroup, setPendingGroup] = useState<GroupType | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const hash = location.hash.slice(1)
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
  }, []) // Only run on mount

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
