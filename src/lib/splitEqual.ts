/**
 * Splits an amount in centavos equally among memberIds.
 * Remainder centavos are distributed randomly (Fisher-Yates shuffle).
 * Returns a Record<memberId, centavos>.
 */
export function splitEqual(amountCentavos: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) return {}
  const share = Math.floor(amountCentavos / memberIds.length)
  const remainder = amountCentavos - share * memberIds.length

  // Fisher-Yates shuffle to randomize who gets remainder centavos
  const shuffled = [...memberIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const result: Record<string, number> = {}
  for (const id of memberIds) {
    result[id] = share
  }
  for (let i = 0; i < remainder; i++) {
    result[shuffled[i]] += 1
  }
  return result
}
