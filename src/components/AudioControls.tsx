import { useGameAudio } from '../hooks/useGameAudio'

export function AudioControls({ audio }: { audio?: ReturnType<typeof useGameAudio> }) {
  return audio ? <Controls controller={audio} /> : <OwnControls />
}
function OwnControls() { const controller = useGameAudio(); return <Controls controller={controller} /> }
function Controls({ controller }: { controller: ReturnType<typeof useGameAudio> }) {
  return <div className="audio-controls" aria-label="Game audio controls">
    <button type="button" aria-pressed={controller.enabled} onClick={() => void controller.setEnabled(!controller.enabled)}>
      Sound {controller.enabled ? 'on' : 'off'}
    </button>
    <label>Volume <input type="range" min="0" max="100" value={Math.round(controller.volume * 100)}
      onChange={event => controller.setVolume(Number(event.target.value) / 100)} disabled={!controller.enabled} /></label>
  </div>
}
export default AudioControls
