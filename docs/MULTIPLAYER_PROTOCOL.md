# Implemented multiplayer protocol

Transport: WebSocket `/ws` on the game server. Browser endpoints default to same-origin `ws`/`wss`; Vite proxies this route in development. This is `ws`, not Colyseus.

## Seat handshake

```text
create { type: "create", name, character? }
join   { type: "join", code, name, character? }
resume { type: "resume", code, token }
```

Successful handshakes receive `{type:"joined", room, selfId, token}`. The raw token is returned only to that seat and stored separately in tab session storage. Disk records hold its hash. Tokens are not broadcast, placed in URLs, logged, or included in local-game exports.

Room snapshot: `{code, hostId, started, seats:[{id,name,character,connected}], session:GameSession|null}`. Names are unique, 1–30 trimmed characters; character IDs are integers 0–5. Capacity is 2–20 for starting, with one-seat lobbies permitted.

## Game messages

```text
start   { type: "start", id }
command { type: "command", id, revision, command: SessionCommand }
state   { type: "state", room, selfId, requestId? }
error   { type: "error", message, code?, requestId?, room?, selfId? }
```

Only the host starts. The server derives the actor from the authenticated socket, not any client-supplied player ID. The reducer enforces turn/deed ownership, auction participation and offer-recipient authority. Commands use flat fields; their exact union is exported by `src/game/session.ts`.

Accepted requests are persisted before broadcast. Duplicate seat request IDs return current state without replay. Stale revisions return `STALE_REVISION` and a snapshot for reconciliation. Unknown outcomes are not automatically retried by the client; reconnect and inspect the canonical state first.

## Recovery and limits

- A disconnected seat remains reserved, including its pending turn and assets. A valid token replaces the old connection. There is no AFK takeover or automatic turn skip.
- Only the host starts, and the host identity never transfers. If the creator never returns, the lobby holds in an explicit waiting state with their seat reserved rather than offering anyone else a start control. Relaxing that gate would not unblock the room: a session always opens at seat 1 and every turn-advancing command — roll, finish, purchase, and opening an offer — is gated to the active seat; bids and offer responses are off-turn by design but cannot arise until that seat acts, so play would simply wait on that same absent seat while the irreversible start had already been committed. Room state survives the creator leaving — persistence is atomic, the departed seat stays reserved, and the room stays joinable and resumable.
- A client retries resume at bounded exponential delays; manual retry remains available. Full account-based recovery after losing the tab's identity is not implemented.
- Maximum payload 16 KiB; 40 incoming messages per connection per ten seconds; ten-second unauthenticated handshake deadline; 1,000 connection / 500 room caps; ping/pong cleanup; seven-day inactive-room expiry.
- Origin policy accepts same-host browser origins or explicit `ALLOWED_ORIGINS`. Nonbrowser clients without Origin can connect but still need a room handshake and seat credential for reclaim.
- Private file permissions, static-path containment and generic persistence failures are implemented. These do not replace TLS, edge/IP abuse controls, accounts, monitoring or a deployment audit.

## Verified

Two-client commands, out-of-turn rejection, stale/duplicate protection, restart/token reclaim, twenty connected socket seats and a rejected twenty-first seat are covered in server tests. Two isolated browser contexts create/join/start and recover a pending turn on reload in browser tests; reconnect tests add a dropped socket with waiting/reconnecting indicators on both clients before the same turn resumes, a mid-turn reload that reclaims the seat with its turn intact, and a departed creator leaving a reserved, still-joinable room. Neither test constitutes a twenty-browser load/balance benchmark.
