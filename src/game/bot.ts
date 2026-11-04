/** Deterministic difficulty-1 bot engine.
 *
 * Pure, read-only and bedrock-deterministic: no Math.random, Date.now, React or
 * websocket imports, and the input session is never mutated. `decide` returns
 * the heuristic primary command (or null when the seat has nothing to do this
 * tick; null never means an illegal command), `step` plays it through
 * `applyCommand`, falling back along `fallbackChain` ordered safest-first.
 */
import { AUCTION_INCREMENT, applyCommand, type GameSession, type SessionCommand } from './session';
import { redemptionCost, type Property } from './index';

export type Rng = () => number;

const PURCHASE_RESERVE = 150; // keep this much cash after buying a deed
const MORTGAGE_FLOOR = 100; // mortgage liquidates largest deed below this cash
const DEVELOP_RESERVE = 150; // build only with this much cash left over
const AUCTION_RESERVE_CAP = 75; // 50% of the reserve pooled with the deed's mortgage value

const isProperty = (space: GameSession['game']['spaces'][number]): space is Property & { kind: 'property' } => space.kind === 'property';
const loanCollateral = (session: GameSession, propertyId: string): boolean => session.economy.loans.some(l => l.propertyId === propertyId);
const factoryOn = (session: GameSession, propertyId: string): boolean => session.economy.factories.some(f => f.propertyId === propertyId);
const hashSeat = (seatId: string): number => { let h = 0; for (const char of seatId) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0; return h; };

