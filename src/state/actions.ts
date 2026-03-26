import type { Group, Member, Expense, Settlement } from '../types'

export type Action =
  | { type: 'CREATE_GROUP'; payload: Group }
  | { type: 'DELETE_GROUP'; payload: { groupId: string } }
  | { type: 'ADD_MEMBER'; payload: { groupId: string; member: Member } }
  | { type: 'REMOVE_MEMBER'; payload: { groupId: string; memberId: string } }
  | { type: 'ADD_EXPENSE'; payload: { groupId: string; expense: Expense } }
  | { type: 'EDIT_EXPENSE'; payload: { groupId: string; expense: Expense } }
  | { type: 'DELETE_EXPENSE'; payload: { groupId: string; expenseId: string } }
  | { type: 'ADD_SETTLEMENT'; payload: { groupId: string; settlement: Settlement } }
  | { type: 'DELETE_SETTLEMENT'; payload: { groupId: string; settlementId: string } }
  | { type: 'IMPORT_GROUP'; payload: Group }
