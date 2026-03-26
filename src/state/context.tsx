import { useState, useCallback, type ReactNode } from 'react'
import { appReducer } from './reducer'
import type { Action } from './actions'
import { createHistory, pushState, undo as undoHistory, redo as redoHistory } from './history'
import { loadGroups, saveGroups } from '../lib/storage'
import { AppContext } from './AppContext'

export function AppProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState(() => createHistory(loadGroups()))

  const dispatch = useCallback((action: Action) => {
    setHistory(prev => {
      const nextState = appReducer(prev.present, action)
      const nextHistory = pushState(prev, nextState)
      saveGroups(nextHistory.present)
      return nextHistory
    })
  }, [])

  const undo = useCallback(() => {
    setHistory(prev => {
      const next = undoHistory(prev)
      saveGroups(next.present)
      return next
    })
  }, [])

  const redo = useCallback(() => {
    setHistory(prev => {
      const next = redoHistory(prev)
      saveGroups(next.present)
      return next
    })
  }, [])

  return (
    <AppContext.Provider value={{
      state: history.present,
      dispatch,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }}>
      {children}
    </AppContext.Provider>
  )
}
