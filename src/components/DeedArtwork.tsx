/** An original miniature banknote engraving for the title deed. */
export function DeedArtwork({ index, special = false }: { index: number; special?: boolean }) {
  const palette = ['#9b765e', '#6b9b8d', '#aa946a', '#8197a2', '#957b8e', '#89a17c']
  const color = palette[((index % palette.length) + palette.length) % palette.length]
  const id = `deed-hatch-${index}-${special ? 'special' : 'ordinary'}`
  return <svg viewBox="0 0 500 160" aria-hidden="true">
    <defs><pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v6" stroke="#305350" strokeWidth="1" opacity=".5" /></pattern></defs>
    <rect width="500" height="160" fill="#e8e5d0" /><path d="M0 24q110 38 216-5t284 13v128H0Z" fill="#c1d2bd" /><path d="M0 129q104-32 194 10t306-29v50H0Z" fill="#9fbdac" />
    <path d="M0 112q125-50 250 2t250-19" fill="none" stroke="#eff0d9" strokeWidth="15" /><path d="M0 112q125-50 250 2t250-19" fill="none" stroke="#325655" strokeWidth="1" strokeDasharray="6 9" />
    <circle cx="403" cy="35" r="25" fill="#ded0a2" stroke="#527566" strokeWidth="1" /><circle cx="403" cy="35" r="20" fill="none" stroke="#527566" strokeWidth="1" strokeDasharray="2 3" />
    <g stroke="#254c4c" strokeWidth="2" strokeLinejoin="round">
      <path d="m102 110 76-23 77 30-75 26Z" fill="#eee6cd" /><path d="m102 110 1-59 75-22v58Z" fill="#f4edd6"/><path d="m178 29 77 31v57l-77-30Z" fill={color}/><path d="m96 52 82-37 82 46-82-32Z" fill="#1b4749"/>
      <path d="m300 128 57-17 54 20-56 18Z" fill="#eee6cd"/><path d="m300 128V59l57-18v70Z" fill="#efe8d0"/><path d="m357 41 54 24v66l-54-20Z" fill={color}/><path d="m296 59 61-32 59 39-59-25Z" fill="#1b4749"/>
      <path d="M117 66v39m16-44v40m16-45v39m17-44v39m150-25v56m15-61v57m14-62v58" stroke="#68867a" strokeWidth="4" />
      {special && <><path d="M340 37V19h35v20" fill="#e2cd98" /><path d="m354 28 4-6 4 6-4 5Z" fill="#254c4c" /></>}
    </g>
    <path d="M103 52v59l76 31V87l-76-35Zm197 7v69l57 21v-38l-57-52Z" fill={`url(#${id})`} opacity=".36" />
    <path d="M8 8h484v144H8zM13 13h474v134H13z" fill="none" stroke="#395c56" strokeWidth="1" /><path d="M15 15h20m-20 0v19m470-19h-20m20 0v19M15 145h20m-20 0v-19m470 19h-20m20 0v-19" fill="none" stroke="#846d56" strokeWidth="2" />
  </svg>
}
