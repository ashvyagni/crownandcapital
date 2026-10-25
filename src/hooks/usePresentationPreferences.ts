import { useEffect, useState } from 'react'

const KEY = 'crown-and-capital:presentation:v1'
type Preferences = { follow: boolean; fast: boolean; dialogue: boolean; speech: boolean }
const defaults: Preferences = { follow: true, fast: false, dialogue: true, speech: false }
function load(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof value?.[key] === 'boolean' ? value[key] : fallback])) as Preferences
  } catch { return defaults }
}
export function usePresentationPreferences() {
  const [preferences, setPreferences] = useState(load)
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReducedMotion(media.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(preferences)) } catch { /* Preferences are optional; gameplay remains usable. */ } }, [preferences])
  const setPreference = (key: keyof Preferences, value: boolean) => setPreferences(previous => ({ ...previous, [key]: value }))
  return { ...preferences, reducedMotion, setPreference }
}
