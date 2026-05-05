import { describe, it, expect } from 'vitest'
import { compressGroup, decompressGroup } from './sharing'
import type { Group } from '../types'

const fixture: Group = {
  id: 'g1',
  name: 'Trip to Tokyo',
  members: [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' },
  ],
  expenses: [
    {
      id: 'e1',
      description: 'Sushi',
      amount: 5000,
      paidBy: 'm1',
      splits: [
        { memberId: 'm1', amount: 2500 },
        { memberId: 'm2', amount: 2500 },
      ],
      date: '2026-04-01',
      createdAt: '2026-04-01T12:00:00Z',
      notes: 'Best toro of the trip',
    },
  ],
  settlements: [
    {
      id: 's1',
      fromMemberId: 'm2',
      toMemberId: 'm1',
      amount: 2500,
      date: '2026-04-02',
      createdAt: '2026-04-02T09:00:00Z',
    },
  ],
  createdAt: '2026-03-30T00:00:00Z',
}

describe('compressGroup / decompressGroup', () => {
  it('round-trips an empty group', () => {
    const empty: Group = {
      id: 'g0', name: '', members: [], expenses: [], settlements: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    expect(decompressGroup(compressGroup(empty))).toEqual(empty)
  })

  it('round-trips a populated group', () => {
    expect(decompressGroup(compressGroup(fixture))).toEqual(fixture)
  })

  it('preserves unicode in names and notes', () => {
    const unicodeGroup: Group = {
      ...fixture,
      name: '東京旅行 🗼',
      members: [
        { id: 'm1', name: 'アリス' },
        { id: 'm2', name: 'ボブ' },
      ],
    }
    expect(decompressGroup(compressGroup(unicodeGroup))).toEqual(unicodeGroup)
  })

  it('produces a base64url string with no padding or unsafe characters', () => {
    const encoded = compressGroup(fixture)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('produces a string shorter than the raw JSON', () => {
    const encoded = compressGroup(fixture)
    const raw = JSON.stringify(fixture)
    expect(encoded.length).toBeLessThan(raw.length)
  })
})
