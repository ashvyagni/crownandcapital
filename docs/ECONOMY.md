# Economy

## Current parameters

| Parameter | Current value | Notes |
|---|---:|---|
| Starting cash | `CR 1,500` | deliberately compact for the local slice |
| Civic Gate salary | `CR 200` | credited when the route wraps |
| Property count | `90` | 5 purchasable slots × 18 districts |
| Development cap | `4` | only with full district ownership |
| Mortgage advance | `50%` of price | integer rounded down |

Property price and rent are generated from district tier and slot. All calculations are integer arithmetic. The ledger records purchases, rent, salary, development, mortgage, refunds, and bankruptcy entries.

The economy module also exposes the documented player-count candidates: `cashFactor = clamp(1 + .0125 × (P - 4), .95, 1.20)`, `priceFactor = clamp(1 + .0056 × (P - 4), .97, 1.09)`, and `rentFactor = clamp(1 - .0125 × (P - 4), .80, 1.025)`. These are tested as helpers but are not yet wired into match setup or balance simulations.

## Integrated exchange rules

The authoritative command implementation is `src/game/session.ts`; `economy.ts` remains a set of older standalone helper experiments, not the live exchange's transaction boundary.

| Factory action | Current rule |
|---|---|
| Build | CR 200 on an owned, vacant, unencumbered deed |
| Materials | CR 10 each |
| Energy | CR 15 each |
| Production | 2 materials + 1 energy → 1 good; once per owner's turn, including before/after-roll actions |
| Capacity | Level 1–3 goods per cycle |
| Upgrade | CR 150, maximum level 3 |
| Sell goods | CR 50 per good; only existing inventory can be sold |
| Dismantle | Half invested build/upgrade cost; confirmed inventory discard; collateral loan must be repaid first |

Loans advance at most half the eligible deed's value, add a disclosed fixed 10% fee once, and support positive integer partial or full repayments. Only one outstanding loan can pledge a deed. Pledged deeds cannot be mortgaged, developed, sold or offered. There is no hidden per-minute interest, repayment timer or maturity schedule.

An auction opens only on the active player's landed bank deed. Bids increase by at least CR 10 and cannot exceed cash. The leading bid reserves funds; spending/offer acceptance is blocked while the auction is open. Other seats fold to settle the winner; everyone folding without a bid leaves the deed at the bank. The active landing still requires explicit end-turn acknowledgement afterward.

Deals exchange cash and/or a vacant eligible deed on each side. Only the recipient accepts/rejects; only the author cancels. Ownership, cash and encumbrances are rechecked atomically on acceptance. Factory sites cannot be transferred without dismantling.

## Accounting contract
Accepted transitions carry receipts with IDs, turn, kind, amount, reason and optional from/to IDs. Money uses safe integers; goods quantities are displayed as goods rather than CR. Online commands are checked against the current revision and persisted before broadcast. Failed commands do not partially commit. This is not a double-entry accounting database.

## Balance status
No balance simulation result is claimed. Production, fixed-fee loans, auctions and negotiations are live, but still need long-match economic tuning. Scheduled repayments, player-count modifiers and net-worth victory calculation are not integrated. Bankruptcy retains the earlier simplified settlement model: affected factory/loan records are removed and offers cancelled when their owner becomes inactive; priority debt workouts and recovery auctions remain future work.
