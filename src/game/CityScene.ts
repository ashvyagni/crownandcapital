import Phaser from 'phaser'
import type { GameState, Space } from './index'
import type { SessionFactory, SessionLoan } from './session'
import { BOARD, CELL, MARGIN, WORLD, tilePosition } from './boardGeometry'

const VIEW_W = 1200
const VIEW_H = 720
const INK = 0x173d40
const PAPER = 0xeee8d5
const ACCENT = 0xa96349
const palette = [0xa96349, 0x528f80, 0xc39d60, 0x768b9b, 0x9b7c8e, 0x7b946a]

export const cityGameConfig: Phaser.Types.Core.GameConfig = {
  // This board is vector paths and text, not a shader scene. Canvas avoids
  // hundreds of text-texture uploads and works without a WebGL context.
  type: Phaser.CANVAS,
  width: VIEW_W,
  height: VIEW_H,
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: VIEW_W, height: VIEW_H },
  render: { antialias: true, pixelArt: false },
  fps: { target: 30, forceSetTimeOut: true },
  scene: [],
}

/** Draws a closed 144-deed route; the rules and landing resolution remain in game/index.ts. */
export class CityScene extends Phaser.Scene {
  private snapshot?: GameState
  private onSelect?: (space: Space) => void
  private nodes?: Phaser.GameObjects.Container
  private pawns?: Phaser.GameObjects.Container
  private selectedId?: string
  private zoomLevel = 1
  private dragging = false
  private moved = false
  private startX = 0
  private startY = 0
  private previousPositions = new Map<string, number>()
  private reducedMotion = false
  private zoomHandler?: (zoom: number) => void
  private tooltip?: Phaser.GameObjects.Text
  private followActive = true
  private fastResolution = false
  private manualCameraHandler?: () => void
  private cameraTween?: Phaser.Tweens.Tween
  private pawnTweens: Phaser.Tweens.Tween[] = []
  private activeId?: string
  private factories: SessionFactory[] = []
  private loans: SessionLoan[] = []

  constructor() { super('CityScene') }

