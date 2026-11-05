import { describe, expect, it } from 'vitest'
import { hasOnboardingDismissed, markOnboardingDismissed } from './onboarding'

function memory() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
describe('first-run onboarding marker', () => {
  it('offers onboarding until a dismissal marker is written', () => {
    const store = memory()
    expect(hasOnboardingDismissed(store)).toBe(false)
    markOnboardingDismissed(store)
    expect(hasOnboardingDismissed(store)).toBe(true)
  })
  it('stamps the dismissal timestamp and survives disabled storage', () => {
    const store = memory()
    const stamp = String(Date.now())
    markOnboardingDismissed(store)
    expect(store.getItem('cc-onboarding-v1')).toBe(stamp)
    expect(() => markOnboardingDismissed({ getItem: () => { throw new Error('disabled') }, setItem: () => {}, removeItem: () => {} })).not.toThrow()
  })
})
