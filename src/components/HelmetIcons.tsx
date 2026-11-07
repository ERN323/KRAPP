import React from 'react'

export interface HelmetOption {
  id: string
  name: string
  primaryColor: string
  visorColor: string
  accentColor: string
}

export const HELMET_OPTIONS: HelmetOption[] = [
  {
    id: 'neon-viper',
    name: 'Neon Viper',
    primaryColor: '#32cd32',
    visorColor: '#111111',
    accentColor: '#ffffff',
  },
  {
    id: 'apex-red',
    name: 'Apex Red',
    primaryColor: '#ef4444',
    visorColor: '#111111',
    accentColor: '#facc15',
  },
  {
    id: 'cyber-blue',
    name: 'Electric Blue',
    primaryColor: '#3b82f6',
    visorColor: '#0f172a',
    accentColor: '#38bdf8',
  },
  {
    id: 'gold-champion',
    name: 'Pole Gold',
    primaryColor: '#eab308',
    visorColor: '#18181b',
    accentColor: '#fef08a',
  },
  {
    id: 'stealth-carbon',
    name: 'Stealth Carbon',
    primaryColor: '#27272a',
    visorColor: '#32cd32',
    accentColor: '#71717a',
  },
  {
    id: 'ultraviolet',
    name: 'Sector Purple',
    primaryColor: '#a855f7',
    visorColor: '#111111',
    accentColor: '#f472b6',
  },
]

interface HelmetIconProps {
  helmet: HelmetOption
  className?: string
}

export const HelmetSvg: React.FC<HelmetIconProps> = ({ helmet, className = 'w-28 h-28' }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Shell */}
      <path
        d="M24 68C24 41 40 24 63 24C84 24 98 39 98 60V77C98 85 91 92 83 92H40C29 92 24 81 24 68Z"
        fill={helmet.primaryColor}
        stroke="#111111"
        strokeWidth="4"
      />
      {/* Racing Stripe */}
      <path
        d="M44 27C55 24 68 24 78 29L64 46H40L44 27Z"
        fill={helmet.accentColor}
        opacity="0.85"
      />
      {/* Visor Shield */}
      <path
        d="M54 46H97V66H54L43 56L54 46Z"
        fill={helmet.visorColor}
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Visor Glare */}
      <path
        d="M60 50H88L83 56H55L60 50Z"
        fill="#ffffff"
        opacity="0.25"
      />
      {/* Chin Vent & Aero Line */}
      <path
        d="M32 79H88"
        stroke={helmet.accentColor}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="84" cy="79" r="3" fill="#111111" />
      <circle cx="75" cy="79" r="3" fill="#111111" />
    </svg>
  )
}
