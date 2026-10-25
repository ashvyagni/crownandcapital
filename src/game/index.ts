/** CROWN & CAPITAL: dependency-free, deterministic rules foundation. */

export const DISTRICT_COUNT = 18;
export const SPACES_PER_DISTRICT = 8;
export const BOARD_SIZE = 144;
export const STARTING_CASH = 1500;
export const START_SALARY = 200;

export type SpaceKind = 'property' | 'special';
export type SpecialKind = 'start' | 'treasury' | 'festival' | 'audit' | 'rest' | 'tax';
export type PlayerStatus = 'active' | 'bankrupt';
export type LedgerKind = 'salary' | 'purchase' | 'rent' | 'development' | 'mortgage' | 'unmortgage' | 'sale' | 'tax' | 'refund' | 'bankruptcy';

export interface District { id: string; name: string; index: number; group: string; color: string; }
export interface Property { id: string; space: number; districtId: string; name: string; price: number; mortgage: number; baseRent: number; developmentCost: number; maxDevelopment: number; development: number; ownerId?: string; mortgaged: boolean; }
export interface SpecialSpace { id: string; space: number; specialKind: SpecialKind; name: string; amount?: number; }
export type Space = (Property & { kind: 'property' }) | (SpecialSpace & { kind: 'special' });
export interface Player { id: string; name: string; character?: number; position: number; cash: number; status: PlayerStatus; properties: string[]; turns: number; }
export interface LedgerEntry { id: string; turn: number; kind: LedgerKind; from?: string; to?: string; amount: number; note: string; }
export interface GameState { seed: number; turn: number; activePlayer: number; players: Record<string, Player>; spaces: Space[]; districts: District[]; ledger: LedgerEntry[]; lastCommandIds: string[]; diceState: number; }
export interface DiceRoll { first: number; second: number; total: number; state: number; }

const DISTRICT_NAMES = ['Crown Heights', 'Ember Quay', 'Larkspur Ward', 'Old Foundry', 'Moonmarket', 'Greenrise', 'Saltmere', 'Gilded Mile', 'Ironbank', 'Rookery', 'Sunken Gardens', 'Northwatch', 'Velvet Row', 'Copperfield', 'Glassworks', 'Harbor Crown', 'Windswept', 'The Commons'];
const COLORS = ['#b45309', '#be123c', '#7c3aed', '#1d4ed8', '#047857', '#0f766e'];
const PROPERTY_SLOTS = new Set([1, 2, 3, 5, 6]); // five deeds per district, 90 in total

export function makeDistricts(): District[] { return DISTRICT_NAMES.map((name, index) => ({ id: `district-${index + 1}`, name, index, group: `group-${index % 6}`, color: COLORS[index % COLORS.length] })); }

export function makeBoard(): { districts: District[]; spaces: Space[] } {
  const districts = makeDistricts(); const spaces: Space[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const districtIndex = Math.floor(i / SPACES_PER_DISTRICT); const slot = i % SPACES_PER_DISTRICT; const district = districts[districtIndex];
    if (PROPERTY_SLOTS.has(slot)) {
      const tier = districtIndex + 1; const price = 100 + tier * 20 + slot * 10;
      spaces.push({ kind: 'property', id: `property-${i + 1}`, space: i, districtId: district.id, name: `${district.name} ${['Arcade', 'Terrace', 'Exchange', 'Hall', 'Gardens', 'Works'][slot === 1 ? 0 : slot === 2 ? 1 : slot === 3 ? 2 : slot === 5 ? 3 : 4]}`, price, mortgage: Math.floor(price / 2), baseRent: 12 + tier * 3 + slot * 2, developmentCost: 50 + tier * 10, maxDevelopment: 4, development: 0, mortgaged: false });
    } else {
      const specialKind: SpecialKind = i === 0 ? 'start' : slot === 0 ? 'rest' : slot === 4 ? 'treasury' : 'festival';
      spaces.push({ kind: 'special', id: `special-${i + 1}`, space: i, name: specialKind === 'start' ? 'Civic Gate' : `${district.name} ${specialKind === 'rest' ? 'Gate' : specialKind[0].toUpperCase() + specialKind.slice(1)}`, specialKind, amount: specialKind === 'treasury' ? 50 : undefined });
    }
  } return { districts, spaces };
}

