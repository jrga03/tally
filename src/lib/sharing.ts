import pako from 'pako'
import type { Group } from '../types'

const CHUNK_SIZE = 8192

function toBase64Url(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)))
  }
  return btoa(chunks.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function compressGroup(group: Group): string {
  const json = JSON.stringify(group)
  const compressed = pako.deflate(json)
  return toBase64Url(compressed)
}

export function decompressGroup(encoded: string): Group {
  const bytes = fromBase64Url(encoded)
  const json = pako.inflate(bytes, { to: 'string' })
  return JSON.parse(json)
}

export function buildShareUrl(group: Group): string {
  const compressed = compressGroup(group)
  return `${window.location.origin}/group/${group.id}#${compressed}`
}

export async function copyShareUrl(group: Group): Promise<void> {
  const url = buildShareUrl(group)
  if (navigator.share) {
    await navigator.share({ title: `Tally — ${group.name}`, url })
  } else {
    await navigator.clipboard.writeText(url)
  }
}
