import { useState, useEffect, useRef } from 'react'
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
  LogOut,
  BellRing,
  CheckCircle2,
  Palette,
  ImagePlus,
} from 'lucide-react'
import { Session } from '@supabase/supabase-js'
import { DriverProfile, ProfileModal } from './components/ProfileModal'
import { HELMET_OPTIONS, HelmetSvg } from './components/HelmetIcons'
import { COUNTRIES, CountryFlagCircle } from './components/CountryFlags'
import { TrackDayHeader, CardGraphicSvg } from './components/TrackDayTheme'
import { AuthScreen } from './components/AuthScreen'
import { LogoCropModal } from './components/LogoCropModal'
import {
  supabase,
  League,
  LeagueRole,
  ALL_LEAGUE_ROLES,
  LeagueMemberItem,
  AppNotification,
  fetchAllLeagues,
  createNewLeague,
  joinLeagueInSupabase,
  ensureAndLoadDriverProfile,
  saveDriverProfileToSupabase,
  fetchLeagueMembers,
  assignLeagueMemberRole,
  fetchMyNotifications,
  markAllNotificationsRead,
  createLeagueTeamInSupabase,
  signOutUser,
} from './lib/leaguesRepo'

const STORAGE_KEY = 'krapp_driver_profile_v1'

const DEFAULT_PROFILE: DriverProfile = {
  username: 'USERNAME',
  name: '',
  surname: '',
  driverNumber: '',
  weightKg: '',
  bio: '',
  avatarType: 'none',
  helmetId: 'track-orange',
  customAvatarDataUrl: null,
}

