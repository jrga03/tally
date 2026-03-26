import type { AppState } from './reducer'

const MAX_HISTORY = 50

export interface HistoryState {
  past: AppState[]
  present: AppState
  future: AppState[]
}

export function createHistory(initial: AppState): HistoryState {
  return { past: [], present: initial, future: [] }
}

export function pushState(history: HistoryState, next: AppState): HistoryState {
  if (next === history.present) return history
  return {
    past: [...history.past.slice(-MAX_HISTORY + 1), history.present],
    present: next,
    future: [],
  }
}

export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history
  const next = history.future[0]
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  }
}
