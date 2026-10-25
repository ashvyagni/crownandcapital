import { useEffect, useRef, useState } from 'react'
import { Character } from './Character'

type LandingProps = { onPlay: () => void; onAuth: () => void; onRoom: () => void; onOnline?: () => void }

function useReveal() {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const nodes = root.current.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: .08, rootMargin: '0px 0px 30px 0px' })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])
  return root
}

function CityWorld() {
  return <svg className="city-world" viewBox="0 0 800 720" role="img" aria-label="Hand-drawn financial city on a round island with a winding river, rail route, harbor, towers and neighborhoods">
    <defs>
      <pattern id="world-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 0V9" stroke="#194943" strokeOpacity=".19" strokeWidth="1" /></pattern>
      <pattern id="world-water" width="34" height="28" patternUnits="userSpaceOnUse"><path d="M2 16q8-5 16 0t16 0" fill="none" stroke="#def0da" strokeOpacity=".4" strokeWidth="2" /></pattern>
      <clipPath id="world-clip"><ellipse cx="404" cy="376" rx="333" ry="286" /></clipPath>
    </defs>
    <ellipse cx="408" cy="404" rx="335" ry="287" fill="#071f27" opacity=".35" />
    <ellipse cx="404" cy="376" rx="333" ry="286" fill="#d9d8b7" stroke="#0c3036" strokeWidth="8" />
    <g clipPath="url(#world-clip)">
      <path d="M-10 230Q156 95 352 175t450-21V0H0ZM-10 630q192-122 409-35t430-32v180H0Z" fill="#6b9d90" />
      <path d="M-10 230Q156 95 352 175t450-21V0H0ZM-10 630q192-122 409-35t430-32v180H0Z" fill="url(#world-water)" />
      <path d="M68 388q107-73 193-37t145 18q112-37 161-4t192-46" fill="none" stroke="#0d343d" strokeWidth="76" />
      <path d="M68 388q107-73 193-37t145 18q112-37 161-4t192-46" fill="none" stroke="#82aea0" strokeWidth="69" />
      <path d="M68 388q107-73 193-37t145 18q112-37 161-4t192-46" fill="none" stroke="url(#world-water)" strokeWidth="57" />
      <path d="M83 254q145 16 197-52m-156 256q80 42 130 126m79-446q122 38 154 151m49 150q67 48 159 36" fill="none" stroke="#0c3036" strokeWidth="17" />
      <path d="M83 254q145 16 197-52m-156 256q80 42 130 126m79-446q122 38 154 151m49 150q67 48 159 36" fill="none" stroke="#f1e7ca" strokeWidth="12" strokeDasharray="22 3" />
      <path d="M78 481q147-55 209 0t146 46q134-13 283-127" fill="none" stroke="#143b3e" strokeWidth="11" />
      <path className="world-route" d="M78 481q147-55 209 0t146 46q134-13 283-127" fill="none" stroke="#c37c52" strokeWidth="5" strokeDasharray="15 14" />
      <path d="M330 196 581 470M276 290l276 192" stroke="#143b3e" strokeWidth="27" />
      <path d="M330 196 581 470M276 290l276 192" stroke="#efe5c8" strokeWidth="19" />
      <path d="M330 196 581 470M276 290l276 192" stroke="#b7825c" strokeWidth="2" strokeDasharray="7 9" />
      <g stroke="#153a3d" strokeLinejoin="round" strokeWidth="3">
        <path d="m166 257 62-21 58 23-60 23Z" fill="#f4e6c7"/><path d="m166 257 1-76 61-22v77Z" fill="#eee0c0"/><path d="m228 159 58 29v71l-58-23Z" fill="#97aea0"/><path d="m167 181 60-42 60 49-59-29Z" fill="#113940"/>
        <path d="m344 284 58-19 61 31-59 21Z" fill="#f2dfb7"/><path d="m344 284-1-154 59-19v154Z" fill="#f4e8d0"/><path d="m402 111 61 34v151l-61-31Z" fill="#a6b8a9"/><path d="m337 132 65-42 67 55-67-34Z" fill="#174247"/>
        <path d="m500 278 54-20 48 26-53 20Z" fill="#f1dfc1"/><path d="m500 278v-105l54-19v104Z" fill="#ecd8b2"/><path d="m554 154 48 27v103l-48-26Z" fill="#9db3a2"/><path d="m496 174 58-39 52 46-52-27Z" fill="#173a40"/>
        <path d="m186 507 53-16 53 27-53 18Z" fill="#f1e3cb"/><path d="m186 507v-81l53-17v82Z" fill="#f0e5ce"/><path d="m239 409 53 27v82l-53-27Z" fill="#a9baae"/><path d="m180 428 59-36 61 45-61-28Z" fill="#174047"/>
        <path d="m425 538 53-16 51 25-52 17Z" fill="#f2e2c4"/><path d="m425 538v-87l53-16v87Z" fill="#f2e5cf"/><path d="m478 435 51 26v86l-51-25Z" fill="#a5b7a8"/><path d="m420 453 58-37 57 46-57-27Z" fill="#183c42"/>
      </g>
      <g stroke="#486961" strokeWidth="2" fill="none"><path d="m177 196 40-13m-40 26 40-13m-40 26 40-13m-40 26 40-13m139-90 35-11m-35 25 35-11m-35 25 35-11m-35 25 35-11m-35 25 35-11m-35 25 35-11m156-64 33-12m-33 28 33-12m-33 28 33-12m-316 202 30-9m-30 24 30-9m-30 24 30-9m198-27 32-10m-32 25 32-10m-32 25 32-10" /></g>
      <g fill="#12383e" stroke="#12383e" strokeWidth="3"><path d="m113 320 10-38 11 38Zm22 3 12-42 11 42Zm464 174 12-43 12 43Zm26-5 9-38 12 38Z" /><path d="M124 319v19m23-16v18m464 154v20m23-21v20" /></g>
      <path d="M40 588q197 154 407 38t310-26" fill="none" stroke="url(#world-hatch)" strokeWidth="25" />
    </g>
    <ellipse cx="404" cy="376" rx="333" ry="286" fill="none" stroke="#e6e0c6" strokeWidth="3" strokeDasharray="3 9" />
    <g className="world-rail" transform="translate(272 483) rotate(20)"><rect x="-23" y="-13" width="68" height="26" rx="5" fill="#e6d6ae" stroke="#143b3e" strokeWidth="3"/><path d="M-13-8v16M0-8v16M13-8v16M26-8v16" stroke="#143b3e" strokeWidth="3"/></g>
    <g fill="#f1e5c7" stroke="#133940" strokeWidth="3"><circle cx="414" cy="368" r="13"/><circle cx="253" cy="481" r="9"/><circle cx="613" cy="479" r="9"/></g>
    <path d="m414 359 7 9-7 9-7-9Z" fill="#b57351" />
  </svg>
}

