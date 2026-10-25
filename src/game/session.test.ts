import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, FACTORY_COST, RECEIPT_CAP, validateSession, type SessionEntry } from './session';
import { purchase } from './index';

describe('deterministic shared session', () => {
  it('locks collateral once, records partial repayment and unlocks after final settlement', () => {
    let s = createSession(); purchase(s.game, 'player-1', 'property-2');
    s = applyCommand(s, 'player-1', { type: 'requestLoan', propertyId: 'property-2', amount: 50 });
    const id = s.economy.loans[0].id;
    expect(s.economy.loans[0].remaining).toBe(55);
    for (const type of ['mortgage', 'sell', 'buildFactory', 'requestLoan'] as const) expect(() => applyCommand(s, 'player-1', { type, propertyId: 'property-2', amount: 10 })).toThrow();
    s = applyCommand(s, 'player-1', { type: 'repayLoan', loanId: id, amount: 20 });
    expect(s.economy.loans[0].remaining).toBe(35);
    expect(() => applyCommand(s, 'player-1', { type: 'repayLoan', loanId: id, amount: 36 })).toThrow();
    s = applyCommand(s, 'player-1', { type: 'repayLoan', loanId: id, amount: 35 });
    expect(s.economy.loans).toHaveLength(0);
    expect(applyCommand(s, 'player-1', { type: 'mortgage', propertyId: 'property-2' }).game.players['player-1'].cash).toBeGreaterThan(s.game.players['player-1'].cash);
  });
  it('settles auction cash and ownership once after opponents fold, including no-bid close', () => {
    let s = createSession(); s.game.players['player-1'].position = 1; s.pendingId = 'player-1'; s.landingOffer = true;
    s = applyCommand(s, 'player-1', { type: 'startAuction', propertyId: 'property-2' });
    expect(() => applyCommand(s, 'player-1', { type: 'bid', amount: 5 })).toThrow();
    s = applyCommand(s, 'player-2', { type: 'bid', amount: 50 });
    expect(() => applyCommand(s, 'player-2', { type: 'fold' })).toThrow();
    expect(() => applyCommand(s, 'player-1', { type: 'finish' })).toThrow();
    s = applyCommand(s, 'player-1', { type: 'fold' }, 'fold-once');
    expect(s.economy.auction).toBeNull(); expect(s.game.players['player-2'].cash).toBe(1450);
    expect(s.game.players['player-2'].properties).toContain('property-2');
    expect(applyCommand(s, 'player-1', { type: 'fold' }, 'fold-once')).toEqual(s);
    let noBid = createSession(); noBid.game.players['player-1'].position = 1; noBid.pendingId = 'player-1'; noBid.landingOffer = true;
    noBid = applyCommand(noBid, 'player-1', { type: 'startAuction', propertyId: 'property-2' });
    noBid = applyCommand(applyCommand(noBid, 'player-1', { type: 'fold' }), 'player-2', { type: 'fold' });
    expect(noBid.economy.auction).toBeNull(); expect(noBid.landingOffer).toBe(false);
  });
  it('accepts offers only by recipient and revalidates cash atomically', () => {
    let s = createSession(); purchase(s.game, 'player-1', 'property-2');
    s = applyCommand(s, 'player-1', { type: 'proposeOffer', toId: 'player-2', giveCash: 0, requestCash: 100, givePropertyId: 'property-2' });
    const offerId = s.economy.offers[0].id;
    expect(() => applyCommand(s, 'player-1', { type: 'acceptOffer', offerId })).toThrow();
    const poor = structuredClone(s); poor.game.players['player-2'].cash = 1;
    expect(() => applyCommand(poor, 'player-2', { type: 'acceptOffer', offerId })).toThrow();
    expect(poor.game.players['player-1'].properties).toContain('property-2');
    const accepted = applyCommand(s, 'player-2', { type: 'acceptOffer', offerId });
    expect(accepted.game.players['player-2'].properties).toContain('property-2');
    expect(accepted.game.players['player-1'].cash).toBe(s.game.players['player-1'].cash + 100);
  });
  it('supports consecutive developments and factory dismantling without permanent deed locks', () => {
    let s = createSession();
    s.game.spaces.filter(p => p.kind === 'property' && p.districtId === 'district-1').forEach(p => purchase(s.game, 'player-1', p.id));
    s = applyCommand(s, 'player-1', { type: 'develop', propertyId: 'property-2' });
    s = applyCommand(s, 'player-1', { type: 'develop', propertyId: 'property-2' });
    expect(s.game.spaces[1]).toMatchObject({ development: 2 });
    s = applyCommand(s, 'player-1', { type: 'buildFactory', propertyId: 'property-3' });
    const before = s.game.players['player-1'].cash;
    s = applyCommand(s, 'player-1', { type: 'dismantleFactory', propertyId: 'property-3' });
    expect(s.economy.factories).toHaveLength(0); expect(s.game.players['player-1'].cash).toBe(before + 100);
    expect(validateSession(s)).toBe(true);
  });
  it('does not grant a second factory cycle by producing before and after the roll', () => {
    let s = createSession(); purchase(s.game, 'player-1', 'property-2');
    s = applyCommand(s, 'player-1', { type: 'buildFactory', propertyId: 'property-2' });
    s = applyCommand(s, 'player-1', { type: 'buyMaterials', propertyId: 'property-2', quantity: 4 });
    s = applyCommand(s, 'player-1', { type: 'buyEnergy', propertyId: 'property-2', quantity: 2 });
    s = applyCommand(s, 'player-1', { type: 'produce', propertyId: 'property-2' });
    s = applyCommand(s, 'player-1', { type: 'roll' });
    expect(() => applyCommand(s, 'player-1', { type: 'produce', propertyId: 'property-2' })).toThrow(/Already produced/);
  });
  it('replays identically, advances only on finish, and deduplicates accepted IDs', () => {
    const initial = createSession(42, ['Ada', 'Bea']);
    const rolled = applyCommand(initial, 'player-1', { type: 'roll' }, 'roll-1');
    expect(initial.revision).toBe(0);
    expect(rolled).toEqual(applyCommand(initial, 'player-1', { type: 'roll' }, 'roll-1'));
    expect(applyCommand(rolled, 'player-1', { type: 'roll' }, 'roll-1')).toEqual(rolled);
    expect(rolled.pendingId).toBe('player-1');
    expect(() => applyCommand(rolled, 'player-2', { type: 'finish' })).toThrow();
    const finished = applyCommand(rolled, 'player-1', { type: 'pass' });
    expect(finished.game.activePlayer).toBe(1);
    expect(finished.pendingId).toBeNull();
  });

  it('caps oversized receipt history to the newest RECEIPT_CAP entries', () => {
    const seeded = createSession();
    seeded.receipts = Array.from({ length: 10_000 }, (_, i) => ({ id: `legacy-${i}`, turn: 0, kind: 'roll', amount: i, note: `legacy receipt ${i}` }) as SessionEntry);
    expect(validateSession(seeded)).toBe(true);
    const next = applyCommand(seeded, 'player-1', { type: 'roll' });
    expect(next.receipts.length).toBeLessThanOrEqual(RECEIPT_CAP);
    expect(next.receipts.some(r => r.id === 'legacy-0')).toBe(false);
    expect(next.receipts.some(r => r.id === 'legacy-9999')).toBe(true);
    expect(next.receipts.at(-1)?.id.startsWith('session-1-')).toBe(true);
    expect(validateSession(next)).toBe(true);
  });

  it('keeps receipts bounded while a long game accumulates history', () => {
    let s = createSession(7);
    let peak = 0;
    for (let i = 0; i < 1_200; i++) {
      const actor = Object.values(s.game.players)[s.game.activePlayer].id;
      s = applyCommand(s, actor, s.pendingId ? { type: 'finish' } : { type: 'roll' });
      peak = Math.max(peak, s.receipts.length);
      expect(s.receipts.length).toBeLessThanOrEqual(RECEIPT_CAP);
    }
    expect(peak).toBe(RECEIPT_CAP);
  });

  it('rejects malformed persisted state and adversarial amounts', () => {
    const s = createSession();
    expect(validateSession(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(validateSession({ ...s, economy: { ...s.economy, loans: [{ id: 'x', remaining: NaN }] } })).toBe(false);
    expect(validateSession({ ...s, game: { ...s.game, players: { ...s.game.players, 'player-1': { ...s.game.players['player-1'], cash: Infinity } } } })).toBe(false);
    const rolled = applyCommand(s, 'player-1', { type: 'roll' });
    for (const amount of [NaN, Infinity, -1, 1.5]) expect(() => applyCommand(rolled, 'player-1', { type: 'requestLoan', propertyId: 'property-2', amount })).toThrow();
    expect(() => applyCommand(rolled, 'player-2', { type: 'bid', amount: Infinity })).toThrow();
  });

  it('enforces factory ownership and inventory with real money', () => {
    const s = createSession();
    const p = s.game.spaces.find(x => x.kind === 'property')!;
    s.game.players['player-1'].properties.push(p.id);
    if (p.kind === 'property') p.ownerId = 'player-1';
    const rolled = applyCommand(s, 'player-1', { type: 'roll' });
    const built = applyCommand(rolled, 'player-1', { type: 'buildFactory', propertyId: p.id });
    expect(built.game.players['player-1'].cash).toBe(rolled.game.players['player-1'].cash - FACTORY_COST);
    expect(() => applyCommand(built, 'player-1', { type: 'produce', propertyId: p.id })).toThrow();
    expect(() => applyCommand(built, 'player-2', { type: 'buyMaterials', propertyId: p.id, quantity: 2 })).toThrow();
    const stocked = applyCommand(applyCommand(built, 'player-1', { type: 'buyMaterials', propertyId: p.id, quantity: 2 }), 'player-1', { type: 'buyEnergy', propertyId: p.id, quantity: 1 });
    const produced = applyCommand(stocked, 'player-1', { type: 'produce', propertyId: p.id });
    expect(produced.economy.factories[0].goods).toBe(1);
    expect(() => applyCommand(produced, 'player-1', { type: 'produce', propertyId: p.id })).toThrow();
    expect(applyCommand(produced, 'player-1', { type: 'sellGoods', propertyId: p.id, quantity: 1 }).game.players['player-1'].cash).toBe(produced.game.players['player-1'].cash + 50);
  });
});
