import React from 'react'

export interface CountryOption {
  id: string
  name: string
}

export const COUNTRIES: CountryOption[] = [
  { id: 'LATVIA', name: 'LATVIA' },
  { id: 'LITHUANIA', name: 'LITHUANIA' },
  { id: 'ESTONIA', name: 'ESTONIA' },
  { id: 'FINLAND', name: 'FINLAND' },
  { id: 'POLAND', name: 'POLAND' },
  { id: 'KAZAKHSTAN', name: 'KAZAKHSTAN' },
  { id: 'USA', name: 'USA' },
]

export const CountryFlagCircle: React.FC<{ country: string; className?: string }> = ({
  country,
  className = 'w-7 h-7',
}) => {
  const upper = country.toUpperCase()

  return (
    <svg
      viewBox="0 0 36 36"
      className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`clip-${upper}`}>
          <circle cx="18" cy="18" r="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${upper})`}>
        {upper === 'LATVIA' && (
          <>
            <rect width="36" height="36" fill="#9E3039" />
            <rect y="14" width="36" height="8" fill="#FFFFFF" />
          </>
        )}
        {upper === 'LITHUANIA' && (
          <>
            <rect width="36" height="12" fill="#FDB913" />
            <rect y="12" width="36" height="12" fill="#006A44" />
            <rect y="24" width="36" height="12" fill="#C1272D" />
          </>
        )}
        {upper === 'ESTONIA' && (
          <>
            <rect width="36" height="12" fill="#0072CE" />
            <rect y="12" width="36" height="12" fill="#000000" />
            <rect y="24" width="36" height="12" fill="#FFFFFF" />
          </>
        )}
        {upper === 'FINLAND' && (
          <>
            <rect width="36" height="36" fill="#FFFFFF" />
            <rect y="13" width="36" height="10" fill="#003580" />
            <rect x="10" width="10" height="36" fill="#003580" />
          </>
        )}
        {upper === 'POLAND' && (
          <>
            <rect width="36" height="18" fill="#FFFFFF" />
            <rect y="18" width="36" height="18" fill="#DC143C" />
          </>
        )}
        {(upper === 'KAZAKHSTAN' || upper === 'KAZKAHSTAN') && (
          <>
            <rect width="36" height="36" fill="#00AFCA" />
            <circle cx="18" cy="18" r="7" fill="#FEC50C" />
          </>
        )}
        {upper === 'USA' && (
          <>
            <rect width="36" height="36" fill="#B22234" />
            <rect y="5" width="36" height="5" fill="#FFFFFF" />
            <rect y="15" width="36" height="5" fill="#FFFFFF" />
            <rect y="25" width="36" height="5" fill="#FFFFFF" />
            <rect width="18" height="18" fill="#3C3B6E" />
          </>
        )}
        {![
          'LATVIA',
          'LITHUANIA',
          'ESTONIA',
          'FINLAND',
          'POLAND',
          'KAZAKHSTAN',
          'KAZKAHSTAN',
          'USA',
        ].includes(upper) && (
          <>
            <rect width="36" height="36" fill="#2b2b2b" />
            <circle cx="18" cy="18" r="10" stroke="#32cd32" strokeWidth="2" fill="none" />
          </>
        )}
      </g>
    </svg>
  )
}
