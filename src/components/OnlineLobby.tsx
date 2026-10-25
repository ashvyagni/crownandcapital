import { useState } from 'react'
import type { useOnlineRoom } from '../hooks/useOnlineRoom'
import { Character, CHARACTER_NAMES } from './Character'

export function OnlineLobby({ online, onLeave }: { online: ReturnType<typeof useOnlineRoom>; onLeave: () => void }) {
  const [name, setName] = useState('')
  const [character, setCharacter] = useState(0)
  const [code, setCode] = useState('')
  const waiting = online.status === 'connecting' || online.status === 'reconnecting' || online.pending
  return <div className="online-panel">
    <p className="eyebrow">Private room / {online.status}</p>
    {online.room ? <>
      <p>Share this room code with your friends on this server.</p>
      <output className="room-code" aria-label="Room code">{online.room.code}</output>
      <div className="online-seats">{online.room.seats.map(seat => <div key={seat.id}><Character index={seat.character} className="gameplay-avatar" /><strong>{seat.name}{seat.id === online.playerId ? ' (you)' : ''}</strong><span>{seat.connected ? 'Connected' : 'Reconnecting'}{seat.id === online.room!.hostId ? ' · Host' : ''}</span></div>)}</div>
      {!online.room.started && (online.playerId === online.room.hostId ? <button className="primary-button" disabled={waiting || online.room.seats.length < 2} onClick={online.start}>Start online game</button> : <p>The host will start once everyone has a seat.</p>)}
      {online.room.started && <p>Your server-saved table is ready. Reconnecting seats retain their deeds and balances.</p>}
    </> : <>
      <p>Host a private table or join a friend's room. Each device controls its own seat; the server checks every move.</p>
      <label className="field-label">Your online name<input maxLength={30} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="field-label">Your online character<select value={character} onChange={e => setCharacter(Number(e.target.value))}>{CHARACTER_NAMES.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
      <div className="landing-choices"><button className="primary-button" disabled={waiting || !name.trim()} onClick={() => online.create(name.trim(), character)}>Create online room</button><button className="outline-button" disabled={waiting} onClick={online.resume}>Resume my room</button></div>
      <label className="field-label">Room code<input maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))} placeholder="10-character room code" /></label>
      <button className="outline-button" disabled={waiting || !name.trim() || code.length !== 10} onClick={() => online.join(code, name.trim(), character)}>Join online room</button>
      <p className="modal-footnote">Online play needs the game server. Connection errors are shown here, never replaced with a simulated room.</p>
    </>}
    {online.error && <p role="alert">{online.error}</p>}
    {(online.status === 'offline' && online.error) && <button className="outline-button" onClick={online.retry}>Retry connection</button>}
    <button className="text-button leave-room" onClick={onLeave}>Return to local play</button><p className="modal-footnote">Returning locally keeps this tab's private seat identity. Use “Resume my room” to reconnect later.</p>
  </div>
}