  create() {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.cameras.main.setBackgroundColor('#eee4cd')
    this.cameras.main.setBounds(0, 0, WORLD, WORLD)
    this.setZoom(this.zoomLevel)
    this.drawCity()
    this.nodes = this.add.container(0, 0)
    this.pawns = this.add.container(0, 0).setDepth(20)
    this.scale.on('resize', () => this.setZoom(this.zoomLevel))
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true; this.moved = false; this.startX = pointer.x; this.startY = pointer.y
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return
      if (!this.moved && Math.hypot(pointer.x - this.startX, pointer.y - this.startY) > 5) {
        this.moved = true
        this.manualCamera()
      }
      if (this.zoomLevel > 1) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom
      }
    })
    this.input.on('pointerup', () => { this.dragging = false })
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      this.manualCamera()
      this.setZoom(this.zoomLevel * (dy > 0 ? 0.88 : 1.12))
      this.zoomHandler?.(this.zoomLevel)
    })
    if (this.snapshot) this.syncState(this.snapshot)
  }

  setSelection(id?: string) {
    const changed = this.selectedId !== id
    this.selectedId = id
    if (this.snapshot && this.nodes) this.drawNodes(this.snapshot)
    if (changed && this.zoomLevel > 1) this.focusSelection()
  }

  setSelectionHandler(handler: (space: Space) => void) { this.onSelect = handler }
  setZoomHandler(handler?: (zoom: number) => void) { this.zoomHandler = handler }
  setManualCameraHandler(handler?: () => void) { this.manualCameraHandler = handler }
  setPresentationOptions(follow: boolean, fast: boolean) {
    const snap = fast && !this.fastResolution
    if (!follow && this.followActive) { this.cameraTween?.stop(); this.cameraTween = undefined }
    this.followActive = follow; this.fastResolution = fast
    if (snap && this.snapshot && this.pawns) {
      this.cameraTween?.stop(); this.cameraTween = undefined
      this.drawPawns(this.snapshot)
    }
  }

  setEconomyMarkers(factories?: SessionFactory[], loans?: SessionLoan[]) {
    this.factories = factories ?? []
    this.loans = loans ?? []
    if (this.snapshot && this.nodes) this.drawNodes(this.snapshot)
  }

  private manualCamera() {
    this.followActive = false
    this.cameraTween?.stop()
    this.cameraTween = undefined
    this.manualCameraHandler?.()
  }

  private panTo(x: number, y: number) {
    if (!this.cameras?.main) return
    this.cameraTween?.stop()
    const camera = this.cameras.main
    if (this.reducedMotion || this.fastResolution) camera.centerOn(x, y)
    else {
      const center = { x: camera.midPoint.x, y: camera.midPoint.y }
      this.cameraTween = this.tweens.add({ targets: center, x, y, duration: 440, ease: 'Sine.easeInOut', onUpdate: () => camera.centerOn(center.x, center.y), onComplete: () => { this.cameraTween = undefined } })
    }
  }

  focusActive() {
    const player = Object.values(this.snapshot?.players ?? {})[this.snapshot?.activePlayer ?? 0]
    if (!player || !this.cameras?.main) return
    if (this.zoomLevel < 7) { this.setZoom(7); this.zoomHandler?.(this.zoomLevel) }
    const point = tilePosition(player.position)
    this.panTo(point.x, point.y)
  }

  private focusSelection() {
    const space = this.snapshot?.spaces.find(s => s.id === this.selectedId)
    if (space) { const point = tilePosition(space.space); this.panTo(point.x, point.y) }
  }

  setZoom(value: number) {
    const oldLevel = this.zoomLevel
    this.zoomLevel = Phaser.Math.Clamp(value, 1, 12)
    if (!this.cameras?.main) return
    const fit = Math.min(this.scale.width / WORLD, this.scale.height / WORLD) * 0.97
    this.cameras.main.setZoom(fit * this.zoomLevel)
    if (this.zoomLevel === 1) {
      this.cameraTween?.stop(); this.cameraTween = undefined
      this.cameras.main.removeBounds()
      this.cameras.main.centerOn(WORLD / 2, WORLD / 2)
    } else {
      this.cameras.main.setBounds(0, 0, WORLD, WORLD)
      if (oldLevel === 1) this.focusSelection()
    }
    this.tooltip?.destroy(); this.tooltip = undefined
    if ((oldLevel < 4) !== (this.zoomLevel < 4) && this.snapshot && this.nodes) this.drawNodes(this.snapshot)
    this.pawns?.list.forEach(pawn => (pawn as Phaser.GameObjects.Container).setScale(Math.max(1, 0.4 / this.cameras.main.zoom)))
  }

  syncState(snapshot: GameState) {
    const previousActive = this.activeId
    const nextActive = Object.values(snapshot.players)[snapshot.activePlayer]
    const previousPosition = nextActive && this.previousPositions.get(nextActive.id)
    this.snapshot = snapshot
    if (!this.nodes || !this.pawns) return
    this.drawNodes(snapshot)
    this.drawPawns(snapshot)
    const active = nextActive
    this.activeId = active?.id
    if (this.followActive && active && previousActive !== undefined && (previousActive !== active.id || previousPosition !== active.position)) {
      if (this.zoomLevel < 7) { this.setZoom(7); this.zoomHandler?.(this.zoomLevel) }
      if (previousPosition === undefined || previousPosition === active.position || this.reducedMotion || this.fastResolution || (active.position - previousPosition + snapshot.spaces.length) % snapshot.spaces.length > 12) {
        const point = tilePosition(active.position)
        this.panTo(point.x, point.y)
      }
    }
  }

  private drawCity() {
    const g = this.add.graphics()
    g.fillStyle(PAPER).fillRect(0, 0, WORLD, WORLD)
    g.fillStyle(0xceddd3).fillRect(MARGIN + CELL, MARGIN + CELL, BOARD - CELL * 2, BOARD - CELL * 2)
    g.lineStyle(9, INK).strokeRect(MARGIN + CELL, MARGIN + CELL, BOARD - CELL * 2, BOARD - CELL * 2)
    // Streets, civic blocks and the exchange tower are all original vector marks.
    g.lineStyle(13, 0xf8f1df)
    for (let x = 460; x < WORLD - 400; x += 310) g.lineBetween(x, 190, x, WORLD - 190)
    for (let y = 470; y < WORLD - 400; y += 310) g.lineBetween(190, y, WORLD - 190, y)
    for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
      const x = 300 + col * 390, y = 310 + row * 385
      const color = [0xdbc6a4, 0xc7d1bf, 0xd0baa8, 0xb8d0cb][(row + col) % 4]
       g.fillStyle(0x56716d, 0.45).fillRect(x + 15, y + 19, 170, 135)
       g.fillStyle(0x8b9a8d).fillRect(x + 9, y + 11, 170, 135)
       g.fillStyle(color).fillRect(x, y, 170, 135)
      g.lineStyle(5, INK).strokeRect(x, y, 170, 135)
      g.fillStyle(INK)
      for (let i = 0; i < 3; i++) g.fillRect(x + 20 + i * 50, y + 24, 22, 34)
      g.fillStyle(0xf8f1df).fillRect(x + 70, y + 90, 30, 45)
       g.fillStyle(0x526c61).fillEllipse(x + 240, y + 68, 74, 28)
       g.fillStyle(0x74977f).fillCircle(x + 230, y + 52, 35)
      g.lineStyle(4, INK).strokeCircle(x + 230, y + 52, 35)
    }
    const cx = WORLD / 2, cy = WORLD / 2
    g.fillStyle(0xf7e6bd).fillCircle(cx, cy, 400)
    g.lineStyle(12, INK).strokeCircle(cx, cy, 400)
    g.fillStyle(INK).fillRect(cx - 175, cy - 120, 350, 330)
    g.fillStyle(0xe4a749).fillRect(cx - 205, cy - 145, 410, 42)
    g.fillStyle(0xf8f1df)
    for (let i = 0; i < 5; i++) g.fillRect(cx - 137 + i * 68, cy - 68, 32, 75)
    g.fillStyle(ACCENT).fillTriangle(cx - 200, cy - 170, cx, cy - 340, cx + 200, cy - 170)
    g.fillStyle(0xe4a749).fillRect(cx - 60, cy + 95, 120, 115)
    this.add.text(cx, cy + 300, 'THE GRAND EXCHANGE', { color: '#183448', fontFamily: 'Georgia, serif', fontSize: '49px', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(cx, cy + 355, 'CROWN  •  CAPITAL  •  CITY', { color: '#183448', fontFamily: 'Arial, sans-serif', fontSize: '22px', letterSpacing: 5 }).setOrigin(0.5)
    this.add.text(cx, 205, '36 STOPS PER SIDE  ·  144 STOPS  ·  ONE CITY', { color: '#183448', fontFamily: 'Arial, sans-serif', fontSize: '23px', letterSpacing: 3 }).setOrigin(0.5)
  }

  private drawNodes(snapshot: GameState) {
    this.tooltip?.destroy(); this.tooltip = undefined
    this.nodes!.removeAll(true)
    const factories = new Map(this.factories.map(factory => [factory.propertyId, factory]))
    const loans = new Map(this.loans.map(loan => [loan.propertyId, loan]))
    snapshot.spaces.forEach((space, index) => {
      const { x, y } = tilePosition(index)
      const group = this.add.container(x, y)
      const shape = this.add.graphics()
      const districtIndex = space.kind === 'property' ? snapshot.districts.findIndex(d => d.id === space.districtId) : Math.floor(index / 8)
      const stripe = palette[((districtIndex % palette.length) + palette.length) % palette.length]
      const selected = this.selectedId === space.id
       shape.fillStyle(0x294b4b, 0.3).fillRect(-32, -29, 78, 78)
       shape.fillStyle(0x9b9786).fillRect(-39, -30, 78, 78)
       shape.fillStyle(selected ? 0xffe2a2 : space.kind === 'special' ? 0xffebcc : 0xfffaf0).fillRect(-39, -39, 78, 69)
      shape.fillStyle(stripe).fillRect(-36, -36, 72, 10)
       shape.lineStyle(selected ? 5 : 2, selected ? ACCENT : INK).strokeRect(-39, -39, 78, 69)
      if (space.kind === 'property' && space.ownerId) {
         shape.fillStyle(this.playerColor(space.ownerId)).fillRect(-37, 24, 74, 8)
       }
       if (space.kind === 'property' && space.development > 0) {
         for (let level = 0; level < space.development; level++) {
           const bx = -25 + level * 14
           shape.fillStyle(0x314d52).fillRect(bx + 4, 2, 11, 17)
           shape.fillStyle(0xdbb777).fillRect(bx, -2, 11, 17)
           shape.fillStyle(0xffedc4).fillRect(bx + 2, 1, 3, 4)
         }
       }
       const overview = this.zoomLevel < 4
       const title = this.add.text(0, -7, overview ? (space.kind === 'property' ? space.name.replace(/ (Arcade|Terrace|Exchange|Hall|Gardens|Works)$/, '') : space.specialKind.toUpperCase()) : space.name, { color: '#183448', fontFamily: 'Arial, sans-serif', fontSize: overview ? '10px' : '10px', fontStyle: 'bold', align: 'center', wordWrap: { width: 71, useAdvancedWrap: true }, lineSpacing: -1 }).setOrigin(0.5)
      const number = this.add.text(0, -31, String(index + 1).padStart(3, '0'), { color: '#183448', fontFamily: 'Arial, sans-serif', fontSize: '9px' }).setOrigin(0.5)
       const detail = this.add.text(0, 22, space.kind === 'property' ? `CR ${space.price}` : space.specialKind.toUpperCase(), { color: '#183448', fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold' }).setOrigin(0.5).setVisible(!overview && !(space.kind === 'property' && space.development > 0))
       group.add([shape, number, title, detail])
      const factory = factories.get(space.id)
      const loan = loans.get(space.id)
      if (factory) group.add(this.factoryMarker(factory))
      if (loan) group.add(this.loanMarker())
      const economyLine = [factory ? `Factory · Level ${factory.level}` : undefined, loan ? `Loan outstanding · CR ${loan.remaining}` : undefined].filter(Boolean).join('  ·  ')
      group.setSize(78, 78).setInteractive(new Phaser.Geom.Rectangle(-39, -39, 78, 78), Phaser.Geom.Rectangle.Contains)
      group.on('pointerup', () => { if (!this.moved) this.onSelect?.(space) })
      group.on('pointerover', () => {
        this.tooltip?.destroy()
         this.tooltip = this.add.text(x, y + 48, `${space.name}${!overview && space.kind === 'property' ? `\nCR ${space.price} · Rent CR ${space.baseRent}` : ''}${economyLine ? `\n${economyLine}` : ''}`, { color: '#fff7e7', backgroundColor: '#172d3d', padding: { x: 10, y: 8 }, fontFamily: 'Arial, sans-serif', fontSize: '13px', align: 'center' }).setOrigin(0.5, 0).setScale(1 / this.cameras.main.zoom).setDepth(100)
      })
      group.on('pointerout', () => { this.tooltip?.destroy(); this.tooltip = undefined })
      this.nodes!.add(group)
    })
  }

  /** Gold works glyph, top-right corner: boiler house + smokestack, ink outline. */
  private factoryMarker(factory: SessionFactory) {
    const badge = this.add.container(30, -30)
    const g = this.add.graphics()
    g.fillStyle(0x173d40, 0.3).fillRect(-10, -7, 21, 17)
    g.fillStyle(0xd7ad70).fillRect(-9, -8, 19, 16)
    g.lineStyle(2, INK).strokeRect(-9, -8, 19, 16)
    g.fillStyle(INK).fillRect(3, -15, 5, 8)
    g.fillStyle(0xeee8d5).fillRect(-6, -4, 5, 5).fillRect(1, -4, 5, 5)
    for (let level = 1; level < Math.min(factory.level, 4); level++) g.fillStyle(INK).fillRect(-9 + level * 5, 5, 3, 3)
    badge.add(g)
    return badge
  }

  /** Ember-red struck coin, top-left corner: outstanding debt marker. */
  private loanMarker() {
    const badge = this.add.container(-30, -30)
    const g = this.add.graphics()
    g.fillStyle(0x173d40, 0.3).fillCircle(-1, -1, 10)
    g.fillStyle(0xa95d43).fillCircle(0, 0, 9)
    g.lineStyle(2, INK).strokeCircle(0, 0, 9)
    g.lineStyle(2, 0xeee8d5).lineBetween(-5, 3, 5, -3)
    badge.add(g)
    return badge
  }

  private playerColor(id: string) {
    const index = Math.max(0, Number(id.replace(/\D/g, '') || 1) - 1)
    return palette[index % palette.length]
  }

  private drawPawns(snapshot: GameState) {
    this.pawnTweens.forEach(tween => tween.stop())
    this.pawnTweens = []
    this.pawns!.removeAll(true)
    const allPlayers = Object.values(snapshot.players)
    const players = allPlayers.filter(player => player.status === 'active')
    const active = allPlayers[snapshot.activePlayer]
    const priorActivePosition = active && this.previousPositions.get(active.id)
    players.forEach((player, i) => {
      const current = tilePosition(player.position)
      const occupants = players.filter(p => p.position === player.position)
      const slot = occupants.findIndex(p => p.id === player.id)
       const columns = Math.min(4, occupants.length)
       const offset = (slot % columns - (columns - 1) / 2) * 18
       const offsetY = 15 + Math.floor(slot / columns) * 24
      const avatar = this.add.container(current.x + offset, current.y + offsetY).setDepth(30).setScale(Math.max(1, 0.4 / this.cameras.main.zoom))
      const g = this.add.graphics()
      const color = this.playerColor(player.id)
      g.fillStyle(0xfffaf0).fillEllipse(0, 6, 42, 49)
      g.lineStyle(3, INK).strokeEllipse(0, 6, 42, 49)
      g.fillStyle(color).fillRoundedRect(-13, 4, 26, 22, 5)
      g.lineStyle(2, INK).strokeRoundedRect(-13, 4, 26, 22, 5)
      g.fillStyle(0xf4c89e).fillCircle(0, -5, 12)
      g.lineStyle(2, INK).strokeCircle(0, -5, 12)
      g.fillStyle(INK).fillCircle(-4, -5, 1.8).fillCircle(4, -5, 1.8)
      const character = player.character ?? i % 6
      if (character % 3 === 0) {
        g.fillStyle(INK).fillRect(-16, -19, 32, 5)
        g.fillStyle(color).fillRect(-10, -31, 20, 14)
        g.lineStyle(2, INK).strokeRect(-10, -31, 20, 14)
      } else if (character % 3 === 1) {
        g.fillStyle(color).fillTriangle(-14, -16, 0, -36, 14, -16)
        g.lineStyle(2, INK).strokeTriangle(-14, -16, 0, -36, 14, -16)
      } else {
        g.fillStyle(color).fillCircle(0, -20, 14)
        g.lineStyle(2, INK).strokeCircle(0, -20, 14)
      }
      if (player.id === allPlayers[snapshot.activePlayer]?.id) {
        g.lineStyle(4, ACCENT).strokeCircle(0, 0, 28)
        avatar.add(this.add.text(0, -49, '▼', { color: '#d85643', fontSize: '23px', fontStyle: 'bold' }).setOrigin(0.5))
      }
      avatar.add(g)
      this.pawns!.add(avatar)
      const previous = this.previousPositions.get(player.id)
       if (previous !== undefined && previous !== player.position && !this.reducedMotion && !this.fastResolution) {
        const distance = (player.position - previous + snapshot.spaces.length) % snapshot.spaces.length
        if (distance <= 12) {
          const route = Array.from({ length: distance + 1 }, (_, step) => tilePosition((previous + step) % snapshot.spaces.length))
          const follower = { t: 0 }
           const tween = this.tweens.add({ targets: follower, t: distance, duration: Math.min(1100, distance * 105), ease: 'Sine.easeInOut', onUpdate: () => {
            const index = Math.min(distance - 1, Math.floor(follower.t))
            const fraction = follower.t - index
             avatar.setPosition(Phaser.Math.Linear(route[index].x, route[index + 1].x, fraction) + offset, Phaser.Math.Linear(route[index].y, route[index + 1].y, fraction) + offsetY)
             if (this.followActive && active?.id === player.id) this.cameras.main.centerOn(avatar.x, avatar.y)
           } })
           this.pawnTweens.push(tween)
        }
      }
      this.previousPositions.set(player.id, player.position)
    })
    if (this.followActive && active && priorActivePosition !== undefined && priorActivePosition !== active.position && !this.reducedMotion && !this.fastResolution) {
      const point = tilePosition(priorActivePosition)
      this.cameraTween?.stop(); this.cameraTween = undefined
      this.cameras.main.centerOn(point.x, point.y)
    }
  }
}
