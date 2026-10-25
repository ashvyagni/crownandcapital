# CROWN & CAPITAL

An original illustrated 2D city-trading game. Play locally with 2–20 seats or host a private online room. Every deed, unfinished landing, factory, loan, auction and offer belongs to a shared serializable rules engine—not a simulated financial dashboard.

## Run the complete game

Use a current Node.js LTS release (22+ recommended) and npm.

```bash
npm install
npm run build
npm start
```

Open **http://localhost:2567**. This single process serves both the built game and the authoritative `/ws` endpoint. `npm run preview` is a static frontend preview, not the online server.

For development, run these in two terminals:

```bash
npm run server
npm run dev
```

Vite proxies `/ws` to the server. Read `.env.example` for actual environment options; the server reads the process environment, not `.env` automatically.

### Playing online

1. Choose **Online table**, enter a name and character, then **Create online room**.
2. A friend opens the same server's website in a different browser/device and joins with the room code.
3. The host starts when 2–20 seats are present. Each connection controls only its authenticated seat.
4. Reloading reconnects that tab's private seat identity and restores the canonical room state. Disconnected seats stay reserved; they are not replaced with bots.

`localhost` only reaches the current machine. To play over the internet, deploy this service behind HTTPS/WSS with a durable private data volume. To test on a trusted LAN, bind `HOST=0.0.0.0` in your shell and visit the machine's LAN address. Do not expose an unaudited development server publicly.

## What's playable

- Closed 144-stop board, 90 deeds, 18 districts, labelled detail zoom, pan and searchable street directory.
- Six trader characters, an illustrated dealer and banker, and custom local roster.
- Automatic landing cards, acquisition, rent, development, mortgage/redemption, bank sales and building liquidation.
- **Factories:** build, buy supplies, run one production cycle per owner turn, sell goods, upgrade and confirm dismantling.
- **City Bank:** secured loans, fixed disclosed fee, locked collateral and partial/full repayment.
- **Auctions:** open a landed bank deed, bid/fold, reserve winning cash and settle ownership atomically. No client-controlled timer.
- **Negotiations:** offer cash and/or an eligible deed on either side; accept, reject or cancel with settlement revalidation.
- **Saves:** automatic browser snapshots with validation/backup, including pending choices; JSON local-save import/export. Online rooms persist atomically on disk before broadcasts and reload after server restart.
- **Audio:** opt-in original synthesized cues, volume preference and preview under profile settings; no autoplay or external sound assets.
- Original city-world, engraved-inspired typography, route flow, ambient atlas contours, dealer/banker breathing, scroll reveals and reduced-motion alternatives.

## Checks

```bash
npm run lint         # frontend and server TypeScript
npm test             # 30 unit/rules/persistence/geometry tests
npm run test:server  # 2 real WebSocket integration tests, including 20 seats
npm run test:e2e     # 18 Chromium tests; starts isolated frontend/server ports
```

Install the Playwright Chromium browser if your environment does not already provide it. Browser tests cover two isolated clients, reload recovery, full economy flows, generated audio cues, and desktop/mobile screenshots. Twenty socket connections are tested separately; this is not twenty full browsers or a performance benchmark.

## Persistence and privacy

- Local game snapshots live in browser `localStorage`. Online resume credentials live separately in tab-scoped `sessionStorage` and are never included in exported local saves.
- Keep the same tab to reclaim an online seat. Closing the browser/tab or clearing its storage may lose that identity; there is no account-based identity recovery yet.
- **Return to local play** disconnects without forgetting the reserved seat. Choose **Resume my room** to return; automatic online resume stays off while you play locally.
- Server room files live in `.data/rooms` by default, are private/ignored, and contain token hashes, never raw resume tokens. Back up this directory privately. Empty inactive rooms expire after seven days.
- Never copy `.data`, real tokens, `.env` or private payloads into a public repository or support report.

## Honest boundaries

Online transport uses `ws`, not Colyseus. Storage is a single-process atomic-file store, not PostgreSQL or a horizontally scalable service. No password accounts, public hosting, matchmaking, host takeover/AFK bot, cross-device account recovery, full debt workout, balance simulation, music score or frame-animated asset pipeline is claimed. Use an HTTPS reverse proxy, durable volume, edge abuse controls and a deployment/security review before public launch. The deferred Phaser chunk still produces a size advisory.

Reference study and its incomplete live-page rendering are recorded in `docs/VISUAL_QA.md`; no proprietary reference artwork was imported. See `docs/ECONOMY.md`, `docs/MULTIPLAYER_PROTOCOL.md` and `docs/TESTING.md` for exact rules and evidence.
