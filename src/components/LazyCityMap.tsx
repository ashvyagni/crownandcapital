import { lazy, Suspense } from 'react'
import type { GameState, Space } from '../game'
import type { SessionFactory, SessionLoan } from '../game/session'

// Keep the game renderer off the marketing page's initial loading path.
const Board = lazy(() => import('./CityMap').then(module => ({ default: module.CityMap })))
type Props = { state: GameState; onSelect: (space: Space) => void; zoom?: number; selectedId?: string; onZoomChange?: (zoom: number) => void; followActive?: boolean; fastResolution?: boolean; focusRequest?: number; onManualCamera?: () => void; factories?: SessionFactory[]; loans?: SessionLoan[] }

export function CityMap(props: Props) {
  return <Suspense fallback={<div className="board-loading" role="status"><strong>UNFOLDING THE CITY…</strong><span>Your table is ready. Preparing the board.</span></div>}><Board {...props} /></Suspense>
}