export function Landing({ onPlay, onAuth, onRoom, onOnline }: LandingProps) {
  const root = useReveal()
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const update = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return <main ref={root} className={`landing-page${hidden ? ' is-paused' : ''}`} id="top">
    <header className="site-nav"><a className="brand-lockup" href="#top" aria-label="Crown and Capital, back to top"><span className="brand-mark">C<span>✦</span></span><span>CROWN <i>&</i> CAPITAL</span></a><nav aria-label="Primary navigation"><a href="#city">The city</a><a href="#crew">The cast</a><a href="#rules">The rules</a></nav><div className="nav-actions"><button className="quiet-button" onClick={onAuth}>Local profile</button><button className="outline-button small" onClick={onRoom}>Set a table <span aria-hidden="true">↗</span></button></div></header>
    <section className="hero-scene" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">AN ATLAS OF AMBITION <span aria-hidden="true"> / EST. TONIGHT</span></p><h1 id="hero-title">CROWN<br /><span className="title-amp">&</span> CAPITAL<span className="title-period">.</span></h1><p className="hero-kicker">Every street has a story.<br />Every story has a price.</p><p className="hero-lede">A living city of deeds, deals and districts. Take a seat, follow the rail, and find out who owns tomorrow.</p><div className="hero-actions"><button className="primary-button hero-cta" onClick={onPlay}>Enter the city <span aria-hidden="true">↗</span></button>{onOnline && <button className="outline-button" onClick={onOnline}>Online table <span aria-hidden="true">↗</span></button>}</div><p className="hero-footnote">02–20 PLAYERS <b>◇</b> LOCAL TABLE OR ONLINE <b>◇</b> NO TWO ROUTES ALIKE</p></div><div className="hero-art"><div className="hero-orbit orbit-one" aria-hidden="true"/><div className="hero-orbit orbit-two" aria-hidden="true"/><CityWorld /><div className="world-label world-label-north">NORTH EXCHANGE <span>↗</span></div><div className="world-label world-label-south">SOUTH QUAY / 04</div><div className="world-banknote" aria-hidden="true"><span>THE CITY BANK</span><strong>₡ 100</strong><i>✦</i></div><div className="world-stamp" aria-hidden="true">A CITY<br />IN MOTION<br /><span>✦ 001</span></div><span className="art-caption">FIG. 01 — THE CITY & ITS POSSIBILITIES</span></div></section>
    <div className="landing-ticker" aria-hidden="true"><span>THE EXCHANGE IS OPEN</span><span>◆</span><span>FORTUNE FAVORS THE BOLD</span><span>◆</span><span>THE EXCHANGE IS OPEN</span></div>
    <section className="city-section" id="city" data-reveal><div className="section-intro"><p className="eyebrow">01 / YOUR CITY, YOUR LEDGER</p><h2>FOLLOW THE<br /><em>FLOW OF FORTUNE.</em></h2><p>A route through waterfronts, towers and storied blocks. The board gives you a destination; what you do when you arrive is up to you.</p></div><div className="city-route"><div className="route-line" aria-hidden="true"><span>◉</span><span>◇</span><span>✦</span></div><article><small>STATION 01 / THE ROUTE</small><h3>Find your way in.</h3><p>Roll two dice and travel the city. Each stop opens a new possibility.</p></article><article><small>STATION 02 / THE DEED</small><h3>Put down roots.</h3><p>Buy an available property, collect rent and assemble a district of your own.</p></article><article><small>STATION 03 / THE DISTRICT</small><h3>Raise the skyline.</h3><p>Develop a complete district, but keep enough in reserve for the road ahead.</p></article></div></section>
    <section className="crew-section" id="crew" data-reveal><div><p className="eyebrow">02 / THE PEOPLE BEHIND THE DEEDS</p><h2>THE CITY<br />HAS <em>FACES.</em></h2><p>Architects, brokers and rail barons all have a stake in the skyline. Choose your company and let the negotiations begin.</p><button className="outline-button" onClick={onRoom}>Set a custom table <span aria-hidden="true">↗</span></button></div><div className="crew-lineup" aria-label="Illustrated city traders"><Character index={3}/><Character index={4}/><Character index={5}/></div></section>
    <section className="rules-section" id="rules" data-reveal><div className="rules-heading"><p className="eyebrow">03 / THE FIELD GUIDE</p><h2>THE RULES OF<br /><em>THE ROAD.</em></h2></div><ol><li><strong>Roll & travel</strong><span>Take turns rolling two dice and move your token along the route.</span></li><li><strong>Make the call</strong><span>Buy an open deed or pass. Pay rent when you visit another player's property.</span></li><li><strong>Build your district</strong><span>Complete a set to develop it. Mortgage eligible deeds when cash runs low.</span></li><li><strong>Outlast the table</strong><span>Watch your balance through every turn. The last solvent player takes the city.</span></li></ol><div className="rules-end"><span>YOUR NEXT MOVE STARTS HERE. <small>◆ CITY BANK / OPEN DAILY</small></span><button className="primary-button" onClick={onPlay}>Enter the city <span aria-hidden="true">↗</span></button></div></section>
    <footer className="site-footer"><a href="#top">CROWN & CAPITAL ↑</a><span>AN ORIGINAL CITY TRADING GAME</span><button onClick={onAuth}>Your local profile ↗</button></footer>
  </main>
}
