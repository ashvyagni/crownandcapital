import { createGame, develop, mortgage, move, nextPlayer, purchase, resolveLanding, sellBuilding, sellToBank, unmortgage, type DiceRoll, type GameState, type LedgerEntry, type Property } from './index';

export const FACTORY_COST = 200;
export const MATERIAL_COST = 10;
export const ENERGY_COST = 15;
export const FACTORY_UPGRADE_COST = 150;
export const FACTORY_SALE_PRICE = 50;
export const MAX_FACTORY_LEVEL = 3;
export const AUCTION_INCREMENT = 10;
export type SessionEntry = Omit<LedgerEntry, 'kind'> & { kind: LedgerEntry['kind'] | 'roll' | 'factory' | 'materials' | 'energy' | 'production' | 'goods' | 'upgrade' | 'loan' | 'repayment' | 'auction' | 'trade' };
export interface SessionFactory { propertyId: string; ownerId: string; level: number; materials: number; energy: number; goods: number; producedTurn: number; }
export interface SessionLoan { id: string; borrowerId: string; propertyId: string; principal: number; remaining: number; total: number; }
export interface SessionAuction { propertyId: string; leaderId: string | null; bid: number; folded: string[]; }
export interface SessionOffer { id: string; fromId: string; toId: string; giveCash: number; requestCash: number; givePropertyId?: string; requestPropertyId?: string; status: 'open' | 'accepted' | 'rejected' | 'cancelled'; }
export interface GameSession { game: GameState; revision: number; pendingId: string | null; landingOffer: boolean; lastRoll: DiceRoll | null; receipts: SessionEntry[]; economy: { factories: SessionFactory[]; loans: SessionLoan[]; auction: SessionAuction | null; offers: SessionOffer[] }; commandIds: string[]; }
export type SessionCommand =
  | { type: 'roll' | 'finish' | 'purchase' | 'pass' | 'startAuction' | 'bid' | 'fold' | 'develop' | 'mortgage' | 'redeem' | 'sell' | 'building' | 'buildFactory' | 'dismantleFactory' | 'buyMaterials' | 'buyEnergy' | 'produce' | 'sellGoods' | 'upgradeFactory' | 'requestLoan' | 'repayLoan' | 'proposeOffer' | 'acceptOffer' | 'rejectOffer' | 'cancelOffer'; propertyId?: string; amount?: number; quantity?: number; loanId?: string; offerId?: string; toId?: string; giveCash?: number; requestCash?: number; givePropertyId?: string; requestPropertyId?: string };

