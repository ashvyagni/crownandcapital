import { useEffect, useRef, useState } from 'react'
import { CityMap } from './components/LazyCityMap'
import { Character, CHARACTER_NAMES } from './components/Character'
import { Landing } from './components/Landing'
import { WorldAmbience } from './components/WorldAmbience'
import { DeedArtwork } from './components/DeedArtwork'
import { DialogFrame } from './components/DialogFrame'
import { EconomyDesk, AuctionPanel, cr, type SendCommand } from './components/EconomyDesk'
import { OnlineLobby } from './components/OnlineLobby'
import { AudioControls } from './components/AudioControls'
import { DiceTray } from './components/DiceTray'
import { CityCommentary } from './components/CityCommentary'
import { useTurnPresentation } from './hooks/useTurnPresentation'
import { usePresentationPreferences } from './hooks/usePresentationPreferences'
import { useOnlineRoom } from './hooks/useOnlineRoom'
import { useGameAudio } from './hooks/useGameAudio'
import { applyCommand, createSession, type SessionCommand } from './game/session'
import { ownershipGroup, ownsGroup, redemptionCost, rentFor, saleValue, validateRoster, type Property } from './game'
import { clearLocalSession, exportLocalSession, importLocalSession, loadLocalSession, saveLocalSession } from './services/localSession'
import type { AudioCue } from './services/audio'
import { requestId } from './services/requestId'
import { presentationEvents } from './game/presentation'

const defaults = ['Avery Vale', 'Briar Holt', 'Cato Reed', 'Nia Sable']
type Dialog = 'setup' | 'restart' | 'profile' | 'landing' | 'manage' | 'exchange' | 'online' | null
const savedOnline = () => { try { return !!sessionStorage.getItem('crown-and-capital:online-identity:v1') && sessionStorage.getItem('crown-and-capital:online-identity:v1:active') !== '0' } catch { return false } }
// Shareable room links look like <origin>/r/<10-character room code>; anything else under /r/ is a broken invite.
type Invite = { code?: string; invalid?: boolean } | null
const readInvite = (pathname: string): Invite => {
  if (pathname !== '/r' && !pathname.startsWith('/r/')) return null
  const code = pathname.replace(/^\/r\/?/, '').replace(/\/$/, '')
  return /^[A-F0-9]{10}$/i.test(code) ? { code: code.toUpperCase() } : { invalid: true }
}
const cueFor = (kind: string): AudioCue => ({ roll: 'roll', purchase: 'purchase', rent: 'rent', mortgage: 'mortgage', unmortgage: 'mortgage', auction: 'auction', factory: 'factory', materials: 'factory', energy: 'factory', production: 'factory', goods: 'factory', upgrade: 'factory', loan: 'loan', repayment: 'loan' }[kind] as AudioCue | undefined) ?? 'turn'

