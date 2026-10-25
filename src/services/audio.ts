export type AudioCue = 'roll' | 'purchase' | 'rent' | 'mortgage' | 'auction' | 'factory' | 'loan' | 'turn' | 'error'
export type AudioPreferences = { enabled: boolean; volume: number }
const KEY = 'crown-and-capital:audio:v1'
const tones: Record<AudioCue, number[]> = {
  roll: [310, 420, 520], purchase: [440, 550, 660], rent: [350, 275], mortgage: [280, 220],
  auction: [420, 520, 620], factory: [230, 345, 460], loan: [310, 390], turn: [480, 620], error: [190, 150],
}
export function loadAudioPreferences(): AudioPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioPreferences>
    return { enabled: value.enabled === true, volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : 0.35 }
  } catch { return { enabled: false, volume: 0.35 } }
}
export class GameAudio {
  private context: AudioContext | null = null
  private preferences = loadAudioPreferences()
  get settings(): AudioPreferences { return { ...this.preferences } }
  private persist() { try { localStorage.setItem(KEY, JSON.stringify(this.preferences)) } catch { /* Preference remains in memory. */ } }
  async setEnabled(enabled: boolean): Promise<void> {
    this.preferences.enabled = enabled
    this.persist()
    if (!enabled) { await this.context?.suspend(); return }
    try {
      this.context ??= new AudioContext()
      if (document.visibilityState === 'visible') await this.context.resume()
    } catch { this.preferences.enabled = false; this.persist() }
  }
  setVolume(volume: number): void { this.preferences.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0; this.persist() }
  unlock = async (): Promise<void> => { if (this.preferences.enabled) await this.setEnabled(true) }
  play(cue: AudioCue): void {
    const ctx = this.context
    if (!this.preferences.enabled || !ctx || ctx.state !== 'running' || document.visibilityState === 'hidden') return
    const now = ctx.currentTime
    tones[cue].forEach((frequency, index) => {
      const start = now + index * 0.085
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = cue === 'error' ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(this.preferences.volume * 0.075, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.2)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    })
  }
  visibility = (): void => { if (document.visibilityState === 'hidden') void this.context?.suspend(); else if (this.preferences.enabled) void this.context?.resume() }
  dispose(): void { void this.context?.close(); this.context = null }
}
