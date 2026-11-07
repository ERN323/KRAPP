import React from 'react'
import { Menu, ArrowLeft, Bell, MoreHorizontal } from 'lucide-react'
import { KrappLogoHelmet } from './HelmetIcons'

interface TrackDayHeaderProps {
  sectionTitle: string
  sectionSubtitle?: string
  onBack?: () => void
  onMenuClick?: () => void
  onBellClick?: () => void
  onMoreClick?: () => void
  showMoreButton?: boolean
  unreadNotificationsCount?: number
}

export const TrackDayHeader: React.FC<TrackDayHeaderProps> = ({
  sectionTitle,
  sectionSubtitle,
  onBack,
  onMenuClick,
  onBellClick,
  onMoreClick,
  showMoreButton = false,
  unreadNotificationsCount = 0,
}) => {
  return (
    <div className="w-full mb-5">
      {/* Top App Bar: Menu/Back | KRAPP Logo | Bell / Settings (...) */}
      <header className="w-full h-14 px-5 flex items-center justify-between bg-[#14191E]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go Back"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/90 hover:text-[#FF6B00] hover:bg-white/5 active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/90 hover:text-[#FF6B00] hover:bg-white/5 active:scale-95 transition cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Official Track Day Pro Italic KRAPP Logo with Orange Helmet Emblem */}
        <div className="flex items-center gap-1.5 select-none">
          <KrappLogoHelmet className="w-8 h-8 drop-shadow-md" />
          <span className="font-display italic font-extrabold text-2xl tracking-wider text-white">
            KRAPP
          </span>
        </div>

        {/* Right Icon: Either More (...) for League Home Page or Notification Bell with cyan dot */}
        {showMoreButton ? (
          <button
            type="button"
            onClick={onMoreClick}
            aria-label="League Settings"
            className="w-9 h-9 rounded-lg bg-[#1C2228] border border-[#2A323B] flex items-center justify-center text-[#FF6B00] hover:border-[#FF6B00] active:scale-95 transition cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onBellClick}
            aria-label="Notifications"
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#8A99AD] hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer"
          >
            <Bell className="w-5 h-5 fill-[#8A99AD]/40" />
            {unreadNotificationsCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B00] text-black text-[9px] font-extrabold flex items-center justify-center ring-2 ring-[#14191E]">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#38BDF8] ring-2 ring-[#14191E]" />
            )}
          </button>
        )}
      </header>

      {/* Angled Racing Stripe Section Banner */}
      <div className="relative w-full h-10 bg-[#181E24] border-y border-[#262F38] flex items-center justify-between overflow-hidden">
        {/* Left angled slate accents */}
        <div className="flex items-center h-full -ml-2">
          <div className="w-12 h-full bg-[#202830] -skew-x-[24deg] border-r-4 border-[#14191E]" />
          <div className="w-3 h-full bg-[#26303A] -skew-x-[24deg] ml-1.5" />
        </div>

        {/* Centered Section Title */}
        <div className="flex flex-col items-center justify-center px-2 text-center z-10">
          <h1 className="font-display font-extrabold text-base sm:text-lg tracking-[0.08em] text-white uppercase leading-none">
            {sectionTitle}
          </h1>
          {sectionSubtitle && (
            <span className="text-[9px] font-bold tracking-[0.16em] text-[#FF6B00] uppercase mt-0.5 leading-none">
              {sectionSubtitle}
            </span>
          )}
        </div>

        {/* Right angled slate accents */}
        <div className="flex items-center h-full -mr-2">
          <div className="w-3 h-full bg-[#26303A] -skew-x-[24deg] mr-1.5" />
          <div className="w-12 h-full bg-[#202830] -skew-x-[24deg] border-l-4 border-[#14191E]" />
        </div>
      </div>
    </div>
  )
}

/* Vector Track / Kart Silhouettes for League Cards matching Track Day Pro */
export const CardGraphicSvg: React.FC<{ index: number; className?: string }> = ({
  index,
  className = 'w-11 h-9',
}) => {
  const variant = index % 4

  if (variant === 0) {
    // Racing Kart Silhouette
    return (
      <svg viewBox="0 0 64 40" fill="none" className={className}>
        <path
          d="M10 28H54M14 24L22 16H36L44 24H52C54 24 56 26 56 28H8C8 25 10 24 14 24Z"
          stroke="#8A99AD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="29" r="5" stroke="#8A99AD" strokeWidth="2" fill="#1C2228" />
        <circle cx="48" cy="29" r="5" stroke="#8A99AD" strokeWidth="2" fill="#1C2228" />
        <circle cx="28" cy="12" r="4" stroke="#8A99AD" strokeWidth="2" />
      </svg>
    )
  }

  if (variant === 1) {
    // Technical Circuit Loop 1
    return (
      <svg viewBox="0 0 64 44" fill="none" className={className}>
        <path
          d="M14 10C14 6 22 6 26 10C30 14 38 12 44 14C50 16 50 24 42 24C34 24 28 22 24 28C20 34 26 38 18 38C12 38 10 32 14 24C16 18 14 14 14 10Z"
          stroke="#8A99AD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (variant === 2) {
    // Technical Hairpin Circuit 2
    return (
      <svg viewBox="0 0 64 44" fill="none" className={className}>
        <path
          d="M12 28C10 22 18 14 26 12C34 10 46 8 48 14C50 20 38 22 36 26C34 30 44 34 38 38C32 40 20 36 12 28Z"
          stroke="#8A99AD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // Euro / World Globe Badge
  return (
    <svg viewBox="0 0 48 44" fill="none" className={className}>
      <circle cx="22" cy="22" r="15" stroke="#8A99AD" strokeWidth="2" />
      <ellipse cx="22" cy="22" rx="7" ry="15" stroke="#8A99AD" strokeWidth="1.5" />
      <path d="M8 17H36M8 27H36" stroke="#8A99AD" strokeWidth="1.5" />
    </svg>
  )
}
