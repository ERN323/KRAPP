import { useState, useEffect } from 'react'
import { Bell, ArrowLeft, MoreHorizontal, Check } from 'lucide-react'
import { DriverProfile, ProfileModal } from './components/ProfileModal'
import { HELMET_OPTIONS, HelmetSvg } from './components/HelmetIcons'
import { COUNTRIES, CountryFlagCircle } from './components/CountryFlags'
import {
  League,
  LeagueRole,
  fetchAllLeagues,
  createNewLeague,
  getLocalJoinedIds,
  saveLocalJoinedIds,
  getCurrentUserId,
  getUserRoleInLeague,
} from './lib/leaguesRepo'

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

export type AppView =
  | 'home'
  | 'history'
  | 'leagues'
  | 'create-league'
  | 'join-league'
  | 'join-league-password'
  | 'league-detail'
  | 'league-standing'
  | 'league-races'
  | 'league-hall-of-fame'
  | 'league-options'
  | 'league-setting-action'
  | 'notifications'

export function App() {
  const [currentUserId] = useState<string>(() => getCurrentUserId())

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

  // Leagues state (Supabase + LocalStorage fallback)
  const [allLeagues, setAllLeagues] = useState<League[]>([])
  const [joinedLeagueIds, setJoinedLeagueIds] = useState<string[]>(() =>
    getLocalJoinedIds()
  )
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)
  const [selectedSettingActionTitle, setSelectedSettingActionTitle] = useState('')

  // Optional role preview override on the Settings page so user can test Admin / Team Captain / Racer views easily
  const [rolePreviewOverride, setRolePreviewOverride] = useState<LeagueRole | null>(
    null
  )

  // Create League Form State
  const [createName, setCreateName] = useState('')
  const [createCountry, setCreateCountry] = useState('')
  const [createCountrySearch, setCreateCountrySearch] = useState('')
  const [isCreateCountryOpen, setIsCreateCountryOpen] = useState(false)
  const [createIsPrivate, setCreateIsPrivate] = useState(false)
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')

  // Join League Search State
  const [searchLeagueQuery, setSearchLeagueQuery] = useState('')
  const [searchCountryFilter, setSearchCountryFilter] = useState('')
  const [searchCountryInput, setSearchCountryInput] = useState('')
  const [isSearchCountryOpen, setIsSearchCountryOpen] = useState(false)

  // Private League Password Prompt State
  const [pendingJoinLeague, setPendingJoinLeague] = useState<League | null>(null)
  const [joinPasswordInput, setJoinPasswordInput] = useState('')
  const [joinPasswordError, setJoinPasswordError] = useState('')

  useEffect(() => {
    fetchAllLeagues().then((loaded) => setAllLeagues(loaded))
  }, [])

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

  // Only show leagues the user has created or joined in "My LEAGUES"
  const myLeagues = allLeagues.filter((l) => joinedLeagueIds.includes(l.id))

  // Filtered leagues in "JOIN LEAGUE" search screen
  const filteredSearchLeagues = allLeagues.filter((league) => {
    const matchesName =
      !searchLeagueQuery.trim() ||
      league.name.toLowerCase().includes(searchLeagueQuery.trim().toLowerCase())
    const matchesCountry =
      !searchCountryFilter ||
      league.country.toUpperCase() === searchCountryFilter.toUpperCase()
    return matchesName && matchesCountry
  })

  // Filtered countries for Create League dropdown
  const filteredCreateCountries = COUNTRIES.filter(
    (c) =>
      !createCountrySearch.trim() ||
      c.name.toLowerCase().includes(createCountrySearch.trim().toLowerCase())
  )

  // Filtered countries for Join League dropdown
  const filteredSearchCountries = COUNTRIES.filter(
    (c) =>
      !searchCountryInput.trim() ||
      c.name.toLowerCase().includes(searchCountryInput.trim().toLowerCase())
  )

  const joinLeagueAndOpenHome = (league: League) => {
    if (!joinedLeagueIds.includes(league.id)) {
      const updatedIds = [league.id, ...joinedLeagueIds]
      setJoinedLeagueIds(updatedIds)
      saveLocalJoinedIds(updatedIds)
    }
    setSelectedLeague(league)
    setRolePreviewOverride(null)
    setActiveView('league-detail')
  }

  const handleOpenCreateLeague = () => {
    setCreateName('')
    setCreateCountry('')
    setCreateCountrySearch('')
    setIsCreateCountryOpen(false)
    setCreateIsPrivate(false)
    setCreatePassword('')
    setCreateError('')
    setActiveView('create-league')
  }

  const handleConfirmCreateLeague = async () => {
    if (!createName.trim()) {
      setCreateError('Please enter a league name')
      return
    }
    if (!createCountry.trim()) {
      setCreateError('Please select a country')
      return
    }
    if (createIsPrivate && !createPassword.trim()) {
      setCreateError('Please enter a password for this private league')
      return
    }

    // The league creator automatically becomes the admin
    const created = await createNewLeague({
      name: createName,
      country: createCountry,
      isPrivate: createIsPrivate,
      password: createIsPrivate ? createPassword : undefined,
      creatorUserId: currentUserId,
    })

    setAllLeagues((prev) => [created, ...prev])
    const updatedJoined = [created.id, ...joinedLeagueIds]
    setJoinedLeagueIds(updatedJoined)
    saveLocalJoinedIds(updatedJoined)

    setSelectedLeague(created)
    setRolePreviewOverride(null)
    setActiveView('league-detail')
  }

  const handleSelectLeagueFromSearch = (league: League) => {
    if (!league.isPrivate || joinedLeagueIds.includes(league.id)) {
      joinLeagueAndOpenHome(league)
      return
    }
    setPendingJoinLeague(league)
    setJoinPasswordInput('')
    setJoinPasswordError('')
    setActiveView('join-league-password')
  }

  const handleSubmitJoinPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pendingJoinLeague) return

    if (joinPasswordInput === (pendingJoinLeague.password || '')) {
      joinLeagueAndOpenHome(pendingJoinLeague)
    } else {
      setJoinPasswordError('Incorrect password')
    }
  }

  const handleOpenSettingAction = (actionTitle: string) => {
    setSelectedSettingActionTitle(actionTitle)
    setActiveView('league-setting-action')
  }

  const actualUserRole: LeagueRole = selectedLeague
    ? getUserRoleInLeague(selectedLeague, currentUserId)
    : 'racer'
  const effectiveRole: LeagueRole = rolePreviewOverride || actualUserRole

  return (
    <div className="min-h-screen w-full bg-[#3a3a3a] text-white flex justify-center">
      {/* Mobile-first container matching the KRAPP wireframes */}
      <main className="w-full max-w-md min-h-screen flex flex-col justify-between px-5 py-6 select-none">
        {/* ================= HOMESCREEN ================= */}
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

        {/* ================= MY LEAGUES SCREEN ================= */}
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
                onClick={handleOpenCreateLeague}
                className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.98] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                  CREATE LEAGUE +
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchLeagueQuery('')
                  setSearchCountryFilter('')
                  setSearchCountryInput('')
                  setIsSearchCountryOpen(false)
                  setActiveView('join-league')
                }}
                className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.98] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                  JOIN LEAGUE
                </span>
              </button>
            </div>

            {/* 2x2 GRID OF JOINED LEAGUES */}
            {myLeagues.length > 0 ? (
              <section className="grid grid-cols-2 gap-4 content-start flex-1">
                {myLeagues.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => {
                      setSelectedLeague(league)
                      setRolePreviewOverride(null)
                      setActiveView('league-detail')
                    }}
                    className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] min-h-[210px] sm:min-h-[240px] p-4 flex flex-col items-center justify-center shadow-lg cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase text-center leading-snug">
                      {league.name}
                    </span>
                  </button>
                ))}
              </section>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 opacity-60">
                <p className="text-[#32cd32] font-bold text-sm uppercase tracking-wider mb-1">
                  No joined leagues yet
                </p>
                <p className="text-xs text-neutral-300">
                  Press CREATE LEAGUE + or JOIN LEAGUE above to get started.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= CREATE LEAGUE SCREEN ================= */}
        {activeView === 'create-league' && (
          <div className="flex flex-col flex-1 w-full justify-between">
            <div className="flex flex-col items-center w-full">
              {/* Top Pill: CREATE LEAGUE + */}
              <div className="w-[85%] bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md mb-5">
                <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                  CREATE LEAGUE +
                </span>
              </div>

              {/* Large Pill Input: LEAGUE NAME */}
              <div className="w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-5">
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value)
                    setCreateError('')
                  }}
                  placeholder="LEAGUE NAME"
                  className="w-full bg-transparent text-center text-[#32cd32] placeholder-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase focus:outline-none"
                />
              </div>

              {/* Pill Dropdown: COUNTRY (All 195+ countries with quick filter) */}
              <div className="relative w-[85%] mb-4">
                <button
                  type="button"
                  onClick={() => setIsCreateCountryOpen((prev) => !prev)}
                  className="w-full bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                >
                  <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase truncate">
                    {createCountry || 'COUNTRY'}
                  </span>
                </button>

                {isCreateCountryOpen && (
                  <div className="absolute left-2 right-2 top-13 z-30 border-2 border-neutral-400 rounded-md overflow-hidden shadow-2xl bg-[#777777]">
                    <div className="bg-[#222222] px-3 py-2 border-b border-neutral-400">
                      <input
                        type="text"
                        value={createCountrySearch}
                        onChange={(e) => setCreateCountrySearch(e.target.value)}
                        placeholder="Type country name..."
                        autoFocus
                        className="w-full bg-transparent text-xs font-extrabold text-[#32cd32] placeholder-neutral-500 uppercase focus:outline-none"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredCreateCountries.map((c) => {
                        const isSelected = createCountry === c.name
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCreateCountry(c.name)
                              setIsCreateCountryOpen(false)
                              setCreateError('')
                            }}
                            className={`w-full px-4 py-2.5 text-left font-extrabold text-sm sm:text-base tracking-wide uppercase border-b border-neutral-400 last:border-b-0 transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#222222] text-[#32cd32]'
                                : 'bg-[#777777] hover:bg-[#666666] text-[#32cd32]'
                            }`}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pill Toggle: Private LEAGUE + Checkbox */}
              <button
                type="button"
                onClick={() => {
                  setCreateIsPrivate((prev) => !prev)
                  setCreateError('')
                }}
                className="relative w-[85%] bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md mb-5 cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide">
                  Private LEAGUE
                </span>
                <span className="absolute right-5 w-6 h-6 rounded border-2 border-[#32cd32] flex items-center justify-center">
                  {createIsPrivate && (
                    <Check className="w-4 h-4 text-[#32cd32]" strokeWidth={3.5} />
                  )}
                </span>
              </button>

              {/* Conditional Pill Input: Password (only visible when Private LEAGUE is checked) */}
              {createIsPrivate && (
                <div className="w-[85%] bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md mb-4">
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => {
                      setCreatePassword(e.target.value)
                      setCreateError('')
                    }}
                    placeholder="Password"
                    className="w-full bg-transparent text-center text-[#32cd32] placeholder-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide focus:outline-none"
                  />
                </div>
              )}

              {createError && (
                <p className="text-xs font-bold text-red-400 mt-1 text-center">
                  {createError}
                </p>
              )}
            </div>

            {/* Bottom Two Cards: CANCEL & CONFIRM */}
            <div className="grid grid-cols-2 gap-4 w-full mt-auto pt-6">
              <button
                type="button"
                onClick={() => setActiveView('leagues')}
                className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] h-64 sm:h-72 p-4 flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center">
                  CANCEL
                </span>
              </button>

              <button
                type="button"
                onClick={handleConfirmCreateLeague}
                className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] h-64 sm:h-72 p-4 flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center">
                  CONFIRM
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================= JOIN LEAGUE (SEARCH) SCREEN ================= */}
        {activeView === 'join-league' && (
          <div className="flex flex-col flex-1 w-full">
            {/* Top Header Pill: JOIN LEAGUE */}
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-4">
              <button
                type="button"
                onClick={() => setActiveView('leagues')}
                aria-label="Back to My Leagues"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase">
                JOIN LEAGUE
              </h1>
            </header>

            {/* Search Inputs: SEARCH LEAGUE & SEARCH COUNTRY */}
            <div className="flex flex-col items-center gap-3 px-4 mb-6">
              {/* SEARCH LEAGUE by Name */}
              <div className="w-full bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md">
                <input
                  type="text"
                  value={searchLeagueQuery}
                  onChange={(e) => setSearchLeagueQuery(e.target.value)}
                  placeholder="SEARCH LEAGUE"
                  className="w-full bg-transparent text-center text-[#32cd32] placeholder-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase focus:outline-none"
                />
              </div>

              {/* SEARCH COUNTRY Dropdown (All 195+ countries) */}
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsSearchCountryOpen((prev) => !prev)}
                  className="w-full bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                >
                  <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase truncate">
                    {searchCountryFilter || 'SEARCH COUNTRY'}
                  </span>
                </button>

                {isSearchCountryOpen && (
                  <div className="absolute left-2 right-2 top-13 z-30 border-2 border-neutral-400 rounded-md overflow-hidden shadow-2xl bg-[#777777]">
                    <div className="bg-[#222222] px-3 py-2 border-b border-neutral-400">
                      <input
                        type="text"
                        value={searchCountryInput}
                        onChange={(e) => setSearchCountryInput(e.target.value)}
                        placeholder="Type country name..."
                        autoFocus
                        className="w-full bg-transparent text-xs font-extrabold text-[#32cd32] placeholder-neutral-500 uppercase focus:outline-none"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {searchCountryFilter && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchCountryFilter('')
                            setIsSearchCountryOpen(false)
                          }}
                          className="w-full px-4 py-2 text-left font-extrabold text-xs tracking-wide uppercase bg-[#222222] text-neutral-300 border-b border-neutral-400 cursor-pointer"
                        >
                          ALL COUNTRIES
                        </button>
                      )}
                      {filteredSearchCountries.map((c, idx) => {
                        const isSelected =
                          searchCountryFilter === c.name ||
                          (!searchCountryFilter && idx === 0)
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setSearchCountryFilter(c.name)
                              setIsSearchCountryOpen(false)
                            }}
                            className={`w-full px-4 py-2.5 text-left font-extrabold text-sm sm:text-base tracking-wide uppercase border-b border-neutral-400 last:border-b-0 transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#222222] text-[#32cd32]'
                                : 'bg-[#777777] hover:bg-[#666666] text-[#32cd32]'
                            }`}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2x2 Grid of Search Results */}
            {filteredSearchLeagues.length > 0 ? (
              <section className="grid grid-cols-2 gap-4 content-start flex-1">
                {filteredSearchLeagues.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => handleSelectLeagueFromSearch(league)}
                    className="bg-[#222222] hover:bg-[#272727] active:scale-[0.98] transition-all rounded-[36px] min-h-[220px] sm:min-h-[245px] p-4 flex flex-col items-center justify-center shadow-lg cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase text-center leading-snug mt-4">
                      {league.name}
                    </span>

                    <div className="mt-3 flex flex-col items-center">
                      <span className="text-neutral-400 text-xs sm:text-sm font-medium leading-tight">
                        {league.isPrivate ? 'Private' : 'Public'}
                      </span>
                      <span className="text-neutral-400 text-xs sm:text-sm font-medium uppercase leading-tight">
                        LEAGUE
                      </span>
                    </div>

                    <div className="mt-2">
                      <CountryFlagCircle country={league.country} className="w-7 h-7" />
                    </div>
                  </button>
                ))}
              </section>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 opacity-60">
                <p className="text-[#32cd32] font-bold text-sm uppercase tracking-wider mb-1">
                  No leagues found
                </p>
                <p className="text-xs text-neutral-300">
                  Create a new league first or adjust your search filters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= PRIVATE LEAGUE PASSWORD PROMPT SCREEN ================= */}
        {activeView === 'join-league-password' && pendingJoinLeague && (
          <div className="flex flex-col flex-1 w-full items-center">
            {/* Top Header Pill: League Name */}
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-5">
              <button
                type="button"
                onClick={() => setActiveView('join-league')}
                aria-label="Back to Join League"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase truncate max-w-[70%]">
                {pendingJoinLeague.name}
              </h1>
            </header>

            {/* Country Pill */}
            <div className="w-[82%] bg-[#222222] rounded-full h-12 px-6 flex items-center justify-center shadow-md mb-16">
              <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                {pendingJoinLeague.country}
              </span>
            </div>

            {/* Password Input Pill */}
            <form onSubmit={handleSubmitJoinPassword} className="w-full flex flex-col items-center">
              <div className="w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg">
                <input
                  type="password"
                  value={joinPasswordInput}
                  onChange={(e) => {
                    setJoinPasswordInput(e.target.value)
                    setJoinPasswordError('')
                  }}
                  placeholder="PASSWORD"
                  autoFocus
                  className="w-full bg-transparent text-center text-[#32cd32] placeholder-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide focus:outline-none"
                />
              </div>

              {joinPasswordError && (
                <p className="text-xs font-bold text-red-400 mt-3">
                  {joinPasswordError}
                </p>
              )}

              {joinPasswordInput.trim().length > 0 && (
                <button
                  type="submit"
                  className="mt-6 px-8 py-3 rounded-full bg-[#222222] border border-[#32cd32]/50 text-[#32cd32] font-extrabold text-sm uppercase tracking-wider hover:bg-[#2a2a2a] transition cursor-pointer"
                >
                  ENTER LEAGUE
                </button>
              )}
            </form>
          </div>
        )}

        {/* ================= LEAGUE HOME PAGE SCREEN ================= */}
        {activeView === 'league-detail' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            {/* TOP PILL HEADER: LEAGUE NAME + HOME PAGE SUBTITLE + (...) MENU BUTTON */}
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-6">
              <button
                type="button"
                onClick={() => setActiveView('leagues')}
                aria-label="Back to My Leagues"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center justify-center text-center max-w-[60%]">
                <h1 className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase truncate w-full">
                  {selectedLeague.name}
                </h1>
                <span className="text-[#32cd32] font-extrabold text-[10px] sm:text-xs tracking-wider uppercase leading-none mt-0.5">
                  HOME PAGE
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveView('league-options')}
                aria-label="League Settings"
                className="absolute right-4 w-12 h-12 rounded-full bg-[#3a3a3a] flex items-center justify-center hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <MoreHorizontal className="w-6 h-6 text-[#32cd32]" strokeWidth={2.5} />
              </button>
            </header>

            {/* 3 STACKED LARGE CARDS: STANDING, RACES, HISTORY (HALL OF FAME) */}
            <div className="flex flex-col gap-5 flex-1 justify-between">
              <button
                type="button"
                onClick={() => setActiveView('league-standing')}
                className="w-full flex-1 min-h-[165px] bg-[#222222] hover:bg-[#272727] active:scale-[0.99] transition-all rounded-[36px] p-6 flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center">
                  STANDING
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('league-races')}
                className="w-full flex-1 min-h-[165px] bg-[#222222] hover:bg-[#272727] active:scale-[0.99] transition-all rounded-[36px] p-6 flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center">
                  RACES
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('league-hall-of-fame')}
                className="w-full flex-1 min-h-[165px] bg-[#222222] hover:bg-[#272727] active:scale-[0.99] transition-all rounded-[36px] p-6 flex flex-col items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center leading-snug">
                  HISTORY
                </span>
                <span className="text-[#32cd32] font-extrabold text-lg sm:text-xl tracking-wide uppercase text-center leading-snug">
                  (HALL OF FAME)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================= LEAGUE SETTINGS SCREEN ================= */}
        {activeView === 'league-options' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            {/* TOP PILL HEADER: LEAGUE NAME + SETTINGS */}
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-4">
              <button
                type="button"
                onClick={() => setActiveView('league-detail')}
                aria-label="Back to League Home Page"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center justify-center text-center max-w-[70%]">
                <h1 className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase truncate w-full leading-tight">
                  {selectedLeague.name}
                </h1>
                <span className="text-[#32cd32] font-extrabold text-sm sm:text-base tracking-wide uppercase leading-tight">
                  SETTINGS
                </span>
              </div>
            </header>

            <div className="flex flex-col gap-5 flex-1 justify-start">
              {/* 1. ONLY ADMINS BOX — Visible only when user is Admin */}
              {effectiveRole === 'admin' && (
                <section className="w-full rounded-[38px] border-[3.5px] border-black px-5 pt-2.5 pb-5 flex flex-col items-center gap-3.5">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-black">
                    ONLY ADMINS
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('UPLOAD RACE RESULTS')}
                    className="w-full bg-[#32cd32] hover:bg-[#2dc02d] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-[#1a1a1a] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      UPLOAD RACE RESULTS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('ASSIGN ROLES')}
                    className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      ASSIGN ROLES
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('MANAGE RACERS')}
                    className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      MANAGE RACERS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('SCHEDULE RACE')}
                    className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      SCHEDULE RACE
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('DELETE LEAGUE')}
                    className="w-full bg-[#c92a2a] hover:bg-[#b52525] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-black font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      DELETE LEAGUE
                    </span>
                  </button>
                </section>
              )}

              {/* 2. ONLY TEAM CAPTAINS BOX — Visible to Admins & Team Captains */}
              {(effectiveRole === 'admin' || effectiveRole === 'team_captain') && (
                <section className="w-full rounded-[38px] border-[3.5px] border-black px-5 pt-2.5 pb-5 flex flex-col items-center gap-3.5">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-black">
                    ONLY TEAM CAPTAINS
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('INVITE RACERS')}
                    className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      INVITE RACERS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('CREATE TEAM')}
                    className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      CREATE TEAM
                    </span>
                  </button>
                </section>
              )}

              {/* 3. ONLY RACERS BOX — Visible to Admins, Team Captains, and Racers */}
              <section className="w-full rounded-[38px] border-[3.5px] border-black px-5 pt-2.5 pb-5 flex flex-col items-center gap-3.5">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-black">
                  ONLY RACERS
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenSettingAction('REQUEST TO JOIN TEAM')}
                  className="w-full bg-[#222222] hover:bg-[#282828] active:scale-[0.99] transition-all rounded-full h-12 px-6 flex items-center justify-center shadow-md cursor-pointer"
                >
                  <span className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase">
                    REQUEST TO JOIN TEAM
                  </span>
                </button>
              </section>
            </div>

            {/* Subtle Role Preview Bar at the very bottom for testing what each role sees */}
            <div className="mt-5 pt-2 border-t border-black/20 flex items-center justify-between text-[10px] text-neutral-400">
              <span>
                Your Role: <strong className="text-[#32cd32] uppercase">{actualUserRole.replace('_', ' ')}</strong>
              </span>
              <div className="flex items-center gap-1">
                <span>Preview as:</span>
                {(['admin', 'team_captain', 'racer'] as LeagueRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setRolePreviewOverride(r === actualUserRole ? null : r)
                    }
                    className={`px-2 py-0.5 rounded-full uppercase font-bold cursor-pointer transition ${
                      effectiveRole === r
                        ? 'bg-[#222222] text-[#32cd32] border border-[#32cd32]/40'
                        : 'bg-black/20 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {r === 'team_captain' ? 'Captain' : r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= PLACEHOLDER SUB-VIEWS ================= */}
        {(activeView === 'league-standing' ||
          activeView === 'league-races' ||
          activeView === 'league-hall-of-fame' ||
          activeView === 'league-setting-action' ||
          activeView === 'history' ||
          activeView === 'notifications') && (
          <div className="flex flex-col flex-1 w-full">
            <header className="relative w-full bg-[#222222] rounded-full h-20 px-6 flex items-center justify-center shadow-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  if (activeView === 'league-setting-action') {
                    setActiveView('league-options')
                  } else if (
                    activeView === 'league-standing' ||
                    activeView === 'league-races' ||
                    activeView === 'league-hall-of-fame'
                  ) {
                    setActiveView('league-detail')
                  } else {
                    setActiveView('home')
                  }
                }}
                aria-label="Go Back"
                className="absolute left-4 w-11 h-11 rounded-full bg-[#3a3a3a] flex items-center justify-center text-[#32cd32] hover:bg-[#484848] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center justify-center text-center max-w-[70%]">
                <h1 className="text-[#32cd32] font-extrabold text-base sm:text-lg tracking-wide uppercase truncate w-full">
                  {activeView === 'league-standing' && 'STANDING'}
                  {activeView === 'league-races' && 'RACES'}
                  {activeView === 'league-hall-of-fame' && 'HISTORY (HALL OF FAME)'}
                  {activeView === 'league-setting-action' && selectedSettingActionTitle}
                  {activeView === 'history' && 'RACE HISTORY'}
                  {activeView === 'notifications' && 'NOTIFICATIONS'}
                </h1>
                {selectedLeague &&
                  (activeView === 'league-standing' ||
                    activeView === 'league-races' ||
                    activeView === 'league-hall-of-fame' ||
                    activeView === 'league-setting-action') && (
                    <span className="text-[#32cd32] font-extrabold text-[10px] sm:text-xs tracking-wider uppercase leading-none mt-0.5">
                      {selectedLeague.name}
                    </span>
                  )}
              </div>
            </header>

            <div className="flex-1 bg-[#222222] rounded-[36px] p-6 flex flex-col items-center justify-center text-center shadow-lg">
              <p className="text-[#32cd32] font-extrabold text-lg uppercase mb-2">
                {activeView === 'league-standing' && `${selectedLeague?.name} — Standings`}
                {activeView === 'league-races' && `${selectedLeague?.name} — Races & Schedules`}
                {activeView === 'league-hall-of-fame' && `${selectedLeague?.name} — Hall of Fame`}
                {activeView === 'league-setting-action' && selectedSettingActionTitle}
                {activeView === 'history' && 'Race History View'}
                {activeView === 'notifications' && 'Notifications Center'}
              </p>
              <p className="text-sm text-neutral-400 max-w-xs mb-6">
                Ready for your next mockup & instructions!
              </p>
              <button
                type="button"
                onClick={() => {
                  if (activeView === 'league-setting-action') {
                    setActiveView('league-options')
                  } else if (
                    activeView === 'league-standing' ||
                    activeView === 'league-races' ||
                    activeView === 'league-hall-of-fame'
                  ) {
                    setActiveView('league-detail')
                  } else {
                    setActiveView('home')
                  }
                }}
                className="px-6 py-2.5 rounded-full bg-[#32cd32] text-black font-extrabold text-sm hover:bg-[#28b428] transition cursor-pointer"
              >
                {activeView === 'league-setting-action'
                  ? 'Back to League Settings'
                  : activeView === 'league-standing' ||
                      activeView === 'league-races' ||
                      activeView === 'league-hall-of-fame'
                    ? `Back to ${selectedLeague?.name}`
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
