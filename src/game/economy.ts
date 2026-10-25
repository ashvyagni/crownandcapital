import type { GameState, Player, Property } from './index';

/** All economy arithmetic is integer arithmetic. A two-player game is the base case. */
export function scaleForPlayers(base: number, players: number): number {
  if (!Number.isInteger(base) || !Number.isInteger(players) || players < 2) throw new Error('players must be an integer >= 2');
  return Math.floor((base * players) / 2);
}
export const scaleAmount = scaleForPlayers;
export interface PlayerCountFactors { cashFactor: number; priceFactor: number; rentFactor: number; }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** Initial balance candidates from the product contract; callers round currency after applying them. */
export function playerCountFactors(players: number): PlayerCountFactors {
  if (!Number.isInteger(players) || players < 2 || players > 20) throw new Error('players must be an integer from 2 to 20');
  return {
    cashFactor: clamp(1 + 0.0125 * (players - 4), 0.95, 1.2),
    priceFactor: clamp(1 + 0.0056 * (players - 4), 0.97, 1.09),
    rentFactor: clamp(1 - 0.0125 * (players - 4), 0.8, 1.025),
  };
}
export function scaledStartingCash(base: number, players: number): number { return Math.round(base * playerCountFactors(players).cashFactor); }
export function scaledPropertyPrice(base: number, players: number): number { return Math.round(base * playerCountFactors(players).priceFactor); }
export function scaledRent(base: number, players: number): number { return Math.round(base * playerCountFactors(players).rentFactor); }
export function playerCountModifier(players: number): number { return Math.round(playerCountFactors(players).cashFactor * 100); }

export interface FactoryInventory { materials: number; energy: number; goods: number; }
export interface Factory { id: string; ownerId: string; propertyId?: string; level: number; inputMaterials: number; inputEnergy: number; outputGoods: number; salePrice: number; inventory: FactoryInventory; }
export interface ProductionResult { produced: number; materialsUsed: number; energyUsed: number; revenue: number; inventory: FactoryInventory; }

export function createFactory(id: string, ownerId: string, level = 1, propertyId?: string): Factory {
  if (!Number.isInteger(level) || level < 1) throw new Error('level must be positive');
  return { id, ownerId, propertyId, level, inputMaterials: 2, inputEnergy: 1, outputGoods: 1, salePrice: 50, inventory: { materials: 0, energy: 0, goods: 0 } };
}
export function produce(factory: Factory, materials: number, energy: number): ProductionResult {
  const m = Math.max(0, Math.floor(materials)); const e = Math.max(0, Math.floor(energy));
  const units = Math.min(Math.floor(m / factory.inputMaterials), Math.floor(e / factory.inputEnergy));
  const usedM = units * factory.inputMaterials, usedE = units * factory.inputEnergy;
  factory.inventory.materials += m - usedM; factory.inventory.energy += e - usedE; factory.inventory.goods += units * factory.outputGoods;
  return { produced: units * factory.outputGoods, materialsUsed: usedM, energyUsed: usedE, revenue: 0, inventory: { ...factory.inventory } };
}
export function sellGoods(factory: Factory, quantity = factory.inventory.goods): number {
  const sold = Math.max(0, Math.min(factory.inventory.goods, Math.floor(quantity))); factory.inventory.goods -= sold; return sold * factory.salePrice;
}
export function runFactory(factory: Factory, materials: number, energy: number): ProductionResult { const result = produce(factory, materials, energy); result.revenue = sellGoods(factory); result.inventory = { ...factory.inventory }; return result; }

export interface Loan { id: string; borrowerId: string; principal: number; remaining: number; collateralPropertyId: string; collateralValue: number; ratePercent: number; }
export function loanLimit(property: Property, ratePercent = 50): number { return Math.floor(property.price * ratePercent / 100); }
export function eligibleForLoan(state: GameState, playerId: string, propertyId: string, amount: number, ratePercent = 50): boolean {
  const p = state.players[playerId]; const property = state.spaces.find(s => s.id === propertyId);
  return !!p && !!property && property.kind === 'property' && property.ownerId === playerId && !property.mortgaged && property.development === 0 && Number.isInteger(amount) && amount > 0 && amount <= loanLimit(property, ratePercent);
}
export function secureLoan(state: GameState, id: string, playerId: string, propertyId: string, amount: number, ratePercent = 50): Loan | null {
  if (!eligibleForLoan(state, playerId, propertyId, amount, ratePercent)) return null;
  const property = state.spaces.find(s => s.id === propertyId) as Property; const loan = { id, borrowerId: playerId, principal: amount, remaining: amount, collateralPropertyId: propertyId, collateralValue: property.price, ratePercent };
  state.players[playerId].cash += amount; return loan;
}
export function repayLoan(state: GameState, loan: Loan, amount: number): number { const p = state.players[loan.borrowerId]; const paid = Math.min(loan.remaining, Math.max(0, Math.floor(amount))); if (!p || p.cash < paid) return 0; p.cash -= paid; loan.remaining -= paid; return paid; }

export interface DealOffer { fromId: string; toId: string; money: number; propertyId?: string; }
export function validateOffer(state: GameState, offer: DealOffer): boolean { const from = state.players[offer.fromId]; const to = state.players[offer.toId]; const prop = offer.propertyId ? state.spaces.find(s => s.id === offer.propertyId) : undefined; return !!from && !!to && from.id !== to.id && Number.isInteger(offer.money) && offer.money >= 0 && from.cash >= offer.money && (!offer.propertyId || (prop?.kind === 'property' && prop.ownerId === from.id && !prop.mortgaged)); }
export function acceptOffer(state: GameState, offer: DealOffer): boolean { if (!validateOffer(state, offer)) return false; const from = state.players[offer.fromId], to = state.players[offer.toId]; from.cash -= offer.money; to.cash += offer.money; if (offer.propertyId) { const prop = state.spaces.find(s => s.id === offer.propertyId) as Property; from.properties = from.properties.filter(id => id !== prop.id); to.properties.push(prop.id); prop.ownerId = to.id; } return true; }

export interface AuctionBid { bidderId: string; amount: number; }
export interface Auction { propertyId: string; bids: AuctionBid[]; settled: boolean; }
export function createAuction(propertyId: string): Auction { return { propertyId, bids: [], settled: false }; }
export function validBid(state: GameState, auction: Auction, bid: AuctionBid): boolean { const p = state.players[bid.bidderId]; return !auction.settled && !!p && Number.isInteger(bid.amount) && bid.amount > 0 && p.cash >= bid.amount && bid.amount > (auction.bids.length ? Math.max(...auction.bids.map(b => b.amount)) : 0); }
export function placeBid(state: GameState, auction: Auction, bid: AuctionBid): boolean { if (!validBid(state, auction, bid)) return false; auction.bids.push(bid); return true; }
export function settleAuction(state: GameState, auction: Auction): AuctionBid | null { if (auction.settled) return null; auction.settled = true; const winner = auction.bids.reduce<AuctionBid | null>((best, bid) => !best || bid.amount > best.amount ? bid : best, null); if (!winner) return null; const property = state.spaces.find(s => s.id === auction.propertyId); const player = state.players[winner.bidderId]; if (!property || property.kind !== 'property' || property.ownerId || player.cash < winner.amount) return null; player.cash -= winner.amount; player.properties.push(property.id); property.ownerId = player.id; return winner; }
