import type { DiceRoll } from './index'
import type { GameSession, SessionEntry } from './session'

export type CityRole = 'dealer' | 'banker' | 'inspector' | 'auctioneer' | 'broker' | 'foreman'
export type CityExpression = 'welcoming' | 'pleased' | 'serious'
export type PresentationEvent =
  | { type: 'roll'; id: string; playerId: string; dice: DiceRoll }
  | { type: 'receipt'; id: string; receipt: SessionEntry }
  | { type: 'auction'; id: string; propertyId: string }
  | { type: 'offer'; id: string; fromId: string; toId: string }
export type CityDialogue = { id: string; role: CityRole; expression: CityExpression; text: string }

/** Only adjacent accepted revisions are animated. Hydration, refresh and catch-up
 * snapshots show canonical state immediately, never re-enacting old effects. */
export function presentationEvents(previous: GameSession, next: GameSession): PresentationEvent[] {
  if (next.revision !== previous.revision + 1) return []
  const known = new Set(previous.receipts.map(receipt => receipt.id))
  const events: PresentationEvent[] = next.receipts.filter(receipt => !known.has(receipt.id)).map(receipt =>
    receipt.kind === 'roll' && next.lastRoll && receipt.from
      ? { type: 'roll', id: receipt.id, playerId: receipt.from, dice: next.lastRoll }
      : { type: 'receipt', id: receipt.id, receipt })
  const auction = next.economy.auction
  if (auction && !previous.economy.auction) events.push({ type: 'auction', id: `auction-${next.revision}`, propertyId: auction.propertyId })
  const offers = new Set(previous.economy.offers.map(offer => offer.id))
  for (const offer of next.economy.offers) if (!offers.has(offer.id)) events.push({ type: 'offer', id: offer.id, fromId: offer.fromId, toId: offer.toId })
  return events
}

const money = (amount: number) => `CR ${amount.toLocaleString('en-US')}`
export function dialogueFor(events: PresentationEvent[], session: GameSession): CityDialogue | null {
  // A transaction takes precedence over the roll that caused it.
  const event = [...events].reverse().find(event => event.type !== 'roll') ?? events.at(-1)
  if (!event) return null
  if (event.type === 'auction') return { id: event.id, role: 'auctioneer', expression: 'welcoming', text: `The floor is open for ${session.game.spaces.find(space => space.id === event.propertyId)?.name ?? 'this deed'}. Bids are reserved until settlement.` }
  if (event.type === 'offer') return { id: event.id, role: 'broker', expression: 'welcoming', text: `${session.game.players[event.fromId].name} has sent terms to ${session.game.players[event.toId].name}. Nothing changes hands until acceptance.` }
  if (event.type === 'roll') return { id: event.id, role: 'dealer', expression: 'welcoming', text: `${session.game.players[event.playerId].name}: ${event.dice.first} and ${event.dice.second}. ${event.dice.total} stops, confirmed.` }
  const receipt = event.receipt
  const name = (id?: string) => id ? session.game.players[id]?.name ?? 'the table' : 'the city treasury'
  const base = { id: event.id, expression: 'pleased' as CityExpression }
  switch (receipt.kind) {
    case 'rent': return { ...base, role: 'banker', expression: 'serious', text: `${name(receipt.from)} paid ${money(receipt.amount)} to ${name(receipt.to)}. The rent is already recorded.` }
    case 'purchase': return { ...base, role: 'dealer', text: `${receipt.note} is now held by ${name(receipt.from)}. ${money(receipt.amount)} paid; title recorded.` }
    case 'loan': return { ...base, role: 'banker', expression: 'serious', text: `${name(receipt.to)} received ${money(receipt.amount)}. ${receipt.note}. The collateral stays pledged until repayment.` }
    case 'repayment': return { ...base, role: 'banker', text: `${name(receipt.from)} repaid ${money(receipt.amount)} against ${receipt.note}. Your loan balance is updated.` }
    case 'bankruptcy': return { ...base, role: 'inspector', expression: 'serious', text: `${name(receipt.from)} is insolvent. The engine has recorded the debt and reassigned the deeds.` }
    case 'auction': return { ...base, role: 'auctioneer', text: `Sold: ${receipt.note}, to ${name(receipt.from)} for ${money(receipt.amount)}. Ownership has transferred.` }
    case 'trade': return { ...base, role: 'broker', text: `${name(receipt.from)} and ${name(receipt.to)} settled ${receipt.note}. Both sides transferred together.` }
    case 'production': return { ...base, role: 'foreman', text: `${name(receipt.from)} produced ${receipt.amount} goods. Materials and energy have been consumed.` }
    case 'factory': case 'materials': case 'energy': case 'goods': case 'upgrade': return { ...base, role: 'foreman', text: `${receipt.kind}: ${receipt.note}. ${money(receipt.amount)} recorded for ${name(receipt.from ?? receipt.to)}.` }
    case 'development': return { ...base, role: 'foreman', text: `${receipt.note} has a new building. ${money(receipt.amount)} paid; its rent is updated.` }
    case 'refund': case 'salary': return { ...base, role: 'banker', text: `${name(receipt.to)} received ${money(receipt.amount)}: ${receipt.note}. Already credited to the ledger.` }
    default: return { ...base, role: 'banker', text: `${receipt.kind}: ${receipt.note}. ${money(receipt.amount)} is recorded in the ledger.` }
  }
}

export const DICE_PRESENTATION_MS = 700
export const movementDuration = (total: number) => Math.min(1100, total * 105)
