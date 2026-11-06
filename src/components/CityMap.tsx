import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { GameState, Space } from '../game'
import type { SessionFactory, SessionLoan } from '../game/session'
import { CityScene, cityGameConfig } from '../game/CityScene'
import './tabletop.css'

type CityMapProps = { state: GameState; onSelect: (space: Space) => void; zoom?: number; selectedId?: string; onZoomChange?: (zoom: number) => void; followActive?: boolean; fastResolution?: boolean; focusRequest?: number; onManualCamera?: () => void; factories?: SessionFactory[]; loans?: SessionLoan[] }

export function CityMap({ state, onSelect, zoom = 1, selectedId, onZoomChange, followActive = true, fastResolution = false, focusRequest, onManualCamera, factories, loans }: CityMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CityScene | null>(null)
  const latest = useRef({ state, onSelect, zoom, selectedId, onZoomChange, followActive, fastResolution, onManualCamera, factories, loans })
  latest.current = { state, onSelect, zoom, selectedId, onZoomChange, followActive, fastResolution, onManualCamera, factories, loans }
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!hostRef.current) return
    const scene = new CityScene()
    let game: Phaser.Game | undefined
    let disposed = false
    const connect = () => {
      if (disposed) return
      sceneRef.current = scene
      scene.setSelectionHandler(space => latest.current.onSelect(space))
      scene.setZoomHandler(value => latest.current.onZoomChange?.(value))
      scene.setManualCameraHandler(() => latest.current.onManualCamera?.())
      scene.setPresentationOptions(latest.current.followActive, latest.current.fastResolution)
      scene.setEconomyMarkers(latest.current.factories, latest.current.loans)
      scene.setZoom(latest.current.zoom)
      scene.setSelection(latest.current.selectedId)
      scene.syncState(latest.current.state)
    }
    // StrictMode may mount and clean up before Phaser's asynchronous boot. Defer
    // allocation a frame so that abandoned mounts never create a second canvas.
    const frame = requestAnimationFrame(() => {
      if (disposed || !hostRef.current) return
      game = new Phaser.Game({ ...cityGameConfig, parent: hostRef.current, input: { keyboard: { target: hostRef.current } }, scene: [scene] })
      game.events.once(Phaser.Core.Events.READY, connect)
      if (game.isBooted) connect()
    })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      game?.events.off(Phaser.Core.Events.READY, connect)
      sceneRef.current = null
      game?.destroy(true)
      game?.canvas?.remove()
    }
  }, [])

  useEffect(() => { sceneRef.current?.setPresentationOptions(followActive, fastResolution) }, [followActive, fastResolution])
  useEffect(() => { sceneRef.current?.setEconomyMarkers(factories, loans) }, [factories, loans])
  useEffect(() => { sceneRef.current?.syncState(state) }, [state])
  useEffect(() => { sceneRef.current?.setZoom(zoom) }, [zoom])
  useEffect(() => { sceneRef.current?.setSelection(selectedId) }, [selectedId])
  const previousFocus = useRef(focusRequest)
  useEffect(() => {
    if (focusRequest !== previousFocus.current) {
      previousFocus.current = focusRequest
      sceneRef.current?.focusActive()
    }
  }, [focusRequest])

  const selectFromDirectory = (space: Space) => {
    onSelect(space)
    onZoomChange?.(Math.max(zoom, 8))
    sceneRef.current?.setZoom(Math.max(zoom, 8))
    sceneRef.current?.setSelection(space.id)
    setDirectoryOpen(false)
  }

  const matches = state.spaces.filter(space => `${space.name} ${space.space + 1}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="city-map-shell">
    <div ref={hostRef} className="city-map-canvas" tabIndex={0} aria-label="Illustrated city board. Drag to pan when zoomed, scroll to zoom, or use the space directory below." aria-description="Illustrated city board. Arrow keys pan, plus and minus zoom, 0 reset the overview, and Home or F focus the active actor." />
    <div className="map-hint">144 stops · Closed city loop <span>Drag to pan / + to read deeds</span></div>
    <details className="map-directory" open={directoryOpen} onToggle={event => setDirectoryOpen(event.currentTarget.open)}>
      <summary>Browse all 144 spaces</summary>
      {directoryOpen && <div className="map-directory-content">
        <label htmlFor="map-space-search">Find a deed or stop</label>
        <input id="map-space-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search spaces" />
        <div className="map-directory-list" style={{ maxHeight: 240, overflowY: 'auto' }}>
          {matches.map(space => <button key={space.id} type="button" onClick={() => selectFromDirectory(space)} aria-current={selectedId === space.id ? 'true' : undefined}>
            <span>{String(space.space + 1).padStart(3, '0')} · {space.name}</span><strong>{space.kind === 'property' ? `CR ${space.price} · Rent CR ${space.mortgaged ? 0 : space.baseRent}` : 'City stop'} ↗</strong>
          </button>)}
          {!matches.length && <p>No matching streets. Try a district name.</p>}
        </div>
      </div>}
    </details>
  </div>
}
