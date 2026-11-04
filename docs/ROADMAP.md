# CROWN & CAPITAL — Roadmap

Single source of truth for plan, gates and measured status. Every count below was re-run on
**2026-10-26**, not remembered. When this file and a command disagree, the command wins and this
file is fixed.

## 1. Vision & strategic direction

CROWN & CAPITAL is an original illustrated 2D city-trading game whose whole economy — deeds,
auctions, loans, factories, offers — lives in one deterministic, serializable rules engine
(`src/game/session.ts`) shared by local play and the online server.

**Direction A (practical excellence) is chosen:** finish and harden what people can play today —
bots as seat fillers, async/private-room UX, mobile PWA, economy tuning. **Direction B** (broad
social/competitive surface: matchmaking, seasons, community) is *evidence-gated*: no work starts
until A's gates are green and real demand is observed. **Direction C** (re-skin for a known IP,
3D asset pipeline) is **rejected**.

**Non-goals:** public matchmaking, password/account identity, modding or UGC, ads, 3D pipeline,
AFK/host takeover, multi-writer database, mobile-native apps.

## 2. Phases & gates

| Phase | Objective | Status | Completion gate (measurable) |
|---|---|---|---|
| **0 — Reality & safety** | Truthful baseline: working tree under git, all suites green, docs match measurements | **done** | `npm run lint` + `npm test` + `npm run test:server` + `npm run test:e2e` exit 0 on a committed tree **and** README/TESTING counts equal measured counts |
| **1 — Foundations** | Deterministic rules foundation, immutable command reducer, seat-authorized server, atomic persistence, reconnect | **done** | G0 green; server tests prove seat-derived actor, revision check, dedupe, restart recovery, 20 seats |
| **2A — Async / private-room UX** | Shareable `/r/` invite deep links, waiting + disconnected seat indicators, reconnect resume | **done** (evidence: `room-link.spec.ts`, `reconnect.spec.ts`) | invite link completes a join in a fresh context; dropped socket shows waiting/reconnecting on both clients then resumes the same turn |
| **2B — Bots** | Deterministic AI seat fillers: 2B.1 contract → 2B.2 `decide()` + tests → 2B.3 turn driver → 2B.4 practice entry → 2B.5 online seats | **in progress** (2B.1 contract delivered 2026-10-26) | **G2**: bot-vs-bot determinism + legality + bounded-completion tests in `npm test`; link-play + bots both complete |
| **3 — Design system + onboarding + a11y** | Single visual system (one token layer), first-run onboarding, accessibility sweep | not started | **G3**: AA contrast audit 0 failures, type floor ≥ 12px, keyboard-only full turn (roll→land→decide→finish), axe 0 serious/critical |
| **4 — PWA + economy tuning + ledger export** | Installable PWA/offline shell, balance pass (player-count factors, game-length band), ledger export | not started | **G4**: installable; game-length inside the band recorded in `ECONOMY.md` (**band not yet defined — G4 cannot be claimed until it is**); exported ledger round-trips to engine state |
| **5 — Performance** | Ledger cap, delta broadcast, metrics, load test | not started | **G5**: sub-quadratic growth measured at 10k commands (1k vs 10k wall time recorded in `TESTING.md`), p95 `applyCommand` < 100 ms in-process, `/metrics` parseable |
| **6 — Evidence-gated (B)** | Tournaments, replay/leaderboards, seasonal content | not started | Starts only with Direction-B evidence; requires G0–G5 green first |
| **Release readiness** | Deployable, audited build | not started | **G6**: all gates green on a tagged commit + clean security audit |

### Quality gates

| Gate | Criteria | Status |
|---|---|---|
| **G0** | `lint` / `test` / `test:server` / `test:e2e` all exit 0; changes committed; docs match measured counts | **green** (2026-10-26) |
| **G1** | Receipts bounded (`RECEIPT_CAP = 500`, TDD) + S1 contrast/mobile fixes | **DONE** |
| **G2** | Link-play complete + bots complete + determinism (same seed ⇒ same command sequence & same final session) | open — Phase 2B |
| **G3** | Design unification, AA contrast audit 0 failures, type floor ≥ 12 px, keyboard-only full turn, axe 0 serious/critical | open — Phase 3 |
| **G4** | PWA installable, game-length within target band, ledger export == engine state | open — Phase 4 |
| **G5** | Non-quadratic validation at 10k commands, p95 < 100 ms in-process, `/metrics` parseable | open — Phase 5 |
| **G6** | All green on a tagged commit + security audit clean | open — release |

