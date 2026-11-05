import { useState } from 'react'
import { DialogFrame } from './DialogFrame'

type OnboardingProps = { onDismiss: () => void; onPractice: () => void }

const TITLES: readonly string[] = ['Welcome to Crown & Capital', 'Read the table', 'Choose your table']
const LAST_STEP = TITLES.length - 1

/** First-run orientation: three textual steps before the player takes their first action at the table. */
export function Onboarding({ onDismiss, onPractice }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const next = () => setStep(current => (current < LAST_STEP ? current + 1 : current))
  return <DialogFrame title={TITLES[step]} close={onDismiss} focusHeading>
    {step === 0 && <>
      <p>You hold a seat at the trading table. This is a living game: every roll, trade and rent is recorded in the ledger as it happens.</p>
      <p className="modal-footnote">The city runs on deeds, districts and cash. The dice are yours whenever the turn comes around to your seat.</p>
      <div className="landing-choices"><button className="primary-button" onClick={next}>Next →</button></div>
    </>}
    {step === 1 && <>
      <p>The table reads in three columns: the seat roster and cash on the left, the 144-stop board in the middle, and your desk with the roll controls on the right.</p>
      <p className="modal-footnote">Text only for now — the board accepts clicks, and the inspector speaks for any stop you select.</p>
      <div className="landing-choices"><button className="primary-button" onClick={next}>Next →</button></div>
    </>}
    {step === 2 && <>
      <p>Two ways into the first game. Take a seat at a table that plays itself, or walk the city first and start from zero.</p>
      <button className="primary-button modal-submit" onClick={onPractice}>Practice vs 3 traders ↗</button>
      <button className="outline-button modal-submit" onClick={onDismiss}>Explore the city first</button>
    </>}
  </DialogFrame>
}
