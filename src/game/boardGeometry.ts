export const CELL = 80
export const SIDE = 36
export const BOARD = SIDE * CELL
export const MARGIN = 100
export const WORLD = BOARD + MARGIN * 2 + CELL

/** Clockwise perimeter with four corner turns, one unique center per deed. */
export function tilePosition(index: number) {
  const n = ((index % 144) + 144) % 144
  const side = Math.floor(n / SIDE)
  const step = n % SIDE
  const low = MARGIN + CELL / 2
  const high = low + SIDE * CELL
  if (side === 0) return { x: low + step * CELL, y: low }
  if (side === 1) return { x: high, y: low + step * CELL }
  if (side === 2) return { x: high - step * CELL, y: high }
  return { x: low, y: high - step * CELL }
}
