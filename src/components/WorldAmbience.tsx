import { useEffect, useState } from 'react'

/** Decorative atlas contours: independent of the board and invisible to assistive tech. */
export function WorldAmbience() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return <div className={`world-ambience${visible ? '' : ' is-paused'}`} aria-hidden="true"><svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g className="ambience-contours" fill="none" stroke="currentColor"><path d="M-140 137Q178-22 354 138t364 72q143-71 255 41t333 6q215-108 378 83"/><path d="M-140 181Q178 22 354 182t364 72q143-71 255 41t333 6q215-108 378 83"/><path d="M-140 225Q178 66 354 226t364 72q143-71 255 41t333 6q215-108 378 83"/><path d="M-140 702q278-172 509-27t366-16q110-92 252-12t300-32q239-150 390-27"/><path d="M-140 745q278-172 509-27t366-16q110-92 252-12t300-32q239-150 390-27"/><path d="M-140 788q278-172 509-27t366-16q110-92 252-12t300-32q239-150 390-27"/></g><path className="ambience-river" d="M-125 459q286-133 473-23t307 70q191-61 319-10t294-60q207-117 407 25" fill="none" stroke="currentColor" strokeWidth="54"/><path className="ambience-route" d="M-125 459q286-133 473-23t307 70q191-61 319-10t294-60q207-117 407 25" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="12 24"/></svg></div>
}
