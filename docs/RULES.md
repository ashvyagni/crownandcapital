# Rules

## Implemented state
The rules module is a serializable `GameState` containing 144 spaces, 18 districts, players, a turn counter, active-player index, explicit dice state, and a ledger. Money is integer Crowns (`CR`).

## Local turn
1. The active player rolls two deterministic seeded dice.
2. The token advances on the fixed sequential route.
3. Passing Civic Gate credits `CR 200` and writes a salary entry.
4. A landing on an owned, unencumbered property charges rent; an insolvent payer enters bankruptcy basics.
5. An unowned, affordable property can be acquired once through an idempotent command or passed.
6. A centred dealer card holds the turn until the player explicitly passes or ends it. Buying does not silently hand off the turn; management actions remain available on the owned landing card.
7. End turn advances to the next non-bankrupt seat. The final solvent player is shown as the winner.

## Ownership and development
Five property slots per district are grouped by district (90 deeds total). A player who owns every property in a district can develop up to level 4, provided the district has no mortgaged deeds. Each level costs the property's configured development cost and increases its rent multiplier.

Mortgaging an undeveloped deed releases its mortgage value and suspends rent. Redemption costs the mortgage principal plus 10%, rounded up using integer arithmetic. Selling to the bank returns half the purchase price plus half the invested development cost, less any outstanding mortgage principal. Developed sister deeds block a deed sale; individual buildings can be liquidated at half cost to clear that restriction. Sales require confirmation in the UI.

Setup accepts 2–20 distinct, trimmed names and six character variants. Roster changes lock after the first roll. There is exactly one Civic Gate (space 1); district gates elsewhere do not pay salary. Salary is credited only on a complete route wrap.

## Not yet live
Double-specific extra turns, event decks, full insolvency workouts and net-worth victory ranking remain unimplemented. Factories, secured fixed-fee loans, auctions and bilateral offers now run through `src/game/session.ts` locally and on the authoritative server; see `ECONOMY.md` for exact parameters. Online seats may act only for themselves. Browser saves retain unfinished landings; server saves retain rooms across process restart.
