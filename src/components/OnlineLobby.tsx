import { useEffect, useRef, useState } from 'react'
import { statusLabel, type useOnlineRoom } from '../hooks/useOnlineRoom'
import { Character, CHARACTER_NAMES } from './Character'

async function copyText(value: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(value); return true } catch { /* Clipboard may be denied; fall back to a hidden field. */ }
  try {
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.append(field)
    try {
      field.select()
      return document.execCommand('copy')
    } finally { field.remove() }
  } catch { return false }
}

export function OnlineLobby({ online, onLeave, initialCode }: { online: ReturnType<typeof useOnlineRoom>; onLeave: () => void; initialCode?: string }) {
  const [name, setName] = useState('')
  const [character, setCharacter] = useState(0)
  const [code, setCode] = useState(initialCode ?? '')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'blocked'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const waiting = online.status === 'connecting' || online.status === 'reconnecting' || online.pending
  const room = online.room
  const hostSeat = room ? room.seats.find(seat => seat.id === room.hostId) : undefined
  const inviteUrl = online.room ? `${window.location.origin}/r/${online.room.code}` : ''
  const copyInvite = async () => {
    const copied = await copyText(inviteUrl)
    setCopyState(copied ? 'copied' : 'blocked')
    if (copyTimer.current) clearTimeout(copyTimer.current)
    if (copied) copyTimer.current = setTimeout(() => setCopyState('idle'), 4000)
  }
  return <div className="online-panel">
    <p className="eyebrow">Private room / {statusLabel(online.status)}</p>
    {online.room ? <>
      <p>Share this room code with your friends on this server.</p>
      <output className="room-code" aria-label="Room code">{online.room.code}</output>
      <div className="room-code-actions"><button className="outline-button" onClick={() => void copyInvite()}>Copy invite link</button><span role="status" aria-live="polite" aria-label="Invite link status">{copyState === 'copied' ? 'Invite link copied to your clipboard.' : copyState === 'blocked' ? 'Copying was blocked. Use the link below instead.' : ''}</span></div>
      {copyState === 'blocked' && <code className="room-code-fallback">{inviteUrl}</code>}
      <div className="online-seats">{online.room.seats.map(seat => <div key={seat.id}><Character index={seat.character} className="gameplay-avatar" /><strong>{seat.name}{seat.id === online.playerId ? ' (you)' : ''}</strong><span>{seat.connected ? 'Connected' : 'Disconnected · seat reserved'}{seat.id === online.room!.hostId ? ' · Host' : ''}</span></div>)}</div>
      {!online.room.started && (online.playerId === online.room.hostId ? <button className="primary-button" disabled={waiting || online.room.seats.length < 2} onClick={online.start}>Start online game</button> : <p role="status" aria-live="polite">{hostSeat && !hostSeat.connected ? `Waiting for ${hostSeat.name} — they are disconnected, their seat is reserved, and only they can start this table.` : 'The host will start once everyone has a seat.'}</p>)}
      {online.room.started && <p>Your server-saved table is ready. Reconnecting seats retain their deeds and balances.</p>}
    </> : <>
      <p>Host a private table or join a friend's room. Each device controls its own seat; the server checks every move.</p>
      <label className="field-label">Your online name<input maxLength={30} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="field-label">Your online character<select value={character} onChange={e => setCharacter(Number(e.target.value))}>{CHARACTER_NAMES.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
      <div className="landing-choices"><button className="primary-button" disabled={waiting || !name.trim()} onClick={() => online.create(name.trim(), character)}>Create online room</button><button className="outline-button" disabled={waiting} onClick={online.resume}>Resume my room</button></div>
      <label className="field-label">Room code<input maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))} placeholder="10-character room code" /></label>
      {initialCode && code && <p className="modal-footnote">You followed an invite link for room {code}. Enter your name and join.</p>}
      <button className="outline-button" disabled={waiting || !name.trim() || code.length !== 10} onClick={() => online.join(code, name.trim(), character)}>Join online room</button>
      <p className="modal-footnote">Online play needs the game server. Connection errors are shown here, never replaced with a simulated room.</p>
    </>}
    {online.error && <p role="alert">{online.error}</p>}
    {(online.status === 'offline' && online.error) && <button className="outline-button" onClick={online.retry}>Retry connection</button>}
    <button className="text-button leave-room" onClick={onLeave}>Return to local play</button><p className="modal-footnote">Returning locally keeps this tab's private seat identity. Use “Resume my room” to reconnect later.</p>
  </div>
}
