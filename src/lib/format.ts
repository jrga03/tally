export function formatPHP(centavos: number): string {
  return `₱${(centavos / 100).toFixed(2)}`
}
