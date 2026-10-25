# CROWN & CAPITAL — Product Specification

## Product promise
CROWN & CAPITAL is an original city-trading game in which ownership is visible, money is accountable, and the board is a living financial metropolis. The first playable build focuses on the satisfying local-table loop: roll, move, inspect, acquire, and leave a receipt.

## Current playable surface
- Art-directed landing page and entry journey.
- A Phaser 3 2D map representing 144 sequential spaces across 18 named districts.
- 2–20 configurable local seats with character choices, deterministic movement and a shared turn order; four seats by default.
- Civic Gate salary, property ownership, district grouping, rent, development eligibility, mortgages, bankruptcy basics, and ledger events.
- Property inspection, contextual actions, responsive UI, opt-in audio and reduced-motion fallback.
- Server-authoritative 2–20-seat private online rooms with reconnect and process-restart recovery.
- Validated automatic local saves, unfinished-decision restoration, backup and JSON import/export.
- Factories, secured lending, auctions and bilateral negotiations through the City Exchange.

## Product flow
1. Enter from the illustrated city introduction.
2. Join the local table and see all active seats, balances, and turn order.
3. Roll from the active desk.
4. Follow the server-shaped rules foundation through movement and landing resolution.
5. Acquire an available deed or pass; inspect assets and financial implications.
6. Read the recent ledger, then hand the desk to the next player.

## Boundaries
The current repository does not claim password accounts, a deployed internet service, PostgreSQL, multiple server writers, cross-device identity recovery, AFK takeover, event decks, full insolvency workouts or twenty full browser clients. Two isolated browsers and twenty separate socket seats are tested; that is not a load or balance benchmark.
