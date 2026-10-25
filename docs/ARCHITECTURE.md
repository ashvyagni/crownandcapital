# Architecture

## Implemented layers

- `src/game/index.ts`: deterministic base board, player, deed, rent and mortgage rules.
- `src/game/session.ts`: immutable validated command boundary for turn state, receipts, factories, loans, auctions and bilateral offers. The same reducer runs locally and on the server.
- `server/index.ts`: Node HTTP/static hosting, `ws` rooms, seat-derived authorization, revision checks, bounded dedupe/rate/payload rules, heartbeats and atomic private-file persistence.
- `src/hooks/useOnlineRoom.ts`: native browser WebSocket transport; no optimistic balance edits, bounded reconnects and separately stored private resume identity.
- `src/services/localSession.ts`: versioned validated browser saves, backup recovery, quota errors and local JSON import/export.
- `src/services/audio.ts`: user-gesture-unlocked Web Audio with original generated cues, persisted preference, hidden-page suspension and node cleanup.
- `src/components/EconomyDesk.tsx`: factories, secured lending, auctions and negotiated offers backed by session commands.
- `src/App.tsx`: local/online orchestration, modal decisions, roster, inspector, save/audio/profile controls.
- `CityScene.ts` / `CityMap.tsx`: 2D Canvas board renderer and React bridge. Rules remain outside the renderer; Phaser is lazy-loaded.
- `styles.css → gameplay.css → exchange.css → art-direction.css`: explicit cascade order in `main.tsx`; the final layer unifies the product's visual language.

## Confirmed-state flow

Local: UI command → reducer validates/clones → accepted session → browser save → render receipts.

Online: UI command + request ID + expected revision → authenticated socket seat → serialized reducer transition → atomic disk replacement → canonical room broadcast → render. Clients cannot submit snapshots, dice totals or balances.

Pending landings and auctions are session state, not transient React-only UI. Reloads therefore restore decisions rather than repeating salary, rent or a purchase. Financial action failures leave the accepted state unchanged.

## Persistence boundary

The server writes each room to a unique private temporary file, then renames it before publishing the updated state. On failure it retains the previous state. Startup validates snapshots and reconnects seats as offline. This supports tested process-restart recovery, but is not an fsync-backed transaction database, redundant storage or a multi-worker deployment model. Run one writer process per data directory.

PostgreSQL, account identities, cross-device recovery, moderation, scalable room placement and comprehensive insolvency settlement remain future production work—not hidden capabilities of the current file store.
