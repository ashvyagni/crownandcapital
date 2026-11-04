import { describe, expect, it } from 'vitest';
import { createSession, type GameSession } from './session';
import { botRng, decide, fallbackChain, step } from './bot';

const NAMES = ['Avery', 'Briar', 'Cove', 'Dane'];
const COMPLETION_SEEDS = [29, 48, 12];
const activeCount = (session: GameSession): number => Object.values(session.game.players).filter(p => p.status === 'active').length;
const lastCommandId = (session: GameSession): string => session.commandIds[session.commandIds.length - 1] ?? '';

let nullStreak = 0;
/** One outer tick plays at most one command per active seat, in stable seat order. */
function cycle(session: GameSession): { session: GameSession; accepted: string[] } {
  const accepted: string[] = [];
  for (const seatId of Object.keys(session.game.players)) {
    if (activeCount(session) <= 1) break;
    const next = step(session, seatId);
    if (!next) { nullStreak++; if (nullStreak > 20) throw new Error(`null deadlock after ${nullStreak} fruitless steps`); continue; }
    nullStreak = 0;
    session = next;
    accepted.push(lastCommandId(session));
  }
  return { session, accepted };
}

function advance(start: GameSession, ticks: number): { session: GameSession; commands: string[] } {
  nullStreak = 0;
  const commands: string[] = [];
  let session = start;
  for (let tick = 0; tick < ticks && activeCount(session) > 1; tick++) {
    const before = session;
    session = cycle(session).session;
    if (session.revision > before.revision) commands.push(lastCommandId(session));
  }
  return { session, commands };
}

describe('difficulty-1 bot engine', () => {
  it('deterministically replays a fixed run: same seed, identical command stream and session; different seed, divergent stream', () => {
    const runA = advance(createSession(29, NAMES.slice(0, 2)), 400);
    const runB = advance(createSession(29, NAMES.slice(0, 2)), 400);
    expect(runA.commands.length).toBeGreaterThan(0);
    expect(runA.commands).toEqual(runB.commands);
    expect(runA.session).toEqual(runB.session);
    expect(JSON.stringify(runA.session)).toBe(JSON.stringify(runB.session));
    const runC = advance(createSession(30, NAMES.slice(0, 2)), 400);
    expect(runC.commands).not.toEqual(runA.commands);
    const seededA = botRng(runA.session, 'player-1');
    const seededB = botRng(structuredClone(runA.session), 'player-1');
    for (let i = 0; i < 8; i++) expect(seededA()).toBe(seededB());
  });

  it('keeps every bot command legal, revision-bumped and the source session pure across seeds and seat counts', () => {
    for (const seed of [29, 48, 24]) for (const seats of [2, 3, 4]) {
      const input = createSession(seed, NAMES.slice(0, seats));
      const snapshot = structuredClone(input);
      let session = input;
      let applied = 0;
      nullStreak = 0;
      while (applied < 500 && activeCount(session) > 1) {
        const result = cycle(session);
        for (const command of result.accepted) {
          expect(command).toMatch(/^player-\d+:bot-\d+-[a-zA-Z]+$/);
          applied++;
        }
        session = result.session;
      }
      expect(applied).toBeGreaterThan(0);
      expect(input).toEqual(snapshot);
    }
  });

  for (const seed of COMPLETION_SEEDS) {
    it(`completes bot-vs-bot on seed ${seed} within 1,000 turns and 4,000 commands`, () => {
      let session = createSession(seed, NAMES.slice(0, 2));
      let commands = 0;
      let lastTurn = session.game.turn;
      let turnless = 0;
      nullStreak = 0;
      while (activeCount(session) > 1) {
        if (session.game.turn >= 1000 || commands >= 4000) throw new Error(`seed ${seed} exceeded the completion bound at turn ${session.game.turn} / ${commands} commands`);
        const before = session;
        session = cycle(session).session;
        if (session === before) continue;
        commands += session.revision - before.revision;
        if (session.game.turn !== lastTurn) { lastTurn = session.game.turn; turnless = 0; } else if (++turnless > 60) throw new Error(`seed ${seed} stalled after ${turnless} commands without a turn advance`);
      }
      expect(activeCount(session)).toBeLessThanOrEqual(1);
      expect(session.game.turn).toBeLessThanOrEqual(1000);
    }, 30_000);
  }

  it('runs 50 two-seat seeds without throwing or deadlocking', () => {
    for (let seed = 1; seed <= 50; seed++) {
      nullStreak = 0;
      let session = createSession(seed, NAMES.slice(0, 2));
      for (let tick = 0; tick < 150 && activeCount(session) > 1; tick++) session = cycle(session).session;
    }
  }, 30_000);

  it('decides only legal-flow commands: roll on turn, purchase-or-finish pending, auction folding, and null while idle', () => {
    const session = createSession(48, NAMES.slice(0, 2));
    expect(decide(session, 'player-1')).toEqual({ type: 'roll' });
    expect(fallbackChain(session, 'player-2')).toEqual([]);
    expect(decide(session, 'player-2')).toBeNull();
    expect(step(session, 'player-2')).toBeNull(); // off-turn with no auction and no offer: nothing to do
    const moved = step(session, 'player-1')!;
    expect(moved).not.toBeNull();
    expect(moved.revision).toBe(session.revision + 1);
    // The pending seat owns a purchase-or-finish flow: the chain leads with the primary intent and ends at the safe finish.
    const primary = decide(moved, 'player-1')!;
    const chain = fallbackChain(moved, 'player-1');
    expect(chain[0]).toEqual(primary);
    expect(chain[chain.length - 1]).toEqual({ type: 'finish' });
    expect(primary.type).toMatch(/^(purchase|finish|startAuction)$/);
    // Let the landing resolve: an auction flow implies the off-turn seat folds rather than idling.
    let landing = moved;
    while (landing.pendingId === 'player-1' && landing.economy.auction === null) {
      const next = step(landing, 'player-1');
      if (!next) break;
      landing = next;
    }
    if (landing.economy.auction) {
      expect(decide(landing, 'player-2')).toEqual({ type: 'bid', amount: landing.economy.auction.bid + 10 });
      expect(fallbackChain(landing, 'player-2')).toEqual([{ type: 'fold' }]);
    } else if (landing.pendingId === 'player-1') {
      expect(decide(landing, 'player-1')).toEqual({ type: 'finish' });
    } else {
      expect(decide(landing, 'player-1')).toBeNull(); // pending resolved and the desk moved on
    }
  });
});
