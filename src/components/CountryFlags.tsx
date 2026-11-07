import React from 'react'

export interface CountryOption {
  code: string
  name: string
}

// Complete ISO 3166-1 alpha-2 country list (195+ countries)
// Priority Baltic/Nordic/Karting countries placed first or sorted alphabetically
export const COUNTRIES: CountryOption[] = [
  { code: 'AF', name: 'AFGHANISTAN' },
  { code: 'AL', name: 'ALBANIA' },
  { code: 'DZ', name: 'ALGERIA' },
  { code: 'AD', name: 'ANDORRA' },
  { code: 'AO', name: 'ANGOLA' },
  { code: 'AG', name: 'ANTIGUA AND BARBUDA' },
  { code: 'AR', name: 'ARGENTINA' },
  { code: 'AM', name: 'ARMENIA' },
  { code: 'AU', name: 'AUSTRALIA' },
  { code: 'AT', name: 'AUSTRIA' },
  { code: 'AZ', name: 'AZERBAIJAN' },
  { code: 'BS', name: 'BAHAMAS' },
  { code: 'BH', name: 'BAHRAIN' },
  { code: 'BD', name: 'BANGLADESH' },
  { code: 'BB', name: 'BARBADOS' },
  { code: 'BY', name: 'BELARUS' },
  { code: 'BE', name: 'BELGIUM' },
  { code: 'BZ', name: 'BELIZE' },
  { code: 'BJ', name: 'BENIN' },
  { code: 'BT', name: 'BHUTAN' },
  { code: 'BO', name: 'BOLIVIA' },
  { code: 'BA', name: 'BOSNIA AND HERZEGOVINA' },
  { code: 'BW', name: 'BOTSWANA' },
  { code: 'BR', name: 'BRAZIL' },
  { code: 'BN', name: 'BRunei' },
  { code: 'BG', name: 'BULGARIA' },
  { code: 'BF', name: 'BURKINA FASO' },
  { code: 'BI', name: 'BURUNDI' },
  { code: 'CV', name: 'CABO VERDE' },
  { code: 'KH', name: 'CAMBODIA' },
  { code: 'CM', name: 'CAMEROON' },
  { code: 'CA', name: 'CANADA' },
  { code: 'CF', name: 'CENTRAL AFRICAN REPUBLIC' },
  { code: 'TD', name: 'CHAD' },
  { code: 'CL', name: 'CHILE' },
  { code: 'CN', name: 'CHINA' },
  { code: 'CO', name: 'COLOMBIA' },
  { code: 'KM', name: 'COMOROS' },
  { code: 'CG', name: 'CONGO' },
  { code: 'CR', name: 'COSTA RICA' },
  { code: 'HR', name: 'CROATIA' },
  { code: 'CU', name: 'CUBA' },
  { code: 'CY', name: 'CYPRUS' },
  { code: 'CZ', name: 'CZECHIA' },
  { code: 'DK', name: 'DENMARK' },
  { code: 'DJ', name: 'DJIBOUTI' },
  { code: 'DM', name: 'DOMINICA' },
  { code: 'DO', name: 'DOMINICAN REPUBLIC' },
  { code: 'EC', name: 'ECUADOR' },
  { code: 'EG', name: 'EGYPT' },
  { code: 'SV', name: 'EL SALVADOR' },
  { code: 'GQ', name: 'EQUATORIAL GUINEA' },
  { code: 'ER', name: 'ERITREA' },
  { code: 'EE', name: 'ESTONIA' },
  { code: 'SZ', name: 'ESWATINI' },
  { code: 'ET', name: 'ETHIOPIA' },
  { code: 'FJ', name: 'FIJI' },
  { code: 'FI', name: 'FINLAND' },
  { code: 'FR', name: 'FRANCE' },
  { code: 'GA', name: 'GABON' },
  { code: 'GM', name: 'GAMBIA' },
  { code: 'GE', name: 'GEORGIA' },
  { code: 'DE', name: 'GERMANY' },
  { code: 'GH', name: 'GHANA' },
  { code: 'GR', name: 'GREECE' },
  { code: 'GD', name: 'GRENADA' },
  { code: 'GT', name: 'GUATEMALA' },
  { code: 'GN', name: 'GUINEA' },
  { code: 'GW', name: 'GUINEA-BISSAU' },
  { code: 'GY', name: 'GUYANA' },
  { code: 'HT', name: 'HAITI' },
  { code: 'HN', name: 'HONDURAS' },
  { code: 'HU', name: 'HUNGARY' },
  { code: 'IS', name: 'ICELAND' },
  { code: 'IN', name: 'INDIA' },
  { code: 'ID', name: 'INDONESIA' },
  { code: 'IR', name: 'IRAN' },
  { code: 'IQ', name: 'IRAQ' },
  { code: 'IE', name: 'IRELAND' },
  { code: 'IL', name: 'ISRAEL' },
  { code: 'IT', name: 'ITALY' },
  { code: 'JM', name: 'JAMAICA' },
  { code: 'JP', name: 'JAPAN' },
  { code: 'JO', name: 'JORDAN' },
  { code: 'KZ', name: 'KAZAKHSTAN' },
  { code: 'KE', name: 'KENYA' },
  { code: 'KI', name: 'KIRIBATI' },
  { code: 'KW', name: 'KUWAIT' },
  { code: 'KG', name: 'KYRGYZSTAN' },
  { code: 'LA', name: 'LAOS' },
  { code: 'LV', name: 'LATVIA' },
  { code: 'LB', name: 'LEBANON' },
  { code: 'LS', name: 'LESOTHO' },
  { code: 'LR', name: 'LIBERIA' },
  { code: 'LY', name: 'LIBYA' },
  { code: 'LI', name: 'LIECHTENSTEIN' },
  { code: 'LT', name: 'LITHUANIA' },
  { code: 'LU', name: 'LUXEMBOURG' },
  { code: 'MG', name: 'MADAGASCAR' },
  { code: 'MW', name: 'MALAWI' },
  { code: 'MY', name: 'MALAYSIA' },
  { code: 'MV', name: 'MALDIVES' },
  { code: 'ML', name: 'MALI' },
  { code: 'MT', name: 'MALTA' },
  { code: 'MH', name: 'MARSHALL ISLANDS' },
  { code: 'MR', name: 'MAURITANIA' },
  { code: 'MU', name: 'MAURITIUS' },
  { code: 'MX', name: 'MEXICO' },
  { code: 'FM', name: 'MICRONESIA' },
  { code: 'MD', name: 'MOLDOVA' },
  { code: 'MC', name: 'MONACO' },
  { code: 'MN', name: 'MONGOLIA' },
  { code: 'ME', name: 'MONTENEGRO' },
  { code: 'MA', name: 'MOROCCO' },
  { code: 'MZ', name: 'MOZAMBIQUE' },
  { code: 'MM', name: 'MYANMAR' },
  { code: 'NA', name: 'NAMIBIA' },
  { code: 'NR', name: 'NAURU' },
  { code: 'NP', name: 'NEPAL' },
  { code: 'NL', name: 'NETHERLANDS' },
  { code: 'NZ', name: 'NEW ZEALAND' },
  { code: 'NI', name: 'NICARAGUA' },
  { code: 'NE', name: 'NIGER' },
  { code: 'NG', name: 'NIGERIA' },
  { code: 'KP', name: 'NORTH KOREA' },
  { code: 'MK', name: 'NORTH MACEDONIA' },
  { code: 'NO', name: 'NORWAY' },
  { code: 'OM', name: 'OMAN' },
  { code: 'PK', name: 'PAKISTAN' },
  { code: 'PW', name: 'PALAU' },
  { code: 'PS', name: 'PALESTINE' },
  { code: 'PA', name: 'PANAMA' },
  { code: 'PG', name: 'PAPUA NEW GUINEA' },
  { code: 'PY', name: 'PARAGUAY' },
  { code: 'PE', name: 'PERU' },
  { code: 'PH', name: 'PHILIPPINES' },
  { code: 'PL', name: 'POLAND' },
  { code: 'PT', name: 'PORTUGAL' },
  { code: 'QA', name: 'QATAR' },
  { code: 'RO', name: 'ROMANIA' },
  { code: 'RU', name: 'RUSSIA' },
  { code: 'RW', name: 'RWANDA' },
  { code: 'KN', name: 'SAINT KITTS AND NEVIS' },
  { code: 'LC', name: 'SAINT LUCIA' },
  { code: 'VC', name: 'SAINT VINCENT AND THE GRENADINES' },
  { code: 'WS', name: 'SAMOA' },
  { code: 'SM', name: 'SAN MARINO' },
  { code: 'ST', name: 'SAO TOME AND PRINCIPE' },
  { code: 'SA', name: 'SAUDI ARABIA' },
  { code: 'SN', name: 'SENEGAL' },
  { code: 'RS', name: 'SERBIA' },
  { code: 'SC', name: 'SEYCHELLES' },
  { code: 'SL', name: 'SIERRA LEONE' },
  { code: 'SG', name: 'SINGAPORE' },
  { code: 'SK', name: 'SLOVAKIA' },
  { code: 'SI', name: 'SLOVENIA' },
  { code: 'SB', name: 'SOLOMON ISLANDS' },
  { code: 'SO', name: 'SOMALIA' },
  { code: 'ZA', name: 'SOUTH AFRICA' },
  { code: 'KR', name: 'SOUTH KOREA' },
  { code: 'SS', name: 'SOUTH SUDAN' },
  { code: 'ES', name: 'SPAIN' },
  { code: 'LK', name: 'SRI LANKA' },
  { code: 'SD', name: 'SUDAN' },
  { code: 'SR', name: 'SURINAME' },
  { code: 'SE', name: 'SWEDEN' },
  { code: 'CH', name: 'SWITZERLAND' },
  { code: 'SY', name: 'SYRIA' },
  { code: 'TW', name: 'TAIWAN' },
  { code: 'TJ', name: 'TAJIKISTAN' },
  { code: 'TZ', name: 'TANZANIA' },
  { code: 'TH', name: 'THAILAND' },
  { code: 'TL', name: 'TIMOR-LESTE' },
  { code: 'TG', name: 'TOGO' },
  { code: 'TO', name: 'TONGA' },
  { code: 'TT', name: 'TRINIDAD AND TOBAGO' },
  { code: 'TN', name: 'TUNISIA' },
  { code: 'TR', name: 'TURKEY' },
  { code: 'TM', name: 'TURKMENISTAN' },
  { code: 'TV', name: 'TUVALU' },
  { code: 'UG', name: 'UGANDA' },
  { code: 'UA', name: 'UKRAINE' },
  { code: 'AE', name: 'UNITED ARAB EMIRATES' },
  { code: 'GB', name: 'UNITED KINGDOM' },
  { code: 'US', name: 'USA' },
  { code: 'UY', name: 'URUGUAY' },
  { code: 'UZ', name: 'UZBEKISTAN' },
  { code: 'VU', name: 'VANUATU' },
  { code: 'VA', name: 'VATICAN CITY' },
  { code: 'VE', name: 'VENEZUELA' },
  { code: 'VN', name: 'VIETNAM' },
  { code: 'YE', name: 'YEMEN' },
  { code: 'ZM', name: 'ZAMBIA' },
  { code: 'ZW', name: 'ZIMBABWE' },
].map((c) => ({ ...c, name: c.name.toUpperCase() }))

export function codeToFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏁'
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export const CountryFlagCircle: React.FC<{ country: string; className?: string }> = ({
  country,
  className = 'w-7 h-7',
}) => {
  const upper = country.trim().toUpperCase()
  const matched = COUNTRIES.find((c) => c.name === upper || c.code === upper)
  const code = matched?.code || ''

  // Render crisp custom SVG for core Baltic/Nordic/frequent countries, and circular flag badge for all 195+ countries
  if (
    ['LATVIA', 'LITHUANIA', 'ESTONIA', 'FINLAND', 'POLAND', 'KAZAKHSTAN', 'USA'].includes(
      upper
    )
  ) {
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
          {upper === 'KAZAKHSTAN' && (
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
        </g>
      </svg>
    )
  }

  return (
    <div
      className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm bg-[#2b2b2b] border border-neutral-700 flex items-center justify-center text-base leading-none`}
      title={upper}
    >
      {code ? (
        <img
          src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
          alt={upper}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span>{codeToFlagEmoji(code)}</span>
      )}
    </div>
  )
}
