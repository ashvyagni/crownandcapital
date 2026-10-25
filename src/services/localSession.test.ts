import { describe, expect, it, vi } from 'vitest'
import type { GameSession } from '../game/session'
vi.mock('../game/session', () => ({ validateSession: (value: unknown) => Boolean(value && typeof value === 'object' && 'game' in value && 'economy' in value && 'pendingId' in value) }))
import { clearLocalSession, exportLocalSession, importLocalSession, loadLocalSession, saveLocalSession } from './localSession'

const session = { game: { turn: 1 }, economy: { loans: [] }, pendingId: 'landing', revision: 2 } as unknown as GameSession
function memory() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
describe('local session persistence', () => {
  it('saves the entire session and loads it', () => {
    const store = memory()
    expect(saveLocalSession(session, store).ok).toBe(true)
    expect(loadLocalSession(store).session).toEqual(session)
    expect(importLocalSession(exportLocalSession(session)!).session).toEqual(session)
    clearLocalSession(store)
    expect(loadLocalSession(store).session).toBeNull()
  })
  it('recovers last valid snapshot while preserving corrupt primary', () => {
    const store = memory()
    saveLocalSession(session, store)
    saveLocalSession({ ...session, revision: 3 }, store)
    const key = [...store.data.keys()].find(key => !key.endsWith(':backup'))!
    store.setItem(key, '{broken')
    expect(loadLocalSession(store).session).toEqual(session)
    expect(store.getItem(key)).toBe('{broken')
    expect(saveLocalSession(session, store).ok).toBe(false)
  })
  it('surfaces disabled storage and quota failures', () => {
    const store = { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('disabled') } }
    expect(saveLocalSession(session, store).ok).toBe(false)
    expect(loadLocalSession({ ...store, getItem: () => { throw new Error('disabled') } }).error).toBeTruthy()
    expect(() => clearLocalSession(store)).not.toThrow()
  })
  it('rejects invalid and oversized imports', () => {
    expect(importLocalSession('{bad').session).toBeNull()
    expect(importLocalSession('x'.repeat(1_000_001)).session).toBeNull()
    expect(importLocalSession(JSON.stringify({ version: 2, session })).session).toBeNull()
  })
})
