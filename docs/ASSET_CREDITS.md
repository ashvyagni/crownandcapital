# Asset Credits and Licenses

## Source/license table

| Asset or category | Source | License | Runtime use | Verification |
|---|---|---|---|---|
| Six trader characters and moustached dealer | `src/components/Character.tsx` | Original project SVG artwork | Landing, roster, setup, profile and dealer cards | Authored as vectors for this implementation; not taken from INK Games |
| City-board hero and deed vignette | `src/components/Landing.tsx`, `DeedArtwork.tsx` | Original project SVG artwork | Landing and automatic cards | No external artwork downloaded |
| Board buildings, map and character pawns | `src/game/CityScene.ts` | Original project vector artwork | Canvas renderer | Authored with Phaser graphics |
| Barlow Condensed | Google Fonts / The Barlow Project Authors | SIL Open Font License 1.1 | Display typography, loaded via Google Fonts CSS | [License source](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt) |
| DM Sans | Google Fonts / The DM Sans Project Authors | SIL Open Font License 1.1 | Body typography, loaded via Google Fonts CSS | [License source](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt) |
| Fraunces | Google Fonts / The Fraunces Project Authors | SIL Open Font License 1.1 | Engraving-inspired headings across landing, HUD, deeds and exchange | [License source](https://github.com/google/fonts/blob/main/ofl/fraunces/OFL.txt), checked upstream |
| Audio cues | `src/services/audio.ts` | Original synthesized project work | Roll, acquisition, rent, bank, auction, production and turn feedback | No third-party samples, music or ZzFX dependency |
| Future commissioned or downloaded assets | Not selected | TBD | Not approved until recorded | Add owner, URL, license, and attribution before use |

Font licenses were checked against the upstream OFL files. No font binaries are vendored; blocked network access falls back to local system fonts. If fonts are bundled later, include their copyright notices and OFL texts.

## References, not imported assets

- Primary current reference: [Messenger by Abeto](https://messenger.abeto.co/). Live desktop/mobile browser attempts rendered an incomplete white/teal scene; public social artwork and loader were inspectable. The hand-illustrated world-first composition, teal/paper palette and dimensional-title concept informed original city-world SVGs. Exact live font, hover, easing and scroll behaviour were not verified or copied. See `docs/VISUAL_QA.md` for the limitation.

- [INK Games](https://inkgames.com/): public homepage structure informed the character-led hero, oversized display typography, world/crew/playbook sections and prominent play CTA. Its branding, imagery, code and reward programme were not copied. Browser inspection timed out; this is not a claim of an exhaustive page-by-page visual audit.
- [Kenney Board Game Icons](https://kenney.nl/assets/board-game-icons): reviewed its explicit CC0 listing as a potential source; no files from the pack are included.
- Poly Haven, Quaternius, Motion, R3F, Colyseus and ZzFX were suggested resources, not imported dependencies or asset sources in this pass. The game remains 2D on its existing React/Phaser stack; no sound or network service is implied.