const integer = (n: unknown, min = 0): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128;
const fail = (message: string): never => { throw new Error(message); };
const requireInt = (n: unknown, name: string, min = 1): number => integer(n, min) ? n : fail(`${name} must be a finite integer >= ${min}`);
const clone = <T>(value: T): T => structuredClone(value);
const active = (s: GameSession, id: string) => s.game.players[id]?.status === 'active';
const deed = (s: GameSession, id?: string): Property => {
  const p = s.game.spaces.find(x => x.id === id);
  if (!p || p.kind !== 'property') return fail('Unknown property');
  return p;
};
const held = (s: GameSession, id: string) => s.economy.loans.some(l => l.propertyId === id);
const factory = (s: GameSession, id?: string) => s.economy.factories.find(f => f.propertyId === id) ?? fail('Factory not found');
const available = (s: GameSession, id: string) => s.game.players[id].cash - (s.economy.auction?.leaderId === id ? s.economy.auction.bid : 0);
function debit(s: GameSession, id: string, amount: number) { if (available(s, id) < amount) fail('Insufficient available cash'); s.game.players[id].cash -= amount; }
function receipt(s: GameSession, kind: SessionEntry['kind'], amount: number, note: string, from?: string, to?: string) {
  const e: SessionEntry = { id: `session-${s.revision + 1}-${s.receipts.length + 1}`, turn: s.game.turn, kind, amount, note, from, to };
  s.receipts.push(e);
}
function reconcile(s: GameSession) {
  const valid = (id: string) => active(s, id);
  s.economy.factories = s.economy.factories.filter(f => valid(f.ownerId) && deed(s, f.propertyId).ownerId === f.ownerId);
  s.economy.loans = s.economy.loans.filter(l => valid(l.borrowerId) && deed(s, l.propertyId).ownerId === l.borrowerId);
  for (const o of s.economy.offers) if (o.status === 'open' && (!valid(o.fromId) || !valid(o.toId))) o.status = 'cancelled';
  const a = s.economy.auction;
  if (a && (!valid(s.pendingId || '') || deed(s, a.propertyId).ownerId)) s.economy.auction = null;
  else if (a) { if (a.leaderId && !valid(a.leaderId)) { a.leaderId = null; a.bid = 0; } a.folded = a.folded.filter(valid); settle(s); }
}
function settle(s: GameSession) {
  const a = s.economy.auction;
  if (!a) return;
  const eligible = Object.keys(s.game.players).filter(id => active(s, id) && !a.folded.includes(id));
  if ((a.leaderId && eligible.length === 1 && eligible[0] === a.leaderId) || (!a.leaderId && eligible.length === 0)) {
    if (a.leaderId) {
      const p = deed(s, a.propertyId); const winner = s.game.players[a.leaderId];
      if (winner.cash < a.bid || p.ownerId) fail('Auction cannot settle');
      winner.cash -= a.bid; winner.properties.push(p.id); p.ownerId = winner.id;
      receipt(s, 'auction', a.bid, p.name, winner.id);
    }
    s.economy.auction = null;
    s.landingOffer = false;
  }
}
export function createSession(seed = 1, names = ['Avery', 'Briar'], characters: number[] = []): GameSession {
  if (!integer(seed)) fail('Seed must be a nonnegative finite integer');
  return { game: createGame(seed, names, characters), revision: 0, pendingId: null, landingOffer: false, lastRoll: null, receipts: [], economy: { factories: [], loans: [], auction: null, offers: [] }, commandIds: [] };
}
export function applyCommand(session: GameSession, actorId: string, command: SessionCommand, commandId?: string): GameSession {
  if (!validateSession(session)) fail('Invalid session snapshot');
  if (!command || typeof command !== 'object' || typeof command.type !== 'string') fail('Invalid command');
  if (commandId !== undefined && !text(commandId)) fail('Invalid command ID');
  const dedupeId = commandId ? `${actorId}:${commandId}` : undefined;
  if (dedupeId && session.commandIds.includes(dedupeId)) return clone(session);
  if (!active(session, actorId)) fail('Unknown or bankrupt actor');
  const s = clone(session);
  const current = Object.keys(s.game.players)[s.game.activePlayer];
  const turn = () => { if (actorId !== current) fail('Only the active player can act'); };
  const pending = () => { turn(); if (s.pendingId !== actorId) fail('Roll before taking this action'); };
  const noAuction = () => { if (s.economy.auction) fail('Resolve the auction first'); };
  const owned = (id?: string) => { const p = deed(s, id); if (p.ownerId !== actorId) fail('Property is not yours'); return p; };
  const unencumbered = (p: Property) => { if (p.mortgaged || held(s, p.id)) fail('Property is encumbered'); };
  const bankAction = (action: () => boolean, name: string) => { const before = s.game.ledger.length; if (!action()) fail(`${name} is not permitted`); s.receipts.push(...s.game.ledger.slice(before)); };
  switch (command.type) {
    case 'roll': {
      turn(); noAuction(); if (Object.values(s.game.players).filter(p => p.status === 'active').length < 2) fail('The game is complete'); if (s.pendingId) fail('Finish the pending turn first');
      const before = s.game.ledger.length;
      s.lastRoll = move(s.game, actorId); resolveLanding(s.game, actorId);
      s.receipts.push(...s.game.ledger.slice(before));
      receipt(s, 'roll', s.lastRoll.total, `${s.lastRoll.first} + ${s.lastRoll.second}`, actorId);
      s.pendingId = active(s, actorId) ? actorId : null;
      if (!s.pendingId && Object.values(s.game.players).some(p => p.status === 'active')) nextPlayer(s.game);
      const land = s.game.spaces[s.game.players[actorId].position];
      s.landingOffer = land.kind === 'property' && !land.ownerId && active(s, actorId);
      reconcile(s);
      break;
    }
    case 'finish': case 'pass': {
      pending(); noAuction(); s.landingOffer = false; s.pendingId = null;
      if (Object.values(s.game.players).filter(p => p.status === 'active').length > 1) nextPlayer(s.game);
      break;
    }
    case 'purchase': {
      pending(); noAuction(); if (!s.landingOffer) fail('No deed is offered');
      const p = deed(s, command.propertyId);
      if (p.space !== s.game.players[actorId].position) fail('Purchase only the landed deed');
      if (available(s, actorId) < p.price) fail('Insufficient available cash');
      bankAction(() => purchase(s.game, actorId, p.id, `session:${s.revision}:purchase`), 'Purchase'); s.landingOffer = false;
      break;
    }
    case 'startAuction': {
      pending(); noAuction(); if (!s.landingOffer) fail('No deed is offered');
      const p = deed(s, command.propertyId);
      if (p.space !== s.game.players[actorId].position || p.ownerId) fail('Auction only the landed bank deed');
      s.economy.auction = { propertyId: p.id, leaderId: null, bid: 0, folded: [] };
      break;
    }
    case 'bid': case 'fold': {
      const a = s.economy.auction; if (!a) throw new Error('No auction is open');
      if (a.folded.includes(actorId)) fail('You have folded');
      if (command.type === 'bid') {
        const amount = requireInt(command.amount, 'Bid');
        if (a.leaderId === actorId) fail('Already leading');
        if (amount < a.bid + AUCTION_INCREMENT) fail(`Bid must increase by ${AUCTION_INCREMENT}`);
        if (s.game.players[actorId].cash < amount) fail('Insufficient cash for bid');
        a.leaderId = actorId; a.bid = amount;
      } else { if (a.leaderId === actorId) fail('Leading bidder cannot fold'); a.folded.push(actorId); }
      settle(s); break;
    }
    case 'develop': case 'mortgage': case 'redeem': case 'sell': case 'building': {
      turn(); noAuction(); const p = owned(command.propertyId);
      if (command.type !== 'redeem' && held(s, p.id)) fail('Property secures a loan');
      if (command.type === 'develop') { unencumbered(p); if (s.economy.factories.some(f => f.propertyId === p.id)) fail('Factory occupies property'); if (available(s, actorId) < p.developmentCost) fail('Insufficient cash'); bankAction(() => develop(s.game, actorId, p.id, `development:${s.revision}`), 'Development'); }
      if (command.type === 'mortgage') { if (s.economy.factories.some(f => f.propertyId === p.id)) fail('Remove factory before mortgage'); bankAction(() => mortgage(s.game, actorId, p.id), 'Mortgage'); }
      if (command.type === 'redeem') bankAction(() => unmortgage(s.game, actorId, p.id), 'Redemption');
      if (command.type === 'building') bankAction(() => sellBuilding(s.game, actorId, p.id), 'Building sale');
      if (command.type === 'sell') { if (s.economy.factories.some(f => f.propertyId === p.id)) fail('Factory occupies property'); bankAction(() => sellToBank(s.game, actorId, p.id), 'Sale'); }
      break;
    }
    case 'buildFactory': {
      turn(); noAuction(); const p = owned(command.propertyId); unencumbered(p);
      if (p.development || s.economy.factories.some(f => f.propertyId === p.id)) fail('Factory requires an undeveloped vacant deed');
      debit(s, actorId, FACTORY_COST);
      s.economy.factories.push({ propertyId: p.id, ownerId: actorId, level: 1, materials: 0, energy: 0, goods: 0, producedTurn: -1 });
      receipt(s, 'factory', FACTORY_COST, p.name, actorId); break;
    }
    case 'buyMaterials': case 'buyEnergy': {
      turn(); noAuction(); const f = factory(s, command.propertyId); if (f.ownerId !== actorId) fail('Factory is not yours');
      const quantity = requireInt(command.quantity, 'Quantity'); const material = command.type === 'buyMaterials';
      const cost = quantity * (material ? MATERIAL_COST : ENERGY_COST);
      if (!Number.isSafeInteger(cost)) fail('Cost exceeds safe integer range');
      debit(s, actorId, cost); if (material) f.materials += quantity; else f.energy += quantity;
      if (!Number.isSafeInteger(material ? f.materials : f.energy)) fail('Inventory overflow');
      receipt(s, material ? 'materials' : 'energy', cost, `${quantity} units`, actorId); break;
    }
    case 'produce': {
      turn(); noAuction(); const f = factory(s, command.propertyId); if (f.ownerId !== actorId) fail('Factory is not yours');
      const productionTurn = s.game.turn + (s.pendingId ? 0 : 1);
      if (f.producedTurn === productionTurn) fail('Already produced this turn');
      const units = Math.min(Math.floor(f.materials / 2), f.energy, f.level);
      if (!units) fail('Need two materials and one energy per good');
      f.materials -= units * 2; f.energy -= units; f.goods += units; f.producedTurn = productionTurn;
      receipt(s, 'production', units, `${units} goods at ${f.propertyId}`, actorId); break;
    }
    case 'sellGoods': {
      turn(); noAuction(); const f = factory(s, command.propertyId); if (f.ownerId !== actorId) fail('Factory is not yours');
      const quantity = requireInt(command.quantity, 'Quantity'); if (quantity > f.goods) fail('Insufficient goods');
      const revenue = quantity * FACTORY_SALE_PRICE; if (!Number.isSafeInteger(revenue) || !Number.isSafeInteger(s.game.players[actorId].cash + revenue)) fail('Cash overflow');
      f.goods -= quantity; s.game.players[actorId].cash += revenue; receipt(s, 'goods', revenue, `${quantity} goods`, undefined, actorId); break;
    }
    case 'upgradeFactory': {
      turn(); noAuction(); const f = factory(s, command.propertyId); if (f.ownerId !== actorId || f.level >= MAX_FACTORY_LEVEL) fail('Factory cannot be upgraded');
      debit(s, actorId, FACTORY_UPGRADE_COST); f.level++; receipt(s, 'upgrade', FACTORY_UPGRADE_COST, f.propertyId, actorId); break;
    }
    case 'dismantleFactory': {
      turn(); noAuction(); const f = factory(s, command.propertyId);
      if (f.ownerId !== actorId || held(s, f.propertyId)) fail('Repay the collateral loan before dismantling');
      const refund = Math.floor((FACTORY_COST + (f.level - 1) * FACTORY_UPGRADE_COST) / 2);
      s.economy.factories = s.economy.factories.filter(item => item !== f);
      s.game.players[actorId].cash += refund; receipt(s, 'factory', refund, `Dismantled ${f.propertyId}; inventory discarded`, undefined, actorId); break;
    }
    case 'requestLoan': {
      turn(); noAuction(); const p = owned(command.propertyId); unencumbered(p);
      const amount = requireInt(command.amount, 'Principal');
      if (p.development || amount > Math.floor(p.price / 2)) fail('Loan requires undeveloped collateral and principal <= half deed price');
      if (!Number.isSafeInteger(s.game.players[actorId].cash + amount)) fail('Cash overflow');
      const total = amount + Math.ceil(amount / 10);
      const id = `loan-${s.revision + 1}`;
      s.economy.loans.push({ id, borrowerId: actorId, propertyId: p.id, principal: amount, remaining: total, total });
      s.game.players[actorId].cash += amount; receipt(s, 'loan', amount, `${id}: repay ${total} total`, undefined, actorId); break;
    }
    case 'repayLoan': {
      turn(); noAuction(); const loan = s.economy.loans.find(l => l.id === command.loanId);
      if (!loan || loan.borrowerId !== actorId) throw new Error('Loan not found');
      const amount = requireInt(command.amount, 'Repayment'); if (amount > loan.remaining) fail('Repayment exceeds balance');
      debit(s, actorId, amount); loan.remaining -= amount;
      if (!loan.remaining) s.economy.loans = s.economy.loans.filter(l => l !== loan);
      receipt(s, 'repayment', amount, loan.id, actorId); break;
    }
    case 'proposeOffer': {
      turn(); noAuction(); const to = command.toId;
      if (!to || !active(s, to) || to === actorId) throw new Error('Recipient must be another active player');
      const giveCash = requireInt(command.giveCash, 'Give cash', 0), requestCash = requireInt(command.requestCash, 'Request cash', 0);
      if (!giveCash && !requestCash && !command.givePropertyId && !command.requestPropertyId) fail('Empty offer');
      const check = (id: string | undefined, owner: string) => { if (!id) return; const p = deed(s, id); if (p.ownerId !== owner || p.development || p.mortgaged || held(s, id) || s.economy.factories.some(f => f.propertyId === id)) fail('Offered deed is not transferable'); };
      check(command.givePropertyId, actorId); check(command.requestPropertyId, to);
      if (available(s, actorId) < giveCash || available(s, to) < requestCash) fail('Insufficient cash for offer');
      s.economy.offers.push({ id: `offer-${s.revision + 1}`, fromId: actorId, toId: to, giveCash, requestCash, givePropertyId: command.givePropertyId, requestPropertyId: command.requestPropertyId, status: 'open' }); break;
    }
    case 'acceptOffer': case 'rejectOffer': case 'cancelOffer': {
      const o = s.economy.offers.find(x => x.id === command.offerId);
      if (!o || o.status !== 'open') throw new Error('Offer not open');
      if (command.type === 'cancelOffer') { if (o.fromId !== actorId) fail('Only author can cancel'); o.status = 'cancelled'; break; }
      if (o.toId !== actorId) fail('Only recipient can respond');
      if (command.type === 'rejectOffer') { o.status = 'rejected'; break; }
      noAuction(); if (!active(s, o.fromId) || !active(s, o.toId)) fail('Player is inactive');
      for (const [id, owner] of [[o.givePropertyId, o.fromId], [o.requestPropertyId, o.toId]] as const) {
        if (!id) continue; const p = deed(s, id);
        if (p.ownerId !== owner || p.development || p.mortgaged || held(s, id) || s.economy.factories.some(f => f.propertyId === id)) fail('Offer deed is no longer transferable');
      }
      if (available(s, o.fromId) < o.giveCash || available(s, o.toId) < o.requestCash) fail('Offer cash no longer available');
      s.game.players[o.fromId].cash += o.requestCash - o.giveCash;
      s.game.players[o.toId].cash += o.giveCash - o.requestCash;
      for (const [id, from, to] of [[o.givePropertyId, o.fromId, o.toId], [o.requestPropertyId, o.toId, o.fromId]] as const) {
        if (!id) continue; deed(s, id).ownerId = to;
        s.game.players[from].properties = s.game.players[from].properties.filter(x => x !== id);
        s.game.players[to].properties.push(id);
      }
      o.status = 'accepted'; receipt(s, 'trade', o.giveCash + o.requestCash, o.id, o.fromId, o.toId); break;
    }
    default: fail('Unknown session command');
  }
  reconcile(s); s.revision++;
  if (dedupeId) s.commandIds.push(dedupeId);
  s.commandIds = s.commandIds.slice(-1024);
  if (!validateSession(s)) fail('Command produced invalid session');
  return s;
}