function App() {
  const [loaded] = useState(loadLocalSession)
  // An invite is read before the first render: a valid /r/<code> opens the join flow immediately.
  const [invite, setInvite] = useState<Invite>(() => readInvite(window.location.pathname))
  const deepLink = useRef(!!invite?.code)
  const [local, setLocal] = useState(() => loaded.session ?? createSession(1847, defaults))
  const [mode, setMode] = useState<'local' | 'online'>(() => (deepLink.current || savedOnline()) ? 'online' : 'local')
  const [view, setView] = useState<'home' | 'game'>(() => loaded.session || savedOnline() ? 'game' : 'home')
  const [dialog, setDialog] = useState<Dialog>(() => deepLink.current ? 'online' : loaded.session?.pendingId ? 'landing' : null)
  const [selectedId, setSelectedId] = useState('property-2')
  const [names, setNames] = useState(defaults)
  const [characters, setCharacters] = useState([0, 1, 2, 3])
  const [newName, setNewName] = useState('')
  const [newCharacter, setNewCharacter] = useState(0)
  const [error, setError] = useState<string | null>(loaded.error ?? null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [confirmSale, setConfirmSale] = useState(false)
  const [exchangeTab, setExchangeTab] = useState('Factories')
  const [localTableId, setLocalTableId] = useState(0)
  const [focusRequest, setFocusRequest] = useState(0)
  const preferences = usePresentationPreferences()
  const online = useOnlineRoom()
  const audio = useGameAudio()
  const session = mode === 'online' && online.room?.session ? online.room.session : local
  const game = session.game
  const tableIdentity = mode === 'online' ? `online:${online.room?.code ?? 'connecting'}` : `local:${localTableId}`
  const presentation = useTurnPresentation(session, tableIdentity, preferences.fast || preferences.reducedMotion)
  const players = Object.values(game.players)
  const actor = players[game.activePlayer]
  const selfId = mode === 'online' ? online.playerId ?? actor.id : actor.id
  const self = game.players[selfId] ?? actor
  const myTurn = mode === 'local' || actor.id === online.playerId
  const busy = presentation.presenting || (mode === 'online' && (online.pending || online.status !== 'connected'))
  const space = game.spaces.find(s => s.id === selectedId) ?? game.spaces[0]
  const property = space.kind === 'property' ? space : null
  const pending = session.pendingId ? game.spaces[game.players[session.pendingId].position] : null
  const auction = session.economy.auction
  const landedRent = session.receipts.filter(r => r.turn === game.turn && r.kind === 'rent').at(-1)
  const winner = players.filter(p => p.status === 'active').length === 1 ? players.find(p => p.status === 'active') : null
  const latest = useRef({ session, identity: tableIdentity })

  useEffect(() => { if (!deepLink.current && savedOnline()) online.resume() }, [online.resume])
  // Leaving an invite resets the address bar so a refresh cannot replay a dismissed link.
  const clearInvitePath = () => {
    setInvite(null)
    if (window.location.pathname.startsWith('/r/')) window.history.replaceState(null, '', '/')
  }
  const dismissInvite = () => { clearInvitePath(); setDialog(null); setView('home') }
  useEffect(() => {
    document.title = `CROWN & CAPITAL — ${view === 'game' ? 'The living ledger' : 'An atlas of ambition'}`
  }, [view])
  useEffect(() => {
    if (mode !== 'local' || view !== 'game') return
    const result = saveLocalSession(local)
    setSaveError(result.error ?? null)
  }, [local, mode, view])
  useEffect(() => {
    if (mode === 'online' && !online.room?.session) return
    if (mode === 'online') setView('game')
    if (presentation.presenting) return
    if (session.pendingId) {
      setSelectedId(game.spaces[game.players[session.pendingId].position].id)
      setDialog('landing')
    } else setDialog(current => current === 'landing' || current === 'online' ? null : current)
  }, [mode, online.room?.started, session.pendingId, game.turn, auction?.propertyId, presentation.presenting])
  useEffect(() => {
    const before = latest.current
    if (before.identity === tableIdentity && session.revision === before.session.revision + 1) {
      const events = presentationEvents(before.session, session)
      const receipt = events.filter(event => event.type === 'receipt').at(-1)
      audio.play(events.some(event => event.type === 'roll') ? 'roll' : receipt ? cueFor(receipt.receipt.kind) : 'turn')
    }
    latest.current = { session, identity: tableIdentity }
  }, [session.revision, tableIdentity])

  const send: SendCommand = (command, actorOverride) => {
    if (presentation.presenting) return
    void audio.unlock()
    setError(null)
    if (mode === 'online') { online.send(command, session.revision); return }
    try {
      const next = applyCommand(local, actorOverride ?? actor.id, command, requestId())
      setLocal(next)
      if (command.type === 'finish' || command.type === 'pass') setDialog(null)
      if (command.type === 'sell' && dialog === 'manage') setDialog(null)
      setConfirmSale(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That action could not be completed.'); audio.play('error') }
  }
  const openSetup = () => {
    if (mode === 'online') { setDialog('online'); return }
    if (game.turn) { setDialog('restart'); return }
    setNames(players.map(p => p.name)); setCharacters(players.map((p, i) => p.character ?? i % 6)); setNewName(''); setError(null); setDialog('setup')
  }
  const commitSetup = () => {
    const issue = validateRoster(names)
    if (issue) { setError(issue); return }
    clearLocalSession(); setLocalTableId(id => id + 1); setLocal(createSession(1847, names, characters)); setDialog(null); setView('game'); setMode('local'); setZoom(1); setError(null)
  }
  const addSeat = () => {
    const issue = validateRoster([...names, newName.trim()])
    if (issue) { setError(issue); return }
    setNames([...names, newName.trim()]); setCharacters([...characters, newCharacter]); setNewName(''); setNewCharacter((newCharacter + 1) % 6); setError(null)
  }
  const enter = () => { void audio.unlock(); setView('game'); setDialog(mode === 'online' && !online.room?.session ? 'online' : session.pendingId ? 'landing' : null) }
  const openOnline = () => { setMode('online'); setDialog('online'); setError(null) }
  const leaveOnline = () => { online.leave(); clearInvitePath(); setMode('local'); setDialog(null); setView('home') }
  const exportSave = () => {
    const json = exportLocalSession(local); if (!json) { setError('Save could not be exported.'); return }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'crown-and-capital-save.json'; link.click(); URL.revokeObjectURL(url)
  }
  const importSave = async (file?: File) => {
    if (!file) return
    if (file.size > 1_000_000) { setError('Save file exceeds 1 MB.'); return }
    const result = importLocalSession(await file.text())
    if (!result.session) { setError(result.error ?? 'Invalid save.'); return }
    online.leave(); clearLocalSession(); setLocalTableId(id => id + 1); setMode('local'); setLocal(result.session); setView('game'); setDialog(result.session.pendingId ? 'landing' : null); setError(null)
  }
  const manualZoom = (value: number) => { preferences.setPreference('follow', false); setZoom(Math.max(1, Math.min(12, value))) }
  const actions = (deed: Property) => {
    const collateral = session.economy.loans.some(l => l.propertyId === deed.id)
    const factory = session.economy.factories.some(f => f.propertyId === deed.id)
    const group = ownershipGroup(game, deed)
    const locked = busy || !myTurn || !!auction || collateral
    const act = (type: SessionCommand['type']) => send({ type, propertyId: deed.id })
    return <div className="gameplay-actions">
      <button disabled={locked || factory || deed.mortgaged || group.some(p => p.mortgaged) || !ownsGroup(game, actor.id, deed) || deed.development >= deed.maxDevelopment || actor.cash < deed.developmentCost} onClick={() => act('develop')}>Develop · {cr(deed.developmentCost)}</button>
      <button disabled={locked || factory || deed.mortgaged || deed.development > 0} onClick={() => act('mortgage')}>Mortgage · +{cr(deed.mortgage)}</button>
      <button disabled={locked || !deed.mortgaged || actor.cash < redemptionCost(deed)} onClick={() => act('redeem')}>Redeem · {cr(redemptionCost(deed))}</button>
      <button disabled={locked || factory || group.some(p => p.id !== deed.id && p.development > 0)} onClick={() => setConfirmSale(true)}>Sell to bank · {cr(saleValue(deed))}</button>
      {deed.development > 0 && <button disabled={locked} onClick={() => act('building')}>Sell one building</button>}
      <button disabled={busy} onClick={() => setDialog('exchange')}>Factories, loans & deals ↗</button>
      {confirmSale && <div className="sale-confirm" role="alert"><strong>Release this deed for {cr(saleValue(deed))}?</strong><p>Its ownership returns to the bank.</p><button onClick={() => act('sell')}>Confirm sale</button><button onClick={() => setConfirmSale(false)}>Keep deed</button></div>}
      <small>{collateral ? 'This deed is pledged as loan collateral. Repay it at the City Bank to unlock management.' : 'Build with a complete unmortgaged district. Factories occupy vacant deeds; buildings and factories cannot share a deed.'}</small>
    </div>
  }

  return <div className="app-shell">
    <WorldAmbience />
    {view === 'home' ? <Landing onPlay={enter} onAuth={() => setDialog('profile')} onRoom={openSetup} onOnline={openOnline} /> : <main className="game-page">
      <header className="game-topbar">
        <button className="brand-lockup compact" onClick={() => setView('home')}>✦ CROWN & CAPITAL</button>
        <span className="match-pill">{mode === 'online' ? `ONLINE ${online.room?.code ?? ''}` : 'LOCAL TABLE'} • TURN {game.turn}</span>
        <div className="topbar-actions"><button className="outline-button small" onClick={() => setDialog('exchange')}>City exchange</button><button className="avatar-button" onClick={() => setDialog('profile')} aria-label="Open local profile">{self.name.slice(0, 2).toUpperCase()}</button></div>
      </header>
      {mode === 'online' && <div className="connection-banner" role="status">Room {online.room?.code ?? '—'} · {online.status} · You are {online.room?.seats.find(s => s.id === online.playerId)?.name ?? 'connecting'}<button onClick={online.retry}>{online.status === 'connected' ? 'Refresh room state' : 'Reconnect'}</button>{online.error && <span role="alert">{online.error}</span>}</div>}
      <div className="game-layout">
        <aside className="player-rail"><div className="rail-heading"><div><p className="eyebrow">The table</p><h2>{players.length} seats live</h2></div><button className="add-seat" onClick={openSetup} disabled={mode === 'local' && game.turn > 0} title={game.turn ? 'Seats lock after the first roll' : 'Add a player'} aria-label="Add a player">+</button></div>
          <div className="roster">{players.map((p, index) => <div className={`player-row ${p.id === actor.id ? 'active' : ''} ${p.status === 'bankrupt' ? 'bankrupt' : ''}`} key={p.id}><Character index={p.character ?? index % 6} className="gameplay-avatar" /><span className="player-details"><strong>{p.name}{mode === 'online' && p.id === selfId ? ' · you' : ''}</strong><small>{p.status === 'bankrupt' ? 'Bankrupt' : p.id === actor.id ? 'At the desk' : `Space ${p.position + 1}`}{mode === 'online' && !online.room?.seats.find(s => s.id === p.id)?.connected ? ' · offline' : ''}</small></span><span className="player-cash">{cr(p.cash)}</span></div>)}</div>
          <p className="save-indicator">{mode === 'local' ? saveError ? 'Save needs attention' : '✓ Saved on this browser' : '✓ Server-saved room'}</p>
          <button className="rail-link" onClick={() => setDialog('profile')}>Profile, audio & saves ↗</button>
        </aside>
        <section className="map-stage"><div className="map-heading"><div><p className="eyebrow">Atlas / route view</p><h1>THE CITY, <em>in play.</em></h1></div><div className="map-controls"><span>Zoom</span><button aria-label="Zoom out" onClick={() => manualZoom(zoom - 1)}>−</button><button aria-label="Reset zoom" onClick={() => manualZoom(1)}>◎</button><button aria-label="Zoom in" onClick={() => manualZoom(zoom + 1)}>+</button></div></div>
          <div className="map-frame"><CityMap state={presentation.board} selectedId={selectedId} zoom={zoom} onZoomChange={setZoom} onSelect={s => setSelectedId(s.id)} followActive={preferences.follow} fastResolution={presentation.snapped} focusRequest={focusRequest} onManualCamera={() => preferences.setPreference('follow', false)} factories={session.economy.factories} loans={session.economy.loans} /></div>
          <div className="map-status">Drag to explore · Select any deed · Zoom {zoom.toFixed(1)}×</div>
          <div className="presentation-toolbar"><button aria-pressed={preferences.follow} onClick={() => preferences.setPreference('follow', !preferences.follow)}>Camera follow {preferences.follow ? 'on' : 'off'}</button><button onClick={() => setFocusRequest(value => value + 1)}>Return to active player ↗</button><button aria-pressed={preferences.fast} onClick={() => preferences.setPreference('fast', !preferences.fast)}>Fast resolution {preferences.fast ? 'on' : 'off'}</button></div>
          <div className="exchange-shortcuts"><button onClick={() => { setExchangeTab('Factories'); setDialog('exchange') }}>▥ Factories</button><button onClick={() => { setExchangeTab('Bank'); setDialog('exchange') }}>◇ City Bank</button><button onClick={() => { setExchangeTab('Auctions'); setDialog(auction ? 'landing' : 'exchange') }}>⚑ Auctions{auction ? ' · LIVE' : ''}</button><button onClick={() => { setExchangeTab('Deals'); setDialog('exchange') }}>↔ Negotiations{session.economy.offers.some(o => o.status === 'open') ? ' · NEW' : ''}</button></div>
        </section>
        <aside className="command-panel"><div className="command-heading"><p className="eyebrow">Current desk</p><h2>{actor.name}</h2><span>Space {actor.position + 1}{!myTurn ? ' · Waiting for their move' : ''}</span></div><div className="balance-block"><span>Available balance</span><strong>{cr(actor.cash)}</strong></div>
          <div className="turn-action"><p role="status">{winner ? `${winner.name} wins the table!` : presentation.phase === 'rolling' ? 'The dice are on the table…' : presentation.phase === 'moving' ? `Following the route · ${session.lastRoll?.total} stops` : presentation.phase === 'syncing' ? 'Synchronizing the table…' : pending ? auction ? 'Auction live · bid or fold to continue.' : session.landingOffer ? 'Choose whether to acquire the deed or open bidding.' : 'Landing settled · manage assets or end turn.' : `${actor.name} is at the desk. Roll when ready.`}</p>{session.lastRoll && <div className="dice-result"><DiceTray first={session.lastRoll.first} second={session.lastRoll.second} rolling={presentation.phase === 'rolling'} reducedMotion={presentation.snapped} /></div>}
            {presentation.presenting && <button className="outline-button" onClick={presentation.skip}>Skip animation →</button>}
            <button className="roll-button" disabled={!!pending || busy || !myTurn || !!winner || !!dialog || (mode === 'online' && !online.room?.started)} onClick={() => send({ type: 'roll' })}>Roll the dice ↗</button>
            {pending && !presentation.presenting && <button className="text-button" onClick={() => setDialog('landing')}>{auction ? 'Open live auction' : 'Resolve landing'} ↗</button>}
          </div>
          {preferences.dialogue && !presentation.presenting && presentation.dialogue && <CityCommentary line={presentation.dialogue} speech={preferences.speech && audio.enabled} dismiss={presentation.dismissDialogue} />}
          <div className="inspector"><p className="eyebrow">Selected asset</p><h3>{space.name}</h3>{property ? <><p>{game.districts.find(d => d.id === property.districtId)?.name} · {property.mortgaged ? 'Mortgaged' : `Level ${property.development}`}</p><div className="inspector-stats"><div>Price<strong>{cr(property.price)}</strong></div><div>Rent<strong>{cr(rentFor(game, property))}</strong></div><div>Mortgage<strong>{cr(property.mortgage)}</strong></div></div><p>Owner: {property.ownerId ? game.players[property.ownerId]?.name : 'Bank'}</p>{property.ownerId === selfId && <button className="outline-button" onClick={() => { setConfirmSale(false); setDialog('manage') }}>Manage deed ↗</button>}</> : <p>Public space · {space.kind === 'special' ? space.specialKind : ''}</p>}</div>
          <div className="portfolio"><p className="eyebrow">Your deeds / {self.properties.length}</p>{self.properties.map(id => {
            const deed = game.spaces.find(s => s.id === id)
            return deed?.kind === 'property' && <button key={id} onClick={() => { setSelectedId(id); setConfirmSale(false); setDialog('manage') }}>{deed.name}<span>{deed.mortgaged ? 'Mortgaged' : `Level ${deed.development}`} ↗</span></button>
          })}{!self.properties.length && <small>Your first deed is a roll away.</small>}</div>
          <div className="ledger-preview" aria-live="polite"><p className="eyebrow">Latest receipts</p>{session.receipts.filter(r => r.kind !== 'roll').slice(-5).reverse().map(entry => <div className="ledger-entry" key={entry.id}><span><small>{entry.kind}</small>{entry.note}</span><strong>{entry.kind === 'production' ? `${entry.amount} goods` : cr(entry.amount)}</strong></div>)}{!session.receipts.some(r => r.kind !== 'roll') && <small>No transactions yet.</small>}</div>
        </aside>
      </div>
    </main>}
    {(error || saveError) && <div className="global-notice" role="alert"><span>{error ?? saveError}</span><button aria-label="Dismiss message" onClick={() => { setError(null); setSaveError(null) }}>×</button></div>}
    {invite?.invalid && <DialogFrame title="That room link did not work" close={dismissInvite}>
      <p>This invite points at <code>{window.location.pathname}</code>, which this server does not recognise. Room links look like <code>/r/</code> followed by a 10-character room code.</p>
      <div className="landing-choices"><button className="primary-button" onClick={dismissInvite}>Go to the home page</button></div>
    </DialogFrame>}
    {dialog === 'setup' && <DialogFrame title="Set your table" close={() => setDialog(null)}>
      <p>Choose 2–20 local players. Names, characters, deeds and every unfinished decision are saved automatically.</p>
      {error && <p role="alert">{error}</p>}
      <div className="gameplay-roster-edit">{names.map((name, index) => <div key={index}><Character index={characters[index]} className="gameplay-avatar" /><input aria-label={`Player ${index + 1} name`} value={name} maxLength={30} onChange={e => setNames(list => list.map((n, i) => i === index ? e.target.value : n))} /><select aria-label={`Player ${index + 1} character`} value={characters[index]} onChange={e => setCharacters(list => list.map((n, i) => i === index ? Number(e.target.value) : n))}>{CHARACTER_NAMES.map((label, i) => <option value={i} key={label}>{label}</option>)}</select><button disabled={names.length <= 2} onClick={() => { setNames(list => list.filter((_, i) => i !== index)); setCharacters(list => list.filter((_, i) => i !== index)) }}>Remove</button></div>)}</div>
      <div className="gameplay-add"><input aria-label="New player name" placeholder="New player name" maxLength={30} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSeat() }} /><select aria-label="New player character" value={newCharacter} onChange={e => setNewCharacter(Number(e.target.value))}>{CHARACTER_NAMES.map((label, i) => <option value={i} key={label}>{label}</option>)}</select><button disabled={names.length >= 20} onClick={addSeat}>Add player</button></div>
      <button className="primary-button modal-submit" onClick={commitSetup}>Enter the city →</button>
    </DialogFrame>}
    {dialog === 'restart' && <DialogFrame title="Start a fresh table?" close={() => setDialog(null)}><p>This replaces your current local save. Export it from your profile first if you want to keep it.</p><div className="landing-choices"><button className="primary-button" onClick={() => { clearLocalSession(); setLocal(createSession(1847, defaults)); setNames(defaults); setCharacters([0, 1, 2, 3]); setDialog('setup'); setError(null); setConfirmSale(false) }}>Start new table</button><button className="outline-button" onClick={() => setDialog(null)}>Keep playing</button></div></DialogFrame>}
    {dialog === 'profile' && <DialogFrame title="Local table profile" close={() => setDialog(null)}>
      <Character index={self.character} className="profile-character" /><p>{self.name} · {cr(self.cash)} · {self.properties.length} deeds · {self.turns} turns</p>
      <AudioControls audio={audio} /><button className="outline-button" disabled={!audio.enabled} onClick={() => { void audio.unlock().then(() => audio.play('purchase')) }}>Play sound preview</button>
      <fieldset className="presentation-preferences"><legend>Table presentation</legend><label><input type="checkbox" checked={preferences.follow} onChange={event => preferences.setPreference('follow', event.target.checked)} /> Follow the active player</label><label><input type="checkbox" checked={preferences.fast} onChange={event => preferences.setPreference('fast', event.target.checked)} /> Fast resolution (skip dice and route animation)</label><label><input type="checkbox" checked={preferences.dialogue} onChange={event => preferences.setPreference('dialogue', event.target.checked)} /> Contextual city dialogue</label><label><input type="checkbox" checked={preferences.speech} onChange={event => preferences.setPreference('speech', event.target.checked)} /> Speak city dialogue (also requires sound on)</label><small>{preferences.reducedMotion ? 'Reduced motion is active: animations resolve immediately.' : 'Your system reduced-motion setting is always respected.'} These preferences never change rules or balances.</small></fieldset>
      <section className="save-tools"><h3>Your saved city</h3><p>Local games save automatically on this browser. Online games are saved by the server and resumed with this tab's private seat identity.</p><button className="outline-button" onClick={exportSave}>Export local save</button><label className="field-label">Import local save (replaces local game)<input type="file" accept="application/json,.json" onChange={e => void importSave(e.target.files?.[0])} /></label></section>
      <div className="landing-choices"><button className="outline-button" onClick={openSetup}>{game.turn ? 'Start a fresh table' : 'Customize this table'} ↗</button><button className="outline-button" onClick={openOnline}>Online table ↗</button></div>
    </DialogFrame>}
    {dialog === 'online' && <DialogFrame title="The online table" close={() => { setDialog(null); clearInvitePath() }} wide><OnlineLobby online={online} onLeave={leaveOnline} initialCode={invite?.code} /></DialogFrame>}
    {mode === 'online' && view === 'game' && !online.room?.session && dialog !== 'online' && <DialogFrame title="The online table" close={leaveOnline} wide><OnlineLobby online={online} onLeave={leaveOnline} initialCode={invite?.code} /></DialogFrame>}
    {dialog === 'exchange' && <DialogFrame title="The city exchange" close={() => setDialog(pending ? 'landing' : null)} wide><EconomyDesk session={session} playerId={selfId} online={mode === 'online'} busy={busy} send={send} initialTab={exchangeTab} /><button className="outline-button exchange-back" onClick={() => setDialog(pending ? 'landing' : null)}>{pending ? 'Back to landing' : 'Back to table'} ↗</button></DialogFrame>}
    {dialog === 'manage' && property && <DialogFrame title={`Manage ${property.name}`} close={() => setDialog(pending ? 'landing' : null)}><p>{cr(self.cash)} available · {property.mortgaged ? 'Mortgaged' : `Level ${property.development}`}</p>{property.ownerId === actor.id && myTurn ? actions(property) : <p>This deed belongs to {game.players[property.ownerId ?? '']?.name ?? 'the bank'}. Only the active owner can manage it.</p>}</DialogFrame>}
    {dialog === 'landing' && pending && !presentation.presenting && <DialogFrame title={auction ? 'Going once. Going twice.' : pending.name} close={() => setDialog(null)} locked={myTurn} wide={!!auction}>
      {auction ? <AuctionPanel session={session} playerId={selfId} online={mode === 'online'} busy={busy} send={send} /> : <>
        <div className="landing-card-art"><DeedArtwork index={Math.floor(pending.space / 8)} special={pending.kind === 'special'} /><Character dealer className="dealer-portrait" /><span className="deed-ribbon">{pending.kind === 'property' ? 'TITLE DEED' : 'CITY STOP'} / {String(pending.space + 1).padStart(3, '0')}</span></div>
        <div className="gameplay-dealer"><span>THE DEALER SAYS</span><strong>{pending.kind === 'property' ? pending.ownerId === actor.id ? 'A fine addition to your empire.' : pending.ownerId ? 'Every address has its price.' : 'A little corner of the city. Yours?' : 'The city keeps its own rhythm.'}</strong></div>
        <p className="landing-actor">{actor.name}<b>{cr(actor.cash)} available</b></p>
        {pending.kind === 'property' ? <>
          <div className="inspector-stats"><div>Deed price<strong>{cr(pending.price)}</strong></div><div>Current rent<strong>{cr(rentFor(game, pending))}</strong></div><div>Mortgage<strong>{cr(pending.mortgage)}</strong></div><div>Build cost<strong>{cr(pending.developmentCost)}</strong></div></div>
          <p className="ownership-label">{game.districts.find(d => d.id === pending.districtId)?.name} · {pending.ownerId ? `Held by ${game.players[pending.ownerId]?.name}` : 'Bank-owned'} · {pending.mortgaged ? 'Mortgaged — no rent' : `Level ${pending.development}`}</p>
          {myTurn && session.landingOffer && !pending.ownerId && <div className="landing-choices"><button className="primary-button" disabled={busy || actor.cash < pending.price} onClick={() => send({ type: 'purchase', propertyId: pending.id })}>Acquire · {cr(pending.price)}</button><button className="outline-button" disabled={busy} onClick={() => send({ type: 'pass' })}>Pass</button><button className="outline-button" disabled={busy} onClick={() => send({ type: 'startAuction', propertyId: pending.id })}>Open auction</button>{actor.cash < pending.price && <small>Not enough cash to acquire this deed. Pass or send it to auction.</small>}</div>}
          {pending.ownerId === actor.id && <><p className="ownership-success">✓ Your deed. Manage it now, or keep building your route.</p>{myTurn && actions(pending)}</>}
          {pending.ownerId && pending.ownerId !== actor.id && <p>{pending.mortgaged ? 'No rent due on a mortgaged property.' : landedRent ? `Paid ${cr(landedRent.amount)} rent to ${game.players[pending.ownerId]?.name}.` : 'No rent was charged on this landing. This deed changed hands at auction.'}</p>}
        </> : <p className="special-outcome">{pending.amount ? `The city treasury releases ${cr(pending.amount)} to you.` : pending.kind === 'special' && pending.specialKind === 'festival' ? 'Festival day! Enjoy a quiet stop. No payment is due.' : 'A quiet city stop. No payment is due. Complete a full loop for CR 200 salary.'}</p>}
        <details className="landing-receipts"><summary>View transaction receipts</summary>{session.receipts.filter(r => r.turn === game.turn && r.kind !== 'roll').map(r => <p key={r.id} className="gameplay-receipt">{r.kind}: {r.kind === 'production' ? `${r.amount} goods` : cr(r.amount)} · {r.note}</p>)}</details>
        {myTurn && !session.landingOffer && <button className="primary-button modal-submit" disabled={busy} onClick={() => send({ type: 'finish' })}>End turn →</button>}
        {!myTurn && <p className="modal-footnote">Waiting for {actor.name} to resolve this landing. Your seat cannot make their decisions.</p>}
      </>}
    </DialogFrame>}
  </div>
}

export default App
