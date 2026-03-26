import type { Group } from '../types'
import type { Action } from './actions'

export type AppState = Record<string, Group>

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_GROUP':
    case 'IMPORT_GROUP':
    case 'MERGE_GROUP':
      return { ...state, [action.payload.id]: action.payload }

    case 'DELETE_GROUP': {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.payload.groupId]: _, ...rest } = state
      return rest
    }

    case 'ADD_MEMBER': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          members: [...group.members, action.payload.member],
        },
      }
    }

    case 'REMOVE_MEMBER': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          members: group.members.filter(m => m.id !== action.payload.memberId),
        },
      }
    }

    case 'ADD_EXPENSE': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          expenses: [...group.expenses, action.payload.expense],
        },
      }
    }

    case 'EDIT_EXPENSE': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          expenses: group.expenses.map(e =>
            e.id === action.payload.expense.id ? action.payload.expense : e
          ),
        },
      }
    }

    case 'DELETE_EXPENSE': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          expenses: group.expenses.filter(e => e.id !== action.payload.expenseId),
        },
      }
    }

    case 'ADD_SETTLEMENT': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          settlements: [...group.settlements, action.payload.settlement],
        },
      }
    }

    case 'DELETE_SETTLEMENT': {
      const group = state[action.payload.groupId]
      if (!group) return state
      return {
        ...state,
        [group.id]: {
          ...group,
          settlements: group.settlements.filter(s => s.id !== action.payload.settlementId),
        },
      }
    }

    default:
      return state
  }
}
