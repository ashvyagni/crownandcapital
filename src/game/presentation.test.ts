import { describe, expect, it } from 'vitest'
import { applyCommand, createSession } from './session'
import { dialogueFor, movementDuration, presentationEvents } from './presentation'

describe('confirmed presentation events', () => {
  it('uses the engine dice, and never changes or resolves the accepted session', () => {
    const before = createSession(1847)
    const after = applyCommand(before, 'player-1', { type: 'roll' }, 'once')
    const snapshot = structuredClone(after)
    const events = presentationEvents(before, after)
    expect(events.find(event => event.type === 'roll')).toMatchObject({ playerId: 'player-1', dice: after.lastRoll })
    expect(dialogueFor(events, after)).not.toBeNull()
    expect(after).toEqual(snapshot)
    expect(before.game.players['player-1'].position).toBe(0)
    expect(after.game.players['player-1'].position).toBe(after.lastRoll!.total)
  })
  it('does not replay hydration, duplicates, older or catch-up snapshots', () => {
    const before = createSession(1847)
    const after = applyCommand(before, 'player-1', { type: 'roll' }, 'once')
    const finished = applyCommand(after, 'player-1', { type: 'finish' })
    expect(presentationEvents(after, structuredClone(after))).toEqual([])
    expect(presentationEvents(after, before)).toEqual([])
    expect(presentationEvents(before, finished)).toEqual([])
    const duplicate = applyCommand(after, 'player-1', { type: 'roll' }, 'once')
    expect(presentationEvents(after, duplicate)).toEqual([])
  })
  it('derives a banker explanation from a genuine treasury receipt, not a fake outcome', () => {
    let before = createSession(3)
    // Find a genuine treasury landing via the unchanged deterministic engine.
    for (let turn = 0; turn < 100; turn++) {
      const actor = Object.values(before.game.players)[before.game.activePlayer]
      const after = applyCommand(before, actor.id, { type: 'roll' })
      const refund = after.receipts.filter(receipt => receipt.kind === 'refund').at(-1)
      if (refund && !before.receipts.some(receipt => receipt.id === refund.id)) {
        const line = dialogueFor(presentationEvents(before, after), after)
        expect(line).toMatchObject({ id: refund.id, role: 'banker' })
        expect(line!.text).toContain('CR 50')
        expect(line!.text).toContain(refund.note)
        return
      }
      before = applyCommand(after, actor.id, { type: 'finish' })
    }
    throw Error('Expected a deterministic treasury stop')
  })
  it('emits proposal/auction events exactly once without claiming settlement', () => {
    const initial = createSession(1847)
    const proposed = applyCommand(initial, 'player-1', { type: 'proposeOffer', toId: 'player-2', giveCash: 50, requestCash: 0 })
    const line = dialogueFor(presentationEvents(initial, proposed), proposed)
    expect(line).toMatchObject({ role: 'broker' })
    expect(line!.text).toContain('Nothing changes hands until acceptance')
    expect(proposed.game.players['player-1'].cash).toBe(1500)
    expect(presentationEvents(proposed, proposed)).toEqual([])
  })
  it('caps route presentation at the same duration as the board', () => {
    expect(movementDuration(2)).toBe(210)
    expect(movementDuration(12)).toBe(1100)
  })
})
