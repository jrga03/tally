import type { Group } from '../types'

const STORAGE_KEY = 'tally_groups'

export function loadGroups(): Record<string, Group> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveGroups(groups: Record<string, Group>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
}
