import React, { useId } from 'react'

export interface HelmetOption {
  id: string
  name: string
  primaryColor: string
  primaryDark: string
  primaryLight: string
  visorColor: string
  accentColor: string
  stripeColor: string
}

export const HELMET_OPTIONS: HelmetOption[] = [
  {
    id: 'track-orange',
    name: 'Track Orange',
    primaryColor: '#FF6B00',
    primaryDark: '#B83B00',
    primaryLight: '#FF9E44',
    visorColor: '#0C0E12',
    accentColor: '#FF8524',
    stripeColor: '#E2E8F0',
  },
  {
    id: 'neon-viper',
    name: 'Neon Viper',
    primaryColor: '#22C55E',
    primaryDark: '#146C32',
    primaryLight: '#86EFAC',
    visorColor: '#0C0E12',
    accentColor: '#4ADE80',
    stripeColor: '#E2E8F0',
  },
  {
    id: 'apex-red',
    name: 'Apex Red',
    primaryColor: '#EF4444',
    primaryDark: '#991B1B',
    primaryLight: '#FCA5A5',
    visorColor: '#0C0E12',
    accentColor: '#FACC15',
    stripeColor: '#E2E8F0',
  },
  {
    id: 'cyber-blue',
    name: 'Electric Blue',
    primaryColor: '#2563EB',
    primaryDark: '#1E3A8A',
    primaryLight: '#93C5FD',
    visorColor: '#0C0E12',
    accentColor: '#38BDF8',
    stripeColor: '#E2E8F0',
  },
  {
    id: 'gold-champion',
    name: 'Pole Gold',
    primaryColor: '#EAB308',
    primaryDark: '#854D0E',
    primaryLight: '#FEF08A',
    visorColor: '#0C0E12',
    accentColor: '#FDE047',
    stripeColor: '#F8FAFC',
  },
  {
    id: 'stealth-carbon',
    name: 'Stealth Carbon',
    primaryColor: '#3F3F46',
    primaryDark: '#18181B',
    primaryLight: '#A1A1AA',
    visorColor: '#0C0E12',
    accentColor: '#FF6B00',
    stripeColor: '#71717A',
  },
  {
    id: 'ultraviolet',
    name: 'Sector Purple',
    primaryColor: '#9333EA',
    primaryDark: '#581C87',
    primaryLight: '#D8B4FE',
    visorColor: '#0C0E12',
    accentColor: '#F472B6',
    stripeColor: '#E2E8F0',
  },
]

export const KRAPP_LOGO_HELMET: HelmetOption = HELMET_OPTIONS[0]

interface HelmetIconProps {
  helmet: HelmetOption
  className?: string
}