export function createGame(seed = 1, names = ['Avery', 'Briar'], characters: number[] = []): GameState {
  const error = validateRoster(names);
  if (error) throw new Error(error);
  const board = makeBoard(); const players: Record<string, Player> = {}; names.forEach((name, i) => { const id = `player-${i + 1}`; players[id] = { id, name: name.trim(), character: characters[i] ?? i % 6, position: 0, cash: STARTING_CASH, status: 'active', properties: [], turns: 0 }; });
  return { seed: seed >>> 0, turn: 0, activePlayer: 0, players, ...board, ledger: [], lastCommandIds: [], diceState: seed >>> 0 };
}

export function validateRoster(names: string[]): string | null {
  if (names.length < 2 || names.length > 20) return 'A table needs 2 to 20 players.';
  if (names.some(name => !name.trim() || name.trim().length > 30)) return 'Names must be 1 to 30 characters.';
  if (new Set(names.map(name => name.trim().toLocaleLowerCase())).size !== names.length) return 'Each player needs a unique name.';
  return null;
}

export function addPlayer(state: GameState, name: string): boolean {
  if (state.turn || validateRoster([...Object.values(state.players).map(p => p.name), name])) return false;
  const id = `player-${Math.max(0, ...Object.keys(state.players).map(key => Number(key.slice(7)))) + 1}`;
  state.players[id] = { id, name: name.trim(), position: 0, cash: STARTING_CASH, status: 'active', properties: [], turns: 0 };
  return true;
}

export function removePlayer(state: GameState, playerId: string): boolean {
  if (state.turn || Object.keys(state.players).length <= 2 || !state.players[playerId]) return false;
  delete state.players[playerId];
  state.activePlayer = 0;
  return true;
}

/** Mulberry-style deterministic PRNG; state is explicit so replays are portable. */
export function rollDice(state: number): DiceRoll { let x = (state + 0x6d2b79f5) >>> 0; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); const next = (x ^ x >>> 14) >>> 0; const first = next % 6 + 1; const second = ((next * 1664525 + 1013904223) >>> 0) % 6 + 1; return { first, second, total: first + second, state: next }; }
export function ownershipGroup(state: GameState, property: Property): Property[] { return state.spaces.filter((s): s is Space & { kind: 'property' } => s.kind === 'property' && s.districtId === property.districtId); }
export function ownsGroup(state: GameState, playerId: string, property: Property): boolean { const group = ownershipGroup(state, property); return group.length > 0 && group.every(p => p.ownerId === playerId); }
export function rentFor(state: GameState, property: Property): number { if (property.mortgaged) return 0; const multiplier = property.development > 0 ? 1 + property.development : ownsGroup(state, property.ownerId || '', property) ? 2 : 1; return property.baseRent * multiplier; }
function entry(state: GameState, kind: LedgerKind, amount: number, note: string, from?: string, to?: string): void { state.ledger.push({ id: `tx-${state.ledger.length + 1}`, turn: state.turn, kind, amount, note, from, to }); }
function player(state: GameState, id: string): Player { const p = state.players[id]; if (!p) throw new Error(`Unknown player: ${id}`); return p; }
function charge(state: GameState, payer: Player, amount: number, receiver?: Player, kind: LedgerKind = 'rent'): void { payer.cash -= amount; if (receiver) receiver.cash += amount; entry(state, kind, amount, `Transfer of ${amount}`, payer.id, receiver?.id); }

