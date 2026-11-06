# Verification record

## Commands actually run

| Command | Result | Scope |
|---|---|---|
| `npm run lint` | PASS | Frontend and server TypeScript (rerun 2026-11-06) |
| `npm test` | PASS | 9 Vitest files / 45 tests (rerun 2026-11-06) |
| `npm run test:server` | PASS | 2 real WebSocket integration tests (rerun 2026-11-06) |
| `npm run test:e2e` | PASS | 35 Chromium tests, one worker; run 2026-11-06: `35 passed (2.0m)` |
| `npm run build` | PASS | 331.13 kB initial app JS (gzip 102.36 kB); deferred 1,212.53 kB board JS, uncompressed (measured 2026-11-06) |
| Targeted visual browser rerun | PASS | Desktop home/board/deed and mobile home/bank after the final paper-card animation refinement |
| Running Node service | PASS | `/health` returns `{"ok":true}` and built `/` returns HTTP 200 on port 2567 |

Vite still reports its deferred Phaser chunk size advisory. This is not a claim of a small overall game payload or a performance benchmark.

## Phase 3 closeout verification (2026-11-06)

Final Phase 3 closeout run reconciled docs to measured truth. Phase 3 landed items — design token unification, dead code, type floor, contrast, motion tokens and 44px targets, board zoom, first-run onboarding, exchange-tabs + canvas keyboard/focus — and the final closeout verification was green: `npm run lint` exit 0, `npm test` 9 files / 45 tests, `npm run test:e2e` 35 passed, `npm run test:server` 2 passed, `npm run build` initial app JS 331.13 kB / deferred CityMap 1,212.53 kB.

## Rules, economy and persistence tests

The suite covers 144 unique contiguous perimeter coordinates and loop closure; 18 districts / 90 deeds / one Civic Gate; seeded dice and salary; deed purchase, development, rent, mortgages and exact redemption arithmetic; liquidation and bankruptcy basics; validated 2–20-seat setup; immutable session transitions and duplicate IDs; rejected malformed/unsafe values; local save/read/backup/quota behaviour; factory inventory and ownership; one production cycle across before/after-roll actions; dismantling; single-pledge collateral and partial/final repayment; auction minimums, folding, no-bid close and once-only settlement; recipient-only offer acceptance and atomic revalidation; and the deterministic difficulty-1 bot engine (`src/game/bot.ts`): replay determinism, legality/purity sweeps across seeds and 2–4 seats, bot-vs-bot completion within 1,000 turns / 4,000 commands on three fixed seeds (29, 48, 24 — seed 12 was replaced by 24 in 2026-11-04's `80e13b9` redeem-policy recalibration; observed per-seed counts are recorded as a comment in `bot.test.ts`), and a 50-seed no-throw/no-deadlock sweep. Bot completion is a heuristic throughput check, not a balance guarantee.

No balance simulation is inferred from passing unit tests.

## Real server tests

1. Two seats, derived actor enforcement, stale revision rejection, duplicate protection, disk restart and token reclaim with the same session revision.
2. Twenty separate WebSocket connections, shared canonical start state, out-of-turn rejection, and refusal of a twenty-first seat.

These are not twenty graphical browsers, a stress test, a public deployment, or an account-security audit.

## Browser tests

The 35 tests exercise the existing local table/roster, acquisition, mortgage/redemption, confirmed bank sales, free pass, readable street directory, actual rent, fresh-table confirmation and keyboard/mobile reachability; then verify reload during an unfinished purchase and after acquisition; collateral and partial repayment; stocked factory production/sales and reload; hotseat auction settlement; bilateral acceptance and balances; opt-in generated audio/volume persistence; two isolated browser contexts creating/joining/starting and reclaiming a pending turn on reload; a dropped room socket that shows waiting/reconnecting seat indicators on both clients before the same turn resumes; an abrupt mid-turn reload that reclaims the seat and returns the desk; a departed creator leaving a reserved, still-joinable room; shareable invite links that prefill the join flow, recover from an unknown code, and — after dismissing a valid invite or a missing room's server error — return to local play without reopening the online lobby; the local practice entry seeding a labeled bot table where a bot completes a full turn solo, acts unprompted on the next desk, and re-derives its seats from the saved config after a reload; and desktop/mobile composition plus reduced-motion fallback.

Audio instrumentation confirms oscillators are created after an opt-in gesture and remain absent before opt-in. It is not a human listening/volume-quality review.

## Integration defects found and fixed

- Character IDs were strings in the browser room hook but numbers on the server.
- A Node entry-point URL comparison failed in workspace paths containing spaces.
- Default development command IDs allowed only one build level; revision-specific commands now permit later levels.
- Producing before and after the roll could create two factory cycles in one owner turn.
- The old base stylesheet was overriding the new art layer; the cascade is now explicit in `main.tsx` and a font-family browser assertion protects it.
- Card opacity during entrance let map text bleed through paper; the final dealing animation moves an opaque card instead.
- The online test initially confused the join-code input with the asynchronously returned room-code output; it now waits for the actual output.

## Remaining coverage boundaries

Chromium only; no broad physical-device/Safari/Firefox matrix, audited public hosting, proxy/TLS rollout, account recovery, host takeover, full debt workout, economic balance simulation, multi-writer storage or disaster-recovery benchmark. Those must not be implied by the current checks.

## Artifact decisions (2026-10-25)

- Removed `tests/reference-inspection.mjs`: a one-off read-only scraper of an external site writing to a hardcoded temp path; not part of the project suite.
- Kept `test-results/audit-2026-10-25/` screenshots on disk, ignored by git.
- `.data/` (room token hashes) and `.data/e2e-rooms/` are git-ignored and were never committed.
