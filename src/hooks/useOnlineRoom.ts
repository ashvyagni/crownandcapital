import { useCallback, useEffect, useRef, useState } from 'react'
import { validateSession, type GameSession, type SessionCommand } from '../game/session'
import { requestId as newRequestId } from '../services/requestId'

export type RoomSnapshot = { code: string; hostId: string; started: boolean; seats: { id: string; name: string; character?: number; connected: boolean }[]; session: GameSession | null }
type Status = 'offline' | 'connecting' | 'connected' | 'reconnecting'
type Identity = { code: string; token: string }
const KEY = 'crown-and-capital:online-identity:v1'
const MAX_MESSAGE = 1_000_000
const delay = (attempt: number) => Math.min(16000, 500 * 2 ** Math.min(attempt, 5))
const id = newRequestId
function savedIdentity(): Identity | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Identity
    return typeof value.code === 'string' && typeof value.token === 'string' && value.code.length < 64 && value.token.length < 512 ? value : null
  } catch { return null }
}
function validRoom(value: unknown): value is RoomSnapshot {
  if (!value || typeof value !== 'object') return false
  const room = value as RoomSnapshot
  return typeof room.code === 'string' && room.code.length < 64 && typeof room.hostId === 'string' &&
    typeof room.started === 'boolean' && Array.isArray(room.seats) && room.seats.length <= 20 &&
    room.seats.every(seat => seat && typeof seat.id === 'string' && typeof seat.name === 'string' && typeof seat.connected === 'boolean' && (seat.character === undefined || (Number.isInteger(seat.character) && seat.character >= 0 && seat.character <= 5))) &&
    (room.session === null || validateSession(room.session))
}
function endpoint(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  if (configured) return configured
  const url = new URL('/ws', window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.href
}

export function useOnlineRoom() {
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('offline')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempt = useRef(0)
  const generation = useRef(0)
  const request = useRef<string | null>(null)
  const mode = useRef<'create' | 'join' | 'resume' | null>(null)
  const initial = useRef<{ name: string; character?: number; code?: string } | null>(null)
  const connectRef = useRef<(kind: 'create' | 'join' | 'resume') => void>(() => {})

  const connect = useCallback((kind: 'create' | 'join' | 'resume') => {
    const identity = savedIdentity()
    if (kind === 'resume' && !identity) { setError('No saved room identity is available.'); setStatus('offline'); return }
    if (timer.current) clearTimeout(timer.current)
    ++generation.current
    const current = generation.current
    socket.current?.close()
    request.current = null
    setPending(false)
    setError(null)
    setStatus(kind === 'resume' && attempt.current ? 'reconnecting' : 'connecting')
    mode.current = kind
    try {
      const ws = new WebSocket(endpoint())
      let authenticated = false
      socket.current = ws
      ws.onopen = () => {
        if (generation.current !== current) return
        if (kind === 'resume') ws.send(JSON.stringify({ type: 'resume', code: identity!.code, token: identity!.token }))
        else ws.send(JSON.stringify({ type: kind, ...initial.current }))
      }
      ws.onmessage = event => {
        if (generation.current !== current) return
        try {
          if (typeof event.data !== 'string' || event.data.length > MAX_MESSAGE) throw new Error('Invalid server message.')
          const data: unknown = JSON.parse(event.data)
          if (!data || typeof data !== 'object') throw new Error('Invalid server message.')
          const message = data as Record<string, unknown>
          if (message.type === 'error') {
            if (typeof message.message !== 'string') throw new Error('Invalid server error.')
            setError(message.message.slice(0, 300))
            if (!authenticated && !message.requestId) { setStatus('offline'); setPending(false); ws.onclose = null; ws.close() }
            if (message.requestId === request.current || (!message.requestId && request.current)) { request.current = null; setPending(false) }
            if (message.room !== undefined) { if (!validRoom(message.room)) throw new Error('Invalid room state.'); setRoom(message.room) }
            if (typeof message.selfId === 'string') setPlayerId(message.selfId)
            return
          }
          if ((message.type !== 'joined' && message.type !== 'state') || !validRoom(message.room) || typeof message.selfId !== 'string') throw new Error('Invalid room state.')
          if (message.type === 'joined') {
            if (typeof message.token !== 'string' || message.token.length > 512) throw new Error('Invalid room identity.')
            try { sessionStorage.setItem(KEY, JSON.stringify({ code: message.room.code, token: message.token })) } catch { setError('Room identity could not be saved for reload.') }
            try { sessionStorage.setItem(`${KEY}:active`, '1') } catch { /* Reload auto-resume may be unavailable. */ }
          }
          setRoom(message.room)
          authenticated = true
          setPlayerId(message.selfId)
          setStatus('connected')
          attempt.current = 0
          if (message.requestId === request.current) { request.current = null; setPending(false) }
        } catch { setError('The server returned an invalid response.'); ws.close() }
      }
      ws.onerror = () => { if (generation.current === current) setError('Room connection failed.') }
      ws.onclose = () => {
        if (generation.current !== current) return
        socket.current = null
        if (request.current) { request.current = null; setPending(false); setError('Connection lost; the command outcome is unknown. Refresh the room state before trying again.') }
        const identity = savedIdentity()
        if (identity && attempt.current < 6) {
          setStatus('reconnecting')
          timer.current = setTimeout(() => { attempt.current++; connectRef.current('resume') }, delay(attempt.current))
        } else { setStatus('offline'); if (!identity) setError('Connection closed. Rejoin or retry.') }
      }
    } catch { setStatus('offline'); setError('Could not open the room connection.') }
  }, [])
  connectRef.current = connect
  useEffect(() => () => {
    ++generation.current
    if (timer.current) clearTimeout(timer.current)
    socket.current?.close()
  }, [])
  const create = useCallback((name: string, character?: number) => { attempt.current = 0; initial.current = { name, character }; connect('create') }, [connect])
  const join = useCallback((code: string, name: string, character?: number) => { attempt.current = 0; initial.current = { code, name, character }; connect('join') }, [connect])
  const resume = useCallback(() => { attempt.current = 0; connect('resume') }, [connect])
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (socket.current?.readyState !== WebSocket.OPEN || request.current) { setError('Wait for the current room update before sending another action.'); return }
    const requestId = id()
    request.current = requestId
    setPending(true)
    setError(null)
    socket.current.send(JSON.stringify({ ...message, id: requestId }))
  }, [])
  const start = useCallback(() => sendMessage({ type: 'start' }), [sendMessage])
  const send = useCallback((command: SessionCommand, revision: number) => sendMessage({ type: 'command', command, revision }), [sendMessage])
  const leave = useCallback(() => {
    ++generation.current
    if (timer.current) clearTimeout(timer.current)
    socket.current?.close(); socket.current = null
    // Returning to local play must not strand an already-reserved online seat.
    // Keep its private identity for the explicit Resume action, but stop auto-resume.
    try { sessionStorage.setItem(`${KEY}:active`, '0') } catch { /* Ignore disabled storage. */ }
    request.current = null; mode.current = null; attempt.current = 0
    setPending(false); setRoom(null); setPlayerId(null); setStatus('offline'); setError(null)
  }, [])
  const retry = useCallback(() => { attempt.current = 0; connect(savedIdentity() ? 'resume' : mode.current === 'join' ? 'join' : 'create') }, [connect])
  return { room, playerId, status, error, pending, create, join, resume, start, send, leave, retry }
}
