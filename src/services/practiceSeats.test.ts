import { describe, expect, it } from 'vitest'
import type { GameSession } from '../game/session'
import { clearPracticeSeats, loadPracticeSeats, savePracticeSeats } from './practiceSeats'

const session = { game: { players: { 'player-1': { id: 'player-1' }, 'player-2': { id: 'player-2' }, 'player-3': { id: 'player-3' } } } } as unknown as GameSession
function memory() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
describe('practice seat persistence', () => {
  it('round-trips bot seat ids and drops seats missing from the session', () => {
    const store = memory()
    savePracticeSeats(['player-2', 'player-3'], store)
    expect(loadPracticeSeats(session, store)).toEqual(['player-2', 'player-3'])
    store.setItem('crown-and-capital:practice-bots:v1', JSON.stringify({ version: 1, seatIds: ['player-2', 'player-9'] }))
    expect(loadPracticeSeats(session, store)).toEqual(['player-2'])
    expect(loadPracticeSeats(null, store)).toBeNull()
  })
  it('treats corrupt or foreign data as a plain table and clears storage', () => {
    const store = memory()
    store.setItem('crown-and-capital:practice-bots:v1', '{broken')
    expect(loadPracticeSeats(session, store)).toBeNull()
    store.setItem('crown-and-capital:practice-bots:v1', JSON.stringify({ version: 2, seatIds: [] }))
    expect(loadPracticeSeats(session, store)).toBeNull()
    savePracticeSeats(['player-2'], store)
    clearPracticeSeats(store)
    expect(loadPracticeSeats(session, store)).toBeNull()
    expect(() => loadPracticeSeats(session, { getItem: () => { throw new Error('disabled') }, setItem: () => {}, removeItem: () => {} })).not.toThrow()
  })
})