export function purchase(state: GameState, playerId: string, propertyId: string, commandId = `purchase:${playerId}:${propertyId}`): boolean {
  if (state.lastCommandIds.includes(commandId)) return false;
  const p = player(state, playerId); const prop = state.spaces.find(s => s.id === propertyId);
  if (p.status !== 'active' || !prop || prop.kind !== 'property' || prop.ownerId || p.cash < prop.price) return false;
  state.lastCommandIds.push(commandId); p.cash -= prop.price; p.properties.push(prop.id); prop.ownerId = playerId;
  entry(state, 'purchase', prop.price, prop.name, playerId); return true;
}
export function develop(state: GameState, playerId: string, propertyId: string, commandId = `develop:${playerId}:${propertyId}`): boolean {
  if (state.lastCommandIds.includes(commandId)) return false;
  const prop = state.spaces.find(s => s.id === propertyId); const p = player(state, playerId);
  if (p.status !== 'active' || !prop || prop.kind !== 'property' || prop.ownerId !== playerId || prop.mortgaged || !ownsGroup(state, playerId, prop) || ownershipGroup(state, prop).some(s => s.mortgaged) || prop.development >= prop.maxDevelopment || p.cash < prop.developmentCost) return false;
  state.lastCommandIds.push(commandId); p.cash -= prop.developmentCost; prop.development++;
  entry(state, 'development', prop.developmentCost, prop.name, playerId); return true;
}
export function move(state: GameState, playerId: string, roll?: DiceRoll): DiceRoll { const p = player(state, playerId); if (p.status === 'bankrupt') throw new Error('Bankrupt players cannot move'); const result = roll || rollDice(state.diceState); state.diceState = result.state; const old = p.position; p.position = (old + result.total) % BOARD_SIZE; p.turns++; state.turn++; if (p.position < old) { p.cash += START_SALARY; entry(state, 'salary', START_SALARY, 'Passed Civic Gate', undefined, playerId); } return result; }
export function resolveLanding(state: GameState, playerId: string): void { const p = player(state, playerId); const space = state.spaces[p.position]; if (space.kind === 'special' && space.amount) { p.cash += space.amount; entry(state, 'refund', space.amount, space.name, undefined, playerId); } if (space.kind === 'property' && space.ownerId && space.ownerId !== playerId && !space.mortgaged) { const amount = rentFor(state, space); const owner = player(state, space.ownerId); charge(state, p, amount, owner); if (p.cash < 0) bankrupt(state, playerId, owner.id); } }
export function mortgage(state: GameState, playerId: string, propertyId: string): boolean { const p = player(state, playerId); const prop = state.spaces.find(s => s.id === propertyId); if (p.status !== 'active' || !prop || prop.kind !== 'property' || prop.ownerId !== playerId || prop.mortgaged || prop.development) return false; prop.mortgaged = true; p.cash += prop.mortgage; entry(state, 'mortgage', prop.mortgage, prop.name, undefined, playerId); return true; }
export function redemptionCost(property: Property): number { return Math.ceil(property.mortgage * 110 / 100); }
export function saleValue(property: Property): number { return Math.floor(property.price / 2) + Math.floor(property.development * property.developmentCost / 2) - (property.mortgaged ? property.mortgage : 0); }
export function unmortgage(state: GameState, playerId: string, propertyId: string): boolean { const p = player(state, playerId); const prop = state.spaces.find(s => s.id === propertyId); if (p.status !== 'active' || !prop || prop.kind !== 'property' || prop.ownerId !== playerId || !prop.mortgaged || p.cash < redemptionCost(prop)) return false; const cost = redemptionCost(prop); prop.mortgaged = false; p.cash -= cost; entry(state, 'unmortgage', cost, prop.name, playerId); return true; }
export function sellToBank(state: GameState, playerId: string, propertyId: string): boolean { const p = player(state, playerId); const prop = state.spaces.find(s => s.id === propertyId); if (p.status !== 'active' || !prop || prop.kind !== 'property' || prop.ownerId !== playerId || ownershipGroup(state, prop).some(s => s.development > 0 && s.id !== prop.id)) return false; const value = saleValue(prop); p.cash += value; p.properties = p.properties.filter(id => id !== prop.id); prop.ownerId = undefined; prop.development = 0; prop.mortgaged = false; entry(state, 'sale', value, prop.name, undefined, playerId); return true; }
export function sellBuilding(state: GameState, playerId: string, propertyId: string): boolean {
  const p = player(state, playerId); const prop = state.spaces.find(s => s.id === propertyId);
  if (p.status !== 'active' || !prop || prop.kind !== 'property' || prop.ownerId !== playerId || prop.development < 1) return false;
  prop.development--; const value = Math.floor(prop.developmentCost / 2); p.cash += value;
  entry(state, 'sale', value, `${prop.name} — one building`, undefined, playerId); return true;
}
export function bankrupt(state: GameState, playerId: string, creditorId?: string): void { const p = player(state, playerId); if (p.status === 'bankrupt') return; p.status = 'bankrupt'; for (const id of p.properties) { const prop = state.spaces.find(s => s.id === id); if (prop && prop.kind === 'property') { prop.ownerId = creditorId; if (creditorId) player(state, creditorId).properties.push(id); } } p.properties = []; entry(state, 'bankruptcy', Math.max(0, -p.cash), p.name, playerId, creditorId); }
export function nextPlayer(state: GameState): string { const ids = Object.keys(state.players); for (let i = 1; i <= ids.length; i++) { const index = (state.activePlayer + i) % ids.length; if (state.players[ids[index]].status === 'active') { state.activePlayer = index; return ids[index]; } } throw new Error('No active players remain'); }