export const HelmetSvg: React.FC<HelmetIconProps> = ({
  helmet,
  className = 'w-28 h-28',
}) => {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '')

  const primary = helmet.primaryColor || '#FF6B00'
  const primaryDark = helmet.primaryDark || '#B83B00'
  const primaryLight = helmet.primaryLight || '#FF9E44'
  const stripe = helmet.stripeColor || '#E2E8F0'

  return (
    <svg
      viewBox="-8 -10 310 326"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Main shell metallic radial gradient */}
        <radialGradient
          id={`domeGrad-${uid}`}
          cx="58%"
          cy="28%"
          r="65%"
          fx="55%"
          fy="24%"
        >
          <stop offset="0%" stopColor={primaryLight} />
          <stop offset="28%" stopColor={primary} />
          <stop offset="78%" stopColor={primary} />
          <stop offset="100%" stopColor={primaryDark} />
        </radialGradient>

        {/* Lower chin metallic gradient */}
        <linearGradient
          id={`chinGrad-${uid}`}
          x1="180"
          y1="180"
          x2="255"
          y2="280"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={primary} />
          <stop offset="55%" stopColor={primary} />
          <stop offset="100%" stopColor={primaryDark} />
        </linearGradient>

        {/* Rear carbon dark shell gradient */}
        <linearGradient
          id={`carbonBase-${uid}`}
          x1="30"
          y1="70"
          x2="185"
          y2="275"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#262930" />
          <stop offset="40%" stopColor="#111317" />
          <stop offset="100%" stopColor="#07080A" />
        </linearGradient>

        {/* Silver metallic band gradient */}
        <linearGradient
          id={`silverBand-${uid}`}
          x1="65"
          y1="55"
          x2="88"
          y2="185"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="35%" stopColor={stripe} />
          <stop offset="52%" stopColor="#FFFFFF" />
          <stop offset="75%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Visor deep smoked tint gradient */}
        <linearGradient
          id={`visorGrad-${uid}`}
          x1="100"
          y1="78"
          x2="265"
          y2="195"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#1E232A" />
          <stop offset="25%" stopColor="#0C0E12" />
          <stop offset="70%" stopColor="#050608" />
          <stop offset="100%" stopColor="#14181F" />
        </linearGradient>

        {/* Carbon fiber diagonal hatch pattern */}
        <pattern
          id={`carbonPattern-${uid}`}
          width="8"
          height="8"
          patternTransform="rotate(35)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill="#0B0D10" />
          <rect x="0" y="0" width="4" height="4" fill="#1E232B" />
          <rect x="4" y="4" width="4" height="4" fill="#1E232B" />
          <rect x="0" y="4" width="4" height="2" fill="#2E3540" opacity="0.6" />
        </pattern>

        {/* Clip path for outer helmet silhouette */}
        <clipPath id={`helmetClip-${uid}`}>
          <path
            d="M 48 76
               L 26 85
               C 25 78, 35 69, 54 63
               C 78 35, 118 22, 162 24
               C 214 27, 254 62, 265 110
               L 254 114
               L 264 118
               C 265 144, 259 175, 250 198
               L 252 204
               C 256 226, 245 256, 232 278
               C 230 282, 224 284, 217 282
               C 150 264, 82 232, 38 196
               C 34 192, 33 185, 34 176
               C 30 144, 34 108, 48 76 Z"
          />
        </clipPath>
      </defs>

      {/* Base Rubber Neck Trim Shadow */}
      <path
        d="M 35 190 C 82 228, 150 262, 222 283 C 228 285, 233 282, 234 277 L 228 271 C 155 250, 88 218, 40 182 Z"
        fill="#08090C"
      />

      {/* CLIPPED MAIN SHELL */}
      <g clipPath={`url(#helmetClip-${uid})`}>
        {/* 1. Primary Colored Dome & Chin Body */}
        <rect x="0" y="0" width="300" height="300" fill={`url(#domeGrad-${uid})`} />

        {/* Lower Chin Shading & Contour */}
        <path
          d="M 165 170 L 265 190 L 260 290 L 185 285 Z"
          fill={`url(#chinGrad-${uid})`}
        />

        {/* Subtle Darker Primary Cheek Recess Contour */}
        <path
          d="M 192 208 C 206 232, 205 255, 194 276 L 232 284 L 245 215 Z"
          fill={primaryDark}
          opacity="0.55"
        />

        {/* Speed-Pill Halftone Graphic Pattern Behind Visor */}
        <g opacity="0.42" fill={primaryLight} transform="rotate(-24 105 115)">
          <rect x="74" y="62" width="34" height="6" rx="3" />
          <rect x="68" y="73" width="44" height="6" rx="3" />
          <rect x="82" y="84" width="36" height="6" rx="3" />
          <rect x="64" y="95" width="48" height="6" rx="3" />
          <rect x="76" y="106" width="42" height="6" rx="3" />
          <rect x="70" y="117" width="46" height="6" rx="3" />
          <rect x="84" y="128" width="38" height="6" rx="3" />
          <rect x="72" y="139" width="44" height="6" rx="3" />
          <rect x="86" y="150" width="34" height="6" rx="3" />
        </g>

        {/* Black Vertical Dome Pinstripe */}
        <path
          d="M 119 20 C 113 42, 113 64, 116 84 L 122 84 C 119 64, 119 42, 125 20 Z"
          fill="#0D1014"
        />

        {/* 2. Rear Carbon Black Section */}
        <path
          d="M 15 50
             L 92 42
             C 76 86, 78 138, 96 178
             L 175 212
             L 196 285
             L 15 285 Z"
          fill={`url(#carbonBase-${uid})`}
        />

        {/* Carbon Weave Lower Cheek & Jaw Strip */}
        <path
          d="M 55 128
             L 172 212
             L 194 282
             L 162 276
             L 42 188 Z"
          fill={`url(#carbonPattern-${uid})`}
          stroke="#272D38"
          strokeWidth="1"
        />

        {/* Carbon Strip Gloss Highlight Line */}
        <path
          d="M 46 178 L 182 268"
          stroke="#CBD5E1"
          strokeWidth="2.5"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
        <path
          d="M 46 182 L 180 272"
          stroke="#000000"
          strokeWidth="2"
          strokeOpacity="0.8"
        />

        {/* Rear Metallic Silver Arc Stripe */}
        <path
          d="M 88 42
             C 72 84, 72 132, 86 172
             L 74 162
             C 62 124, 62 82, 77 42 Z"
          fill={`url(#silverBand-${uid})`}
        />

        {/* Dark Charcoal Secondary Stripe Next to Silver Band */}
        <path
          d="M 76 42
             C 60 82, 60 124, 72 161
             L 61 151
             C 51 116, 51 78, 65 42 Z"
          fill="#1F242D"
        />

        {/* Lower Rear Speed-Pill Cutout Graphic */}
        <path
          d="M 74 176
             L 106 196
             L 118 232
             L 66 202 Z"
          fill={primary}
        />
        <g fill="#0D1014">
          <rect
            x="72"
            y="182"
            width="18"
            height="4.5"
            rx="2.2"
            transform="rotate(28 72 182)"
          />
          <rect
            x="92"
            y="193"
            width="16"
            height="4.5"
            rx="2.2"
            transform="rotate(28 92 193)"
          />
          <rect
            x="68"
            y="191"
            width="22"
            height="4.5"
            rx="2.2"
            transform="rotate(28 68 191)"
          />
          <rect
            x="93"
            y="204"
            width="18"
            height="4.5"
            rx="2.2"
            transform="rotate(28 93 204)"
          />
          <rect
            x="74"
            y="203"
            width="20"
            height="4.5"
            rx="2.2"
            transform="rotate(28 74 203)"
          />
        </g>

        {/* Stealth Diagonal "KRAPP" Wordmark in Cheek Recess */}
        <text
          x="82"
          y="168"
          fill="#2D333F"
          fontFamily="Impact, Arial Black, sans-serif"
          fontSize="25"
          fontStyle="italic"
          fontWeight="900"
          letterSpacing="2"
          transform="rotate(30 82 168)"
          opacity="0.85"
        >
          KRAPP
        </text>

        {/* Cheek Trim Accent Line under Visor */}
        <path
          d="M 152 172 L 156 181 L 205 203 L 208 198"
          fill="none"
          stroke="#0D1014"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />

        {/* 3. Brow Air Intake Vent */}
        <path
          d="M 200 66
             L 234 78
             L 262 100
             L 256 104
             L 228 84
             L 196 71 Z"
          fill="#0F1217"
          stroke="#262B35"
          strokeWidth="1.2"
        />
        <path d="M 206 70 L 226 78 L 223 81 L 204 73 Z" fill="#050608" />
        <path d="M 234 82 L 254 96 L 250 99 L 231 85 Z" fill="#050608" />

        {/* 4. Chin Bar Sharp Black Air Vent */}
        <path
          d="M 233 218
             L 246 208
             C 246 225, 238 248, 224 264
             L 219 258
             C 226 244, 231 230, 233 218 Z"
          fill="#0E1116"
          stroke="#272C35"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M 236 221 L 242 216 C 240 230, 234 246, 224 258 L 222 254 C 228 243, 233 232, 236 221 Z"
          fill="#050608"
        />

        {/* 5. Glossy Specular Dome Highlight */}
        <ellipse cx="164" cy="70" rx="8" ry="6.5" fill="#FFFFFF" opacity="0.92" />
        <ellipse cx="164" cy="70" rx="18" ry="13" fill="#FFFFFF" opacity="0.18" />
        <path
          d="M 128 36 C 165 28, 205 42, 232 68"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.22"
          fill="none"
        />
      </g>

      {/* Rear Aero Spoiler Lip + Decal Icon */}
      <path
        d="M 54 63
           C 37 69, 26 78, 26 85
           L 48 77
           L 56 92
           L 64 64 Z"
        fill="#14181F"
        stroke="#2D3340"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M 48 69 L 56 67 L 54 78 L 46 77 Z"
        fill="none"
        stroke="#94A3B8"
        strokeWidth="1.2"
        opacity="0.8"
      />

      {/* 6. DEEP SMOKED WRAPAROUND VISOR */}
      <path
        d="M 98 73
           L 132 76
           C 184 82, 234 96, 265 113
           C 267 142, 260 174, 250 198
           L 234 205
           L 228 196
           L 164 168
           C 138 140, 115 109, 98 73 Z"
        fill="#07080B"
        stroke="#1E232D"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M 103 77
           L 134 80
           C 184 86, 232 99, 263 115
           C 264 142, 258 172, 248 195
           L 234 201
           L 228 192
           L 166 165
           C 141 138, 119 109, 103 77 Z"
        fill={`url(#visorGrad-${uid})`}
      />

      {/* Visor Inner Reflection */}
      <path
        d="M 156 84
           C 196 90, 232 101, 258 115
           C 258 138, 253 165, 245 188
           L 228 182
           C 234 156, 236 128, 228 102
           Z"
        fill="#FFFFFF"
        opacity="0.06"
      />

      {/* Crisp Top Edge Visor Highlight */}
      <path
        d="M 104 78 L 134 81 C 182 86, 228 98, 261 114"
        stroke="#64748B"
        strokeWidth="1.5"
        strokeOpacity="0.65"
        fill="none"
      />

      {/* Metallic Tear-Off / Pinlock Post on Visor */}
      <circle
        cx="152"
        cy="140"
        r="5"
        fill="#CBD5E1"
        stroke="#0F172A"
        strokeWidth="1.2"
      />
      <circle cx="152" cy="140" r="2.2" fill="#334155" />
      <circle cx="150.5" cy="138.5" r="1.2" fill="#FFFFFF" />

      {/* Subtle "KRAPP" Visor Corner Branding */}
      <text
        x="128"
        y="90"
        fill="#E2E8F0"
        fontFamily="Arial, sans-serif"
        fontSize="7.5"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="1"
        opacity="0.85"
      >
        KRAPP
      </text>

      {/* Vertical Technical Micro-Text Lines on Left Visor Edge */}
      <line
        x1="108"
        y1="84"
        x2="124"
        y2="115"
        stroke="#94A3B8"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="3 2"
      />
      <line
        x1="112"
        y1="88"
        x2="129"
        y2="121"
        stroke="#94A3B8"
        strokeWidth="1"
        strokeOpacity="0.35"
      />
    </svg>
  )
}

export const KrappLogoHelmet: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => {
  return <HelmetSvg helmet={KRAPP_LOGO_HELMET} className={className} />
}
