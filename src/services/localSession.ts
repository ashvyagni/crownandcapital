import { validateSession, type GameSession } from '../game/session'

const KEY = 'crown-and-capital:local:v1'
const BACKUP = `${KEY}:backup`
const MAX_BYTES = 1_000_000
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Envelope = { version: 1; session: GameSession }

function storage(store?: Store): Store {
  if (store) return store
  return window.localStorage
}

function decode(raw: string | null): GameSession | null {
  if (!raw || new TextEncoder().encode(raw).length > MAX_BYTES) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') return null
  const envelope = value as Partial<Envelope>
  return envelope.version === 1 && validateSession(envelope.session) ? envelope.session! : null
}

export function loadLocalSession(store?: Store): { session: GameSession | null; error?: string } {
  try {
    const target = storage(store)
    const raw = target.getItem(KEY)
    try {
      const session = decode(raw)
      if (session) return { session }
      if (!raw) return { session: null }
    } catch { /* Preserve the invalid primary for manual recovery. */ }
    try {
      const backup = decode(target.getItem(BACKUP))
      if (backup) return { session: backup, error: 'The latest save is invalid; a previous valid snapshot was recovered.' }
    } catch { /* Invalid backup is also left untouched. */ }
    return { session: null, error: 'Saved game is invalid. Its original data has been preserved.' }
  } catch {
    return { session: null, error: 'Browser storage is unavailable.' }
  }
}

export function saveLocalSession(session: GameSession, store?: Store): { ok: boolean; error?: string } {
  if (!validateSession(session)) return { ok: false, error: 'Invalid game session.' }
  try {
    const target = storage(store)
    const json = JSON.stringify({ version: 1, session } satisfies Envelope)
    if (new TextEncoder().encode(json).length > MAX_BYTES) return { ok: false, error: 'Save exceeds the 1 MB limit.' }
    const previous = target.getItem(KEY)
    if (previous) {
      try {
        if (decode(previous)) target.setItem(BACKUP, previous)
        else return { ok: false, error: 'Existing save is invalid; export or clear it before saving.' }
      } catch { return { ok: false, error: 'Existing save is invalid; export or clear it before saving.' } }
    }
    target.setItem(KEY, json)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not save game; browser storage may be full or disabled.' }
  }
}

export function clearLocalSession(store?: Store): void {
  try { const target = storage(store); target.removeItem(KEY); target.removeItem(BACKUP) } catch { /* Disabled storage. */ }
}

export function exportLocalSession(session: GameSession): string | null {
  if (!validateSession(session)) return null
  const json = JSON.stringify({ version: 1, session } satisfies Envelope)
  return new TextEncoder().encode(json).length <= MAX_BYTES ? json : null
}

export function importLocalSession(json: string): { session: GameSession | null; error?: string } {
  try {
    const session = decode(json)
    return session ? { session } : { session: null, error: 'Invalid or oversized game file.' }
  } catch { return { session: null, error: 'Invalid game file.' } }
}
