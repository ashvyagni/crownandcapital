/** Secure random command IDs also work on a trusted HTTP LAN (where randomUUID may be absent). */
export function requestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')
}
