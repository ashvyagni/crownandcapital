import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome?: 'accepted' | 'dismissed' }>
}

// The browser fires beforeinstallprompt only when the app is installable; the
// event is cancelled and stored here so the minimal in-app button can trigger it.
export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])
  const install = useCallback(async () => {
    const event = installEvent
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    if (choice?.outcome === 'accepted') setInstallEvent(null)
  }, [installEvent])
  return { canInstall: installEvent !== null, install }
}
