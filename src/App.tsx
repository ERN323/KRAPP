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
  Shield,
  Pencil,
  UserMinus,
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
  LeagueTeam,
  LeagueRaceEvent,
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
  fetchLeagueTeamsWithRosters,
  updateLeagueTeamInSupabase,
  deleteLeagueTeamInSupabase,
  assignRacerToTeamInSupabase,
  removeRacerFromLeagueInSupabase,
  toggleDriverTagInSupabase,
  fetchLeagueEventsInSupabase,
  assignDriverPenaltyInSupabase,
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
  | 'my-team'
  | 'my-team-manage-racers'
  | 'assign-roles'
  | 'manage-racers'
  | 'create-team'
  | 'create-team-manage-racers'
  | 'league-setting-action'
  | 'notifications'

export type ManageRacersStep =
  | 'list'
  | 'actions'
  | 'select-team'
  | 'remove-confirm'
  | 'tag'
  | 'penalty-races'
  | 'penalty-type'

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

  // Create Team / Edit Team Screen State
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

  // My Team Inspection & Edit State
  const [leagueTeams, setLeagueTeams] = useState<LeagueTeam[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [selectedMyTeamId, setSelectedMyTeamId] = useState<string | null>(null)
  const [isEditingMyTeam, setIsEditingMyTeam] = useState(false)
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState<string | null>(
    null
  )
  const [myTeamSaveMsg, setMyTeamSaveMsg] = useState('')

  // Manage Racers Screen State
  const [manageRacersStep, setManageRacersStep] =
    useState<ManageRacersStep>('list')
  const [selectedManagedRacer, setSelectedManagedRacer] =
    useState<LeagueMemberItem | null>(null)
  const [manageTeamSearchQuery, setManageTeamSearchQuery] = useState('')
  const [leagueRaceEvents, setLeagueRaceEvents] = useState<LeagueRaceEvent[]>([])
  const [selectedPenaltyEvent, setSelectedPenaltyEvent] =
    useState<LeagueRaceEvent | null>(null)
  const [customPenaltyRaceDate, setCustomPenaltyRaceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [customPenaltyRaceName, setCustomPenaltyRaceName] =
    useState('Round 1 Race')
  const [penaltyKind, setPenaltyKind] = useState<'TIME' | 'DSQ'>('TIME')
  const [penaltySecondsInput, setPenaltySecondsInput] = useState('5')
  const [penaltyReasonInput, setPenaltyReasonInput] = useState('')
  const [manageRacerActionLoading, setManageRacerActionLoading] = useState(false)
  const [manageRacerSuccessMsg, setManageRacerSuccessMsg] = useState('')
  const [manageRacerErrorMsg, setManageRacerErrorMsg] = useState('')

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
    }).then(async (dbProfile) => {
      if (!dbProfile) return

      // Check if localStorage still has previously entered profile details that weren't synced to DB yet
      let localSaved: Partial<DriverProfile> = {}
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) localSaved = JSON.parse(raw)
      } catch {
        // ignore
      }

      const dbIsBlank =
        !dbProfile.name &&
        !dbProfile.surname &&
        !dbProfile.driverNumber &&
        !dbProfile.weightKg
      const localHasData = Boolean(
        localSaved.name ||
          localSaved.surname ||
          localSaved.driverNumber ||
          localSaved.weightKg
      )

      if (dbIsBlank && localHasData) {
        const merged: DriverProfile = {
          username:
            localSaved.username && localSaved.username !== 'USERNAME'
              ? localSaved.username
              : dbProfile.username,
          name: localSaved.name || dbProfile.name,
          surname: localSaved.surname || dbProfile.surname,
          driverNumber: localSaved.driverNumber || dbProfile.driverNumber || '',
          weightKg: localSaved.weightKg || dbProfile.weightKg,
          bio: localSaved.bio || dbProfile.bio,
          avatarType:
            localSaved.avatarType && localSaved.avatarType !== 'none'
              ? localSaved.avatarType
              : dbProfile.avatarType,
          helmetId: localSaved.helmetId || dbProfile.helmetId || 'track-orange',
          customAvatarDataUrl:
            localSaved.customAvatarDataUrl || dbProfile.customAvatarDataUrl,
        }
        setProfile(merged)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        await saveDriverProfileToSupabase(merged)
      } else {
        setProfile(dbProfile)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbProfile))
        } catch {
          // ignore
        }
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
    const savedFromDb = await saveDriverProfileToSupabase(updated)
    if (savedFromDb) {
      setProfile(savedFromDb)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFromDb))
      } catch {
        // ignore
      }
    }
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

  const populateTeamEditFields = (team: LeagueTeam) => {
    setTeamName(team.name)
    setTeamColorHex(team.colorHex || '#FF6B00')
    setTeamLogoDataUrl(team.logoUrl)
    setSelectedTeamDriverIds(team.members.map((m) => m.driverId))
    setTeamCreateError('')
  }

  const handleOpenMyTeam = async () => {
    if (!selectedLeague) return
    setIsEditingMyTeam(false)
    setMyTeamSaveMsg('')
    setTeamCreateError('')
    setActiveView('my-team')
    setLoadingTeams(true)
    const [teams, members] = await Promise.all([
      fetchLeagueTeamsWithRosters(selectedLeague.id),
      fetchLeagueMembers(selectedLeague.id),
    ])
    setLeagueTeams(teams)
    setLeagueMembers(members)
    const myTeam = teams.find((t) => t.isMyTeam) || teams[0] || null
    if (myTeam) {
      setSelectedMyTeamId(myTeam.id)
      populateTeamEditFields(myTeam)
    } else {
      setSelectedMyTeamId(null)
    }
    setLoadingTeams(false)
  }

  const handleSelectTeamToInspect = (team: LeagueTeam) => {
    setSelectedMyTeamId(team.id)
    setIsEditingMyTeam(false)
    setConfirmDeleteTeamId(null)
    setMyTeamSaveMsg('')
    populateTeamEditFields(team)
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!selectedLeague) return
    setIsCreatingTeam(true)
    setTeamCreateError('')
    setMyTeamSaveMsg('')
    try {
      await deleteLeagueTeamInSupabase(teamId)
      const refreshed = await fetchLeagueTeamsWithRosters(selectedLeague.id)
      setLeagueTeams(refreshed)
      setIsEditingMyTeam(false)
      setConfirmDeleteTeamId(null)
      const nextTeam = refreshed.find((t) => t.isMyTeam) || refreshed[0] || null
      if (nextTeam) {
        setSelectedMyTeamId(nextTeam.id)
        populateTeamEditFields(nextTeam)
        setMyTeamSaveMsg('Team deleted.')
      } else {
        setSelectedMyTeamId(null)
      }
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      setTeamCreateError(
        err instanceof Error ? err.message : 'Failed to delete team'
      )
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const handleKickTeamMemberDirect = async (
    team: LeagueTeam,
    driverIdToKick: string
  ) => {
    if (!selectedLeague) return
    const updatedDriverIds = team.members
      .map((m) => m.driverId)
      .filter((id) => id !== driverIdToKick)

    setIsCreatingTeam(true)
    setMyTeamSaveMsg('')
    setTeamCreateError('')
    try {
      await updateLeagueTeamInSupabase({
        teamId: team.id,
        name: isEditingMyTeam ? teamName : team.name,
        colorHex: isEditingMyTeam ? teamColorHex : team.colorHex,
        logoUrl: isEditingMyTeam ? teamLogoDataUrl : team.logoUrl,
        driverIds: updatedDriverIds,
      })

      setSelectedTeamDriverIds(updatedDriverIds)
      const refreshed = await fetchLeagueTeamsWithRosters(selectedLeague.id)
      setLeagueTeams(refreshed)
      setMyTeamSaveMsg('Teammate removed from team.')
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      setTeamCreateError(
        err instanceof Error ? err.message : 'Failed to remove teammate'
      )
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const handleSaveMyTeamChanges = async () => {
    if (!selectedLeague || !selectedMyTeamId) return
    if (!teamName.trim()) {
      setTeamCreateError('Team name cannot be empty')
      return
    }
    const cleanHex = teamColorHex.trim().startsWith('#')
      ? teamColorHex.trim()
      : `#${teamColorHex.trim()}`

    setIsCreatingTeam(true)
    setTeamCreateError('')
    setMyTeamSaveMsg('')
    try {
      await updateLeagueTeamInSupabase({
        teamId: selectedMyTeamId,
        name: teamName,
        colorHex: cleanHex,
        logoUrl: teamLogoDataUrl,
        driverIds: selectedTeamDriverIds,
      })

      const refreshed = await fetchLeagueTeamsWithRosters(selectedLeague.id)
      setLeagueTeams(refreshed)
      setIsEditingMyTeam(false)
      setMyTeamSaveMsg('Team updated & notifications sent!')
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      setTeamCreateError(
        err instanceof Error ? err.message : 'Failed to update team'
      )
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const handleOpenManageRacers = async () => {
    if (!selectedLeague) return
    setMemberSearchQuery('')
    setSelectedManagedRacer(null)
    setManageRacersStep('list')
    setManageTeamSearchQuery('')
    setManageRacerSuccessMsg('')
    setManageRacerErrorMsg('')
    setActiveView('manage-racers')
    setLoadingMembers(true)
    const [members, teams, events] = await Promise.all([
      fetchLeagueMembers(selectedLeague.id),
      fetchLeagueTeamsWithRosters(selectedLeague.id),
      fetchLeagueEventsInSupabase(selectedLeague.id),
    ])
    setLeagueMembers(members)
    setLeagueTeams(teams)
    setLeagueRaceEvents(events)
    setLoadingMembers(false)
  }

  const handleAssignRacerToTeam = async (teamId: string | null) => {
    if (!selectedLeague || !selectedManagedRacer) return
    setManageRacerActionLoading(true)
    setManageRacerErrorMsg('')
    setManageRacerSuccessMsg('')
    try {
      await assignRacerToTeamInSupabase(
        selectedLeague.id,
        selectedManagedRacer.driverId,
        teamId
      )
      const [members, teams] = await Promise.all([
        fetchLeagueMembers(selectedLeague.id),
        fetchLeagueTeamsWithRosters(selectedLeague.id),
      ])
      setLeagueMembers(members)
      setLeagueTeams(teams)
      const updatedRacer =
        members.find((m) => m.driverId === selectedManagedRacer.driverId) ||
        selectedManagedRacer
      setSelectedManagedRacer(updatedRacer)
      const assignedTeam = teams.find((t) => t.id === teamId)
      setManageRacerSuccessMsg(
        assignedTeam
          ? `Assigned to team ${assignedTeam.name}!`
          : 'Removed from team.'
      )
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      setManageRacerErrorMsg(
        err instanceof Error ? err.message : 'Failed to update team assignment'
      )
    } finally {
      setManageRacerActionLoading(false)
    }
  }

  const handleConfirmRemoveRacerFromLeague = async () => {
    if (!selectedLeague || !selectedManagedRacer) return
    setManageRacerActionLoading(true)
    setManageRacerErrorMsg('')
    setManageRacerSuccessMsg('')
    try {
      await removeRacerFromLeagueInSupabase(
        selectedLeague.id,
        selectedManagedRacer.driverId
      )
      const [members, teams] = await Promise.all([
        fetchLeagueMembers(selectedLeague.id),
        fetchLeagueTeamsWithRosters(selectedLeague.id),
      ])
      setLeagueMembers(members)
      setLeagueTeams(teams)
      setSelectedManagedRacer(null)
      setManageRacersStep('list')
    } catch (err: unknown) {
      setManageRacerErrorMsg(
        err instanceof Error ? err.message : 'Failed to remove racer from league'
      )
    } finally {
      setManageRacerActionLoading(false)
    }
  }

  const handleToggleRacerTag = async (tag: '#debitant' | '#heavyweight') => {
    if (!selectedLeague || !selectedManagedRacer) return
    setManageRacerActionLoading(true)
    setManageRacerErrorMsg('')
    setManageRacerSuccessMsg('')
    try {
      const updatedTags = await toggleDriverTagInSupabase(
        selectedLeague.id,
        selectedManagedRacer.driverId,
        tag
      )
      const updatedRacer: LeagueMemberItem = {
        ...selectedManagedRacer,
        tags: updatedTags,
      }
      setSelectedManagedRacer(updatedRacer)
      setLeagueMembers((prev) =>
        prev.map((m) =>
          m.driverId === updatedRacer.driverId ? updatedRacer : m
        )
      )
      setManageRacerSuccessMsg(
        updatedTags.includes(tag)
          ? `Added ${tag.toUpperCase()} tag!`
          : `Removed ${tag.toUpperCase()} tag.`
      )
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      setManageRacerErrorMsg(
        err instanceof Error ? err.message : 'Failed to toggle tag'
      )
    } finally {
      setManageRacerActionLoading(false)
    }
  }

  const handleConfirmAssignPenalty = async () => {
    if (!selectedLeague || !selectedManagedRacer) return
    const parsedSeconds = parseFloat(penaltySecondsInput)
    if (penaltyKind === 'TIME' && (Number.isNaN(parsedSeconds) || parsedSeconds <= 0)) {
      setManageRacerErrorMsg('Please enter valid penalty seconds (> 0)')
      return
    }

    setManageRacerActionLoading(true)
    setManageRacerErrorMsg('')
    setManageRacerSuccessMsg('')
    try {
      await assignDriverPenaltyInSupabase({
        leagueId: selectedLeague.id,
        targetDriverId: selectedManagedRacer.driverId,
        eventId: selectedPenaltyEvent ? selectedPenaltyEvent.id : null,
        kind: penaltyKind,
        seconds: penaltyKind === 'TIME' ? parsedSeconds : 0,
        reason: penaltyReasonInput.trim(),
        fallbackDate: customPenaltyRaceDate,
        fallbackName: customPenaltyRaceName.trim() || 'Race Event',
      })

      const refreshedEvents = await fetchLeagueEventsInSupabase(
        selectedLeague.id
      )
      setLeagueRaceEvents(refreshedEvents)
      setManageRacerSuccessMsg(
        penaltyKind === 'TIME'
          ? `Assigned +${parsedSeconds}s time penalty!`
          : 'Assigned Disqualification (DSQ — banned for next race)!'
      )
      fetchMyNotifications().then((loaded) => setNotifications(loaded))
    } catch (err: unknown) {
      setManageRacerErrorMsg(
        err instanceof Error ? err.message : 'Failed to assign penalty'
      )
    } finally {
      setManageRacerActionLoading(false)
    }
  }

  const handleOpenSettingAction = (actionTitle: string) => {
    if (actionTitle === 'MY TEAM') {
      handleOpenMyTeam()
      return
    }
    if (actionTitle === 'ASSIGN ROLES') {
      handleOpenAssignRoles()
      return
    }
    if (actionTitle === 'MANAGE RACERS') {
      handleOpenManageRacers()
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
              {/* 0. MY TEAM BUTTON — Located just above all settings of the league, visible to everyone */}
              <button
                type="button"
                onClick={handleOpenMyTeam}
                className="w-full bg-[#1C2228] hover:bg-[#242C35] border-2 border-[#FF6B00]/80 hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full h-12 px-5 flex items-center justify-center gap-2.5 shadow-lg shadow-[#FF6B00]/10 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-[#FF6B00]" />
                <span className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase">
                  MY TEAM
                </span>
              </button>

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

        {/* ================= 7B. MY TEAM SCREEN (Inspect & Edit Team) ================= */}
        {activeView === 'my-team' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="MY TEAM"
              onBack={() => {
                setIsEditingMyTeam(false)
                setActiveView('league-options')
              }}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col justify-between gap-4">
              {loadingTeams ? (
                <div className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-[#8A99AD]">
                  Loading team details...
                </div>
              ) : leagueTeams.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-[#14191E] border-2 border-[#2A323B] flex items-center justify-center text-[#8A99AD] mb-3">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h2 className="font-display font-extrabold text-xl tracking-wider text-white uppercase mb-1">
                    NO TEAMS CREATED YET
                  </h2>
                  <p className="text-xs text-[#8A99AD] max-w-xs mb-5">
                    No teams have been created in this league yet. Team Captains and Admins can create a team from League Settings.
                  </p>
                  {isEffectiveCaptainOrAbove && (
                    <button
                      type="button"
                      onClick={handleOpenCreateTeam}
                      className="px-6 py-2.5 rounded-full bg-[#FF6B00] hover:bg-[#ff7b1a] text-black font-display font-extrabold text-sm tracking-wider uppercase shadow-lg shadow-[#FF6B00]/20 transition cursor-pointer"
                    >
                      CREATE TEAM NOW
                    </button>
                  )}
                </div>
              ) : (
                (() => {
                  const activeTeam =
                    leagueTeams.find((t) => t.id === selectedMyTeamId) ||
                    leagueTeams[0]
                  const displayColor = isEditingMyTeam
                    ? teamColorHex
                    : activeTeam.colorHex || '#FF6B00'
                  const displayLogo = isEditingMyTeam
                    ? teamLogoDataUrl
                    : activeTeam.logoUrl

                  return (
                    <>
                      <div className="flex flex-col gap-3.5">
                        {/* Team Switcher Pills (if league has multiple teams) */}
                        {leagueTeams.length > 1 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {leagueTeams.map((t) => {
                              const isSelected = t.id === activeTeam.id
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleSelectTeamToInspect(t)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-display font-extrabold uppercase tracking-wider flex items-center gap-1.5 shrink-0 border transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#14191E] text-white border-[#FF6B00]'
                                      : 'bg-[#14191E]/50 text-[#8A99AD] border-[#2A323B] hover:text-white'
                                  }`}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: t.colorHex }}
                                  />
                                  <span>{t.name}</span>
                                  {t.isMyTeam && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#FF6B00] text-black font-extrabold">
                                      MY TEAM
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Team Identity Banner: Circular Logo + Team Name + Color + Edit Toggle */}
                        <div className="bg-[#14191E] border border-[#2A323B] rounded-2xl p-4 flex flex-col items-center text-center relative">
                          {isEffectiveCaptainOrAbove && !isEditingMyTeam && (
                            <button
                              type="button"
                              onClick={() => {
                                populateTeamEditFields(activeTeam)
                                setIsEditingMyTeam(true)
                                setMyTeamSaveMsg('')
                              }}
                              className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#FF6B00]/60 text-[#FF6B00] text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit Team
                            </button>
                          )}

                          {/* Team Circular Logo */}
                          <div
                            className="w-24 h-24 rounded-full bg-[#1C2228] flex items-center justify-center overflow-hidden shadow-xl mb-2.5 relative"
                            style={{
                              borderWidth: '3px',
                              borderStyle: 'solid',
                              borderColor: displayColor,
                            }}
                          >
                            {displayLogo ? (
                              <img
                                src={displayLogo}
                                alt={activeTeam.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Shield
                                className="w-11 h-11"
                                style={{ color: displayColor }}
                              />
                            )}
                          </div>

                          {!isEditingMyTeam ? (
                            <>
                              <h2 className="font-display font-extrabold text-2xl tracking-wider text-white uppercase">
                                {activeTeam.name}
                              </h2>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="w-3 h-3 rounded-full border border-white/40"
                                  style={{ backgroundColor: activeTeam.colorHex }}
                                />
                                <span className="text-[11px] font-mono font-bold text-[#8A99AD] uppercase">
                                  {activeTeam.colorHex}
                                </span>
                                <span className="text-[#2A323B]">•</span>
                                <span className="text-[11px] font-bold text-[#FF6B00] uppercase">
                                  {activeTeam.members.length}{' '}
                                  {activeTeam.members.length === 1
                                    ? 'Member'
                                    : 'Members'}
                                </span>
                              </div>
                            </>
                          ) : (
                            /* ADMIN / TEAM CAPTAIN EDIT CONTROLS */
                            <div className="w-full flex flex-col gap-2.5 mt-2">
                              {/* Upload / Adjust Logo Controls */}
                              <input
                                ref={teamLogoInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoFileSelected}
                                className="hidden"
                              />
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => teamLogoInputRef.current?.click()}
                                  className="px-3.5 py-1.5 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] text-xs font-extrabold uppercase tracking-wider text-[#FF6B00] flex items-center gap-1.5 cursor-pointer"
                                >
                                  <ImagePlus className="w-3.5 h-3.5" />
                                  {teamLogoDataUrl ? 'Change Logo' : 'Upload Logo'}
                                </button>
                                {teamLogoDataUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRawLogoForCrop(teamLogoDataUrl)
                                      setIsLogoCropModalOpen(true)
                                    }}
                                    className="px-3 py-1.5 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#38BDF8]/50 text-xs font-extrabold uppercase tracking-wider text-[#38BDF8] cursor-pointer"
                                  >
                                    Adjust Circle
                                  </button>
                                )}
                              </div>

                              {/* Edit Team Name */}
                              <div className="w-full bg-[#1C2228] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-10 px-4 flex items-center">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A99AD] mr-2 shrink-0">
                                  NAME:
                                </span>
                                <input
                                  type="text"
                                  value={teamName}
                                  onChange={(e) => setTeamName(e.target.value)}
                                  placeholder="TEAM NAME"
                                  className="w-full bg-transparent font-display font-extrabold text-base tracking-wider text-white uppercase focus:outline-none"
                                />
                              </div>

                              {/* Edit Team HEX Color */}
                              <div className="w-full bg-[#1C2228] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-10 px-4 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Palette className="w-3.5 h-3.5 text-[#FF6B00]" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A99AD]">
                                    HEX:
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  value={teamColorHex}
                                  maxLength={7}
                                  onChange={(e) => setTeamColorHex(e.target.value)}
                                  className="w-24 bg-[#14191E] border border-[#2A323B] rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-white uppercase text-center focus:outline-none focus:border-[#FF6B00]"
                                />
                                <label
                                  className="w-6 h-6 rounded-full border-2 border-white shadow cursor-pointer shrink-0 relative overflow-hidden"
                                  style={{ backgroundColor: teamColorHex || '#FF6B00' }}
                                >
                                  <input
                                    type="color"
                                    value={
                                      /^#[0-9A-Fa-f]{6}$/.test(teamColorHex)
                                        ? teamColorHex
                                        : '#FF6B00'
                                    }
                                    onChange={(e) =>
                                      setTeamColorHex(e.target.value.toUpperCase())
                                    }
                                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* TEAM MEMBERS ROSTER SECTION */}
                        <div className="bg-[#14191E]/80 border-2 border-[#2A323B] rounded-3xl p-3.5 flex flex-col">
                          <div className="flex items-center justify-between mb-2.5 px-1">
                            <span className="font-display font-extrabold text-sm tracking-widest text-[#FF6B00] uppercase">
                              TEAM MEMBERS
                            </span>
                            {isEffectiveCaptainOrAbove && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isEditingMyTeam) {
                                    populateTeamEditFields(activeTeam)
                                    setIsEditingMyTeam(true)
                                  }
                                  setTeamRacerSearchQuery('')
                                  setActiveView('my-team-manage-racers')
                                }}
                                className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#38BDF8]/50 text-[#38BDF8] flex items-center gap-1 cursor-pointer"
                              >
                                <UserPlus className="w-3 h-3" />
                                Add / Manage Racers
                              </button>
                            )}
                          </div>

                          {/* Member Rows */}
                          {(() => {
                            const displayedMembers = isEditingMyTeam
                              ? leagueMembers
                                  .filter((m) =>
                                    selectedTeamDriverIds.includes(m.driverId)
                                  )
                                  .map((m) => ({
                                    driverId: m.driverId,
                                    displayName: m.displayName,
                                    firstName: m.firstName,
                                    surname: m.surname,
                                    handle: m.handle,
                                    driverNumber: m.driverNumber,
                                    appRole: m.appRole,
                                  }))
                              : activeTeam.members

                            if (displayedMembers.length === 0) {
                              return (
                                <div className="py-6 text-center text-xs text-[#8A99AD]">
                                  No racers assigned to this team yet.
                                </div>
                              )
                            }

                            return (
                              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-0.5">
                                {displayedMembers.map((member, idx) => {
                                  const fullName =
                                    `${member.firstName} ${member.surname}`.trim() ||
                                    member.displayName ||
                                    member.handle
                                  const num = member.driverNumber || String(idx + 1)

                                  return (
                                    <div
                                      key={member.driverId}
                                      className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-11 px-4 flex items-center justify-between gap-2"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-display font-extrabold text-sm sm:text-base tracking-wider text-[#FF6B00] uppercase truncate">
                                          {fullName.toUpperCase()} - {num}
                                        </span>
                                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#14191E] border border-[#2A323B] text-[#8A99AD] shrink-0">
                                          {member.appRole}
                                        </span>
                                      </div>

                                      {/* Admin / Team Captain Kick / Remove Teammate Button */}
                                      {isEffectiveCaptainOrAbove && (
                                        <button
                                          type="button"
                                          disabled={isCreatingTeam}
                                          onClick={() => {
                                            if (isEditingMyTeam) {
                                              handleToggleTeamRacer(member.driverId)
                                            } else {
                                              handleKickTeamMemberDirect(
                                                activeTeam,
                                                member.driverId
                                              )
                                            }
                                          }}
                                          title="Kick / Remove from team"
                                          className="px-2.5 py-1 rounded-full bg-[#dc2626]/15 hover:bg-[#dc2626] text-red-400 hover:text-white border border-red-800/50 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition shrink-0 cursor-pointer disabled:opacity-50"
                                        >
                                          <UserMinus className="w-3 h-3" />
                                          <span>Kick</span>
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </div>

                        {myTeamSaveMsg && (
                          <div className="flex items-center gap-2 bg-[#38BDF8]/10 border border-[#38BDF8]/40 rounded-2xl p-2.5 text-xs text-[#38BDF8] font-semibold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{myTeamSaveMsg}</span>
                          </div>
                        )}

                        {teamCreateError && (
                          <p className="text-xs text-red-400 text-center font-semibold">
                            {teamCreateError}
                          </p>
                        )}
                      </div>

                      {/* Bottom Action Bar: Save/Cancel when editing + Delete Team for Admins & Captains */}
                      <div className="flex flex-col gap-2.5 pt-2">
                        {isEditingMyTeam && (
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingMyTeam(false)
                                setConfirmDeleteTeamId(null)
                                populateTeamEditFields(activeTeam)
                              }}
                              className="bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-red-500/60 active:scale-[0.98] transition-all rounded-2xl h-12 flex items-center justify-center cursor-pointer"
                            >
                              <span className="font-display font-extrabold text-base tracking-wider text-[#EF4444] uppercase">
                                CANCEL
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={isCreatingTeam}
                              onClick={handleSaveMyTeamChanges}
                              className="bg-[#FF6B00] hover:bg-[#ff7b1a] active:scale-[0.98] transition-all rounded-2xl h-12 flex items-center justify-center shadow-lg shadow-[#FF6B00]/20 cursor-pointer disabled:opacity-50"
                            >
                              <span className="font-display font-extrabold text-base tracking-wider text-black uppercase">
                                {isCreatingTeam ? 'SAVING...' : 'SAVE CHANGES'}
                              </span>
                            </button>
                          </div>
                        )}

                        {isEffectiveCaptainOrAbove && (
                          confirmDeleteTeamId === activeTeam.id ? (
                            <div className="bg-[#14191E] border border-red-500/60 rounded-2xl p-3 flex flex-col gap-2">
                              <p className="text-xs font-bold text-center text-red-400 uppercase tracking-wider">
                                Delete team "{activeTeam.name}" permanently?
                              </p>
                              <div className="grid grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTeamId(null)}
                                  className="h-10 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer"
                                >
                                  Keep Team
                                </button>
                                <button
                                  type="button"
                                  disabled={isCreatingTeam}
                                  onClick={() => handleDeleteTeam(activeTeam.id)}
                                  className="h-10 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-xs font-extrabold uppercase tracking-wider text-white flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {isCreatingTeam ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTeamId(activeTeam.id)}
                              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center gap-2 shadow-md cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-white" />
                              <span className="font-display font-extrabold text-base tracking-wider text-white uppercase">
                                DELETE TEAM
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </>
                  )
                })()
              )}
            </div>
          </div>
        )}

        {/* ================= 7C. MY TEAM — MANAGE RACERS PICKER ================= */}
        {activeView === 'my-team-manage-racers' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="EDIT TEAM ROSTER"
              onBack={() => setActiveView('my-team')}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col justify-between">
              <div className="flex flex-col flex-1">
                <h2 className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase text-center mb-1">
                  MANAGE TEAM RACERS
                </h2>
                <p className="text-[11px] text-[#8A99AD] text-center mb-3">
                  Tap members to add or kick them from{' '}
                  <strong className="text-white">{teamName || 'YOUR TEAM'}</strong>
                </p>

                <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-4 flex items-center gap-2 mb-3">
                  <Search className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <input
                    type="text"
                    value={teamRacerSearchQuery}
                    onChange={(e) => setTeamRacerSearchQuery(e.target.value)}
                    placeholder="SEARCH NAME - NUMBER"
                    className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-[#FF6B00] uppercase focus:outline-none pr-4"
                  />
                </div>

                <div className="flex-1 bg-[#14191E]/70 border-2 border-[#2A323B] rounded-3xl p-3 flex flex-col gap-2.5 overflow-y-auto max-h-80">
                  {filteredTeamRacers.length > 0 ? (
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
                              ? 'bg-[#FF6B00] text-black border-2 border-white shadow-md shadow-[#FF6B00]/20'
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
                onClick={() => setActiveView('my-team')}
                className="w-full mt-4 bg-[#FF6B00] hover:bg-[#ff7b1a] text-black font-display font-extrabold text-base tracking-wider uppercase h-12 rounded-full shadow-lg shadow-[#FF6B00]/20 transition cursor-pointer"
              >
                DONE ({selectedTeamDriverIds.length} IN TEAM)
              </button>
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

        {/* ================= 8B. MANAGE RACERS SCREEN (Team, Remove, #Tag, Penalty) ================= */}
        {activeView === 'manage-racers' && selectedLeague && (
          <div className="flex flex-col flex-1 w-full">
            <TrackDayHeader
              sectionTitle={selectedLeague.name}
              sectionSubtitle="SETTINGS"
              onBack={() => {
                setManageRacerSuccessMsg('')
                setManageRacerErrorMsg('')
                if (manageRacersStep === 'penalty-type') {
                  setManageRacersStep('penalty-races')
                } else if (
                  manageRacersStep === 'select-team' ||
                  manageRacersStep === 'remove-confirm' ||
                  manageRacersStep === 'tag' ||
                  manageRacersStep === 'penalty-races'
                ) {
                  setManageRacersStep('actions')
                } else if (manageRacersStep === 'actions') {
                  setSelectedManagedRacer(null)
                  setManageRacersStep('list')
                } else {
                  setActiveView('league-options')
                }
              }}
              onBellClick={handleOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />

            <div className="mx-5 flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col">
              <h2 className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase text-center mb-3">
                MANAGE RACERS
              </h2>

              {/* STEP 1: RACER LIST WITH SEARCH BAR */}
              {manageRacersStep === 'list' && (
                <>
                  <div className="w-full bg-[#14191E] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-4 flex items-center gap-2 mb-4 shadow-inner">
                    <Search className="w-4 h-4 text-[#FF6B00] shrink-0" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="SEARCH NAME - NUMBER"
                      className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-[#FF6B00] uppercase focus:outline-none pr-4"
                    />
                  </div>

                  <div className="flex-1 bg-[#14191E]/70 border-2 border-[#2A323B] rounded-3xl p-3.5 flex flex-col">
                    {loadingMembers ? (
                      <div className="flex-1 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-[#8A99AD]">
                        Loading league racers...
                      </div>
                    ) : filteredLeagueMembers.length > 0 ? (
                      <div className="flex flex-col gap-3 overflow-y-auto">
                        {filteredLeagueMembers.map((member, idx) => (
                          <button
                            key={member.driverId}
                            type="button"
                            onClick={() => {
                              setSelectedManagedRacer(member)
                              setManageRacersStep('actions')
                              setManageRacerSuccessMsg('')
                              setManageRacerErrorMsg('')
                            }}
                            className="w-full bg-[#1C2228] hover:bg-[#242C35] border border-[#2A323B] hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full min-h-[2.75rem] py-2 px-5 flex items-center justify-between gap-2 shadow-md cursor-pointer"
                          >
                            <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase truncate">
                              {formatMemberLabel(member, idx)}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {member.teamName && (
                                <span
                                  className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#14191E] border text-white flex items-center gap-1"
                                  style={{
                                    borderColor: member.teamColorHex || '#FF6B00',
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{
                                      backgroundColor:
                                        member.teamColorHex || '#FF6B00',
                                    }}
                                  />
                                  {member.teamName}
                                </span>
                              )}
                              {member.tags?.map((tg) => (
                                <span
                                  key={tg}
                                  className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8]"
                                >
                                  {tg}
                                </span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                        <p className="font-display font-extrabold text-base text-white uppercase tracking-wider mb-1">
                          NO RACERS MATCHING SEARCH
                        </p>
                        <p className="text-xs text-[#8A99AD]">
                          Try searching by driver name, handle, or driver number.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SELECTED RACER HEADER PILL (Shown on all sub-steps once a racer is clicked) */}
              {manageRacersStep !== 'list' && selectedManagedRacer && (
                <div className="flex flex-col flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedManagedRacer(null)
                      setManageRacersStep('list')
                      setManageRacerSuccessMsg('')
                      setManageRacerErrorMsg('')
                    }}
                    className="w-full bg-[#14191E] border border-[#FF6B00] rounded-full h-11 px-5 flex items-center justify-center relative mb-4 shadow-md cursor-pointer"
                  >
                    <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase truncate">
                      {formatMemberLabel(
                        selectedManagedRacer,
                        leagueMembers.findIndex(
                          (m) => m.driverId === selectedManagedRacer.driverId
                        )
                      )}
                    </span>
                  </button>

                  {/* Outer Sub-Step Container */}
                  <div className="flex-1 bg-[#14191E]/70 border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col justify-center">
                    {/* STEP 2: 4 MAIN ACTIONS (SELECT TEAM, REMOVE FROM LEAGUE, #TAG, ASSIGN PENALTY) */}
                    {manageRacersStep === 'actions' && (
                      <div className="bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setManageTeamSearchQuery('')
                            setManageRacerSuccessMsg('')
                            setManageRacerErrorMsg('')
                            setManageRacersStep('select-team')
                          }}
                          className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center cursor-pointer"
                        >
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            SELECT TEAM
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setManageRacerSuccessMsg('')
                            setManageRacerErrorMsg('')
                            setManageRacersStep('remove-confirm')
                          }}
                          className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-red-500 active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center cursor-pointer"
                        >
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            REMOVE FROM LEAGUE
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setManageRacerSuccessMsg('')
                            setManageRacerErrorMsg('')
                            setManageRacersStep('tag')
                          }}
                          className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-[#38BDF8] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center cursor-pointer"
                        >
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            #TAG
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setManageRacerSuccessMsg('')
                            setManageRacerErrorMsg('')
                            setSelectedPenaltyEvent(null)
                            setManageRacersStep('penalty-races')
                          }}
                          className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center cursor-pointer"
                        >
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            ASSIGN PENALTY
                          </span>
                        </button>
                      </div>
                    )}

                    {/* STEP 3A: SELECT TEAM (Search Team + Team Cards with Name, Logo, Racer Count) */}
                    {manageRacersStep === 'select-team' && (
                      <div className="flex flex-col flex-1">
                        <div className="w-full bg-[#1C2228] border border-[#2A323B] focus-within:border-[#FF6B00] rounded-full h-11 px-4 flex items-center gap-2 mb-3">
                          <Search className="w-4 h-4 text-[#FF6B00] shrink-0" />
                          <input
                            type="text"
                            value={manageTeamSearchQuery}
                            onChange={(e) =>
                              setManageTeamSearchQuery(e.target.value)
                            }
                            placeholder="SEARCH TEAM"
                            className="w-full bg-transparent text-center font-display font-extrabold text-base tracking-wider text-white placeholder-[#FF6B00] uppercase focus:outline-none pr-4"
                          />
                        </div>

                        <div className="flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-3.5 flex flex-col gap-2.5 overflow-y-auto max-h-80">
                          {(() => {
                            const q = manageTeamSearchQuery.trim().toLowerCase()
                            const matchingTeams = leagueTeams.filter(
                              (t) => !q || t.name.toLowerCase().includes(q)
                            )

                            if (matchingTeams.length === 0) {
                              return (
                                <div className="py-8 text-center text-xs text-[#8A99AD]">
                                  {leagueTeams.length === 0
                                    ? 'No teams have been created in this league yet.'
                                    : 'No teams match your search.'}
                                </div>
                              )
                            }

                            return matchingTeams.map((team) => {
                              const isCurrentTeam =
                                selectedManagedRacer.teamId === team.id ||
                                team.members.some(
                                  (m) =>
                                    m.driverId === selectedManagedRacer.driverId
                                )

                              return (
                                <button
                                  key={team.id}
                                  type="button"
                                  disabled={manageRacerActionLoading}
                                  onClick={() => handleAssignRacerToTeam(team.id)}
                                  className={`w-full rounded-2xl p-3 flex items-center justify-between gap-3 border transition-all cursor-pointer disabled:opacity-50 ${
                                    isCurrentTeam
                                      ? 'bg-[#FF6B00] text-black border-2 border-white shadow-lg shadow-[#FF6B00]/25'
                                      : 'bg-[#14191E] hover:bg-[#222930] text-white border-[#2A323B] hover:border-[#FF6B00]'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* Team Circular Logo */}
                                    <div
                                      className="w-11 h-11 rounded-full bg-[#1C2228] flex items-center justify-center overflow-hidden shrink-0"
                                      style={{
                                        borderWidth: '2px',
                                        borderStyle: 'solid',
                                        borderColor: isCurrentTeam
                                          ? '#000000'
                                          : team.colorHex || '#FF6B00',
                                      }}
                                    >
                                      {team.logoUrl ? (
                                        <img
                                          src={team.logoUrl}
                                          alt={team.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <Shield
                                          className="w-5 h-5"
                                          style={{
                                            color: team.colorHex || '#FF6B00',
                                          }}
                                        />
                                      )}
                                    </div>

                                    <div className="text-left min-w-0">
                                      <span
                                        className={`font-display font-extrabold text-lg tracking-wider uppercase block truncate ${
                                          isCurrentTeam
                                            ? 'text-black'
                                            : 'text-[#FF6B00]'
                                        }`}
                                      >
                                        {team.name}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold uppercase tracking-wider block ${
                                          isCurrentTeam
                                            ? 'text-black/80'
                                            : 'text-[#8A99AD]'
                                        }`}
                                      >
                                        {team.members.length}{' '}
                                        {team.members.length === 1
                                          ? 'RACER'
                                          : 'RACERS'}
                                      </span>
                                    </div>
                                  </div>

                                  {isCurrentTeam && (
                                    <Check className="w-5 h-5 text-black stroke-[3] shrink-0" />
                                  )}
                                </button>
                              )
                            })
                          })()}

                          {selectedManagedRacer.teamId && (
                            <button
                              type="button"
                              disabled={manageRacerActionLoading}
                              onClick={() => handleAssignRacerToTeam(null)}
                              className="w-full mt-1 py-2 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs font-extrabold uppercase tracking-wider transition cursor-pointer"
                            >
                              Remove from Current Team
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STEP 3B: REMOVE FROM LEAGUE CONFIRMATION */}
                    {manageRacersStep === 'remove-confirm' && (
                      <div className="flex flex-col flex-1 justify-center">
                        <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-11 px-5 flex items-center justify-center mb-4">
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            REMOVE FROM LEAGUE
                          </span>
                        </div>

                        <div className="bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-5 flex flex-col gap-3">
                          <p className="text-xs text-[#8A99AD] text-center mb-1">
                            Are you sure you want to remove{' '}
                            <strong className="text-white uppercase">
                              {selectedManagedRacer.displayName}
                            </strong>{' '}
                            from <strong className="text-[#FF6B00]">{selectedLeague.name}</strong>?
                          </p>

                          <button
                            type="button"
                            disabled={manageRacerActionLoading}
                            onClick={handleConfirmRemoveRacerFromLeague}
                            className="w-full bg-[#14191E] hover:bg-[#dc2626] text-[#FF6B00] hover:text-white border border-[#2A323B] hover:border-red-400 active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center cursor-pointer disabled:opacity-50"
                          >
                            <span className="font-display font-extrabold text-base tracking-wider uppercase">
                              {manageRacerActionLoading ? 'REMOVING...' : 'CONFIRM'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={manageRacerActionLoading}
                            onClick={() => setManageRacersStep('actions')}
                            className="w-full bg-[#14191E] hover:bg-[#222930] text-[#FF6B00] border border-[#2A323B] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center cursor-pointer"
                          >
                            <span className="font-display font-extrabold text-base tracking-wider uppercase">
                              CANCEL
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3C: #TAG (#debitant & #heavyweight) */}
                    {manageRacersStep === 'tag' && (
                      <div className="flex flex-col flex-1 justify-center">
                        <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-11 px-5 flex items-center justify-center mb-4">
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            #TAG
                          </span>
                        </div>

                        <div className="bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col gap-3">
                          {(
                            [
                              {
                                tag: '#debitant' as const,
                                label: '#DEBITANT',
                                desc: 'First-season newcomer — filterable in race performance',
                              },
                              {
                                tag: '#heavyweight' as const,
                                label: '#HEAVYWEIGHT',
                                desc: 'Heavyweight class — filterable to see fastest heavyweights',
                              },
                            ]
                          ).map((item) => {
                            const hasTag = Boolean(
                              selectedManagedRacer.tags?.includes(item.tag)
                            )
                            return (
                              <button
                                key={item.tag}
                                type="button"
                                disabled={manageRacerActionLoading}
                                onClick={() => handleToggleRacerTag(item.tag)}
                                className={`w-full rounded-2xl p-3.5 flex items-center justify-between gap-3 border transition-all cursor-pointer disabled:opacity-50 ${
                                  hasTag
                                    ? 'bg-[#FF6B00] text-black border-2 border-white shadow-lg shadow-[#FF6B00]/20'
                                    : 'bg-[#14191E] hover:bg-[#222930] text-[#FF6B00] border-[#2A323B] hover:border-[#FF6B00]'
                                }`}
                              >
                                <div className="text-left">
                                  <span className="font-display font-extrabold text-lg tracking-wider uppercase block">
                                    {item.label}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold block ${
                                      hasTag ? 'text-black/80' : 'text-[#8A99AD]'
                                    }`}
                                  >
                                    {item.desc}
                                  </span>
                                </div>
                                <span
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                                    hasTag
                                      ? 'bg-black border-black text-[#FF6B00]'
                                      : 'border-[#8A99AD]'
                                  }`}
                                >
                                  {hasTag && (
                                    <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                                  )}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* STEP 3D: ASSIGN PENALTY — STEP 1: PICK RACE (Date & Title) */}
                    {manageRacersStep === 'penalty-races' && (
                      <div className="flex flex-col flex-1">
                        <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-10 px-5 flex items-center justify-center mb-3">
                          <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                            ASSIGN PENALTY
                          </span>
                        </div>

                        <div className="flex-1 bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-3.5 flex flex-col gap-2.5">
                          <div className="w-full bg-[#14191E] border border-[#2A323B] rounded-full h-10 px-5 flex items-center justify-center">
                            <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                              RACES
                            </span>
                          </div>

                          {leagueRaceEvents.length > 0 ? (
                            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-56">
                              {leagueRaceEvents.map((ev) => {
                                const formattedDate = ev.eventDate
                                  ? ev.eventDate.split('-').reverse().join('.')
                                  : ev.eventDate
                                return (
                                  <button
                                    key={ev.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPenaltyEvent(ev)
                                      setPenaltyKind('TIME')
                                      setPenaltySecondsInput('5')
                                      setPenaltyReasonInput('')
                                      setManageRacerSuccessMsg('')
                                      setManageRacerErrorMsg('')
                                      setManageRacersStep('penalty-type')
                                    }}
                                    className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#2A323B] hover:border-[#FF6B00] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-between cursor-pointer"
                                  >
                                    <span className="font-display font-extrabold text-base tracking-wider text-[#FF6B00] uppercase">
                                      {formattedDate}
                                    </span>
                                    <span className="text-xs font-bold text-white uppercase truncate ml-2">
                                      {ev.name}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="py-2 text-center text-[11px] text-[#8A99AD]">
                              No races scheduled yet — pick or create a race date below to apply a penalty:
                            </div>
                          )}

                          {/* Quick Race Date Picker (works even before Schedule Race is used) */}
                          <div className="mt-auto pt-2 border-t border-[#2A323B] flex flex-col gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A99AD] text-center">
                              Or Select / Enter Race Date &amp; Title
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={customPenaltyRaceDate}
                                onChange={(e) =>
                                  setCustomPenaltyRaceDate(e.target.value)
                                }
                                className="bg-[#14191E] border border-[#2A323B] rounded-full h-9 px-3 text-xs font-bold text-[#FF6B00] focus:outline-none focus:border-[#FF6B00]"
                              />
                              <input
                                type="text"
                                value={customPenaltyRaceName}
                                onChange={(e) =>
                                  setCustomPenaltyRaceName(e.target.value)
                                }
                                placeholder="Race Title"
                                className="bg-[#14191E] border border-[#2A323B] rounded-full h-9 px-3 text-xs font-bold text-white uppercase focus:outline-none focus:border-[#FF6B00]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPenaltyEvent(null)
                                setPenaltyKind('TIME')
                                setPenaltySecondsInput('5')
                                setPenaltyReasonInput('')
                                setManageRacerSuccessMsg('')
                                setManageRacerErrorMsg('')
                                setManageRacersStep('penalty-type')
                              }}
                              className="w-full bg-[#14191E] hover:bg-[#222930] border border-[#FF6B00]/60 rounded-full h-10 px-4 flex items-center justify-center cursor-pointer"
                            >
                              <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase">
                                USE {customPenaltyRaceDate.split('-').reverse().join('.')} — {customPenaltyRaceName || 'RACE'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 3E: ASSIGN PENALTY — STEP 2: CHOOSE SECONDS OR DISQUALIFICATION */}
                    {manageRacersStep === 'penalty-type' && (
                      <div className="flex flex-col flex-1 justify-between gap-3">
                        <div className="flex flex-col gap-2.5">
                          <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-10 px-4 flex items-center justify-between">
                            <span className="font-display font-extrabold text-sm tracking-wider text-[#FF6B00] uppercase">
                              RACE:
                            </span>
                            <span className="font-display font-extrabold text-sm tracking-wider text-white uppercase truncate ml-2">
                              {selectedPenaltyEvent
                                ? `${selectedPenaltyEvent.eventDate
                                    .split('-')
                                    .reverse()
                                    .join('.')} — ${selectedPenaltyEvent.name}`
                                : `${customPenaltyRaceDate
                                    .split('-')
                                    .reverse()
                                    .join('.')} — ${customPenaltyRaceName}`}
                            </span>
                          </div>

                          {/* Penalty Kind Toggle: SECONDS vs DISQUALIFICATION */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setPenaltyKind('TIME')}
                              className={`rounded-2xl p-3 border flex flex-col items-center justify-center text-center transition cursor-pointer ${
                                penaltyKind === 'TIME'
                                  ? 'bg-[#FF6B00] text-black border-2 border-white shadow-lg shadow-[#FF6B00]/25'
                                  : 'bg-[#1C2228] text-[#FF6B00] border-[#2A323B] hover:border-[#FF6B00]'
                              }`}
                            >
                              <span className="font-display font-extrabold text-base tracking-wider uppercase">
                                + SECONDS
                              </span>
                              <span
                                className={`text-[10px] font-semibold mt-0.5 ${
                                  penaltyKind === 'TIME'
                                    ? 'text-black/80'
                                    : 'text-[#8A99AD]'
                                }`}
                              >
                                Adds time to drive &amp; adjusts position
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPenaltyKind('DSQ')}
                              className={`rounded-2xl p-3 border flex flex-col items-center justify-center text-center transition cursor-pointer ${
                                penaltyKind === 'DSQ'
                                  ? 'bg-[#dc2626] text-white border-2 border-white shadow-lg shadow-red-600/25'
                                  : 'bg-[#1C2228] text-red-400 border-[#2A323B] hover:border-red-500'
                              }`}
                            >
                              <span className="font-display font-extrabold text-base tracking-wider uppercase">
                                DISQUALIFICATION
                              </span>
                              <span
                                className={`text-[10px] font-semibold mt-0.5 ${
                                  penaltyKind === 'DSQ'
                                    ? 'text-white/90'
                                    : 'text-[#8A99AD]'
                                }`}
                              >
                                DSQ — cannot race in next event
                              </span>
                            </button>
                          </div>

                          {penaltyKind === 'TIME' ? (
                            <div className="bg-[#1C2228] border border-[#2A323B] rounded-2xl p-3 flex flex-col gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A99AD] text-center">
                                Select or Enter Extra Penalty Seconds
                              </span>
                              <div className="grid grid-cols-4 gap-2">
                                {['3', '5', '10', '15'].map((sec) => (
                                  <button
                                    key={sec}
                                    type="button"
                                    onClick={() => setPenaltySecondsInput(sec)}
                                    className={`h-9 rounded-full font-display font-extrabold text-sm tracking-wider uppercase border transition cursor-pointer ${
                                      penaltySecondsInput === sec
                                        ? 'bg-[#FF6B00] text-black border-white'
                                        : 'bg-[#14191E] text-[#FF6B00] border-[#2A323B]'
                                    }`}
                                  >
                                    +{sec}S
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold uppercase text-[#8A99AD] shrink-0">
                                  Custom Seconds:
                                </span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={penaltySecondsInput}
                                  onChange={(e) =>
                                    setPenaltySecondsInput(e.target.value)
                                  }
                                  className="w-full bg-[#14191E] border border-[#2A323B] rounded-full h-9 px-3 text-center font-display font-extrabold text-base text-white focus:outline-none focus:border-[#FF6B00]"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-3 text-center">
                              <p className="text-xs font-bold text-red-300 uppercase tracking-wide">
                                Disqualification (DSQ)
                              </p>
                              <p className="text-[11px] text-[#8A99AD] mt-1">
                                This driver will be disqualified from this race and flagged as unable to participate in the next race.
                              </p>
                            </div>
                          )}

                          <input
                            type="text"
                            value={penaltyReasonInput}
                            onChange={(e) => setPenaltyReasonInput(e.target.value)}
                            placeholder="Optional reason (e.g. Track limits / Contact)"
                            className="w-full bg-[#1C2228] border border-[#2A323B] rounded-full h-10 px-4 text-xs text-white placeholder-[#8A99AD] focus:outline-none focus:border-[#FF6B00]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setManageRacersStep('penalty-races')}
                            className="bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] rounded-full h-11 flex items-center justify-center cursor-pointer"
                          >
                            <span className="font-display font-extrabold text-base tracking-wider text-[#EF4444] uppercase">
                              CANCEL
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={manageRacerActionLoading}
                            onClick={handleConfirmAssignPenalty}
                            className="bg-[#FF6B00] hover:bg-[#ff7b1a] rounded-full h-11 flex items-center justify-center shadow-lg shadow-[#FF6B00]/20 cursor-pointer disabled:opacity-50"
                          >
                            <span className="font-display font-extrabold text-base tracking-wider text-black uppercase">
                              {manageRacerActionLoading ? 'APPLYING...' : 'CONFIRM'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Status & Error Alerts inside Manage Racers */}
                    {manageRacerSuccessMsg && (
                      <div className="mt-3 flex items-center gap-2 bg-[#38BDF8]/10 border border-[#38BDF8]/40 rounded-2xl p-2.5 text-xs text-[#38BDF8] font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{manageRacerSuccessMsg}</span>
                      </div>
                    )}

                    {manageRacerErrorMsg && (
                      <p className="mt-3 text-xs text-red-400 text-center font-semibold">
                        {manageRacerErrorMsg}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
