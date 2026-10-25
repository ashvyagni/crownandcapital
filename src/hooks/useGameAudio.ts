import { useEffect, useState } from 'react'
import { GameAudio, type AudioCue } from '../services/audio'

const sharedAudio = new GameAudio()
export function useGameAudio() {
  const [settings, setSettings] = useState(sharedAudio.settings)
  useEffect(() => {
    document.addEventListener('visibilitychange', sharedAudio.visibility)
    return () => document.removeEventListener('visibilitychange', sharedAudio.visibility)
  }, [])
  return {
    ...settings,
    setEnabled: async (enabled: boolean) => { await sharedAudio.setEnabled(enabled); setSettings(sharedAudio.settings) },
    setVolume: (volume: number) => { sharedAudio.setVolume(volume); setSettings(sharedAudio.settings) },
    play: (cue: AudioCue) => sharedAudio.play(cue),
    unlock: sharedAudio.unlock,
  }
}
