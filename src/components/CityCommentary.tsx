import { useEffect } from 'react'
import { Character } from './Character'
import type { CityDialogue } from '../game/presentation'
import './presentation.css'

const titles = { dealer: 'The Dealer', banker: 'The Banker', inspector: 'The Inspector', auctioneer: 'The Auctioneer', broker: 'The Broker', foreman: 'The Foreman' }
export function CityCommentary({ line, speech, dismiss }: { line: CityDialogue; speech: boolean; dismiss: () => void }) {
  useEffect(() => {
    if (!speech || !('speechSynthesis' in window)) return
    // Opt-in only. Speech and its cancellation cannot send gameplay commands.
    const utterance = new SpeechSynthesisUtterance(line.text)
    speechSynthesis.speak(utterance)
    return () => speechSynthesis.cancel()
  }, [line.id, speech])
  return <section className="city-commentary" aria-label="City commentary">
    <div className="city-commentary__portrait"><Character role={line.role} expression={line.expression} /></div>
    <div><p className="eyebrow">{titles[line.role]}</p><p role="status">{line.text}</p></div>
    <button aria-label="Dismiss city commentary" onClick={dismiss}>×</button>
  </section>
}
