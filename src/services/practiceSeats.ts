/** Practice-mode bot seats round-trip beside the local save.
 *
 * The GameSession envelope has no bot marking (players are plain, validateSession
 * -checked data), so the practice driver keeps only the bot seat ids here and
 * re-derives automated seats on resume: a saved practice game reloads as such,
 * everything else loads as a normal local table.
 */
import type { GameSession } from '../game/session'

const KEY = 'crown-and-capital:practice-bots:v1'
type Envelope = { version: 1; seatIds: string[] }
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(store?: Store): Store {
  if (store) return store
  return window.localStorage
}

/** Bot seat ids whose players still exist in the loaded session, or null for a plain table. */
export function loadPracticeSeats(session: GameSession | null, store?: Store): string[] | null {
  try {
    const raw = storage(store).getItem(KEY)
    if (!session || !raw) return null
    const value: unknown = JSON.parse(raw)
    const envelope = value as Partial<Envelope>
    if (envelope.version !== 1 || !Array.isArray(envelope.seatIds)) return null
    const seatIds = envelope.seatIds.filter(id => typeof id === 'string' && !!id && id in session.game.players)
    return seatIds.length ? seatIds : null
  } catch { return null }
}

export function savePracticeSeats(seatIds: string[], store?: Store): void {
  try { storage(store).setItem(KEY, JSON.stringify({ version: 1, seatIds } satisfies Envelope)) } catch { /* Label loss only degrades a resumed practice table to a plain one. */ }
}

export function clearPracticeSeats(store?: Store): void {
  try { storage(store).removeItem(KEY) } catch { /* Disabled storage. */ }
}
