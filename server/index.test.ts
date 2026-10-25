import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { startRoomServer } from './index.ts'

type Message = Record<string, any>
async function client(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject) })
  const pending: Message[] = []
  const waiters: ((message: Message) => void)[] = []
  ws.on('message', bytes => { const message = JSON.parse(bytes.toString()); const waiter = waiters.shift(); if (waiter) waiter(message); else pending.push(message) })
  return { ws, send: (value: unknown) => ws.send(JSON.stringify(value)), next: () => pending.length ? Promise.resolve(pending.shift()!) : new Promise<Message>((resolve, reject) => { const timer = setTimeout(() => reject(Error('Timed out waiting for server')), 3000); waiters.push(message => { clearTimeout(timer); resolve(message) }) }) }
}

test('two seats, actor enforcement, revision, dedupe, restart and token reclaim', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'crown-server-'))
  let server = await startRoomServer({ port: 0, dataDir })
  const connections: Awaited<ReturnType<typeof client>>[] = []
  let stage = 'create'
  try {
    const a = await client(server.port); connections.push(a)
    a.send({ type: 'create', name: 'Alice' }); const joined = await a.next()
    assert.equal(joined.type, 'joined'); const { code } = joined.room
    stage = 'join'
    const b = await client(server.port); connections.push(b)
    b.send({ type: 'join', code, name: 'Bob' }); const joinedB = await b.next()
    assert.equal(joinedB.selfId, 'player-2'); await a.next(); await b.next()
    stage = 'start'
    a.send({ type: 'start', id: 'start-1' }); const started = await a.next(); await b.next()
    assert.equal(started.room.session.revision, 0)
    stage = 'forged command'
    b.send({ type: 'command', id: 'forge-1', revision: 0, command: { type: 'roll', playerId: 'player-1' } })
    assert.equal((await b.next()).type, 'error')
    stage = 'roll'
    a.send({ type: 'command', id: 'roll-1', revision: 0, command: { type: 'roll' } })
    const rolled = await a.next(); await b.next(); assert.equal(rolled.room.session.revision, 1)
    stage = 'duplicate'
    a.send({ type: 'command', id: 'roll-1', revision: 0, command: { type: 'roll' } })
    assert.equal((await a.next()).room.session.revision, 1)
    stage = 'stale'
    a.send({ type: 'command', id: 'stale-1', revision: 0, command: { type: 'finish' } })
    assert.equal((await a.next()).code, 'STALE_REVISION')
    stage = 'restart'
    a.ws.terminate(); b.ws.terminate(); await server.close()
    server = await startRoomServer({ port: 0, dataDir })
    const resumed = await client(server.port); connections.push(resumed)
    resumed.send({ type: 'resume', code, token: joined.token })
    const state = await resumed.next(); assert.equal(state.type, 'joined'); assert.equal(state.room.session.revision, 1)
    resumed.ws.terminate()
  } catch (error) { throw new Error(`Stage ${stage}: ${String(error)}`) } finally { for (const connection of connections) connection.ws.terminate(); await server.close(); await rm(dataDir, { recursive: true, force: true }) }
})

test('twenty authenticated seats receive one state; a twenty-first seat is rejected', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'crown-twenty-'))
  const server = await startRoomServer({ port: 0, dataDir })
  const connections: Awaited<ReturnType<typeof client>>[] = []
  try {
    const host = await client(server.port); connections.push(host)
    host.send({ type: 'create', name: 'Host', character: 5 }); const joined = await host.next()
    for (let i = 2; i <= 20; i++) {
      const seat = await client(server.port); connections.push(seat)
      seat.send({ type: 'join', code: joined.room.code, name: `Seat ${i}`, character: i % 6 })
      const reply = await seat.next(); assert.equal(reply.type, 'joined'); assert.equal(reply.room.seats.length, i)
    }
    const extra = await client(server.port); connections.push(extra)
    extra.send({ type: 'join', code: joined.room.code, name: 'Too many' }); assert.equal((await extra.next()).type, 'error')
    host.send({ type: 'start', id: 'twenty-start' })
    let started: Message
    do { started = await host.next() } while (!started.room?.session)
    assert.equal(Object.keys(started.room.session.game.players).length, 20)
    const guest = connections[19]
    let state: Message
    do { state = await guest.next() } while (!state.room?.session)
    assert.deepEqual(state.room.session, started.room.session)
    guest.send({ type: 'command', id: 'illegal-turn', revision: 0, command: { type: 'roll' } })
    assert.equal((await guest.next()).type, 'error')
  } finally { connections.forEach(c => c.ws.terminate()); await server.close(); await rm(dataDir, { recursive: true, force: true }) }
})
