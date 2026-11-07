import { useState, useEffect } from 'react'
import {
  Check,
  Trophy,
  Flag,
  Medal,
  Lock,
  Globe,
  Upload,
  UserCog,
  Users,
  CalendarPlus,
  Trash2,
  UserPlus,
  ShieldPlus,
  Send,
  ChevronDown,
  Search,
} from 'lucide-react'
import { DriverProfile, ProfileModal } from './components/ProfileModal'
import { HELMET_OPTIONS, HelmetSvg } from './components/HelmetIcons'
import { COUNTRIES, CountryFlagCircle } from './components/CountryFlags'
import { TrackDayHeader, CardGraphicSvg } from './components/TrackDayTheme'
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

  // Role preview override on the Settings page so user can test Admin / Team Captain / Racer views easily
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

  // Only show leagues the user has created or joined in "MY LEAGUES"
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

  // Reusable Track Day Pro League Card component
  const renderLeagueCard = (
    league: League,
    idx: number,
    onClick: () => void,
    showAccessBadge = false
  ) => {
    const isCyanAccent = idx % 4 === 3
    const accentColorClass = isCyanAccent ? 'text-[#38BDF8]' : 'text-[#FF6B00]'
    const userRoleInCard = getUserRoleInLeague(league, currentUserId)

    return (
      <button
        key={league.id}
        type="button"
        onClick={onClick}
        className="group bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00]/60 active:scale-[0.98] transition-all rounded-2xl p-3.5 flex flex-col justify-between text-left shadow-lg cursor-pointer"
      >
        {/* Top Row: Circuit/Kart Icon + Trend Arrows */}
        <div className="w-full flex items-start justify-between mb-2">
          <CardGraphicSvg index={idx} className="w-11 h-8" />
          <div className="flex items-center gap-1.5">
            {showAccessBadge && (
              <CountryFlagCircle country={league.country} className="w-5 h-5" />
            )}
            <span className="text-xs font-extrabold tracking-tighter">
              <span className="text-[#8A99AD]">↑</span>
              <span className={accentColorClass}>↓</span>
            </span>
          </div>
        </div>

        {/* League Title */}
        <h3 className="font-display font-extrabold text-xl leading-[1.05] tracking-wide text-white uppercase line-clamp-2 my-1">
          {league.name}
        </h3>

        {/* Middle Two-Column Telemetry Stats */}
        <div className="w-full grid grid-cols-2 gap-2 pt-2 mt-1 border-t border-[#2A323B]">
          <div>
            <span className="block text-[10px] text-[#8A99AD] leading-tight">
              {showAccessBadge ? 'Access' : 'Statistics'}
            </span>
            <span className="text-xs font-bold text-white">
              {showAccessBadge
                ? league.isPrivate
                  ? 'Private'
                  : 'Public'
                : '0 races'}
            </span>
          </div>
          <div className="border-l border-[#2A323B] pl-2">
            <span className="block text-[10px] text-[#8A99AD] leading-tight">
              Country
            </span>
            <span className={`text-xs font-extrabold uppercase truncate block ${accentColorClass}`}>
              {league.country}
            </span>
          </div>
        </div>

        {/* Bottom Row: Role / Status Badge + Mini Circuit */}
        <div className="w-full flex items-center justify-between pt-2 mt-2 border-t border-[#2A323B]/60">
          <div>
            <span className="block text-[10px] text-[#8A99AD] leading-tight">
              {showAccessBadge ? 'Status:' : 'Role:'}
            </span>
            <span className={`text-xs font-extrabold uppercase ${accentColorClass}`}>
              {showAccessBadge
                ? league.isPrivate
                  ? 'Locked'
                  : 'Open'
                : userRoleInCard === 'admin'
                  ? 'Admin'
                  : userRoleInCard === 'team_captain'
                    ? 'Captain'
                    : 'Racer'}
            </span>
          </div>
          {showAccessBadge ? (
            league.isPrivate ? (
              <Lock className="w-4 h-4 text-[#FF6B00]" />
            ) : (
              <Globe className="w-4 h-4 text-[#38BDF8]" />
            )
          ) : (
            <CountryFlagCircle country={league.country} className="w-5 h-5" />
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#0d1114] text-white flex justify-center">
      {/* Mobile-first Track Day Pro frame */}
      <main className="w-full max-w-md min-h-screen bg-[#14191E] border-x border-[#222A32] flex flex-col justify-between pb-6 select-none shadow-2xl">
        {/* ================= 1. HOMESCREEN ================= */}
        {activeView === 'home' && (
          <div className="flex flex-col flex-1 justify-between">
            <TrackDayHeader
              sectionTitle={`@${profile.username}`}
              sectionSubtitle="DRIVER DASHBOARD"
              onMenuClick={() => setIsProfileModalOpen(true)}
              onBellClick={() => setActiveView('notifications')}
            />

            {/* CENTRAL AVATAR MODULE (Tappable to edit profile) */}
            <section className="my-auto px-5 py-4 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="group relative w-60 h-60 sm:w-64 sm:h-64 rounded-full p-1.5 bg-gradient-to-b from-[#FF6B00] via-[#2A323B] to-[#38BDF8] active:scale-[0.98] transition-all shadow-2xl shadow-black/80 cursor-pointer"
              >
                <div className="w-full h-full rounded-full bg-[#1C2228] flex flex-col items-center justify-center overflow-hidden relative">
                  {profile.avatarType === 'custom' && profile.customAvatarDataUrl ? (
                    <img
                      src={profile.customAvatarDataUrl}
                      alt={profile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : profile.avatarType === 'helmet' ? (
                    <div className="flex flex-col items-center justify-center p-4">
                      <HelmetSvg helmet={selectedHelmet} className="w-32 h-32" />
                      {(profile.name || profile.surname) && (
                        <span className="mt-2 font-display text-lg font-extrabold tracking-wider text-white uppercase">
                          {profile.name} {profile.surname}
                        </span>
                      )}
                      {profile.weightKg && (
                        <span className="text-xs font-extrabold text-[#FF6B00] uppercase">
                          {profile.weightKg} KG
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="px-6 text-center flex flex-col items-center">
                      <HelmetSvg helmet={selectedHelmet} className="w-24 h-24 opacity-85 mb-2" />
                      <span className="font-display text-2xl font-extrabold text-white tracking-wider">
                        DRIVER AVATAR
                      </span>
                      <p className="text-[11px] font-semibold text-[#8A99AD] leading-snug max-w-[170px] mt-1">
                        Tap to edit profile, weight & helmet
                      </p>
                    </div>
                  )}

                  {/* Hover/tap edit badge */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider bg-[#FF6B00] text-black px-4 py-1.5 rounded-full shadow-lg">
                      Edit Driver Profile
                    </span>
                  </div>
                </div>
              </button>

              {/* Driver Telemetry Bar under Avatar */}
              <div className="mt-4 flex items-center gap-3 bg-[#1C2228] border border-[#2A323B] rounded-full px-4 py-1.5">
                <span className="text-[11px] text-[#8A99AD] font-semibold uppercase">
                  Driver:{' '}
                  <strong className="text-white">
                    {profile.name || profile.surname
                      ? `${profile.name} ${profile.surname}`.trim()
                      : `@${profile.username}`}
                  </strong>
                </span>
                <span className="text-[#2A323B]">|</span>
                <span className="text-[11px] text-[#8A99AD] font-semibold uppercase">
                  Weight:{' '}
                  <strong className="text-[#FF6B00]">
                    {profile.weightKg ? `${profile.weightKg} kg` : '-- kg'}
                  </strong>
                </span>
              </div>

              {hasConfiguredProfile && profile.bio && (
                <p className="mt-2 text-xs text-[#8A99AD] text-center max-w-xs italic line-clamp-2">
                  "{profile.bio}"
                </p>
              )}
            </section>

            {/* BOTTOM TWO TELEMETRY CARDS: RACE HISTORY & MY LEAGUES */}
            <nav className="grid grid-cols-2 gap-3.5 px-5 w-full">
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className="bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#38BDF8]/60 active:scale-[0.98] transition-all rounded-2xl h-48 p-4 flex flex-col justify-between text-left shadow-lg cursor-pointer"
              >
                <div className="w-full flex items-center justify-between">
                  <CardGraphicSvg index={1} className="w-10 h-8" />
                  <span className="text-xs font-extrabold text-[#38BDF8]">↑↓</span>
                </div>
                <div>
                  <span className="font-display font-extrabold text-2xl tracking-wide text-white uppercase block leading-none">
                    RACE
                  </span>
                  <span className="font-display font-extrabold text-2xl tracking-wide text-[#38BDF8] uppercase block leading-tight">
                    HISTORY
                  </span>
                </div>
                <div className="pt-2 border-t border-[#2A323B] flex items-center justify-between text-[11px]">
                  <span className="text-[#8A99AD]">Telemetry</span>
                  <span className="font-bold text-white">Logs & CSV</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('leagues')}
                className="bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00]/60 active:scale-[0.98] transition-all rounded-2xl h-48 p-4 flex flex-col justify-between text-left shadow-lg cursor-pointer"
              >
                <div className="w-full flex items-center justify-between">
                  <CardGraphicSvg index={0} className="w-10 h-8" />
                  <span className="text-xs font-extrabold text-[#FF6B00]">↑↓</span>
                </div>
                <div>
                  <span className="font-display font-extrabold text-2xl tracking-wide text-white uppercase block leading-none">
                    MY
                  </span>
                  <span className="font-display font-extrabold text-2xl tracking-wide text-[#FF6B00] uppercase block leading-tight">
                    LEAGUES
                  </span>
                </div>
                <div className="pt-2 border-t border-[#2A323B] flex items-center justify-between text-[11px]">
                  <span className="text-[#8A99AD]">Joined</span>
                  <span className="font-bold text-[#FF6B00]">
                    {myLeagues.length} {myLeagues.length === 1 ? 'League' : 'Leagues'}
                  </span>
                </div>
              </button>
            </nav>
          </div>
        )}

        {/* ================= 2. MY LEAGUES SCREEN (Exact Reference Match) ================= */}
        {activeView === 'leagues' && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle="MY LEAGUES"
              onBack={() => setActiveView('home')}
              onBellClick={() => setActiveView('notifications')}
            />

            {/* ACTION PILL BUTTONS: Orange CREATE LEAGUE + & Outlined JOIN LEAGUE */}
            <div className="flex flex-col items-center gap-3 px-8 mb-6">
              <button
                type="button"
                onClick={handleOpenCreateLeague}
                className="w-full bg-[#FF6B00] hover:bg-[#ff7b1a] active:scale-[0.98] transition-all rounded-full h-11 px-6 flex items-center justify-center shadow-lg shadow-[#FF6B00]/20 cursor-pointer"
              >
                <span className="font-display font-extrabold text-base tracking-wider text-black uppercase">
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
                className="w-full bg-transparent hover:bg-white/5 active:scale-[0.98] transition-all rounded-full h-11 px-6 border-[1.5px] border-white/80 flex items-center justify-center cursor-pointer"
              >
                <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                  JOIN LEAGUE
                </span>
              </button>
            </div>

            {/* 2x2 GRID OF JOINED LEAGUES */}
            {myLeagues.length > 0 ? (
              <section className="grid grid-cols-2 gap-3.5 px-5 content-start flex-1">
                {myLeagues.map((league, idx) =>
                  renderLeagueCard(league, idx, () => {
                    setSelectedLeague(league)
                    setRolePreviewOverride(null)
                    setActiveView('league-detail')
                  })
                )}
              </section>
            ) : (
              <div className="flex-1 mx-5 bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <CardGraphicSvg index={0} className="w-14 h-10 mb-3 opacity-60" />
                <p className="font-display font-extrabold text-lg text-white uppercase tracking-wider mb-1">
                  NO JOINED LEAGUES YET
                </p>
                <p className="text-xs text-[#8A99AD] max-w-xs">
                  Tap <strong className="text-[#FF6B00]">CREATE LEAGUE +</strong> or{' '}
                  <strong className="text-white">JOIN LEAGUE</strong> above to start racing.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= 3. CREATE LEAGUE SCREEN ================= */}
        {activeView === 'create-league' && (
          <div className="flex flex-col flex-1 w-full justify-between">
            <div className="flex flex-col w-full">
              <TrackDayHeader
                sectionTitle="CREATE LEAGUE +"
                onBack={() => setActiveView('leagues')}
                onBellClick={() => setActiveView('notifications')}
              />

              <div className="px-5 flex flex-col gap-4 mt-2">
                {/* League Name Card Input */}
                <div className="bg-[#1C2228] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-2xl p-3.5 transition">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1">
                    League Name
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => {
                      setCreateName(e.target.value)
                      setCreateError('')
                    }}
                    placeholder="E.G. GĀZĒJU KAUSS"
                    className="w-full bg-transparent font-display font-extrabold text-xl tracking-wider text-white placeholder-[#8A99AD]/40 uppercase focus:outline-none"
                  />
                </div>

                {/* Country Dropdown (All 195+ countries) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCreateCountryOpen((prev) => !prev)}
                    className="w-full bg-[#1C2228] border border-[#2A323B] hover:border-[#FF6B00]/60 rounded-2xl p-3.5 flex items-center justify-between text-left transition cursor-pointer"
                  >
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8A99AD] mb-0.5">
                        Country
                      </span>
                      <span className="font-display font-extrabold text-lg tracking-wider text-white uppercase">
                        {createCountry || 'SELECT COUNTRY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {createCountry && (
                        <CountryFlagCircle country={createCountry} className="w-6 h-6" />
                      )}
                      <ChevronDown className="w-5 h-5 text-[#FF6B00]" />
                    </div>
                  </button>

                  {isCreateCountryOpen && (
                    <div className="absolute left-0 right-0 top-[76px] z-30 bg-[#1C2228] border border-[#FF6B00] rounded-2xl overflow-hidden shadow-2xl">
                      <div className="bg-[#14191E] px-3.5 py-2.5 border-b border-[#2A323B] flex items-center gap-2">
                        <Search className="w-4 h-4 text-[#FF6B00]" />
                        <input
                          type="text"
                          value={createCountrySearch}
                          onChange={(e) => setCreateCountrySearch(e.target.value)}
                          placeholder="Search all countries..."
                          autoFocus
                          className="w-full bg-transparent text-xs font-bold text-white placeholder-[#8A99AD] uppercase focus:outline-none"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-[#2A323B]">
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
                              className={`w-full px-4 py-2.5 flex items-center justify-between text-left font-display font-bold text-base tracking-wider uppercase transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#FF6B00] text-black'
                                  : 'bg-[#1C2228] hover:bg-[#252D35] text-white'
                              }`}
                            >
                              <span>{c.name}</span>
                              <CountryFlagCircle country={c.name} className="w-5 h-5" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Private League Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setCreateIsPrivate((prev) => !prev)
                    setCreateError('')
                  }}
                  className="w-full bg-[#1C2228] border border-[#2A323B] hover:border-[#FF6B00]/60 rounded-2xl p-3.5 flex items-center justify-between transition cursor-pointer"
                >
                  <div className="text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8A99AD] mb-0.5">
                      Access Control
                    </span>
                    <span className="font-display font-extrabold text-lg tracking-wider text-white uppercase">
                      PRIVATE LEAGUE
                    </span>
                  </div>
                  <span
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${
                      createIsPrivate
                        ? 'bg-[#FF6B00] border-[#FF6B00] text-black'
                        : 'border-[#8A99AD] bg-transparent'
                    }`}
                  >
                    {createIsPrivate && <Check className="w-4 h-4 stroke-[3.5]" />}
                  </span>
                </button>

                {/* Conditional Password Input when Private League is checked */}
                {createIsPrivate && (
                  <div className="bg-[#1C2228] border border-[#FF6B00]/60 rounded-2xl p-3.5 transition">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#FF6B00] mb-1">
                      League Password
                    </label>
                    <input
                      type="password"
                      value={createPassword}
                      onChange={(e) => {
                        setCreatePassword(e.target.value)
                        setCreateError('')
                      }}
                      placeholder="ENTER SECRET PASSWORD"
                      className="w-full bg-transparent font-display font-extrabold text-lg tracking-wider text-white placeholder-[#8A99AD]/40 focus:outline-none"
                    />
                  </div>
                )}

                {createError && (
                  <p className="text-xs font-bold text-red-400 text-center">
                    {createError}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Two Action Cards: CANCEL & CONFIRM */}
            <div className="grid grid-cols-2 gap-3.5 px-5 w-full mt-auto pt-6">
              <button
                type="button"
                onClick={() => setActiveView('leagues')}
                className="bg-[#1C2228] hover:bg-[#252D35] border-[1.5px] border-white/80 active:scale-[0.98] transition-all rounded-2xl h-36 p-4 flex flex-col items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="font-display font-extrabold text-2xl tracking-wider text-white uppercase">
                  CANCEL
                </span>
                <span className="text-[10px] text-[#8A99AD] uppercase mt-1">
                  Discard changes
                </span>
              </button>

              <button
                type="button"
                onClick={handleConfirmCreateLeague}
                className="bg-[#FF6B00] hover:bg-[#ff7b1a] active:scale-[0.98] transition-all rounded-2xl h-36 p-4 flex flex-col items-center justify-center shadow-lg shadow-[#FF6B00]/20 cursor-pointer"
              >
                <span className="font-display font-extrabold text-2xl tracking-wider text-black uppercase">
                  CONFIRM
                </span>
                <span className="text-[10px] text-black/80 font-bold uppercase mt-1">
                  Create & Open
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 4. JOIN LEAGUE (SEARCH) SCREEN ================= */}
        {activeView === 'join-league' && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle="JOIN LEAGUE"
              onBack={() => setActiveView('leagues')}
              onBellClick={() => setActiveView('notifications')}
            />

            {/* Search Controls: SEARCH LEAGUE & SEARCH COUNTRY */}
            <div className="flex flex-col items-center gap-3 px-8 mb-6">
              {/* SEARCH LEAGUE Input Pill */}
              <div className="w-full bg-[#1C2228] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-5 flex items-center gap-2 shadow-md">
                <Search className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <input
                  type="text"
                  value={searchLeagueQuery}
                  onChange={(e) => setSearchLeagueQuery(e.target.value)}
                  placeholder="SEARCH LEAGUE"
                  className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-white/80 uppercase focus:outline-none pr-4"
                />
              </div>

              {/* SEARCH COUNTRY Dropdown Pill */}
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsSearchCountryOpen((prev) => !prev)}
                  className="w-full bg-transparent hover:bg-white/5 border-[1.5px] border-white/80 rounded-full h-11 px-5 flex items-center justify-between cursor-pointer"
                >
                  <span className="w-4" />
                  <span className="font-display font-extrabold text-base tracking-wider text-white uppercase truncate">
                    {searchCountryFilter || 'SEARCH COUNTRY'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#FF6B00] shrink-0" />
                </button>

                {isSearchCountryOpen && (
                  <div className="absolute left-0 right-0 top-12 z-30 bg-[#1C2228] border border-[#FF6B00] rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-[#14191E] px-3.5 py-2 border-b border-[#2A323B] flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <input
                        type="text"
                        value={searchCountryInput}
                        onChange={(e) => setSearchCountryInput(e.target.value)}
                        placeholder="Type country name..."
                        autoFocus
                        className="w-full bg-transparent text-xs font-bold text-white placeholder-[#8A99AD] uppercase focus:outline-none"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-[#2A323B]">
                      {searchCountryFilter && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchCountryFilter('')
                            setIsSearchCountryOpen(false)
                          }}
                          className="w-full px-4 py-2 text-left font-display font-bold text-sm tracking-wider uppercase bg-[#14191E] text-[#38BDF8] cursor-pointer"
                        >
                          ALL COUNTRIES
                        </button>
                      )}
                      {filteredSearchCountries.map((c) => {
                        const isSelected = searchCountryFilter === c.name
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setSearchCountryFilter(c.name)
                              setIsSearchCountryOpen(false)
                            }}
                            className={`w-full px-4 py-2.5 flex items-center justify-between text-left font-display font-bold text-base tracking-wider uppercase transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#FF6B00] text-black'
                                : 'bg-[#1C2228] hover:bg-[#252D35] text-white'
                            }`}
                          >
                            <span>{c.name}</span>
                            <CountryFlagCircle country={c.name} className="w-5 h-5" />
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
              <section className="grid grid-cols-2 gap-3.5 px-5 content-start flex-1">
                {filteredSearchLeagues.map((league, idx) =>
                  renderLeagueCard(
                    league,
                    idx,
                    () => handleSelectLeagueFromSearch(league),
                    true
                  )
                )}
              </section>
            ) : (
              <div className="flex-1 mx-5 bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <p className="font-display font-extrabold text-lg text-white uppercase tracking-wider mb-1">
                  NO LEAGUES FOUND
                </p>
                <p className="text-xs text-[#8A99AD] max-w-xs">
                  Create a new league first or adjust your search filters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= 5. PRIVATE LEAGUE PASSWORD PROMPT SCREEN ================= */}
        {activeView === 'join-league-password' && pendingJoinLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={pendingJoinLeague.name}
              sectionSubtitle="PRIVATE LEAGUE ACCESS"
              onBack={() => setActiveView('join-league')}
              onBellClick={() => setActiveView('notifications')}
            />

            <div className="px-6 flex flex-col items-center flex-1 justify-center">
              <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 flex flex-col items-center text-center shadow-xl">
                <div className="w-12 h-12 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00] flex items-center justify-center text-[#FF6B00] mb-3">
                  <Lock className="w-6 h-6" />
                </div>

                <h2 className="font-display font-extrabold text-2xl text-white uppercase tracking-wide">
                  {pendingJoinLeague.name}
                </h2>

                <div className="mt-1 mb-6 flex items-center gap-2 px-3 py-1 rounded-full bg-[#14191E] border border-[#2A323B]">
                  <CountryFlagCircle country={pendingJoinLeague.country} className="w-4 h-4" />
                  <span className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-wider">
                    {pendingJoinLeague.country}
                  </span>
                </div>

                <form onSubmit={handleSubmitJoinPassword} className="w-full space-y-4">
                  <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-12 px-5 flex items-center justify-center">
                    <input
                      type="password"
                      value={joinPasswordInput}
                      onChange={(e) => {
                        setJoinPasswordInput(e.target.value)
                        setJoinPasswordError('')
                      }}
                      placeholder="PASSWORD"
                      autoFocus
                      className="w-full bg-transparent text-center font-display font-extrabold text-lg tracking-wider text-white placeholder-[#8A99AD] focus:outline-none"
                    />
                  </div>

                  {joinPasswordError && (
                    <p className="text-xs font-bold text-red-400">
                      {joinPasswordError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#FF6B00] hover:bg-[#ff7b1a] text-black font-display font-extrabold text-base tracking-wider uppercase h-11 rounded-full shadow-lg shadow-[#FF6B00]/20 transition cursor-pointer"
                  >
                    UNLOCK & JOIN LEAGUE
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. LEAGUE HOME PAGE SCREEN ================= */}
        {activeView === 'league-detail' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="HOME PAGE"
              onBack={() => setActiveView('leagues')}
              showMoreButton
              onMoreClick={() => setActiveView('league-options')}
            />

            {/* 3 STACKED TELEMETRY CARDS: STANDING, RACES, HISTORY (HALL OF FAME) */}
            <div className="flex flex-col gap-4 px-5 flex-1 justify-between">
              <button
                type="button"
                onClick={() => setActiveView('league-standing')}
                className="w-full flex-1 bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00]/60 active:scale-[0.99] transition-all rounded-2xl p-5 flex items-center justify-between text-left shadow-lg cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6B00] block mb-1">
                    CHAMPIONSHIP TABLE
                  </span>
                  <span className="font-display font-extrabold text-3xl tracking-wide text-white uppercase block leading-none">
                    STANDING
                  </span>
                  <span className="text-xs text-[#8A99AD] mt-2 block">
                    Driver & Team points leaderboard
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-[#14191E] border border-[#2A323B] flex items-center justify-center text-[#FF6B00]">
                  <Trophy className="w-7 h-7" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('league-races')}
                className="w-full flex-1 bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#38BDF8]/60 active:scale-[0.99] transition-all rounded-2xl p-5 flex items-center justify-between text-left shadow-lg cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8] block mb-1">
                    CALENDAR & RESULTS
                  </span>
                  <span className="font-display font-extrabold text-3xl tracking-wide text-white uppercase block leading-none">
                    RACES
                  </span>
                  <span className="text-xs text-[#8A99AD] mt-2 block">
                    Upcoming schedules & lap sessions
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-[#14191E] border border-[#2A323B] flex items-center justify-center text-[#38BDF8]">
                  <Flag className="w-7 h-7" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('league-hall-of-fame')}
                className="w-full flex-1 bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00]/60 active:scale-[0.99] transition-all rounded-2xl p-5 flex items-center justify-between text-left shadow-lg cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6B00] block mb-1">
                    LEAGUE ARCHIVE
                  </span>
                  <span className="font-display font-extrabold text-2xl sm:text-3xl tracking-wide text-white uppercase block leading-none">
                    HISTORY <span className="text-[#FF6B00]">(HALL OF FAME)</span>
                  </span>
                  <span className="text-xs text-[#8A99AD] mt-2 block">
                    All-time records, champions & fastest laps
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-[#14191E] border border-[#2A323B] flex items-center justify-center text-[#FF6B00]">
                  <Medal className="w-7 h-7" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ================= 7. LEAGUE SETTINGS SCREEN (Role-Based) ================= */}
        {activeView === 'league-options' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="SETTINGS"
              onBack={() => setActiveView('league-detail')}
              onBellClick={() => setActiveView('notifications')}
            />

            <div className="flex flex-col gap-4 px-5 flex-1 justify-start">
              {/* 1. ONLY ADMINS BOX — Visible only when user is Admin */}
              {effectiveRole === 'admin' && (
                <section className="w-full bg-[#1C2228] rounded-2xl border border-[#2A323B] p-4 flex flex-col gap-2.5 shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#2A323B] pb-2 mb-1">
                    <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#FF6B00]">
                      ONLY ADMINS
                    </span>
                    <span className="text-[10px] text-[#8A99AD] font-semibold">
                      League Control
                    </span>
                  </div>

                  {/* Primary Highlighted Button: UPLOAD RACE RESULTS */}
                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('UPLOAD RACE RESULTS')}
                    className="w-full bg-[#FF6B00] hover:bg-[#ff7b1a] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 shadow-md shadow-[#FF6B00]/20 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-black stroke-[2.5]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-black uppercase">
                      UPLOAD RACE RESULTS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('ASSIGN ROLES')}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserCog className="w-4 h-4 text-[#FF6B00]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      ASSIGN ROLES
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('MANAGE RACERS')}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-[#FF6B00]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      MANAGE RACERS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('SCHEDULE RACE')}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CalendarPlus className="w-4 h-4 text-[#FF6B00]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      SCHEDULE RACE
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('DELETE LEAGUE')}
                    className="w-full bg-[#dc2626] hover:bg-[#b91c1c] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 shadow-md cursor-pointer mt-1"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      DELETE LEAGUE
                    </span>
                  </button>
                </section>
              )}

              {/* 2. ONLY TEAM CAPTAINS BOX — Visible to Admins & Team Captains */}
              {(effectiveRole === 'admin' || effectiveRole === 'team_captain') && (
                <section className="w-full bg-[#1C2228] rounded-2xl border border-[#2A323B] p-4 flex flex-col gap-2.5 shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#2A323B] pb-2 mb-1">
                    <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#38BDF8]">
                      ONLY TEAM CAPTAINS
                    </span>
                    <span className="text-[10px] text-[#8A99AD] font-semibold">
                      Team Management
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('INVITE RACERS')}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-[#38BDF8]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      INVITE RACERS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSettingAction('CREATE TEAM')}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldPlus className="w-4 h-4 text-[#38BDF8]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      CREATE TEAM
                    </span>
                  </button>
                </section>
              )}

              {/* 3. ONLY RACERS BOX — Visible to Admins, Team Captains, and Racers */}
              <section className="w-full bg-[#1C2228] rounded-2xl border border-[#2A323B] p-4 flex flex-col gap-2.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#2A323B] pb-2 mb-1">
                  <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#8A99AD]">
                    ONLY RACERS
                  </span>
                  <span className="text-[10px] text-[#8A99AD] font-semibold">
                    Driver Actions
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenSettingAction('REQUEST TO JOIN TEAM')}
                  className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4 text-[#FF6B00]" />
                  <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                    REQUEST TO JOIN TEAM
                  </span>
                </button>
              </section>
            </div>

            {/* Subtle Role Preview Bar at the bottom for testing what each role sees */}
            <div className="mx-5 mt-5 pt-3 border-t border-[#2A323B] flex items-center justify-between text-[10px] text-[#8A99AD]">
              <span>
                Role:{' '}
                <strong className="text-[#FF6B00] uppercase">
                  {actualUserRole.replace('_', ' ')}
                </strong>
              </span>
              <div className="flex items-center gap-1">
                <span>View as:</span>
                {(['admin', 'team_captain', 'racer'] as LeagueRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setRolePreviewOverride(r === actualUserRole ? null : r)
                    }
                    className={`px-2 py-0.5 rounded-full uppercase font-bold cursor-pointer transition ${
                      effectiveRole === r
                        ? 'bg-[#FF6B00] text-black'
                        : 'bg-[#1C2228] text-[#8A99AD] hover:text-white'
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
            <TrackDayHeader
              sectionTitle={
                activeView === 'league-standing'
                  ? 'STANDING'
                  : activeView === 'league-races'
                    ? 'RACES'
                    : activeView === 'league-hall-of-fame'
                      ? 'HALL OF FAME'
                      : activeView === 'league-setting-action'
                        ? selectedSettingActionTitle
                        : activeView === 'history'
                          ? 'RACE HISTORY'
                          : 'NOTIFICATIONS'
              }
              sectionSubtitle={selectedLeague?.name}
              onBack={() => {
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
              onBellClick={() => setActiveView('notifications')}
            />

            <div className="flex-1 mx-5 bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
              <p className="font-display font-extrabold text-2xl text-white uppercase tracking-wide mb-1">
                {activeView === 'league-standing' && `${selectedLeague?.name} — Standings`}
                {activeView === 'league-races' && `${selectedLeague?.name} — Races`}
                {activeView === 'league-hall-of-fame' && `${selectedLeague?.name} — Hall of Fame`}
                {activeView === 'league-setting-action' && selectedSettingActionTitle}
                {activeView === 'history' && 'Race History View'}
                {activeView === 'notifications' && 'Notifications Center'}
              </p>
              <p className="text-xs text-[#8A99AD] max-w-xs mb-6">
                Ready for your next skeleton mockup — I will build it in this Track Day Pro design!
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
                className="px-6 py-2.5 rounded-full bg-[#FF6B00] text-black font-display font-extrabold text-sm tracking-wider uppercase hover:bg-[#ff7b1a] transition cursor-pointer"
              >
                Go Back
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
