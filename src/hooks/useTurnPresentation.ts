import { useEffect, useRef, useState } from 'react'
import type { GameSession } from '../game/session'
import { DICE_PRESENTATION_MS, dialogueFor, movementDuration, presentationEvents, type CityDialogue } from '../game/presentation'

type Phase = 'ready' | 'rolling' | 'moving'
export function useTurnPresentation(session: GameSession, identity: string, instant: boolean) {
  const previous = useRef({ session, identity })
  const current = useRef(session)
  current.current = session
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [display, setDisplay] = useState({ game: session.game, revision: session.revision, identity, phase: 'ready' as Phase })
  const [dialogue, setDialogue] = useState<CityDialogue | null>(null)
  const [skippedRevision, setSkippedRevision] = useState(-1)
  const cancel = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  useEffect(() => {
    cancel()
    const before = previous.current
    previous.current = { session, identity }
    const events = before.identity === identity ? presentationEvents(before.session, session) : []
    if (before.identity !== identity) setDialogue(null)
    const line = dialogueFor(events, session)
    if (line) setDialogue(line)
    const roll = events.find(event => event.type === 'roll')
    const ready = () => setDisplay({ game: session.game, revision: session.revision, identity, phase: 'ready' })
    if (!roll || instant) { ready(); return cancel }
    setDisplay({ game: before.session.game, revision: session.revision, identity, phase: 'rolling' })
    timers.current.push(setTimeout(() => {
      setDisplay({ game: session.game, revision: session.revision, identity, phase: 'moving' })
      timers.current.push(setTimeout(ready, movementDuration(roll.dice.total) + 100))
    }, DICE_PRESENTATION_MS))
    return cancel
  }, [session.revision, identity, instant])

  const syncing = display.identity !== identity || display.revision !== session.revision
  const pendingRoll = syncing && previous.current.identity === identity && presentationEvents(previous.current.session, session).some(event => event.type === 'roll') && !instant
  const skip = () => {
    cancel()
    setSkippedRevision(current.current.revision)
    setDisplay({ game: current.current.game, revision: current.current.revision, identity, phase: 'ready' })
  }
  return {
    board: display.identity === identity ? display.game : session.game,
    phase: syncing ? pendingRoll ? 'syncing' : 'ready' : display.phase,
    presenting: syncing ? pendingRoll : display.phase !== 'ready',
    snapped: instant || skippedRevision === session.revision,
    dialogue, dismissDialogue: () => setDialogue(null), skip,
  }
}
