import { describe, expect, it } from 'vitest';
import { createGame, purchase } from './index';
import { createAuction, createFactory, placeBid, produce, runFactory, scaleForPlayers, secureLoan, loanLimit, repayLoan, settleAuction, playerCountFactors, scaledRent } from './economy';

describe('economy foundation', () => {
  it('scales with exact integer arithmetic', () => { expect(scaleForPlayers(101, 3)).toBe(151); expect(scaleForPlayers(101, 4)).toBe(202); });
  it('exposes the documented conservative player-count factors', () => { expect(playerCountFactors(20)).toEqual({ cashFactor: 1.2, priceFactor: 1.0896, rentFactor: 0.8 }); expect(scaledRent(101, 8)).toBe(96); });
  it('reconciles factory inputs, output, and sale', () => { const f = createFactory('f', 'player-1'); expect(produce(f, 5, 2).produced).toBe(2); const result = runFactory(f, 0, 0); expect(result.revenue).toBe(100); expect(f.inventory).toEqual({ materials: 1, energy: 0, goods: 0 }); });
  it('enforces collateral loan limits and repayment', () => { const state = createGame(); const property = state.spaces.find(s => s.kind === 'property')!; const p = state.players['player-1']; purchase(state, p.id, property.id); expect(loanLimit(property as any)).toBe(Math.floor((property as any).price / 2)); const loan = secureLoan(state, 'l', p.id, property.id, loanLimit(property as any)); expect(loan).not.toBeNull(); expect(repayLoan(state, loan!, 20)).toBe(20); expect(loan!.remaining).toBe(loan!.principal - 20); });
  it('settles the highest valid auction bid', () => { const state = createGame(); const property = state.spaces.find(s => s.kind === 'property')!; const auction = createAuction(property.id); expect(placeBid(state, auction, { bidderId: 'player-1', amount: 200 })).toBe(true); expect(placeBid(state, auction, { bidderId: 'player-2', amount: 300 })).toBe(true); expect(settleAuction(state, auction)?.bidderId).toBe('player-2'); expect((property as any).ownerId).toBe('player-2'); });
});
