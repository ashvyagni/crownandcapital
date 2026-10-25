import { describe, expect, it } from 'vitest'
import { confirmedDiceTotal, DICE_FACES, FACE_PIPS, FACE_ROTATIONS } from './diceFaces'

describe('dice presentation contract', () => {
  it('provides exactly one deterministic orientation and the correct number of visible pips per face', () => {
    expect(DICE_FACES).toEqual([1, 2, 3, 4, 5, 6])
    expect(DICE_FACES.map(face => FACE_ROTATIONS[face])).toEqual([
      { x: 0, y: 0 }, { x: 90, y: 0 }, { x: 0, y: -90 },
      { x: 0, y: 90 }, { x: -90, y: 0 }, { x: 0, y: 180 },
    ])
    for (const face of DICE_FACES) expect(FACE_PIPS[face]).toHaveLength(face)
  })

  it('uses passed values for the confirmed total without rolling or randomizing', () => {
    for (const first of DICE_FACES) for (const second of DICE_FACES) {
      expect(confirmedDiceTotal(first, second)).toBe(first + second)
    }
    expect(() => confirmedDiceTotal(0, 6)).toThrow(RangeError)
    expect(() => confirmedDiceTotal(1.5, 4)).toThrow(RangeError)
  })
})
