import { useState, useEffect } from 'react'
import { Bell, ArrowLeft } from 'lucide-react'
import { DriverProfile, ProfileModal } from './components/ProfileModal'
import { HELMET_OPTIONS, HelmetSvg } from './components/HelmetIcons'

const STORAGE_KEY = 'krapp_driver_profile_v1'

const DEFAULT_PROFILE: DriverProfile = {
  username: 'USERNAME',
  name: '',
  surname: '',
  weightKg: '',
  bio: '',
  avatarType: 'none',
  helmetId: 'neon-viper',
  customAvatarDataUrl: null,
}

export interface LeagueItem {
  id: string
  name: string
}

const DEFAULT_LEAGUES: LeagueItem[] = [
  { id: 'gazeju-kauss', name: 'GĀZĒJU KAUSS' },
  { id: 'leisu-cup', name: 'LEISU CUP' },
  { id: 'kurzemes-rally', name: 'KURZEMES RALLY' },
  { id: 'euro-cup', name: 'EURO CUP' },
]

export type AppView =
  | 'home'
  | 'history'
  | 'leagues'
  | 'create-league'
  | 'join-league'
  | 'league-detail'
  | 'notifications'

export function App() {
  const [profile, setProfile] = useState<DriverProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE
    } catch {
      return DEFAULT_PROFILE
    }
  })

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('home')
  const [selectedLeague, setSelectedLeague] = useState<LeagueItem | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch (e) {
      console.error('Failed to save profile to localStorage', e)
    }
  }, [profile])

  const selectedHelmet =
    HELMET_OPTIONS.find((h) => h.id === profile.helmetId) || HELMET_OPTIONS[0]

  const hasConfiguredProfile =
    profile.avatarType !== 'none' ||
    Boolean(profile.name || profile.surname || profile.weightKg || profile.bio)

  const handleOpenLeague = (league: LeagueItem) => {
    setSelectedLeague(league)
    setActiveView('league-detail')
  }

  return (
    <div className="min-h-screen w-full bg-[#3a3a3a] text-white flex justify-center">
      {/* Mobile-first container matching the KRAPP wireframes */}
      <main className="w-full max-w-md min-h-screen flex flex-col justify-between px-5 py-6 select-none">
        {activeView === 'home' && (
          <>
            {/* 1. TOP PILL BAR: @USERNAME + NOTIFICATION BELL */}
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide truncate max-w-[68%] hover:opacity-90 transition cursor-pointer"
                title="Tap to edit @username"
              >
                @{profile.username}
              </button>

              <button
                type="button"
                onClick={() => setActiveView('notifications')}
                aria-label="Notifications"
                className="absolute right-4 w-12 h-12 rounded-full bg-[#3a3a3a] flex items-center justify-center hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <Bell className="w-6 h-6 text-[#32cd32]" strokeWidth={2} />
              </button>
            </header>

            {/* 2. CENTRAL AVATAR CIRCLE (Tappable to edit profile) */}
            <section className="my-auto py-6 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="group relative w-64 h-64 sm:w-72 sm:h-72 rounded-full border-[5px] border-black bg-[#3a3a3a] hover:bg-[#404040] active:scale-[0.98] transition-all flex flex-col items-center justify-center overflow-hidden shadow-xl cursor-pointer"
              >
                {profile.avatarType === 'custom' && profile.customAvatarDataUrl ? (
                  <img
                    src={profile.customAvatarDataUrl}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : profile.avatarType === 'helmet' ? (
                  <div className="flex flex-col items-center justify-center p-4">
                    <HelmetSvg helmet={selectedHelmet} className="w-36 h-36" />
                    {(profile.name || profile.surname) && (
                      <span className="mt-2 text-sm font-extrabold tracking-wider text-white uppercase">
                        {profile.name} {profile.surname}
                      </span>
                    )}
                    {profile.weightKg && (
                      <span className="text-xs font-bold text-[#32cd32]">
                        {profile.weightKg} kg
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="px-6 text-center flex flex-col items-center">
                    <span className="text-3xl sm:text-4xl font-extrabold text-black tracking-wide mb-2">
                      AVATAR
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-black/90 leading-snug max-w-[180px]">
                      When pressed, user can edit his profile
                    </p>
                  </div>
                )}

                {hasConfiguredProfile && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider bg-[#222222] text-[#32cd32] px-3 py-1.5 rounded-full border border-[#32cd32]/40">
                      Edit Profile
                    </span>
                  </div>
                )}
              </button>

              {hasConfiguredProfile && profile.bio && (
                <p className="mt-3 text-xs text-neutral-300 text-center max-w-xs italic line-clamp-2">
                  "{profile.bio}"
                </p>
              )}
            </section>

            {/* 3. BOTTOM TWO CARDS: RACE HISTORY & MY LEAGUES */}
            <nav className="grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] h-64 sm:h-72 p-4 flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center">
                  RACE HISTORY
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('leagues')}
                className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] h-64 sm:h-72 p-4 flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center">
                  MY LEAGUES
                </span>
              </button>
            </nav>
          </>
        )}

        {activeView === 'leagues' && (
          <div className="flex flex-col flex-1 w-full">
            {/* TOP PILL HEADER: My LEAGUES */}
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-5">
              <button
                type="button"
                onClick={() => setActiveView('home')}
                aria-label="Back to Home"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide">
                My LEAGUES
              </h1>
            </header>

            {/* ACTION PILL BUTTONS: CREATE LEAGUE + & JOIN LEAGUE */}
            <div className="flex flex-col items-center gap-3.5 px-4 mb-6">
              <button
                type="button"
                onClick={() => setActiveView('create-league')}
                className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.98] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                  CREATE LEAGUE +
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('join-league')}
                className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.98] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                  JOIN LEAGUE
                </span>
              </button>
            </div>

            {/* 2x2 GRID OF LEAGUES */}
            <section className="grid grid-cols-2 gap-4 flex-1">
              {DEFAULT_LEAGUES.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => handleOpenLeague(league)}
                  className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] min-h-[210px] sm:min-h-[240px] p-4 flex items-center justify-center shadow-lg cursor-pointer"
                >
                  <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase text-center leading-snug">
                    {league.name}
                  </span>
                </button>
              ))}
            </section>
          </div>
        )}

        {(activeView === 'create-league' ||
          activeView === 'join-league' ||
          activeView === 'league-detail' ||
          activeView === 'history' ||
          activeView === 'notifications') && (
          <div className="flex flex-col flex-1 w-full">
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-6">
              <button
                type="button"
                onClick={() =>
                  setActiveView(
                    activeView === 'create-league' ||
                      activeView === 'join-league' ||
                      activeView === 'league-detail'
                      ? 'leagues'
                      : 'home'
                  )
                }
                aria-label="Go Back"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase truncate max-w-[70%]">
                {activeView === 'create-league' && 'CREATE LEAGUE +'}
                {activeView === 'join-league' && 'JOIN LEAGUE'}
                {activeView === 'league-detail' && (selectedLeague?.name || 'LEAGUE')}
                {activeView === 'history' && 'RACE HISTORY'}
                {activeView === 'notifications' && 'NOTIFICATIONS'}
              </h1>
            </header>

            <div className="flex-1 bg-[#222222] rounded-[36px] p-6 flex flex-col items-center justify-center text-center shadow-lg">
              <p className="text-[#32cd32] font-extrabold text-lg uppercase mb-2">
                {activeView === 'create-league' && 'Create League Screen'}
                {activeView === 'join-league' && 'Join League Screen'}
                {activeView === 'league-detail' && `${selectedLeague?.name} Hub`}
                {activeView === 'history' && 'Race History View'}
                {activeView === 'notifications' && 'Notifications Center'}
              </p>
              <p className="text-sm text-neutral-400 max-w-xs mb-6">
                Ready for your next mockup & instructions!
              </p>
              <button
                type="button"
                onClick={() =>
                  setActiveView(
                    activeView === 'create-league' ||
                      activeView === 'join-league' ||
                      activeView === 'league-detail'
                      ? 'leagues'
                      : 'home'
                  )
                }
                className="px-6 py-2.5 rounded-full bg-[#32cd32] text-black font-extrabold text-sm hover:bg-[#28b428] transition cursor-pointer"
              >
                {activeView === 'create-league' ||
                activeView === 'join-league' ||
                activeView === 'league-detail'
                  ? 'Back to My Leagues'
                  : 'Back to Homescreen'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Driver Profile Edit Modal */}
      <ProfileModal
        profile={profile}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={setProfile}
      />
    </div>
  )
}

export default App
