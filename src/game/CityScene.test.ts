import { describe, expect, it } from 'vitest'
import { tilePosition } from './boardGeometry'

describe('city board geometry', () => {
  it('places 144 distinct squares in one closed, evenly spaced route', () => {
    const points = Array.from({ length: 144 }, (_, index) => tilePosition(index))
    expect(new Set(points.map(({ x, y }) => `${x},${y}`)).size).toBe(144)
    for (let i = 0; i < 144; i++) {
      const a = points[i], b = points[(i + 1) % 144]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBe(80)
    }
    expect(tilePosition(144)).toEqual(points[0])
    expect(tilePosition(-1)).toEqual(points[143])
  })
})
