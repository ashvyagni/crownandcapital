# Visual and motion QA

## Reference inspection — actual scope

The primary requested reference was `https://messenger.abeto.co/`. The built-in browser navigation timed out; a separate isolated read-only Playwright study captured desktop 1440×1000 and mobile 390×844 views plus scrolled views. The live application remained an incomplete white/teal diagonal scene in those captures, with no accessible application text or mounted canvas. Its published social artwork was viewable: a hand-illustrated world/globe, teal surroundings, irregular architectural forms and an oversized dimensional white title. The published loader stylesheet exposed a one-second, eight-frame sequence.

This does **not** establish the live reference's complete fonts, hover states, navigation, scroll transitions, easing, loading completion or interaction timing. No exhaustive-match claim is made. No reference logo, proprietary artwork, code or font was copied. The implementation adapts the inspectable world-first composition and palette into original financial-city SVG artwork and an independently authored motion system.

## Implemented visual system

- Original elliptical city-world with river, towers, rail route, banknote and etched linework.
- Fraunces financial/engraving-inspired headings with DM Sans body text; paper, ink-teal, sage and copper across the entire application.
- Explicit stylesheet cascade shared by home, HUD, map frame, deeds, banker, factories, auctions, negotiations and online lobby.
- Slow city drift (~24 s), route/atlas flow (~25–27 s), banknote drift (~21 s), slight character/dealer/banker breathing (~8–11 s), short button feedback and opaque dealing-card movement (~220 ms).
- Scroll reveal is progressive enhancement. Reduced-motion rules remove nonessential motion; hidden-page listeners pause background motion/audio.
- No meaningless particle field, reference asset import, copied gradient wallpaper or external soundtrack.

## Actual app screenshots inspected

- Desktop home at 1440×1000: original city-world, financial typography, spacious hierarchy, cast and field-guide sections.
- Closed board overview and 8× deed detail: connected perimeter, ownership inspection, names/prices at detail scale and searchable street directory.
- Centred dealer card: opaque paper, property vignette, bank/deed values, acquisition/pass/auction actions and transaction receipts.
- City Bank at desktop/mobile: banker, collateral explanation, principal/repayment, clear disabled state before owning a deed.
- Factory production: real inventory/capacity, supplies, production, sales, upgrade and dismantling controls inside a scrollable exchange.
- Online table: two distinct seats and one shared turn, with identity/connection status.
- Mobile 390×844: home composition, setup keyboard controls, bank/exchange scrolling, no horizontal page overflow, fixed roll control and reduced-motion fallback.

Screenshot inspection exposed the incorrect stylesheet order; a subsequent screenshot pass verified Fraunces and the intended shared palette. A second refinement removed card-opacity bleed-through. Repeatable captures are generated under ignored `test-results/` directories; filtered test runs replace those generated outputs.

## Remaining art boundaries

The city uses authored stylised vectors and procedural architectural marks, not a fully painted 144-location environment or frame-animated sprite pipeline. Whole-board text requires zoom/hover/directory reading. Cues are synthesized effects, not a music score. Font requests need network access, with system fallbacks. The reference's unrendered live interactions remain unverified rather than invented.
