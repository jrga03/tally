import { createContext } from 'react'
import type { AppState } from './reducer'
import type { Action } from './actions'

export interface AppContextValue {
  state: AppState
  dispatch: (action: Action) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export const AppContext = createContext<AppContextValue | null>(null)
