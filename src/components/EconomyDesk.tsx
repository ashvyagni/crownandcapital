import { useState } from 'react'
import { Character } from './Character'
import { AUCTION_INCREMENT, ENERGY_COST, FACTORY_COST, FACTORY_SALE_PRICE, FACTORY_UPGRADE_COST, MATERIAL_COST, type GameSession, type SessionCommand } from '../game/session'
import type { Property } from '../game'

export const cr = (amount: number) => `CR ${amount.toLocaleString('en-GB')}`
export type SendCommand = (command: SessionCommand, actorId?: string) => void
type Props = { session: GameSession; playerId: string; online: boolean; busy: boolean; send: SendCommand; initialTab?: string; defaultBidder?: string }

export function AuctionPanel({ session, playerId, online, busy, send, defaultBidder }: Props) {
  const auction = session.economy.auction
  // Practice tables pass the human seat so an auction on a bot's landing never
  // preselects the automated bidder holding the desk.
  const [bidder, setBidder] = useState(() => defaultBidder ?? playerId)
  const [amount, setAmount] = useState('')
  if (!auction) return <p>No auction is open. Land on a bank-owned deed and choose <strong>Open auction</strong> on its card.</p>
  const actor = online ? playerId : bidder
  const eligible = session.game.players[actor]?.status === 'active' && !auction.folded.includes(actor)
  const property = session.game.spaces.find(p => p.id === auction.propertyId)
  const minimum = auction.bid + AUCTION_INCREMENT
  return <section className="auction-table" aria-label="Live auction">
    <p className="eyebrow">The auctioneer's desk / live bids</p><h3>{property?.name}</h3>
    <div className="auction-price">{cr(auction.bid)}<small>{auction.leaderId ? `Leading: ${session.game.players[auction.leaderId].name}` : 'No bids yet'}</small></div>
    {!online && <label className="field-label">Bidding as<select value={bidder} onChange={e => setBidder(e.target.value)}>{Object.values(session.game.players).filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}{auction.folded.includes(p.id) ? ' · folded' : ''}</option>)}</select></label>}
    <p>{session.game.players[actor]?.name} · {cr(session.game.players[actor]?.cash ?? 0)} balance</p>
    <label className="field-label">Your bid<input type="number" min={minimum} step="1" value={amount} placeholder={String(minimum)} onChange={e => setAmount(e.target.value)} /></label>
    <div className="landing-choices"><button className="primary-button" disabled={busy || !eligible || auction.leaderId === actor} onClick={() => { send({ type: 'bid', amount: amount ? Number(amount) : minimum }, actor); setAmount('') }}>Place bid</button><button className="outline-button" disabled={busy || !eligible || auction.leaderId === actor} onClick={() => send({ type: 'fold' }, actor)}>Fold</button></div>
    <p className="modal-footnote">Minimum increment {cr(AUCTION_INCREMENT)}. Leading bids reserve cash. The deed settles when all other seats fold; everyone folding without a bid returns it to the bank.</p>
    <p>Folded: {auction.folded.map(id => session.game.players[id].name).join(', ') || 'Nobody yet'}</p>
  </section>
}