## 3. Status — 2026-10-26

Re-ran the evidence; all commands from repo root on `main`.

| Command | Result |
|---|---|
| `git log --oneline` | **11 commits** (baseline `d1f9538` → `e31dd52`); tree clean |
| `npm run lint` | exit 0 (frontend + server `tsc`) |
| `npm test` | **34 tests / 6 files** pass (matches README & TESTING) |
| `npm run test:server` | **2** pass (2-seat auth flow; 20 seats + rejected 21st) |
| `npx playwright test` | **32 passed (2.6m)**, 6 spec files, Chromium, one worker (matches README & TESTING) |
| `npm run build` | pass; initial `index-*.js` **322.7 kB** (315.1 KiB), deferred `CityMap-*.js` 1211.6 kB |

**Verified since baseline (each has a commit):** no git repo → repo with 11 commits and truthful
docs; build/economy markers shipped (`9cfc952`); receipts capped newest-keep 500 by TDD with a
30s long-game test (`dd03212`); dead `economy.ts` removed (`dd03212`); S1 a11y/mobile contrast +
turn-guidance fixes (`3d1eb6e`); shareable `/r/` invite deep links (`9f1e088`); waiting/disconnected
seat indicators + reconnect resume (`fd3af5c`); local-mode restore on invite dismissal (`9d21343`);
receipts-cap unflake + evidence reconciliation (`e31dd52`).

**Test totals: unit 34 (6 files) · server 2 · e2e 32 (6 files)** — re-verified, not copied.

## 4. Decisions log

| # | Decision | Evidence / rationale |
|---|---|---|
| **D1** | Establish a git baseline and make docs state only measured facts | Pre-existing tree had no VCS; every count in README/TESTING now comes from a re-run |
| **D2** | Economy markers implemented (not stripped) | `setEconomyMarkers` in `CityScene.ts` + signature guard; shipped `9cfc952` |
| **D3** | Receipts capped: keep newest 500, legacy sessions self-repair on next accepted command; **game ledger still uncapped (open → Phase 5)** | `RECEIPT_CAP` splice at end of `applyCommand`; long-game test `session.test.ts` |
| **D4** | Dead `economy.ts` deleted; player-count factors (`cashFactor`/`priceFactor`/`rentFactor`) documented but deferred to Phase 4 | `ECONOMY.md` states they are not wired; tests removed with the module |
| **D5** | Host-deadlock: **no protocol change** — absent creator is labelled, not fixed | `MULTIPLAYER_PROTOCOL.md`: session always opens at seat 1 and every command is active-player gated, so relaxing the start gate would stall anyway |
| **D6** | Direction A chosen over B and C | §1; B evidence-gated, C rejected |

## 5. Open risks

1. **Ledger unbounded** — `game.ledger` grows for the whole match; receipts are capped but the ledger is not (Phase 5).
2. **Full-state broadcast** — every accepted command re-sends the entire room snapshot: O(state) per action, no deltas (Phase 5).
3. **No account-based identity recovery** — losing a tab's resume token loses the seat; *accepted* for now (D5-adjacent).
4. **e2e is Chromium-only** — no Safari/Firefox/physical-device matrix (`TESTING.md` coverage boundary).
5. **`TESTING.md` build-size evidence is stale — verified** — doc says "~309 kB"; a fresh `npm run build` today measured **322.7 kB** (CityMap 1211.6 kB ≈ the documented 1.21 MB). Fix the number in the Phase 3 docs pass.
6. **Economy-marker guard has no unit test — verified** — no test references `setEconomyMarkers`; only the manual visual rerun covers it.
7. **Absent-creator lobby still cannot start** — labelled with an explicit waiting state, deliberately not fixed (D5).
8. **Demand for an original-IP game is unverified** — the reason Direction B stays evidence-gated.

## 6. Next actions

1. **Phase 2B — bots.** 2B.1 interface contract delivered with this roadmap (2026-10-26); implement 2B.2 `decide()` + determinism/legality/completion tests, then 2B.3 turn driver (local-first), then 2B.4 practice entry.
2. **Phase 3 — design-system unification + onboarding + a11y** (G3), including the `TESTING.md` build-size correction from §5.
3. Everything else waits behind its gate in §2.
