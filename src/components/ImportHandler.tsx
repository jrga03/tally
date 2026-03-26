import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { decompressGroup } from '../lib/sharing'
import { mergeGroups, applyResolutions } from '../lib/merge'
import type { MergeResult, ConflictResolution } from '../lib/merge'
import { useApp } from '../state/useApp'
import { MergeConflictModal } from './MergeConflictModal'

export function ImportHandler() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { state, dispatch } = useApp()
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [showConflicts, setShowConflicts] = useState(false)
  const [hash] = useState(() => window.location.hash.slice(1))

  useEffect(() => {
    if (!hash) return

    try {
      const incoming = decompressGroup(hash)
      const local = state[incoming.id]

      if (!local) {
        dispatch({ type: 'IMPORT_GROUP', payload: incoming })
        navigate(`/group/${incoming.id}`, { replace: true })
        return
      }

      const result = mergeGroups(local, incoming)

      if (!result.hasConflicts) {
        dispatch({ type: 'MERGE_GROUP', payload: result.merged })
        navigate(`/group/${incoming.id}`, { replace: true })
      } else {
        setMergeResult(result)
        setShowConflicts(true)
      }
    } catch {
      // Invalid hash, ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  const handleResolve = (resolutions: ConflictResolution[]) => {
    if (!mergeResult) return
    const finalGroup = applyResolutions(mergeResult, resolutions)
    dispatch({ type: 'MERGE_GROUP', payload: finalGroup })
    setShowConflicts(false)
    navigate(`/group/${finalGroup.id}`, { replace: true })
  }

  const handleCancel = () => {
    setShowConflicts(false)
    navigate(`/group/${id}`, { replace: true })
  }

  if (!mergeResult) return null

  return (
    <MergeConflictModal
      opened={showConflicts}
      mergeResult={mergeResult}
      onResolve={handleResolve}
      onCancel={handleCancel}
    />
  )
}
