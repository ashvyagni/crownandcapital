import { useEffect, useRef, type ReactNode } from 'react'

export function DialogFrame({ title, children, close, locked = false, wide = false, focusHeading = false }: { title: string; children: ReactNode; close: () => void; locked?: boolean; wide?: boolean; focusHeading?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]') ?? [])
    const initial = focusHeading ? ref.current?.querySelector<HTMLElement>('h2') ?? null : (items()[0] ?? null)
    initial?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!locked) closeRef.current(); return }
      if (event.key !== 'Tab') return
      const controls = items(); if (!controls.length) return
      const index = controls.indexOf(document.activeElement as HTMLElement)
      if (index < 0 || (!event.shiftKey && index === controls.length - 1)) { event.preventDefault(); controls[0].focus() }
      else if (event.shiftKey && index === 0) { event.preventDefault(); controls.at(-1)?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus() }
  }, [locked, focusHeading])
  return <div className="modal-backdrop"><section ref={ref} className={`modal-card gameplay-dialog${wide ? ' dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    {!locked && <button className="modal-close" aria-label="Close" onClick={close}>×</button>}
    <p className="eyebrow">Crown & Capital / City exchange</p><h2 tabIndex={focusHeading ? -1 : undefined}>{title}</h2>{children}
  </section></div>
}
