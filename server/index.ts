import { createServer, type Server } from 'node:http'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises'
import { join, resolve, sep, extname } from 'node:path'
import { WebSocket, WebSocketServer } from 'ws'
import { fileURLToPath } from 'node:url'
import { applyCommand, createSession, validateSession, type GameSession, type SessionCommand } from '../src/game/session.ts'

type Seat = { id: string; name: string; character?: number; connected: boolean; tokenHash: string; socket?: WebSocket; ids: string[] }
type Room = { code: string; hostId: string; started: boolean; seats: Seat[]; session: GameSession | null; updatedAt: number }
type Options = { host?: string; port?: number; dataDir?: string; distDir?: string; allowedOrigins?: string[] }
const LIMIT = 16 * 1024
const EXPIRY = 7 * 24 * 60 * 60 * 1000
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const token = () => randomBytes(32).toString('base64url')
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
const safeName = (value: unknown) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 30 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : null
const character = (value: unknown) => value === undefined || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 5)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const snapshot = (room: Room) => ({ code: room.code, hostId: room.hostId, started: room.started, seats: room.seats.map(({ id, name, character, connected }) => ({ id, name, character, connected })), session: room.session })

export async function startRoomServer(options: Options = {}) {
  const host = options.host ?? process.env.HOST ?? '127.0.0.1'
  const port = options.port ?? Number(process.env.PORT ?? 2567)
  const dataDir = resolve(options.dataDir ?? process.env.DATA_DIR ?? '.data/rooms')
  const distDir = resolve(options.distDir ?? 'dist')
  const allowed = options.allowedOrigins ?? process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  const rooms = new Map<string, Room>()
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  for (const file of await readdir(dataDir)) {
    if (!/^[A-F0-9]{10}\.json$/.test(file)) continue
    try {
      const raw = JSON.parse(await readFile(join(dataDir, file), 'utf8')) as Room
      if (raw.code + '.json' !== file || !Array.isArray(raw.seats) || raw.seats.length > 20 || (raw.session && !validateSession(raw.session)) || Date.now() - raw.updatedAt > EXPIRY) continue
      raw.seats.forEach(s => { s.connected = false; s.ids ??= [] })
      rooms.set(raw.code, raw)
    } catch { /* corrupted files are skipped, never overwritten on startup */ }
  }
  async function persist(room: Room) {
    const file = join(dataDir, room.code + '.json')
    const temp = file + '.' + randomBytes(8).toString('hex') + '.tmp'
    try {
      await writeFile(temp, JSON.stringify({ ...room, seats: room.seats.map(({ socket: _socket, ...s }) => s) }), { mode: 0o600, flag: 'wx' })
      await rename(temp, file)
    } catch { await unlink(temp).catch(() => {}); throw new Error('The room could not be saved. No move was committed.') }
  }
  function send(ws: WebSocket, payload: unknown) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)) }
  function broadcast(room: Room, requestId?: string) { for (const seat of room.seats) if (seat.socket) send(seat.socket, { type: 'state', room: snapshot(room), selfId: seat.id, ...(requestId ? { requestId } : {}) }) }
  function error(ws: WebSocket, message: string, requestId?: string, code?: string, room?: Room, seat?: Seat) { send(ws, { type: 'error', message, ...(requestId ? { requestId } : {}), ...(code ? { code } : {}), ...(room && seat ? { room: snapshot(room), selfId: seat.id } : {}) }) }
  const server: Server = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
      if (pathname.includes('\0') || pathname.includes('\\')) throw Error('Invalid path')
      let path = resolve(distDir, '.' + pathname)
      if (path !== distDir && !path.startsWith(distDir + sep)) throw Error('Invalid path')
      let info = await stat(path).catch(() => null)
      if (!info?.isFile()) {
        if (extname(pathname)) { res.writeHead(404); res.end(); return }
        path = join(distDir, 'index.html'); info = await stat(path).catch(() => null)
      }
      if (!info?.isFile()) { res.writeHead(404); res.end('Build the frontend first'); return }
      const { realpath } = await import('node:fs/promises')
      const actual = await realpath(path)
      const root = await realpath(distDir)
      if (actual !== root && !actual.startsWith(root + sep)) { res.writeHead(403); res.end(); return }
      const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
      res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' })
      res.end(req.method === 'HEAD' ? undefined : await readFile(path))
    } catch { res.writeHead(400); res.end() }
  })
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: LIMIT, verifyClient: ({ origin, req }, cb) => {
    const hostHeader = req.headers.host
    const sameOrigin = !!origin && !!hostHeader && (() => { try { return new URL(origin).host === hostHeader } catch { return false } })()
    cb(!origin || sameOrigin || allowed.includes(origin))
  } })
  // Serialize all room mutations across sockets; no second command can observe an uncommitted revision.
  let queue: Promise<void> = Promise.resolve()
  wss.on('connection', ws => {
    if (wss.clients.size > 1000) { ws.close(1013, 'Server connection capacity reached'); return }
    let room: Room | undefined; let seat: Seat | undefined; let messages = 0; let windowStart = Date.now(); let alive = true
    const authenticationDeadline = setTimeout(() => { if (!seat) ws.close(1008, 'Create, join or resume within ten seconds') }, 10_000)
    ws.on('pong', () => { alive = true })
    ws.on('message', data => { queue = queue.then(async () => {
      if (ws.readyState !== WebSocket.OPEN) return
      const now = Date.now()
      if (now - windowStart > 10_000) { windowStart = now; messages = 0 }
      if (++messages > 40) { ws.close(1008, 'Rate limit'); return }
      let msg: Record<string, unknown>
      try { const parsed: unknown = JSON.parse(data.toString()); if (!object(parsed)) throw Error(); msg = parsed } catch { error(ws, 'Invalid JSON message'); return }
      const requestId = validId(msg.id) ? msg.id : undefined
      try {
        if (!seat) {
          if (msg.type === 'create') {
            const name = safeName(msg.name)
            if (!name || !character(msg.character)) throw Error('Invalid name or character')
            if (rooms.size >= 500) throw Error('Room capacity reached')
            let code: string
            do { code = randomBytes(5).toString('hex').toUpperCase() } while (rooms.has(code))
            const secret = token()
            const next: Room = { code, hostId: 'player-1', started: false, seats: [{ id: 'player-1', name, character: msg.character as number | undefined, connected: true, tokenHash: hash(secret), ids: [] }], session: null, updatedAt: now }
            await persist(next); rooms.set(code, next); room = next; seat = next.seats[0]; seat.socket = ws
            send(ws, { type: 'joined', room: snapshot(next), selfId: seat.id, token: secret }); return
          }
          const code = typeof msg.code === 'string' ? msg.code.toUpperCase() : ''
          const target = rooms.get(code)
          if (!target) throw Error('Room not found')
          if (msg.type === 'join') {
            const name = safeName(msg.name)
            if (target.started || target.seats.length >= 20 || !name || !character(msg.character) || target.seats.some(s => s.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('Cannot join this room')
            const secret = token(); const nextSeat: Seat = { id: `player-${target.seats.length + 1}`, name, character: msg.character as number | undefined, connected: true, tokenHash: hash(secret), ids: [] }
            const next = { ...target, seats: [...target.seats, nextSeat], updatedAt: now }
            await persist(next); rooms.set(code, next); room = next; seat = nextSeat; seat.socket = ws
            send(ws, { type: 'joined', room: snapshot(next), selfId: seat.id, token: secret }); broadcast(next); return
          }
          if (msg.type === 'resume') {
            if (typeof msg.token !== 'string' || msg.token.length > 128) throw Error('Invalid resume token')
            const digest = Buffer.from(hash(msg.token), 'hex')
            const existing = target.seats.find(s => typeof s.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(s.tokenHash) && timingSafeEqual(Buffer.from(s.tokenHash, 'hex'), digest))
            if (!existing) throw Error('Invalid resume token')
            existing.socket?.terminate(); existing.socket = ws; existing.connected = true; room = target; seat = existing
            send(ws, { type: 'joined', room: snapshot(target), selfId: seat.id, token: msg.token }); broadcast(target); return
          }
          throw Error('Create, join or resume first')
        }
        if (!room) throw Error('Room unavailable')
        room = rooms.get(room.code)
        if (!room) throw Error('Room unavailable')
        seat = room.seats.find(s => s.id === seat!.id)
        if (!seat || seat.socket !== ws) throw Error('Seat connection replaced')
        if (!requestId) throw Error('Request id required')
        if (seat.ids.includes(requestId)) { send(ws, { type: 'state', room: snapshot(room), selfId: seat.id, requestId }); return }
        if (msg.type === 'start') {
          if (seat.id !== room.hostId || room.started || room.seats.length < 2) throw Error('Only the host may start a table of 2–20')
          // Reserved offline seats remain participants; reconnection retains their turn and assets.
          const next = { ...room, started: true, session: createSession(randomBytes(4).readUInt32BE(0), room.seats.map(s => s.name), room.seats.map(s => s.character ?? 0)), seats: room.seats.map(s => ({ ...s, ids: [...s.ids, requestId].slice(-128) })), updatedAt: now }
          await persist(next); rooms.set(room.code, next); room = next; seat = next.seats.find(s => s.id === seat!.id)!; broadcast(next, requestId); return
        }
        if (msg.type !== 'command' || !room.session) throw Error('Game not started')
        if (!Number.isSafeInteger(msg.revision) || msg.revision !== room.session.revision) { error(ws, 'Stale revision', requestId, 'STALE_REVISION', room, seat); return }
        if (!object(msg.command) || typeof msg.command.type !== 'string' || !/^[a-zA-Z]{1,32}$/.test(msg.command.type) || Object.keys(msg.command).length > 12 || Object.keys(msg.command).some(key => !['type', 'propertyId', 'amount', 'quantity', 'loanId', 'offerId', 'toId', 'giveCash', 'requestCash', 'givePropertyId', 'requestPropertyId'].includes(key))) throw Error('Invalid command')
        for (const value of Object.values(msg.command)) if (!(value === null || typeof value === 'boolean' || (typeof value === 'string' && value.length <= 128) || (typeof value === 'number' && Number.isSafeInteger(value)))) throw Error('Invalid command payload')
        const nextSession = applyCommand(room.session, seat.id, msg.command as unknown as SessionCommand, requestId)
        const next = { ...room, session: nextSession, seats: room.seats.map(s => s.id === seat!.id ? { ...s, ids: [...s.ids, requestId].slice(-128) } : s), updatedAt: now }
        await persist(next); rooms.set(room.code, next); room = next; seat = next.seats.find(s => s.id === seat!.id)!; broadcast(next, requestId)
      } catch (cause) { error(ws, cause instanceof Error ? cause.message : 'Request failed', requestId, 'REJECTED') }
    }).catch(() => { error(ws, 'Request failed') }) })
    ws.on('close', () => { clearTimeout(authenticationDeadline); const current = room && rooms.get(room.code); const activeSeat = current?.seats.find(s => s.id === seat?.id); if (current && activeSeat?.socket === ws) { activeSeat.socket = undefined; activeSeat.connected = false; broadcast(current) } })
    ;(ws as WebSocket & { heartbeat?: () => void }).heartbeat = () => { if (!alive) ws.terminate(); else { alive = false; ws.ping() } }
  })
  const interval = setInterval(() => {
    for (const ws of wss.clients) (ws as WebSocket & { heartbeat: () => void }).heartbeat()
    for (const [code, room] of rooms) if (Date.now() - room.updatedAt > EXPIRY && room.seats.every(s => !s.connected)) { rooms.delete(code); unlink(join(dataDir, code + '.json')).catch(() => {}) }
  }, 30_000)
  await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(port, host, ok) })
  return { server, port: (server.address() as { port: number }).port, close: async () => { clearInterval(interval); for (const ws of wss.clients) ws.terminate(); await new Promise<void>(ok => wss.close(() => ok())); await new Promise<void>(ok => server.close(() => ok())) } }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  startRoomServer().then(({ port }) => console.log(`Crown & Capital listening on ${process.env.HOST ?? '127.0.0.1'}:${port}`)).catch(error => { console.error('Server startup failed:', error); process.exitCode = 1 })
}