/** Mulberry-family PRNG seeded from the session seed, revision and seat id; same family as `rollDice`. */
export function botRng(session: GameSession, seatId: string): Rng {
  let state = (session.game.seed ^ (session.revision & 0xffffffff) ^ hashSeat(seatId)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Largest unmortgaged, undeveloped, loan- and factory-free own deed; board order breaks ties. */
function liquidationCommand(session: GameSession, seatId: string): SessionCommand | null {
  const seat = session.game.players[seatId];
  if (!seat || seat.cash >= MORTGAGE_FLOOR) return null;
  let best: { id: string; mortgage: number; space: number } | null = null;
  for (const space of session.game.spaces) {
    if (!isProperty(space) || space.ownerId !== seatId || space.mortgaged || space.development > 0) continue;
    if (loanCollateral(session, space.id) || factoryOn(session, space.id)) continue;
    if (!best || space.mortgage > best.mortgage || (space.mortgage === best.mortgage && space.space < best.space)) best = { id: space.id, mortgage: space.mortgage, space: space.space };
  }
  return best ? { type: 'mortgage', propertyId: best.id } : null;
}

/** Redeems mortgaged deeds that block or starve the districts the seat owns; cheapest pay-off first. */
function redemptionCommand(session: GameSession, seatId: string): SessionCommand | null {
  const seat = session.game.players[seatId];
  if (!seat) return null;
  const groups = new Map<string, Property[]>();
  for (const space of session.game.spaces) {
    if (!isProperty(space)) continue;
    const list = groups.get(space.districtId) ?? [];
    list.push(space);
    groups.set(space.districtId, list);
  }
  let target: { deed: Property; cost: number; priority: number } | null = null;
  for (const group of groups.values()) {
    if (!group.some(p => p.ownerId === seatId) || !group.some(p => p.mortgaged && p.ownerId === seatId)) continue;
    const fullDistrict = group.every(p => p.ownerId === seatId);
    const developable = group.some(p => p.ownerId === seatId && !p.mortgaged && p.development < p.maxDevelopment);
    for (const deed of group) {
      if (!deed.mortgaged || deed.ownerId !== seatId || loanCollateral(session, deed.id) || factoryOn(session, deed.id)) continue;
      const cost = redemptionCost(deed);
      if (seat.cash < cost + DEVELOP_RESERVE) continue;
      // Full districts unlock development after redemption; partial ones simply restore their rents.
      const priority = (fullDistrict ? 0 : 5) + (developable ? 0 : 2) + cost;
      if (!target || priority < target.priority || (priority === target.priority && deed.space < target.deed.space)) target = { deed, cost, priority };
    }
  }
  return target ? { type: 'redeem', propertyId: target.deed.id } : null;
}

/** The first district-owned deed the seat can still build on, once per turn. */
function developmentCommand(session: GameSession, seatId: string): SessionCommand | null {
  if (session.economy.auction) return null;
  if (session.receipts.some(r => r.kind === 'development' && r.from === seatId && r.turn === session.game.turn)) return null;
  const groupOf = (deed: Property) => session.game.spaces.filter(isProperty).filter(p => p.districtId === deed.districtId);
  for (const space of session.game.spaces) {
    if (!isProperty(space) || space.ownerId !== seatId || space.mortgaged || space.development >= space.maxDevelopment) continue;
    if (loanCollateral(session, space.id) || factoryOn(session, space.id)) continue;
    if (session.game.players[seatId].cash - space.developmentCost < DEVELOP_RESERVE) continue;
    const group = groupOf(space);
    if (!group.length || !group.every(p => p.ownerId === seatId) || group.some(p => p.mortgaged)) continue;
    return { type: 'develop', propertyId: space.id };
  }
  return null;
}

/** Landing decision: purchase the landed deed with a comfortable reserve, end the turn when affordable, or open a bid-off. */
function pendingCommand(session: GameSession, seatId: string): SessionCommand | null {
  const seat = session.game.players[seatId];
  if (!seat || session.pendingId !== seatId) return null;
  const landed = session.game.spaces[seat.position];
  if (session.landingOffer && isProperty(landed) && !landed.ownerId) {
    const completesDistrict = session.game.spaces.filter(isProperty).filter(p => p.districtId === landed.districtId).every(p => p.ownerId === seatId || p.id === landed.id);
    // Aggression floor: a monopoly-completing deed is worth buying on a thinner reserve.
    if (seat.cash >= landed.price && (seat.cash - landed.price >= PURCHASE_RESERVE || completesDistrict)) return { type: 'purchase', propertyId: landed.id };
    if (seat.cash < landed.price) return { type: 'startAuction', propertyId: landed.id };
  }
  return { type: 'finish' };
}

/** Auction seat: raise to the increment, but never beyond cash or the deed's collateral value plus half the reserve. */
function auctionCommand(session: GameSession, seatId: string): SessionCommand | null {
  const auction = session.economy.auction;
  if (!auction) return null;
  const seat = session.game.players[seatId];
  if (!seat || auction.leaderId === seatId || auction.folded.includes(seatId)) return null;
  const wanted = auction.bid + AUCTION_INCREMENT;
  const deed = session.game.spaces.find(s => s.id === auction.propertyId);
  const ceiling = Math.min(seat.cash, (deed && isProperty(deed) ? deed.mortgage : 0) + AUCTION_RESERVE_CAP);
  return wanted <= ceiling ? { type: 'bid', amount: wanted } : { type: 'fold' };
}

/** Every incoming offer is refused: difficulty 1 bots do not evaluate trades. */
function offerCommand(session: GameSession, seatId: string): SessionCommand | null {
  const openOffer = session.economy.offers.find(o => o.status === 'open' && o.toId === seatId);
  return openOffer ? { type: 'rejectOffer', offerId: openOffer.id } : null;
}

/** The heuristic primary command for this tick, or null when there is nothing to do. */
export function decide(session: GameSession, seatId: string, rng?: Rng): SessionCommand | null {
  const seat = session.game.players[seatId];
  if (!seat || seat.status !== 'active') return null;
  void (rng ?? botRng(session, seatId)); // deterministic default; difficulty >1 consumes it later
  const isTurn = seatId === Object.keys(session.game.players)[session.game.activePlayer];
  return offerCommand(session, seatId)
    ?? auctionCommand(session, seatId)
    ?? (session.pendingId === seatId ? pendingCommand(session, seatId) : null)
    ?? (isTurn && !session.pendingId ? liquidationCommand(session, seatId) : null)
    ?? (isTurn && !session.pendingId ? redemptionCommand(session, seatId) : null)
    ?? (isTurn && !session.pendingId ? developmentCommand(session, seatId) : null)
    ?? (isTurn && !session.pendingId ? { type: 'roll' } : null);
}

/** Legality fallback path for this seat's turn flow, ordered safest-first. */
export function fallbackChain(session: GameSession, seatId: string): SessionCommand[] {
  const seat = session.game.players[seatId];
  if (!seat || seat.status !== 'active') return [];
  const auction = session.economy.auction;
  if (auction) {
    if (auction.leaderId === seatId || auction.folded.includes(seatId)) return [];
    return [{ type: 'fold' }];
  }
  if (session.pendingId === seatId) {
    const landed = session.game.spaces[seat.position];
    if (session.landingOffer && isProperty(landed) && !landed.ownerId && seat.cash - landed.price >= PURCHASE_RESERVE) {
      return [{ type: 'purchase', propertyId: landed.id }, { type: 'finish' }];
    }
    return [{ type: 'finish' }];
  }
  if (seatId === Object.keys(session.game.players)[session.game.activePlayer]) return [{ type: 'roll' }];
  return [];
}

const sameCommand = (a: SessionCommand, b: SessionCommand): boolean =>
  a.type === b.type && a.propertyId === b.propertyId && a.offerId === b.offerId && a.amount === b.amount;

/** Plays this seat's move: apply the primary heuristic command, else the
 * fallback chain, with applyCommand as the legality judge. Returns the first
 * accepted session clone, or null when no legal command remains this tick. */
export function step(session: GameSession, seatId: string, rng?: Rng, commandId?: string): GameSession | null {
  const candidates: SessionCommand[] = [];
  for (const candidate of [decide(session, seatId, rng), ...fallbackChain(session, seatId)]) {
    if (candidate && !candidates.some(existing => sameCommand(existing, candidate))) candidates.push(candidate);
  }
  for (const candidate of candidates) {
    try {
      return applyCommand(session, seatId, candidate, commandId ?? `bot-${session.revision}-${candidate.type}`);
    } catch { /* Illegal this tick: fall through to the next, safer candidate. */ }
  }
  return null;
}