export function validateSession(value: unknown): value is GameSession {
  try {
    if (!value || typeof value !== 'object') return false;
    const s = value as GameSession, g = s.game, e = s.economy;
    if (!g || !e || !integer(s.revision) || !Array.isArray(s.commandIds) || new Set(s.commandIds).size !== s.commandIds.length || !s.commandIds.every(text) || !Array.isArray(s.receipts) || !Array.isArray(e.factories) || !Array.isArray(e.loans) || !Array.isArray(e.offers)) return false;
    if (!integer(g.seed) || !integer(g.turn) || !integer(g.diceState) || !Array.isArray(g.spaces) || g.spaces.length !== 144 || !Array.isArray(g.districts) || g.districts.length !== 18 || !Array.isArray(g.ledger) || !Array.isArray(g.lastCommandIds) || !g.players || typeof g.players !== 'object') return false;
    const ids = Object.keys(g.players);
    if (!g.districts.every(d => d && text(d.id) && text(d.name) && /^#[a-fA-F0-9]{6}$/.test(d.color)) || new Set(g.districts.map(d => d.id)).size !== 18) return false;
    if (ids.length < 2 || ids.length > 20 || !integer(g.activePlayer) || g.activePlayer >= ids.length || !ids.every(id => { const p = g.players[id]; return p && p.id === id && text(p.name) && integer(p.position) && p.position < 144 && Number.isSafeInteger(p.cash) && (p.status === 'active' || p.status === 'bankrupt') && integer(p.turns) && Array.isArray(p.properties) && new Set(p.properties).size === p.properties.length; })) return false;
    if (s.pendingId !== null && (s.pendingId !== ids[g.activePlayer] || !active(s, s.pendingId))) return false;
    if (typeof s.landingOffer !== 'boolean' || (s.landingOffer && (!s.pendingId || g.spaces[g.players[s.pendingId].position]?.kind !== 'property' || (g.spaces[g.players[s.pendingId].position] as Property).ownerId))) return false;
    if (s.lastRoll && (!integer(s.lastRoll.first, 1) || s.lastRoll.first > 6 || !integer(s.lastRoll.second, 1) || s.lastRoll.second > 6 || s.lastRoll.total !== s.lastRoll.first + s.lastRoll.second || !integer(s.lastRoll.state))) return false;
    if (!s.receipts.every(r => text(r.id) && integer(r.turn) && text(r.kind) && integer(r.amount) && typeof r.note === 'string' && (!r.from || ids.includes(r.from)) && (!r.to || ids.includes(r.to)))) return false;
    const properties = g.spaces.filter((p): p is Property & { kind: 'property' } => p.kind === 'property');
    if (properties.length !== 90 || g.spaces.some((p, i) => !p || p.space !== i || !text(p.id) || !text(p.name) || !['property', 'special'].includes(p.kind) || (p.kind === 'special' && (!['start', 'treasury', 'festival', 'audit', 'rest', 'tax'].includes(p.specialKind) || (p.amount !== undefined && !integer(p.amount))))) || new Set(g.spaces.map(p => p.id)).size !== 144) return false;
    for (const p of properties) {
      if (!g.districts.some(d => d.id === p.districtId)) return false;
      if (!integer(p.price, 1) || !integer(p.mortgage) || !integer(p.baseRent) || !integer(p.developmentCost) || !integer(p.development) || !integer(p.maxDevelopment) || p.development > p.maxDevelopment || typeof p.mortgaged !== 'boolean' || (p.ownerId && (!ids.includes(p.ownerId) || !g.players[p.ownerId].properties.includes(p.id))) || ids.filter(id => g.players[id].properties.includes(p.id)).length !== (p.ownerId ? 1 : 0)) return false;
    }
    if (ids.some(id => g.players[id].properties.some(pid => !properties.some(p => p.id === pid)))) return false;
    if (new Set(e.factories.map(f => f.propertyId)).size !== e.factories.length || !e.factories.every(f => properties.some(p => p.id === f.propertyId && p.ownerId === f.ownerId && !p.mortgaged && !p.development) && active(s, f.ownerId) && integer(f.level, 1) && f.level <= MAX_FACTORY_LEVEL && integer(f.materials) && integer(f.energy) && integer(f.goods) && Number.isSafeInteger(f.producedTurn) && f.producedTurn >= -1 && f.producedTurn <= g.turn + (s.pendingId ? 0 : 1))) return false;
    if (new Set(e.loans.map(l => l.propertyId)).size !== e.loans.length || new Set(e.loans.map(l => l.id)).size !== e.loans.length || !e.loans.every(l => text(l.id) && active(s, l.borrowerId) && properties.some(p => p.id === l.propertyId && p.ownerId === l.borrowerId && !p.mortgaged && !p.development) && integer(l.principal, 1) && integer(l.total, 1) && l.total === l.principal + Math.ceil(l.principal / 10) && integer(l.remaining, 1) && l.remaining <= l.total)) return false;
    if (e.auction) { const a = e.auction; if (!s.pendingId || !s.landingOffer || !properties.some(p => p.id === a.propertyId && p.space === g.players[s.pendingId!].position && !p.ownerId) || !integer(a.bid) || (a.leaderId !== null && (!active(s, a.leaderId) || a.bid < AUCTION_INCREMENT || g.players[a.leaderId].cash < a.bid)) || (a.leaderId === null && a.bid !== 0) || !Array.isArray(a.folded) || new Set(a.folded).size !== a.folded.length || !a.folded.every(id => ids.includes(id)) || (a.leaderId && a.folded.includes(a.leaderId))) return false; }
    if (new Set(e.offers.map(o => o.id)).size !== e.offers.length || !e.offers.every(o => text(o.id) && ids.includes(o.fromId) && ids.includes(o.toId) && o.fromId !== o.toId && integer(o.giveCash) && integer(o.requestCash) && ['open', 'accepted', 'rejected', 'cancelled'].includes(o.status) && (!o.givePropertyId || properties.some(p => p.id === o.givePropertyId)) && (!o.requestPropertyId || properties.some(p => p.id === o.requestPropertyId)))) return false;
    return true;
  } catch { return false; }
}
