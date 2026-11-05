const KEY = 'cc-onboarding-v1'
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(store?: Store): Store {
  if (store) return store
  return window.localStorage
}

/** A dismissed first run stamps the marker; an unset or unreadable marker offers onboarding again. */
export function hasOnboardingDismissed(store?: Store): boolean {
  try { return !!storage(store).getItem(KEY) } catch { return false }
}

/** First-run marker: the dismissal timestamp, best-effort like the presentation preferences write. */
export function markOnboardingDismissed(store?: Store): void {
  try { storage(store).setItem(KEY, String(Date.now())) } catch { /* Marker is optional; gameplay stays usable without it. */ }
}