export function EconomyDesk(props: Props) {
  const { session, playerId, online, busy, send } = props
  const [tab, setTab] = useState(props.initialTab ?? 'Factories')
  const [selected, setSelected] = useState('')
  const [quantity, setQuantity] = useState('2')
  const [principal, setPrincipal] = useState('')
  const [repayment, setRepayment] = useState<Record<string, string>>({})
  const players = Object.values(session.game.players)
  const [recipient, setRecipient] = useState(players.find(p => p.id !== playerId)?.id ?? '')
  const [giveCash, setGiveCash] = useState('0')
  const [requestCash, setRequestCash] = useState('0')
  const [givePropertyId, setGiveProperty] = useState('')
  const [requestPropertyId, setRequestProperty] = useState('')
  const [dismantle, setDismantle] = useState<string | null>(null)
  const owned = session.game.spaces.filter((p): p is Property & { kind: 'property' } => p.kind === 'property' && p.ownerId === playerId)
  const deed = owned.find(p => p.id === selected) ?? owned[0]
  const current = players[session.game.activePlayer].id === playerId
  const locked = busy || !current || !!session.economy.auction
  const held = (id: string) => session.economy.loans.some(l => l.propertyId === id)
  const transferable = (p: Property) => !p.mortgaged && !p.development && !held(p.id) && !session.economy.factories.some(f => f.propertyId === p.id)
  return <div className="economy-desk">
    <div className="economy-tabs" role="tablist" aria-label="Exchange departments">{['Factories', 'Bank', 'Auctions', 'Deals'].map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
    <p className="economy-balance">{session.game.players[playerId]?.name} <strong>{cr(session.game.players[playerId]?.cash ?? 0)}</strong></p>
    {!current && <p className="modal-footnote">Financing and production are available on your turn. You can still bid at auction or respond to an offer addressed to you.</p>}
    {(tab === 'Factories' || tab === 'Bank') && <label className="field-label">Owned deed<select value={deed?.id ?? ''} onChange={e => setSelected(e.target.value)}>{!owned.length && <option value="">Acquire a deed first</option>}{owned.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {tab === 'Factories' && <section className="economy-card">
      <div className="economy-illustration" aria-hidden="true">▥ <span>THE WORKS / INDUSTRIAL LEDGER</span></div>
      <p>Build on a vacant, unencumbered deed. Each production cycle uses <b>2 materials + 1 energy per good</b>, once per owner turn, up to the factory's level.</p>
      <button className="primary-button" disabled={locked || !deed || !transferable(deed)} onClick={() => send({ type: 'buildFactory', propertyId: deed?.id })}>Build factory · {cr(FACTORY_COST)}</button>
      {session.economy.factories.filter(f => f.ownerId === playerId).map(f => <article className="factory-card" key={f.propertyId}>
        <h3>{session.game.spaces.find(p => p.id === f.propertyId)?.name}</h3><p>Level {f.level} / 3 · Capacity {f.level} goods per turn</p>
        <dl className="economy-inventory"><div><dt>Materials</dt><dd>{f.materials}</dd></div><div><dt>Energy</dt><dd>{f.energy}</dd></div><div><dt>Goods</dt><dd>{f.goods}</dd></div></dl>
        <label className="field-label">Supply quantity<input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <div className="economy-actions">
          <button disabled={locked} onClick={() => send({ type: 'buyMaterials', propertyId: f.propertyId, quantity: Number(quantity) })}>Buy materials · {cr(MATERIAL_COST)} each</button>
          <button disabled={locked} onClick={() => send({ type: 'buyEnergy', propertyId: f.propertyId, quantity: Number(quantity) })}>Buy energy · {cr(ENERGY_COST)} each</button>
          <button disabled={locked || f.materials < 2 || f.energy < 1 || f.producedTurn === session.game.turn + (session.pendingId ? 0 : 1)} onClick={() => send({ type: 'produce', propertyId: f.propertyId })}>Run production</button>
          <button disabled={locked || !f.goods} onClick={() => send({ type: 'sellGoods', propertyId: f.propertyId, quantity: f.goods })}>Sell all goods · {cr(f.goods * FACTORY_SALE_PRICE)}</button>
          <button disabled={locked || f.level >= 3} onClick={() => send({ type: 'upgradeFactory', propertyId: f.propertyId })}>Upgrade · {cr(FACTORY_UPGRADE_COST)}</button>
        </div>
        <button className="text-button" disabled={locked || held(f.propertyId)} onClick={() => setDismantle(f.propertyId)}>Dismantle factory</button>
        {dismantle === f.propertyId && <div className="sale-confirm"><p>Recover {cr(Math.floor((FACTORY_COST + (f.level - 1) * FACTORY_UPGRADE_COST) / 2))}. All inventory will be discarded.</p><button onClick={() => { send({ type: 'dismantleFactory', propertyId: f.propertyId }); setDismantle(null) }}>Confirm dismantle</button><button onClick={() => setDismantle(null)}>Keep factory</button></div>}
      </article>)}
    </section>}
    {tab === 'Bank' && <section className="economy-card bank-desk">
      <Character banker className="banker-portrait" /><p className="eyebrow">City bank / secured lending</p>
      <p>Borrow up to half a vacant deed's price. A fixed <b>10% fee</b> is added once. Collateral stays locked against mortgage, development, sale and transfer until repaid.</p>
      <label className="field-label">Loan principal<input type="number" min="1" max={deed ? Math.floor(deed.price / 2) : 0} value={principal} onChange={e => setPrincipal(e.target.value)} placeholder={deed ? `Maximum ${Math.floor(deed.price / 2)}` : 'Choose a deed'} /></label>
      <p>Total due: {cr(Number(principal) > 0 ? Number(principal) + Math.ceil(Number(principal) / 10) : 0)}</p>
      <button className="primary-button" disabled={locked || !deed || deed.mortgaged || deed.development > 0 || held(deed.id) || !principal} onClick={() => send({ type: 'requestLoan', propertyId: deed?.id, amount: Number(principal) })}>Take secured loan</button>
      {session.economy.loans.filter(l => l.borrowerId === playerId).map(loan => <article className="loan-card" key={loan.id}><h3>{session.game.spaces.find(p => p.id === loan.propertyId)?.name}</h3><p>{loan.id} · principal {cr(loan.principal)} · outstanding <strong>{cr(loan.remaining)}</strong></p><label className="field-label">Repayment for {loan.id}<input type="number" min="1" max={loan.remaining} value={repayment[loan.id] ?? String(loan.remaining)} onChange={e => setRepayment(values => ({ ...values, [loan.id]: e.target.value }))} /></label><button className="outline-button" disabled={locked} onClick={() => send({ type: 'repayLoan', loanId: loan.id, amount: Number(repayment[loan.id] ?? loan.remaining) })}>Repay loan</button></article>)}
      {!session.economy.loans.some(l => l.borrowerId === playerId) && <p className="modal-footnote">No outstanding loans. No timer or recurring interest is hidden in this contract.</p>}
    </section>}
    {tab === 'Auctions' && <AuctionPanel {...props} />}
    {tab === 'Deals' && <section className="economy-card">
      <p className="eyebrow">Negotiations / two signatures</p><p>Offer cash or a vacant deed in return for cash or a deed. Nothing moves until the recipient accepts. Both sides are checked again at settlement.</p>
      <label className="field-label">Trade with<select value={recipient} onChange={e => { setRecipient(e.target.value); setRequestProperty('') }}>{players.filter(p => p.id !== playerId && p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="deal-columns"><div><h3>You give</h3><label className="field-label">Cash offered<input type="number" min="0" value={giveCash} onChange={e => setGiveCash(e.target.value)} /></label><label className="field-label">Deed offered<select value={givePropertyId} onChange={e => setGiveProperty(e.target.value)}><option value="">No deed</option>{owned.filter(transferable).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><div><h3>You receive</h3><label className="field-label">Cash requested<input type="number" min="0" value={requestCash} onChange={e => setRequestCash(e.target.value)} /></label><label className="field-label">Deed requested<select value={requestPropertyId} onChange={e => setRequestProperty(e.target.value)}><option value="">No deed</option>{session.game.spaces.filter((p): p is Property & { kind: 'property' } => p.kind === 'property' && p.ownerId === recipient && transferable(p)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div></div>
      <button className="primary-button" disabled={locked} onClick={() => send({ type: 'proposeOffer', toId: recipient, giveCash: Number(giveCash), requestCash: Number(requestCash), givePropertyId: givePropertyId || undefined, requestPropertyId: requestPropertyId || undefined })}>Send offer</button>
      <div className="offers-list">{session.economy.offers.filter(o => !online || o.fromId === playerId || o.toId === playerId).slice().reverse().map(offer => <article key={offer.id} className="offer-card"><h3>{session.game.players[offer.fromId].name} → {session.game.players[offer.toId].name}</h3><p>{offer.id} / <strong>{offer.status}</strong></p><p>Gives {cr(offer.giveCash)}{offer.givePropertyId ? ` + ${session.game.spaces.find(p => p.id === offer.givePropertyId)?.name}` : ''}<br />Requests {cr(offer.requestCash)}{offer.requestPropertyId ? ` + ${session.game.spaces.find(p => p.id === offer.requestPropertyId)?.name}` : ''}</p>{offer.status === 'open' && <div className="economy-actions">{(!online || offer.toId === playerId) && <><button disabled={busy || !!session.economy.auction} onClick={() => send({ type: 'acceptOffer', offerId: offer.id }, offer.toId)}>Accept as {session.game.players[offer.toId].name}</button><button disabled={busy} onClick={() => send({ type: 'rejectOffer', offerId: offer.id }, offer.toId)}>Reject offer</button></>}{(!online || offer.fromId === playerId) && <button disabled={busy} onClick={() => send({ type: 'cancelOffer', offerId: offer.id }, offer.fromId)}>Cancel offer</button>}</div>}</article>)}</div>
    </section>}
  </div>
}
