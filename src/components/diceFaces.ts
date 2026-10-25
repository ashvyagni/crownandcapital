/** Face arrangement uses opposite pairs 1–6, 2–5, and 3–4. */
export const DICE_FACES = [1, 2, 3, 4, 5, 6] as const
export type DieFace = (typeof DICE_FACES)[number]

/** Rotation of the whole cube that places the requested face toward the viewer. */
export const FACE_ROTATIONS: Record<DieFace, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 0, y: 180 },
}

export function isDieFace(value: number): value is DieFace {
  return Number.isInteger(value) && value >= 1 && value <= 6
}

export function confirmedDiceTotal(first: number, second: number): number {
  if (!isDieFace(first) || !isDieFace(second)) throw new RangeError('Dice faces must be integers from 1 to 6')
  return first + second
}

/** Positions in a three-by-three grid, numbered from the top left. */
export const FACE_PIPS: Record<DieFace, readonly number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}
