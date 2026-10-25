import type { CityExpression, CityRole } from '../game/presentation'
type CharacterProps = { index?: number; dealer?: boolean; banker?: boolean; role?: CityRole; expression?: CityExpression; className?: string }

const cast = [
  { name: 'The Architect', skin: '#B96644', hair: '#142536', coat: '#EF573F', shirt: '#FFE8BC', accent: '#8EE0BE', hat: true, item: 'plans' },
  { name: 'The Rail Baron', skin: '#E9AC79', hair: '#4A2533', coat: '#234455', shirt: '#F9ECCC', accent: '#F7B94A', hat: true, item: 'case' },
  { name: 'The Broker', skin: '#8C533D', hair: '#132935', coat: '#8EE0BE', shirt: '#FFF1DA', accent: '#EF573F', hat: false, item: 'coin' },
  { name: 'The Inventor', skin: '#D59370', hair: '#784337', coat: '#ECA943', shirt: '#142536', accent: '#F8F0D9', hat: false, item: 'plans' },
  { name: 'The Magnate', skin: '#684032', hair: '#191F36', coat: '#8A66A4', shirt: '#F7EDDB', accent: '#F7BC51', hat: true, item: 'case' },
  { name: 'The Courier', skin: '#E4A17D', hair: '#302836', coat: '#5D9F90', shirt: '#FFF1D7', accent: '#F35E46', hat: false, item: 'coin' },
]
export const CHARACTER_NAMES = cast.map(person => person.name)

export function Character({ index = 0, dealer = false, banker = false, role, expression = 'welcoming', className = '' }: CharacterProps) {
  dealer = dealer || role === 'dealer'
  banker = banker || role === 'banker'
  const person = dealer
    ? { name: 'The Dealer', skin: '#BA7452', hair: '#1B2939', coat: '#23494A', shirt: '#FFF0D8', accent: '#C48C67', hat: false, item: 'cards' }
    : banker ? { name: 'The Banker', skin: '#D7AA80', hair: '#65766C', coat: '#546B61', shirt: '#FAF1D7', accent: '#C2985B', hat: false, item: 'case' }
      : role ? { ...cast[{ inspector: 0, auctioneer: 1, broker: 2, foreman: 3 }[role as 'inspector' | 'auctioneer' | 'broker' | 'foreman'] ?? 0], name: `The ${role[0].toUpperCase()}${role.slice(1)}` }
      : cast[((index % cast.length) + cast.length) % cast.length]
  return (
    <svg className={className} viewBox="0 0 180 260" role="img" aria-label={`${person.name}, illustrated city trader`} xmlns="http://www.w3.org/2000/svg">
      <title>{person.name}</title>
      <g stroke="#182A39" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="91" cy="250" rx="60" ry="7" fill="#182A39" opacity=".18" stroke="none" />
        <path d="M53 181 48 240 76 242 86 195 96 243 126 240 122 179Z" fill="#273D4D" />
        <path d="M45 239q-15 3-18 11h48l2-10ZM100 240l3 10h49q-5-9-25-11Z" fill="#132938" />
        <path d="M53 116q-23 0-28 34l-8 47 29 7 14-36-5 40q37 13 75-2l-6-41 14 35 26-7-12-54q-9-27-33-25Z" fill={person.coat} />
        <path d="m68 115 22 39 26-39-9-9H76Z" fill={person.shirt} />
        <path d="m84 128 7 11 8-11-5-10h-7Z" fill={person.accent} />
        <path d="m90 139-9 43 10 11 10-11-10-43Z" fill={person.accent} />
        <path d="m55 118 26 56-22-12-11 14M123 118l-25 56 24-12 9 13" fill="none" />
        <path d="M62 187q30 9 58 0m-58 8q30 9 58 0" fill="none" stroke="#f4e5cb" strokeWidth="1" opacity=".55" />
        <path d="m20 195-4 16q3 15 17 9l12-17M139 199l9 20q13 6 17-10l-3-16" fill={person.skin} />
        <path d="M73 104v18q18 17 36 0v-18" fill={person.skin} />
        <path d="M58 61q0-38 34-39 37 0 36 41l-4 36q-9 26-32 26-25-1-32-27Z" fill={person.skin} />
        <path d="M58 73q-9-39 14-49 12-24 41-9 20 10 16 47l-10-19q-20 8-41-1l-17 23Z" fill={person.hair} />
        <path d="M60 77q-13-7-13 7t15 17M126 77q13-7 13 7t-15 17" fill={person.skin} />
        <path d={expression === 'serious' ? 'M72 74l14 3M102 77l14-3' : 'M72 76q7-5 14 0M102 76q7-5 14 0'} fill="none" />
        <ellipse cx="79" cy="83" rx="3" ry="4" fill="#182A39" stroke="none" />
        <ellipse cx="109" cy="83" rx="3" ry="4" fill="#182A39" stroke="none" />
        <path d="m93 85-3 13h7" fill="none" />
        <path d={expression === 'serious' ? 'M84 108h20' : expression === 'pleased' ? 'M82 104q12 15 24 0Z' : 'M83 106q10 8 21-1'} fill={expression === 'pleased' ? '#FFF0D8' : 'none'} />
        {dealer && <><path d="M89 102q-11-4-15 3 8 13 18 3 10 10 19-3-6-8-16-3" fill={person.hair} /><path d="m86 129 6 7 7-7-7-4Z" fill={person.accent} /></>}
        {person.hat && <><path d="M54 47q-6-25 2-33Q87 0 124 16l5 31Z" fill={person.hair} /><path d="M42 47q50 10 95 0l7 9q-50 14-104 0Z" fill={person.accent} /></>}
        {person.item === 'plans' && <><path d="m17 175 36 4-3 29-36-3Z" fill="#FFF0D8" /><path d="m24 186 21 2m-20 6 14 2" fill="none" strokeWidth="2" /></>}
        {person.item === 'case' && <><rect x="130" y="186" width="37" height="29" rx="3" fill="#D89B52" /><path d="M140 186v-8h16v8m-26 14h37" fill="none" /></>}
        {person.item === 'coin' && <><circle cx="151" cy="200" r="17" fill="#F5BF58" /><path d="M151 189v22m-7-16q10-7 15 0-10 4-15 7 5 9 16 2" fill="none" strokeWidth="2" /></>}
        {dealer && <><path d="m133 171 30 6-7 39-31-6Z" fill="#FFF3DE" /><path d="m124 178 29 8-11 36-28-8Z" fill="#FFF3DE" /><path d="m130 191 8 11-13 2" fill="none" stroke={person.accent} /></>}
        {banker && <><circle cx="109" cy="83" r="11" fill="none" stroke="#D4B478" strokeWidth="3" /><path d="M120 83q18 47 1 83" fill="none" stroke="#D4B478" strokeWidth="2" /></>}
      </g>
    </svg>
  )
}
