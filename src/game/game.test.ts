import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, START_SALARY, addPlayer, bankrupt, createGame, develop, makeBoard, mortgage, move, purchase, redemptionCost, removePlayer, resolveLanding, rentFor, rollDice, saleValue, sellBuilding, sellToBank, unmortgage, validateRoster } from './index';

describe('CROWN & CAPITAL rules', () => {
  it('has exactly one start and retains chosen characters with trimmed names', () => {
    const g = createGame(1, [' A ', 'B'], [5, 2]);
    expect(g.spaces.filter(s => s.kind === 'special' && s.specialKind === 'start')).toHaveLength(1);
    expect(g.spaces.filter(s => s.kind === 'property')).toHaveLength(90);
    expect(g.players['player-1']).toMatchObject({ name: 'A', character: 5 });
  });
  it('does not charge rent on mortgaged deeds and uses exact redemption rounding', () => {
    const g = createGame(); const deed = g.spaces.find(s => s.kind === 'property')!;
    purchase(g, 'player-1', deed.id); mortgage(g, 'player-1', deed.id);
    const before = g.players['player-2'].cash;
    g.players['player-2'].position = deed.space; resolveLanding(g, 'player-2');
    expect(g.players['player-2'].cash).toBe(before);
    if (deed.kind === 'property') { expect(rentFor(g, deed)).toBe(0); expect(redemptionCost({ ...deed, mortgage: 90 })).toBe(99); }
  });
  it('can liquidate buildings in a developed district without deadlocking deed sales', () => {
    const g = createGame(); const a = g.players['player-1'];
    const deeds = g.spaces.filter((s): s is Extract<typeof s, { kind: 'property' }> => s.kind === 'property' && s.districtId === 'district-1');
    deeds.forEach(p => purchase(g, a.id, p.id));
    develop(g, a.id, deeds[0].id); develop(g, a.id, deeds[1].id);
    expect(sellToBank(g, a.id, deeds[0].id)).toBe(false);
    const cash = a.cash;
    expect(sellBuilding(g, a.id, deeds[1].id)).toBe(true);
    expect(a.cash).toBe(cash + Math.floor(deeds[1].developmentCost / 2));
    expect(sellToBank(g, a.id, deeds[0].id)).toBe(true);
  });
  it('rejects financial actions by bankrupt players and does not consume failed command ids', () => {
    const g = createGame(); const deed = g.spaces.find(s => s.kind === 'property')!;
    g.players['player-1'].cash = 0;
    expect(purchase(g, 'player-1', deed.id, 'retry')).toBe(false);
    g.players['player-1'].cash = 1500;
    expect(purchase(g, 'player-1', deed.id, 'retry')).toBe(true);
    g.players['player-1'].status = 'bankrupt';
    expect(mortgage(g, 'player-1', deed.id)).toBe(false);
    expect(sellToBank(g, 'player-1', deed.id)).toBe(false);
  });
  it('builds 144 spaces across 18 districts with deterministic dice', () => { const b = makeBoard(); expect(b.spaces).toHaveLength(BOARD_SIZE); expect(b.districts).toHaveLength(18); expect(rollDice(42)).toEqual(rollDice(42)); });
  it('moves and pays salary when passing the gate', () => { const g = createGame(1); const p = g.players['player-1']; p.position = 140; move(g, p.id, { first: 3, second: 2, total: 5, state: 8 }); expect(p.position).toBe(1); expect(p.cash).toBe(1500 + START_SALARY); });
  it('supports ownership, group development, and rent', () => { const g = createGame(); const a = g.players['player-1']; const props = g.spaces.filter((s): s is Extract<typeof s, { kind: 'property' }> => s.kind === 'property' && s.districtId === 'district-1'); props.forEach(x => purchase(g, a.id, x.id)); expect(develop(g, a.id, props[0].id)).toBe(true); expect(rentFor(g, props[0])).toBeGreaterThan(props[0].baseRent); });
  it('makes commands idempotent', () => { const g = createGame(); const prop = g.spaces.find(s => s.kind === 'property')!; expect(purchase(g, 'player-1', prop.id, 'same')).toBe(true); expect(purchase(g, 'player-1', prop.id, 'same')).toBe(false); });
  it('transfers rent and marks an insolvent player bankrupt', () => { const g = createGame(); const prop = g.spaces.find(s => s.kind === 'property')!; purchase(g, 'player-1', prop.id); const b = g.players['player-2']; b.position = prop.space; b.cash = 1; resolveLanding(g, b.id); expect(b.status).toBe('bankrupt'); expect(g.players['player-1'].properties).toContain(prop.id); bankrupt(g, b.id); expect(b.status).toBe('bankrupt'); });
  it('validates 2–20 distinct nonempty seats and locks additions after rolling', () => { expect(validateRoster(['A', ' a '])).toMatch(/unique/); expect(validateRoster(['A'])).toMatch(/2 to 20/); expect(validateRoster(Array.from({ length: 20 }, (_, i) => `Seat ${i}`))).toBeNull(); const g = createGame(); expect(addPlayer(g, 'Cato')).toBe(true); expect(removePlayer(g, 'player-2')).toBe(true); move(g, 'player-1'); expect(addPlayer(g, 'Dana')).toBe(false); expect(removePlayer(g, 'player-3')).toBe(false); });
  it('redeems a mortgage with interest and never builds on encumbered deeds', () => { const g = createGame(); const p = g.spaces.find(s => s.kind === 'property')!; purchase(g, 'player-1', p.id); expect(mortgage(g, 'player-1', p.id)).toBe(true); expect(develop(g, 'player-1', p.id)).toBe(false); const cash = g.players['player-1'].cash; expect(unmortgage(g, 'player-1', p.id)).toBe(true); expect(g.players['player-1'].cash).toBe(cash - redemptionCost(p)); expect(unmortgage(g, 'player-1', p.id)).toBe(false); expect(g.ledger.at(-1)?.kind).toBe('unmortgage'); });
  it('sells to bank at declared value and protects developed sister deeds', () => { const g = createGame(); const deeds = g.spaces.filter((s): s is Extract<typeof s, { kind: 'property' }> => s.kind === 'property' && s.districtId === 'district-1'); deeds.forEach(p => purchase(g, 'player-1', p.id)); expect(develop(g, 'player-1', deeds[0].id)).toBe(true); expect(sellToBank(g, 'player-1', deeds[1].id)).toBe(false); const value = saleValue(deeds[0]); const cash = g.players['player-1'].cash; expect(sellToBank(g, 'player-1', deeds[0].id)).toBe(true); expect(g.players['player-1'].cash).toBe(cash + value); expect(g.ledger.at(-1)?.kind).toBe('sale'); });
});