const PRESET_TEAM_COLORS = [
  '#FF6B00',
  '#38BDF8',
  '#EF4444',
  '#22C55E',
  '#EAB308',
  '#A855F7',
  '#EC4899',
  '#FFFFFF',
]

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
  | 'assign-roles'
  | 'create-team'
  | 'create-team-manage-racers'
  | 'league-setting-action'
  | 'notifications'

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

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

  // Leagues state synced directly with Supabase (`leagues` + `league_members`)
  const [allLeagues, setAllLeagues] = useState<League[]>([])
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)
  const [selectedSettingActionTitle, setSelectedSettingActionTitle] = useState('')

  // Role preview override on the Settings page so user can test Admin / Team Captain / Racer views easily
  const [rolePreviewOverride, setRolePreviewOverride] = useState<LeagueRole | null>(
    null
  )

  // Assign Roles & League Members State
  const [leagueMembers, setLeagueMembers] = useState<LeagueMemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [selectedMemberForRole, setSelectedMemberForRole] =
    useState<LeagueMemberItem | null>(null)
  const [assigningRoleLoading, setAssigningRoleLoading] = useState(false)
  const [roleAssignSuccessMsg, setRoleAssignSuccessMsg] = useState('')

  // Create Team Screen State
  const [teamName, setTeamName] = useState('')
  const [teamColorHex, setTeamColorHex] = useState('#FF6B00')
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [teamLogoDataUrl, setTeamLogoDataUrl] = useState<string | null>(null)
  const [rawLogoForCrop, setRawLogoForCrop] = useState<string | null>(null)
  const [isLogoCropModalOpen, setIsLogoCropModalOpen] = useState(false)
  const [selectedTeamDriverIds, setSelectedTeamDriverIds] = useState<string[]>([])
  const [teamRacerSearchQuery, setTeamRacerSearchQuery] = useState('')
  const [teamCreateError, setTeamCreateError] = useState('')
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const teamLogoInputRef = useRef<HTMLInputElement>(null)

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  // Create League Form State
  const [createName, setCreateName] = useState('')
  const [createCountry, setCreateCountry] = useState('')
  const [createCountrySearch, setCreateCountrySearch] = useState('')
  const [isCreateCountryOpen, setIsCreateCountryOpen] = useState(false)
  const [createIsPrivate, setCreateIsPrivate] = useState(false)
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [isSubmittingLeague, setIsSubmittingLeague] = useState(false)

  // Join League Search State
  const [searchLeagueQuery, setSearchLeagueQuery] = useState('')
  const [searchCountryFilter, setSearchCountryFilter] = useState('')
  const [searchCountryInput, setSearchCountryInput] = useState('')
  const [isSearchCountryOpen, setIsSearchCountryOpen] = useState(false)

  // Private League Password Prompt State
  const [pendingJoinLeague, setPendingJoinLeague] = useState<League | null>(null)
  const [joinPasswordInput, setJoinPasswordInput] = useState('')
  const [joinPasswordError, setJoinPasswordError] = useState('')

  // Listen to Supabase Auth session (Google OAuth + Email)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Whenever the user signs in, ensure their `drivers` row exists in Supabase, load all leagues & notifications
  useEffect(() => {
    if (!session?.user) return

    const meta = session.user.user_metadata || {}
    ensureAndLoadDriverProfile({
      fullName: meta.full_name || meta.name,
      email: session.user.email,
      avatarUrl: meta.avatar_url || meta.picture,
    }).then((dbProfile) => {
      if (dbProfile) {
        setProfile(dbProfile)
      }
    })

    fetchAllLeagues().then((loaded) => setAllLeagues(loaded))
    fetchMyNotifications().then((loaded) => setNotifications(loaded))
  }, [session])

  // Refresh leagues or notifications when navigating
  useEffect(() => {
    if (!session) return
    if (activeView === 'leagues' || activeView === 'join-league') {
      fetchAllLeagues().then((loaded) => setAllLeagues(loaded))
    }
    if (activeView === 'home' || activeView === 'notifications') {
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    }
  }, [activeView, session])

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length

  const handleOpenNotifications = async () => {
    setActiveView('notifications')
    const latest = await fetchMyNotifications()
    setNotifications(latest.map((n) => ({ ...n, isRead: true })))
    await markAllNotificationsRead()
  }

  const handleSaveProfile = async (updated: DriverProfile) => {
    setProfile(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.error('Failed to save profile to localStorage', e)
    }
    await saveDriverProfileToSupabase(updated)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0d1114] text-white flex items-center justify-center">
        <span className="font-display font-extrabold text-xl tracking-wider text-[#FF6B00] uppercase animate-pulse">
          LOADING KRAPP TELEMETRY...
        </span>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  const selectedHelmet =
    HELMET_OPTIONS.find((h) => h.id === profile.helmetId) || HELMET_OPTIONS[0]

  const hasConfiguredProfile =
    profile.avatarType !== 'none' ||
    Boolean(profile.name || profile.surname || profile.weightKg || profile.bio)

  // Only show leagues the user is a member of in "MY LEAGUES"
  const myLeagues = allLeagues.filter((l) => l.isMember)

  // All leagues in "JOIN LEAGUE" search screen
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

  // Format a member row as "NAME SURNAME - NUMBER" matching the skeleton mockup
  const formatMemberLabel = (member: LeagueMemberItem, index: number) => {
    const fullName =
      `${member.firstName} ${member.surname}`.trim() ||
      member.displayName ||
      member.handle.replace(/^@/, '')
    const num = member.driverNumber.trim() || String(index + 1)
    return `${fullName.toUpperCase()} - ${num}`
  }

  // Filtered league members for "ASSIGN ROLES" search box
  const filteredLeagueMembers = leagueMembers.filter((member, idx) => {
    if (!memberSearchQuery.trim()) return true
    const label = formatMemberLabel(member, idx).toLowerCase()
    const handle = member.handle.toLowerCase()
    const q = memberSearchQuery.trim().toLowerCase()
    return label.includes(q) || handle.includes(q)
  })

  // Filtered league members for "CREATE TEAM -> MANAGE RACERS"
  const filteredTeamRacers = leagueMembers.filter((member, idx) => {
    if (!teamRacerSearchQuery.trim()) return true
    const label = formatMemberLabel(member, idx).toLowerCase()
    const handle = member.handle.toLowerCase()
    const q = teamRacerSearchQuery.trim().toLowerCase()
    return label.includes(q) || handle.includes(q)
  })

  // Selected members shown in "TEAM SUMMARY" box on Create Team screen
  const selectedTeamMembers = leagueMembers.filter((m) =>
    selectedTeamDriverIds.includes(m.driverId)
  )

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

    setIsSubmittingLeague(true)
    setCreateError('')
    try {
      const created = await createNewLeague({
        name: createName,
        country: createCountry,
        isPrivate: createIsPrivate,
        password: createIsPrivate ? createPassword : undefined,
      })

      const refreshed = await fetchAllLeagues()
      setAllLeagues(refreshed.length > 0 ? refreshed : [created, ...allLeagues])
      setSelectedLeague(created)
      setRolePreviewOverride(null)
      setActiveView('league-detail')
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create league in Supabase'
      )
    } finally {
      setIsSubmittingLeague(false)
    }
  }

  const handleSelectLeagueFromSearch = async (league: League) => {
    if (league.isMember) {
      setSelectedLeague(league)
      setRolePreviewOverride(null)
      setActiveView('league-detail')
      return
    }

    if (!league.isPrivate) {
      try {
        const assignedRole = await joinLeagueInSupabase(league.id)
        const updatedLeague: League = {
          ...league,
          isMember: true,
          myRole: assignedRole,
        }
        setAllLeagues((prev) =>
          prev.map((l) => (l.id === league.id ? updatedLeague : l))
        )
        setSelectedLeague(updatedLeague)
        setRolePreviewOverride(null)
        setActiveView('league-detail')
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Could not join league')
      }
      return
    }

    setPendingJoinLeague(league)
    setJoinPasswordInput('')
    setJoinPasswordError('')
    setActiveView('join-league-password')
  }

  const handleSubmitJoinPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pendingJoinLeague) return

    setJoinPasswordError('')
    try {
      const assignedRole = await joinLeagueInSupabase(
        pendingJoinLeague.id,
        joinPasswordInput
      )
      const updatedLeague: League = {
        ...pendingJoinLeague,
        isMember: true,
        myRole: assignedRole,
      }
      setAllLeagues((prev) =>
        prev.map((l) => (l.id === pendingJoinLeague.id ? updatedLeague : l))
      )
      setSelectedLeague(updatedLeague)
      setRolePreviewOverride(null)
      setActiveView('league-detail')
    } catch (err: unknown) {
      setJoinPasswordError(
        err instanceof Error ? err.message : 'Incorrect password'
      )
    }
  }

  const handleOpenAssignRoles = async () => {
    if (!selectedLeague) return
    setMemberSearchQuery('')
    setSelectedMemberForRole(null)
    setRoleAssignSuccessMsg('')
    setActiveView('assign-roles')
    setLoadingMembers(true)
    const members = await fetchLeagueMembers(selectedLeague.id)
    setLeagueMembers(members)
    setLoadingMembers(false)
  }

  const handleAssignRoleToMember = async (newRole: LeagueRole) => {
    if (!selectedLeague || !selectedMemberForRole) return
    setAssigningRoleLoading(true)
    setRoleAssignSuccessMsg('')
    try {
      await assignLeagueMemberRole(
        selectedLeague.id,
        selectedMemberForRole.driverId,
        newRole
      )

      const updatedMember: LeagueMemberItem = {
        ...selectedMemberForRole,
        appRole: newRole,
      }
      setSelectedMemberForRole(updatedMember)
      setLeagueMembers((prev) =>
        prev.map((m) =>
          m.driverId === updatedMember.driverId ? updatedMember : m
        )
      )
      setRoleAssignSuccessMsg(
        `Assigned ${newRole} & sent notification to ${
          updatedMember.displayName || updatedMember.handle
        }`
      )
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to assign role')
    } finally {
      setAssigningRoleLoading(false)
    }
  }

  const handleOpenCreateTeam = async () => {
    if (!selectedLeague) return
    setTeamName('')
    setTeamColorHex('#FF6B00')
    setIsColorPickerOpen(false)
    setTeamLogoDataUrl(null)
    setRawLogoForCrop(null)
    setSelectedTeamDriverIds([])
    setTeamRacerSearchQuery('')
    setTeamCreateError('')
    setActiveView('create-team')
    setLoadingMembers(true)
    const members = await fetchLeagueMembers(selectedLeague.id)
    setLeagueMembers(members)
    setLoadingMembers(false)
  }

  const handleLogoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawLogoForCrop(reader.result)
        setIsLogoCropModalOpen(true)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleToggleTeamRacer = (driverId: string) => {
    setSelectedTeamDriverIds((prev) =>
      prev.includes(driverId)
        ? prev.filter((id) => id !== driverId)
        : [...prev, driverId]
    )
  }

  const handleConfirmCreateTeam = async () => {
    if (!selectedLeague) return
    if (!teamName.trim()) {
      setTeamCreateError('Please enter a team name')
      return
    }
    const cleanHex = teamColorHex.trim().startsWith('#')
      ? teamColorHex.trim()
      : `#${teamColorHex.trim()}`

    setIsCreatingTeam(true)
    setTeamCreateError('')
    try {
      await createLeagueTeamInSupabase({
        leagueId: selectedLeague.id,
        name: teamName,
        colorHex: cleanHex,
        logoUrl: teamLogoDataUrl,
        driverIds: selectedTeamDriverIds,
      })

      // Refresh notifications in case the creator added themselves to the team
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
      setActiveView('league-options')
    } catch (err: unknown) {
      setTeamCreateError(
        err instanceof Error ? err.message : 'Failed to create team'
      )
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const handleOpenSettingAction = (actionTitle: string) => {
    if (actionTitle === 'ASSIGN ROLES') {
      handleOpenAssignRoles()
      return
    }
    if (actionTitle === 'CREATE TEAM') {
      handleOpenCreateTeam()
      return
    }
    setSelectedSettingActionTitle(actionTitle)
    setActiveView('league-setting-action')
  }

  const actualUserRole: LeagueRole = selectedLeague?.myRole || 'RACER'
  const effectiveRole: LeagueRole = rolePreviewOverride || actualUserRole
  const isEffectiveAdmin =
    effectiveRole === 'ADMIN' || effectiveRole === 'CO-ADMIN'
  const isEffectiveCaptainOrAbove =
    isEffectiveAdmin || effectiveRole === 'TEAM CAPTAIN'

  // Reusable Track Day Pro League Card component
  const renderLeagueCard = (
    league: League,
    idx: number,
    onClick: () => void,
    showAccessBadge = false
  ) => {
    const isCyanAccent = idx % 4 === 3
    const accentColorClass = isCyanAccent ? 'text-[#38BDF8]' : 'text-[#FF6B00]'
    const userRoleInCard = league.myRole || 'RACER'

    return (
      <button
        key={league.id}
        type="button"
        onClick={onClick}
        className="group bg-[#1C2228] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00]/60 active:scale-[0.98] transition-all rounded-2xl p-3.5 flex flex-col justify-between text-left shadow-lg cursor-pointer"
      >
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

        <h3 className="font-display font-extrabold text-xl leading-[1.05] tracking-wide text-white uppercase line-clamp-2 my-1">
          {league.name}
        </h3>

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
            <span
              className={`text-xs font-extrabold uppercase truncate block ${accentColorClass}`}
            >
              {league.country}
            </span>
          </div>
        </div>

        <div className="w-full flex items-center justify-between pt-2 mt-2 border-t border-[#2A323B]/60">
          <div>
            <span className="block text-[10px] text-[#8A99AD] leading-tight">
              {showAccessBadge ? 'Status:' : 'Role:'}
            </span>
            <span className={`text-xs font-extrabold uppercase ${accentColorClass}`}>
              {showAccessBadge
                ? league.isMember
                  ? 'Joined'
                  : league.isPrivate
                    ? 'Locked'
                    : 'Open'
                : userRoleInCard}
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
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

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
                      <HelmetSvg helmet={selectedHelmet} className="w-24 h-24" />
                      {(profile.name || profile.surname) && (
                        <span className="mt-1 font-display text-lg font-extrabold tracking-wider text-white uppercase">
                          {profile.name} {profile.surname}{' '}
                          {profile.driverNumber ? `#${profile.driverNumber}` : ''}
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
                      <HelmetSvg
                        helmet={selectedHelmet}
                        className="w-14 h-14 mb-1.5"
                      />
                      <span className="font-display text-2xl font-extrabold text-white tracking-wider">
                        DRIVER AVATAR
                      </span>
                      <p className="text-[11px] font-semibold text-[#8A99AD] leading-snug max-w-[170px] mt-1">
                        Tap to edit profile, number, weight & helmet
                      </p>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider bg-[#FF6B00] text-black px-4 py-1.5 rounded-full shadow-lg">
                      Edit Driver Profile
                    </span>
                  </div>
                </div>
              </button>

              <div className="mt-4 flex items-center gap-3 bg-[#1C2228] border border-[#2A323B] rounded-full px-4 py-1.5">
                <span className="text-[11px] text-[#8A99AD] font-semibold uppercase">
                  Driver:{' '}
                  <strong className="text-white">
                    {profile.name || profile.surname
                      ? `${profile.name} ${profile.surname}`.trim()
                      : `@${profile.username}`}
                    {profile.driverNumber ? ` - ${profile.driverNumber}` : ''}
                  </strong>
                </span>
                <span className="text-[#2A323B]">|</span>
                <span className="text-[11px] text-[#8A99AD] font-semibold uppercase">
                  Weight:{' '}
                  <strong className="text-[#FF6B00]">
                    {profile.weightKg ? `${profile.weightKg} kg` : '-- kg'}
                  </strong>
                </span>
                <span className="text-[#2A323B]">|</span>
                <button
                  type="button"
                  onClick={signOutUser}
                  title="Sign out"
                  className="text-[11px] text-[#8A99AD] hover:text-red-400 flex items-center gap-1 font-bold uppercase cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>

              {hasConfiguredProfile && profile.bio && (
                <p className="mt-2 text-xs text-[#8A99AD] text-center max-w-xs italic line-clamp-2">
                  "{profile.bio}"
                </p>
              )}
            </section>

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

        {/* ================= 2. MY LEAGUES SCREEN ================= */}
        {activeView === 'leagues' && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle="MY LEAGUES"
              onBack={() => setActiveView('home')}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

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
                onBellClick={handleOpenNotifications}
                unreadNotificationsCount={unreadNotificationsCount}
              />

              <div className="px-5 flex flex-col gap-4 mt-2">
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
                disabled={isSubmittingLeague}
                onClick={handleConfirmCreateLeague}
                className="bg-[#FF6B00] hover:bg-[#ff7b1a] active:scale-[0.98] transition-all rounded-2xl h-36 p-4 flex flex-col items-center justify-center shadow-lg shadow-[#FF6B00]/20 cursor-pointer disabled:opacity-50"
              >
                <span className="font-display font-extrabold text-2xl tracking-wider text-black uppercase">
                  {isSubmittingLeague ? 'SAVING...' : 'CONFIRM'}
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
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="flex flex-col items-center gap-3 px-8 mb-6">
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
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
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
                  <CountryFlagCircle
                    country={pendingJoinLeague.country}
                    className="w-4 h-4"
                  />
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
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="flex flex-col gap-4 px-5 flex-1 justify-start">
              {/* 1. ONLY ADMINS BOX — Visible only when user is ADMIN or CO-ADMIN */}
              {isEffectiveAdmin && (
                <section className="w-full bg-[#1C2228] rounded-2xl border border-[#2A323B] p-4 flex flex-col gap-2.5 shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#2A323B] pb-2 mb-1">
                    <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#FF6B00]">
                      ONLY ADMINS
                    </span>
                    <span className="text-[10px] text-[#8A99AD] font-semibold">
                      League Control
                    </span>
                  </div>

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
                    onClick={handleOpenAssignRoles}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00]/60 active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
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
              {isEffectiveCaptainOrAbove && (
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
                    onClick={handleOpenCreateTeam}
                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-[#38BDF8]/60 active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldPlus className="w-4 h-4 text-[#38BDF8]" />
                    <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                      CREATE TEAM
                    </span>
                  </button>
                </section>
              )}

              {/* 3. ONLY RACERS BOX — Visible to Everyone */}
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
                Role: <strong className="text-[#FF6B00] uppercase">{actualUserRole}</strong>
              </span>
              <div className="flex items-center gap-1">
                <span>View as:</span>
                {(['ADMIN', 'TEAM CAPTAIN', 'RACER'] as LeagueRole[]).map((r) => (
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
                    {r === 'TEAM CAPTAIN' ? 'Captain' : r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= 8. ASSIGN ROLES SCREEN ================= */}
        {activeView === 'assign-roles' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="SETTINGS"
              onBack={() => {
                if (selectedMemberForRole) {
                  setSelectedMemberForRole(null)
                  setRoleAssignSuccessMsg('')
                } else {
                  setActiveView('league-options')
                }
              }}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col">
              <h2 className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase text-center mb-3">
                ASSIGN ROLES
              </h2>

              <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-4 flex items-center gap-2 mb-4 shadow-inner">
                <Search className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => {
                    setMemberSearchQuery(e.target.value)
                    if (selectedMemberForRole) {
                      setSelectedMemberForRole(null)
                      setRoleAssignSuccessMsg('')
                    }
                  }}
                  placeholder="SEARCH NAME - NUMBER"
                  className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-[#FF6B00] uppercase focus:outline-none pr-4"
                />
              </div>

              <div className="flex-1 bg-[#14191E]/70 border-2 border-[#2A323B] rounded-3xl p-3.5 flex flex-col">
                {loadingMembers ? (
                  <div className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-[#8A99AD]">
                    Loading league members...
                  </div>
                ) : selectedMemberForRole ? (
                  <div className="flex flex-col flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberForRole(null)
                        setRoleAssignSuccessMsg('')
                      }}
                      className="w-full bg-[#1C2228] border border-[#FF6B00] rounded-full h-11 px-5 flex items-center justify-between mb-4 shadow-md cursor-pointer"
                    >
                      <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase truncate">
                        {formatMemberLabel(
                          selectedMemberForRole,
                          leagueMembers.findIndex(
                            (m) => m.driverId === selectedMemberForRole.driverId
                          )
                        )}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-[#8A99AD]">
                        Change driver
                      </span>
                    </button>

                    <div className="bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col gap-3">
                      {ALL_LEAGUE_ROLES.map((roleOption) => {
                        const isCurrentRole =
                          selectedMemberForRole.appRole === roleOption
                        return (
                          <button
                            key={roleOption}
                            type="button"
                            disabled={assigningRoleLoading}
                            onClick={() => handleAssignRoleToMember(roleOption)}
                            className={`w-full rounded-full h-11 px-5 flex items-center justify-center relative transition-all cursor-pointer disabled:opacity-50 ${
                              isCurrentRole
                                ? 'bg-[#FF6B00] text-black border-2 border-white shadow-lg shadow-[#FF6B00]/25'
                                : 'bg-[#14191E] hover:bg-[#222930] text-[#FF6B00] border border-[#2A323B] hover:border-[#FF6B00]/60'
                            }`}
                          >
                            <span className="font-display font-extrabold text-base tracking-wider uppercase">
                              {roleOption}
                            </span>
                            {isCurrentRole && (
                              <Check className="w-4 h-4 text-black stroke-[3] absolute right-4" />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {roleAssignSuccessMsg && (
                      <div className="mt-4 flex items-center gap-2 bg-[#38BDF8]/10 border border-[#38BDF8]/40 rounded-2xl p-3 text-xs text-[#38BDF8] font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{roleAssignSuccessMsg}</span>
                      </div>
                    )}
                  </div>
                ) : filteredLeagueMembers.length > 0 ? (
                  <div className="flex flex-col gap-3 overflow-y-auto">
                    {filteredLeagueMembers.map((member, idx) => (
                      <button
                        key={member.driverId}
                        type="button"
                        onClick={() => {
                          setSelectedMemberForRole(member)
                          setRoleAssignSuccessMsg('')
                        }}
                        className="w-full bg-[#1C2228] hover:bg-[#242C35] border border-[#2A323B] hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-between shadow-md cursor-pointer"
                      >
                        <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase truncate">
                          {formatMemberLabel(member, idx)}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#14191E] border border-[#2A323B] text-[#8A99AD] shrink-0 ml-2">
                          {member.appRole}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <p className="font-display font-extrabold text-base text-white uppercase tracking-wider mb-1">
                      NO MEMBERS MATCHING SEARCH
                    </p>
                    <p className="text-xs text-[#8A99AD]">
                      Try searching by driver name, handle, or driver number.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 9. CREATE TEAM SCREEN (Matches Skeleton Mockup) ================= */}
        {activeView === 'create-team' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="SETTINGS"
              onBack={() => setActiveView('league-options')}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            {/* Outer Container: CREATE TEAM */}
            <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center gap-2.5 mb-1">
                  {teamLogoDataUrl && (
                    <img
                      src={teamLogoDataUrl}
                      alt="Team Logo"
                      className="w-8 h-8 rounded-full border-2 object-cover"
                      style={{ borderColor: teamColorHex }}
                    />
                  )}
                  <h2 className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase text-center">
                    CREATE TEAM
                  </h2>
                </div>

                {/* 1. NAME Pill Input */}
                <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-5 flex items-center justify-center shadow-inner">
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value)
                      setTeamCreateError('')
                    }}
                    placeholder="NAME"
                    className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-[#FF6B00] uppercase focus:outline-none"
                  />
                </div>

                {/* 2. COLOR Pill (Supports HEX Code input + Native Color Picker + Presets) */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen((prev) => !prev)}
                    className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#2A323B] rounded-full h-11 px-5 flex items-center justify-center gap-2.5 shadow-inner cursor-pointer"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/60 shrink-0"
                      style={{ backgroundColor: teamColorHex }}
                    />
                    <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                      COLOR ({teamColorHex.toUpperCase()})
                    </span>
                    <Palette className="w-4 h-4 text-[#8A99AD]" />
                  </button>

                  {isColorPickerOpen && (
                    <div className="bg-[#14191E] border border-[#FF6B00]/60 rounded-2xl p-3 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A99AD]">
                          HEX Code:
                        </span>
                        <input
                          type="text"
                          value={teamColorHex}
                          onChange={(e) => setTeamColorHex(e.target.value)}
                          placeholder="#FF6B00"
                          maxLength={7}
                          className="flex-1 bg-[#1C2228] border border-[#2A323B] rounded-lg px-3 py-1 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-[#FF6B00]"
                        />
                        <input
                          type="color"
                          value={
                            /^#[0-9A-Fa-f]{6}$/.test(teamColorHex)
                              ? teamColorHex
                              : '#FF6B00'
                          }
                          onChange={(e) => setTeamColorHex(e.target.value)}
                          className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                          title="Pick custom color"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        {PRESET_TEAM_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setTeamColorHex(hex)}
                            className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                              teamColorHex.toUpperCase() === hex
                                ? 'border-white scale-110'
                                : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. ADD LOGO Pill (Upload only -> Opens circular cropper modal) */}
                <input
                  ref={teamLogoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => teamLogoInputRef.current?.click()}
                  className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#2A323B] rounded-full h-11 px-5 flex items-center justify-center gap-2.5 shadow-inner cursor-pointer"
                >
                  {teamLogoDataUrl ? (
                    <>
                      <img
                        src={teamLogoDataUrl}
                        alt="Team Logo"
                        className="w-6 h-6 rounded-full object-cover border border-[#FF6B00]"
                      />
                      <span className="font-display font-extrabold text-base tracking-wider text-[#38BDF8] uppercase">
                        CHANGE / ADJUST LOGO
                      </span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-4 h-4 text-[#FF6B00]" />
                      <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                        ADD LOGO
                      </span>
                    </>
                  )}
                </button>

                {/* 4. MANAGE RACERS Pill (Opens league member selector) */}
                <button
                  type="button"
                  onClick={() => setActiveView('create-team-manage-racers')}
                  className="w-full bg-[#14191E] hover:bg-[#192026] border border-[#2A323B] hover:border-[#FF6B00]/60 rounded-full h-11 px-5 flex items-center justify-center gap-2 shadow-inner cursor-pointer"
                >
                  <Users className="w-4 h-4 text-[#FF6B00]" />
                  <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                    MANAGE RACERS ({selectedTeamDriverIds.length})
                  </span>
                </button>

                {/* 5. TEAM SUMMARY Box */}
                <div className="bg-[#14191E]/80 border-2 border-[#2A323B] rounded-3xl p-3.5 min-h-[150px] flex flex-col">
                  <span className="font-display font-extrabold text-xs tracking-wider text-[#FF6B00] uppercase text-center mb-2.5">
                    TEAM SUMMARY
                  </span>

                  {selectedTeamMembers.length > 0 ? (
                    <div className="flex flex-col gap-2.5 max-h-44 overflow-y-auto">
                      {selectedTeamMembers.map((member) => {
                        const originalIdx = leagueMembers.findIndex(
                          (m) => m.driverId === member.driverId
                        )
                        return (
                          <div
                            key={member.driverId}
                            className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-10 px-4 flex items-center justify-between"
                          >
                            <span
                              className="font-display font-extrabold text-sm sm:text-base tracking-wider uppercase truncate"
                              style={{ color: teamColorHex || '#FF6B00' }}
                            >
                              {formatMemberLabel(
                                member,
                                originalIdx >= 0 ? originalIdx : 0
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleTeamRacer(member.driverId)
                              }
                              className="text-[10px] font-bold uppercase text-[#8A99AD] hover:text-red-400 ml-2 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center px-4">
                      <p className="text-xs text-[#8A99AD]">
                        Tap <strong className="text-[#FF6B00]">MANAGE RACERS</strong> above to select league members for this team.
                      </p>
                    </div>
                  )}
                </div>

                {teamCreateError && (
                  <p className="text-xs font-bold text-red-400 text-center">
                    {teamCreateError}
                  </p>
                )}
              </div>

              {/* 6. Bottom Two Cards: CANCEL & CONFIRM */}
              <div className="grid grid-cols-2 gap-3.5 w-full mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('league-options')}
                  className="bg-[#14191E] hover:bg-[#192026] border border-[#2A323B] active:scale-[0.98] transition-all rounded-3xl h-36 p-4 flex flex-col items-center justify-center shadow-lg cursor-pointer"
                >
                  <span className="font-display font-extrabold text-2xl tracking-wider text-[#EF4444] uppercase">
                    CANCEL
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isCreatingTeam}
                  onClick={handleConfirmCreateTeam}
                  className="bg-[#14191E] hover:bg-[#192026] border border-[#FF6B00]/60 active:scale-[0.98] transition-all rounded-3xl h-36 p-4 flex flex-col items-center justify-center shadow-lg cursor-pointer disabled:opacity-50"
                >
                  <span className="font-display font-extrabold text-2xl tracking-wider text-[#FF6B00] uppercase">
                    {isCreatingTeam ? 'SAVING...' : 'CONFIRM'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 10. CREATE TEAM -> MANAGE RACERS PICKER SCREEN ================= */}
        {activeView === 'create-team-manage-racers' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="CREATE TEAM · MANAGE RACERS"
              onBack={() => setActiveView('create-team')}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col justify-between">
              <div className="flex flex-col flex-1">
                <h2 className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase text-center mb-3">
                  SELECT TEAM RACERS
                </h2>

                {/* Search Input */}
                <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-4 flex items-center gap-2 mb-4 shadow-inner">
                  <Search className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <input
                    type="text"
                    value={teamRacerSearchQuery}
                    onChange={(e) => setTeamRacerSearchQuery(e.target.value)}
                    placeholder="SEARCH NAME - NUMBER"
                    className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-[#FF6B00] uppercase focus:outline-none pr-4"
                  />
                </div>

                {/* Member Multi-Select List */}
                <div className="flex-1 bg-[#14191E]/70 border-2 border-[#2A323B] rounded-3xl p-3.5 flex flex-col gap-3 overflow-y-auto max-h-[380px]">
                  {loadingMembers ? (
                    <div className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-[#8A99AD]">
                      Loading league members...
                    </div>
                  ) : filteredTeamRacers.length > 0 ? (
                    filteredTeamRacers.map((member, idx) => {
                      const isSelected = selectedTeamDriverIds.includes(
                        member.driverId
                      )
                      return (
                        <button
                          key={member.driverId}
                          type="button"
                          onClick={() => handleToggleTeamRacer(member.driverId)}
                          className={`w-full rounded-full h-11 px-5 flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#FF6B00] text-black border-2 border-white shadow-md'
                              : 'bg-[#1C2228] hover:bg-[#242C35] text-[#FF6B00] border border-[#2A323B]'
                          }`}
                        >
                          <span className="font-display font-extrabold text-base tracking-wider uppercase truncate">
                            {formatMemberLabel(member, idx)}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ml-2 ${
                              isSelected
                                ? 'bg-black border-black text-[#FF6B00]'
                                : 'border-[#8A99AD]'
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                            )}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-[#8A99AD] text-center">
                      No league members found.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveView('create-team')}
                className="w-full mt-4 bg-[#FF6B00] hover:bg-[#ff7b1a] text-black font-display font-extrabold text-base tracking-wider uppercase h-12 rounded-full shadow-lg shadow-[#FF6B00]/20 transition cursor-pointer"
              >
                DONE ({selectedTeamDriverIds.length} SELECTED)
              </button>
            </div>
          </div>
        )}

        {/* ================= 11. NOTIFICATIONS SCREEN (Bell on Homescreen) ================= */}
        {activeView === 'notifications' && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle="NOTIFICATIONS"
              sectionSubtitle="ROLE & TEAM UPDATES"
              onBack={() => setActiveView('home')}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={0}
            />

            <div className="px-5 flex-1 flex flex-col gap-3">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="bg-[#1C2228] border border-[#2A323B] rounded-2xl p-4 flex items-start gap-3.5 shadow-lg"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 flex items-center justify-center text-[#FF6B00] shrink-0 mt-0.5">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-extrabold text-base tracking-wide text-white uppercase truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[#8A99AD] shrink-0">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#8A99AD] mt-1 leading-relaxed">
                        {n.body}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                  <BellRing className="w-10 h-10 text-[#8A99AD]/50 mb-3" />
                  <p className="font-display font-extrabold text-lg text-white uppercase tracking-wider mb-1">
                    NO NOTIFICATIONS YET
                  </p>
                  <p className="text-xs text-[#8A99AD] max-w-xs">
                    When an Admin or Team Captain updates your role or adds you to a team, you will see the alert right here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PLACEHOLDER SUB-VIEWS ================= */}
        {(activeView === 'league-standing' ||
          activeView === 'league-races' ||
          activeView === 'league-hall-of-fame' ||
          activeView === 'league-setting-action' ||
          activeView === 'history') && (
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
                        : 'RACE HISTORY'
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
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="flex-1 mx-5 bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
              <p className="font-display font-extrabold text-2xl text-white uppercase tracking-wide mb-1">
                {activeView === 'league-standing' &&
                  `${selectedLeague?.name} — Standings`}
                {activeView === 'league-races' && `${selectedLeague?.name} — Races`}
                {activeView === 'league-hall-of-fame' &&
                  `${selectedLeague?.name} — Hall of Fame`}
                {activeView === 'league-setting-action' && selectedSettingActionTitle}
                {activeView === 'history' && 'Race History View'}
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
        onSave={handleSaveProfile}
      />

      {/* Team Logo Circular Crop & Adjust Modal */}
      <LogoCropModal
        imageSrc={rawLogoForCrop}
        isOpen={isLogoCropModalOpen}
        onClose={() => setIsLogoCropModalOpen(false)}
        onConfirm={(croppedUrl) => {
          setTeamLogoDataUrl(croppedUrl)
          setIsLogoCropModalOpen(false)
        }}
      />
    </div>
  )
}

export default App
