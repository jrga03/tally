import { Modal, TextInput, Button, Stack } from '@mantine/core'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decompressGroup } from '../lib/sharing'
import { mergeGroups, applyResolutions } from '../lib/merge'
import type { MergeResult, ConflictResolution } from '../lib/merge'
import { useApp } from '../state/useApp'
import { MergeConflictModal } from './MergeConflictModal'

interface Props {
  opened: boolean
  onClose: () => void
}

export function ImportGroupModal({ opened, onClose }: Props) {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)

  const handleImport = () => {
    setError('')

    let hash: string
    try {
      hash = new URL(url.trim()).hash.slice(1)
    } catch {
      setError('Invalid URL')
      return
    }

    if (!hash) {
      setError('URL does not contain group data')
      return
    }

    try {
      const incoming = decompressGroup(hash)
      const local = state[incoming.id]

      if (!local) {
        dispatch({ type: 'IMPORT_GROUP', payload: incoming })
        handleClose()
        navigate(`/group/${incoming.id}`)
        return
      }

      const result = mergeGroups(local, incoming)

      if (!result.hasConflicts) {
        dispatch({ type: 'MERGE_GROUP', payload: result.merged })
        handleClose()
        navigate(`/group/${incoming.id}`)
      } else {
        setMergeResult(result)
      }
    } catch {
      setError('Could not read group data from URL')
    }
  }

  const handleResolve = (resolutions: ConflictResolution[]) => {
    if (!mergeResult) return
    const finalGroup = applyResolutions(mergeResult, resolutions)
    dispatch({ type: 'MERGE_GROUP', payload: finalGroup })
    setMergeResult(null)
    handleClose()
    navigate(`/group/${finalGroup.id}`)
  }

  const handleClose = () => {
    setUrl('')
    setError('')
    setMergeResult(null)
    onClose()
  }

  return (
    <>
      <Modal opened={opened && !mergeResult} onClose={handleClose} title="Import Group">
        <Stack>
          <TextInput
            label="Share URL"
            placeholder="Paste a Tally share link"
            value={url}
            onChange={e => setUrl(e.currentTarget.value)}
            error={error}
          />
          <Button onClick={handleImport} disabled={!url.trim()}>
            Import
          </Button>
        </Stack>
      </Modal>

      {mergeResult && (
        <MergeConflictModal
          opened={!!mergeResult}
          mergeResult={mergeResult}
          onResolve={handleResolve}
          onCancel={handleClose}
        />
      )}
    </>
  )
}
