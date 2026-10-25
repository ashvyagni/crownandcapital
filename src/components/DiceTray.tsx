import { DICE_FACES, FACE_PIPS, FACE_ROTATIONS, confirmedDiceTotal, type DieFace } from './diceFaces'
import './dice-tray.css'

export type DiceTrayProps = {
  first: number
  second: number
  rolling: boolean
  reducedMotion?: boolean
}

function Die({ value, rolling, reducedMotion }: { value: DieFace; rolling: boolean; reducedMotion: boolean }) {
  const rotation = FACE_ROTATIONS[value]
  return (
    <div className="dice-tray__die" aria-hidden="true">
      <div className={`dice-tray__cube${rolling && !reducedMotion ? ' dice-tray__cube--rolling' : ''}`}
        style={{ '--dice-face-x': `${rotation.x}deg`, '--dice-face-y': `${rotation.y}deg` } as React.CSSProperties}>
        {DICE_FACES.map(face => (
          <div className={`dice-tray__face dice-tray__face--${face}`} key={face} data-current={face === value}>
            {FACE_PIPS[face].map(position => <span className={`dice-tray__pip dice-tray__pip--${position}`} key={position} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pure presentation: the parent owns both results and the rolling lifecycle. */
export function DiceTray({ first, second, rolling, reducedMotion = false }: DiceTrayProps) {
  const total = confirmedDiceTotal(first, second)
  return (
    <div className={`dice-tray${reducedMotion ? ' dice-tray--still' : ''}`} role="group" aria-label="Dice result">
      <div className="dice-tray__pair" aria-hidden="true">
        <Die value={first as DieFace} rolling={rolling} reducedMotion={reducedMotion} />
        <Die value={second as DieFace} rolling={rolling} reducedMotion={reducedMotion} />
      </div>
      <span className="dice-tray__result" aria-live="polite" aria-atomic="true">
        {rolling ? 'Rolling dice' : `Dice: ${first} and ${second}. Total: ${total}.`}
      </span>
    </div>
  )
}
